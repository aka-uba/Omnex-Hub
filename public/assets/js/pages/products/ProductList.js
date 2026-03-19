/**
 * Product List Page Component
 *
 * @package OmnexDisplayHub
 */

import { escapeHTML } from '../../core/SecurityUtils.js';
import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { getTemplateRenderer, shouldPreserveHelperObjectsForTemplate } from '../../services/TemplateRenderer.js?v=1.0.73';
import { MediaUtils } from '../../utils/MediaUtils.js';
import { ExportManager } from '../../utils/ExportManager.js';

export class ProductListPage {
    constructor(app) {
        this.app = app;
        this.table = null;
        this.selectedProducts = [];
        this.mappingDefaults = this.loadMappingDefaults();
        this.viewStateStorageKey = 'products_list_view_state_v1';
        this.viewState = this.loadViewState();
        this.sortCycleValues = {
            group: [],
            category: []
        };
        this.categoryCycleByGroup = {};
        this.sortCycleIndex = {
            group: -1,
            category: -1
        };
        this.sortAnchor = {
            group: '',
            category: ''
        };
        this._exportOutsideClickHandler = null;
    }

    _getRenderOptions(template) {
        return {
            preserveHelpers: shouldPreserveHelperObjectsForTemplate(template)
        };
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Get appropriate "no devices" message based on active scope (branch > region > company)
     * @param {string} baseKey - Base translation key (e.g., 'sendToDevice.noDevices')
     * @returns {string} Translated message with scope name
     */
    _getNoDevicesMessage(baseKey) {
        const activeBranch = this.app.state.get('activeBranch');
        const user = this.app.state.get('user');

        if (activeBranch) {
            // Check if it's a region or a branch/store
            if (activeBranch.type === 'region') {
                return this.__(`${baseKey}Region`, { regionName: activeBranch.name });
            } else {
                return this.__(`${baseKey}Branch`, { branchName: activeBranch.name });
            }
        }

        // Fallback to company
        const companyName = user?.company_name || 'Firma';
        return this.__(`${baseKey}Company`, { companyName });
    }

    /**
     * Render page
     */
    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('breadcrumb.products')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon blue">
                            <i class="ti ti-package"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('title')}</h1>
                            <p class="page-subtitle">${this.__('subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button class="btn btn-outline" id="btn-import">
                            <i class="ti ti-file-import"></i>
                            <span>${this.__('actions.import')}</span>
                        </button>
                        <div class="export-dropdown" id="export-dropdown">
                            <button class="btn btn-outline export-dropdown-btn" type="button">
                                <i class="ti ti-download"></i>
                                <span>${this.__('actions.export')}</span>
                                <i class="ti ti-chevron-down"></i>
                            </button>
                            <div class="export-dropdown-menu">
                                <button class="export-dropdown-item" data-export-type="excel">
                                    <i class="ti ti-file-spreadsheet" style="color: #217346"></i>
                                    <span>Excel (.xlsx)</span>
                                </button>
                                <button class="export-dropdown-item" data-export-type="csv">
                                    <i class="ti ti-file-text" style="color: #4CAF50"></i>
                                    <span>CSV</span>
                                </button>
                                <button class="export-dropdown-item" data-export-type="html">
                                    <i class="ti ti-file-code" style="color: #E44D26"></i>
                                    <span>HTML</span>
                                </button>
                                <button class="export-dropdown-item" data-export-type="json">
                                    <i class="ti ti-braces" style="color: #F7DF1E"></i>
                                    <span>JSON</span>
                                </button>
                                <button class="export-dropdown-item" data-export-type="md">
                                    <i class="ti ti-markdown" style="color: #083FA1"></i>
                                    <span>Markdown</span>
                                </button>
                                <button class="export-dropdown-item" data-export-type="txt">
                                    <i class="ti ti-file" style="color: #6c757d"></i>
                                    <span>Text (.txt)</span>
                                </button>
                                <div class="export-dropdown-divider"></div>
                                <button class="export-dropdown-item" data-export-type="print">
                                    <i class="ti ti-printer" style="color: #6366f1"></i>
                                    <span>${this.__('actions.print')}</span>
                                </button>
                            </div>
                        </div>
                        <button class="btn btn-primary" id="btn-add">
                            <i class="ti ti-plus"></i>
                            <span>${this.__('actions.add')}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stats Cards -->
            <div class="products-stats-grid">
                <div class="product-stat-card">
                    <div class="stat-card-icon blue">
                        <i class="ti ti-package"></i>
                    </div>
                    <div class="stat-card-info">
                        <span class="stat-card-value" id="stat-total-products">0</span>
                        <span class="stat-card-label">${this.__('stats.totalProducts')}</span>
                    </div>
                </div>
                <div class="product-stat-card">
                    <div class="stat-card-icon green">
                        <i class="ti ti-device-mobile-check"></i>
                    </div>
                    <div class="stat-card-info">
                        <span class="stat-card-value" id="stat-assigned-products">0</span>
                        <span class="stat-card-label">${this.__('stats.assignedProducts')}</span>
                    </div>
                </div>
                <div class="product-stat-card">
                    <div class="stat-card-icon orange">
                        <i class="ti ti-category"></i>
                    </div>
                    <div class="stat-card-info">
                        <span class="stat-card-value" id="stat-total-categories">0</span>
                        <span class="stat-card-label">${this.__('stats.totalCategories')}</span>
                    </div>
                </div>
                <div class="product-stat-card">
                    <div class="stat-card-icon purple">
                        <i class="ti ti-clock"></i>
                    </div>
                    <div class="stat-card-info">
                        <span class="stat-card-value" id="stat-last-sent">-</span>
                        <span class="stat-card-label">${this.__('stats.lastSent')}</span>
                    </div>
                </div>
            </div>

            <!-- Filters -->
            <div class="card mb-4">
                <div class="products-filter-bar">
                    <div class="filter-item">
                        <select class="form-select form-select-sm" id="filter-group">
                            <option value="">${this.__('filters.allGroups')}</option>
                        </select>
                    </div>
                    <div class="filter-item">
                        <select class="form-select form-select-sm" id="filter-category">
                            <option value="">${this.__('filters.allCategories')}</option>
                        </select>
                    </div>
                    <div class="filter-item">
                        <select class="form-select form-select-sm" id="filter-status">
                            <option value="">${this.__('filters.allStatus')}</option>
                            <option value="active">${this.__('status.active')}</option>
                            <option value="inactive">${this.__('status.inactive')}</option>
                        </select>
                    </div>
                    <div class="filter-item">
                        <select class="form-select form-select-sm" id="filter-label">
                            <option value="">${this.__('filters.allLabels')}</option>
                            <option value="assigned">${this.__('filters.labelAssigned')}</option>
                            <option value="unassigned">${this.__('filters.labelUnassigned')}</option>
                        </select>
                    </div>
                    <div class="filter-item">
                        <select class="form-select form-select-sm" id="filter-device">
                            <option value="">${this.__('filters.allDevices')}</option>
                            <option value="assigned">${this.__('filters.deviceAssigned')}</option>
                            <option value="unassigned">${this.__('filters.deviceUnassigned')}</option>
                        </select>
                    </div>
                    <button class="btn btn-sm btn-outline filter-clear" id="btn-clear-filters">
                        <i class="ti ti-x"></i>
                    </button>
                </div>
            </div>

            <!-- Products Table -->
            <div class="card card-table">
                <div class="card-body">
                    <div id="products-table"></div>
                </div>
            </div>
        `;
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('products');
    }

    /**
     * Initialize page
     */
    async init() {
        this.initTable();
        this.bindEvents();
        this.initImageHoverPreview();
        await this.loadFilters();
        this.applySavedViewState();
        await this.loadStats();
    }

    /**
     * Initialize data table
     */
    initTable() {
        const allowedSortKeys = new Set([
            'sku', 'name', 'barcode', 'group', 'category',
            'current_price', 'stock', 'status', 'updated_at',
            'assigned_device', 'assigned_template'
        ]);
        const savedSortBy = typeof this.viewState?.sortBy === 'string' ? this.viewState.sortBy : '';
        const savedSortDir = String(this.viewState?.sortDir || '').toUpperCase() === 'ASC' ? 'asc' : 'desc';
        const defaultSort = allowedSortKeys.has(savedSortBy)
            ? { key: savedSortBy, direction: savedSortDir }
            : { key: 'updated_at', direction: 'desc' };
        const pageSize = Number.parseInt(this.viewState?.pageSize, 10);
        this.table = new DataTable('#products-table', {
            pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 25,
            columns: [
                {
                    key: 'cover_image',
                    label: '',
                    width: '50px',
                    sortable: false,
                    render: (_, row) => this.renderCoverImage(row)
                },
                {
                    key: 'sku',
                    label: this.__('list.columns.sku'),
                    width: '120px'
                },
                {
                    key: 'name',
                    label: this.__('list.columns.name'),
                    render: (value, row) => `<a href="javascript:void(0)" class="product-name-link font-medium text-primary hover:text-primary-dark hover:underline" data-product-id="${row.id}">${escapeHTML(value)}</a>`
                },
                {
                    key: 'barcode',
                    label: this.__('list.columns.barcode'),
                    width: '140px',
                    render: (value) => value ? `<span class="text-gray-600 dark:text-gray-400">${escapeHTML(value)}</span>` : '-'
                },
                {
                    key: 'group',
                    label: this.__('list.columns.group'),
                    width: '120px',
                    render: (value) => value ? `<span class="badge bg-purple-100 text-purple-800">${escapeHTML(value)}</span>` : '-'
                },
                {
                    key: 'category',
                    label: this.__('list.columns.category'),
                    width: '150px'
                },
                {
                    key: 'current_price',
                    label: this.__('list.columns.price'),
                    width: '120px',
                    render: (value, row) => {
                        const current = this.formatCurrency(value);
                        if (row.previous_price && row.previous_price > value) {
                            const previous = this.formatCurrency(row.previous_price);
                            return `
                                <div>
                                    <span class="font-medium text-green-600">${current}</span>
                                    <span class="text-xs text-gray-400 line-through ml-1">${previous}</span>
                                </div>
                            `;
                        }
                        return `<span class="font-medium">${current}</span>`;
                    }
                },
                {
                    key: 'stock',
                    label: this.__('list.columns.stock'),
                    width: '80px',
                    render: (value) => {
                        const color = value > 10 ? 'green' : value > 0 ? 'yellow' : 'red';
                        return `<span class="badge bg-${color}-100 text-${color}-800">${value}</span>`;
                    }
                },
                {
                    key: 'status',
                    label: this.__('list.columns.status'),
                    width: '100px',
                    type: 'status'
                },
                {
                    key: 'assigned_device',
                    label: this.__('list.columns.assignedDevice'),
                    width: '140px',
                    sortable: true,
                    render: (_, row) => {
                        if (row.labels && row.labels.length > 0 && row.labels[0].device_name) {
                            const label = row.labels[0];
                            const deviceName = label.device_name;
                            const status = label.status;
                            const statusColor = status === 'synced' ? 'green' : 'yellow';

                            // Build tooltip with IP and location
                            const tooltipParts = [];
                            if (label.ip_address) {
                                tooltipParts.push(`IP: ${label.ip_address}`);
                            }
                            if (label.location) {
                                tooltipParts.push(`${this.__('list.deviceLocation')}: ${label.location}`);
                            }
                            const tooltip = tooltipParts.length > 0 ? tooltipParts.join(' | ') : deviceName;

                            return `<span class="badge bg-${statusColor}-100 text-${statusColor}-800 cursor-help" title="${escapeHTML(tooltip)}">
                                <i class="ti ti-device-desktop text-xs mr-1"></i>${escapeHTML(deviceName)}
                            </span>`;
                        }
                        return '<span class="text-gray-400">-</span>';
                    }
                },
                {
                    key: 'assigned_template',
                    label: this.__('list.columns.assignedTemplate'),
                    width: '140px',
                    sortable: true,
                    render: (_, row) => {
                        if (row.labels && row.labels.length > 0 && row.labels[0].template_name) {
                            const templateName = row.labels[0].template_name;
                            return `<span class="badge bg-blue-100 text-blue-800" title="${escapeHTML(templateName)}">
                                <i class="ti ti-layout text-xs mr-1"></i>${escapeHTML(templateName)}
                            </span>`;
                        }
                        return '<span class="text-gray-400">-</span>';
                    }
                },
                {
                    key: 'updated_at',
                    label: this.__('list.columns.updatedAt'),
                    width: '130px',
                    sortable: true,
                    render: (value) => {
                        if (!value) return '-';
                        const date = new Date(value);
                        return `<span class="text-sm text-gray-500" title="${date.toLocaleString('tr-TR')}">${this.formatRelativeTime(date)}</span>`;
                    }
                },
            ],
            actions: [
                {
                    name: 'send-to-device',
                    icon: 'ti-device-mobile-share',
                    label: this.__('list.actions.sendToDevice'),
                    class: 'btn-ghost text-purple',
                    onClick: (row) => this.handleSendToDevice(row)
                },
                {
                    name: 'assign-label',
                    icon: 'ti-tag',
                    label: this.__('list.actions.assignLabel'),
                    class: 'btn-ghost text-success',
                    visible: (row) => row.labels && row.labels.length > 0,
                    onClick: (row) => this.handleAssignLabel(row)
                },
                {
                    name: 'assign-label-new',
                    icon: 'ti-tags',
                    label: this.__('list.actions.assignLabel'),
                    class: 'btn-ghost text-brand',
                    visible: (row) => !row.labels || row.labels.length === 0,
                    onClick: (row) => this.handleAssignLabel(row)
                },
                {
                    name: 'generate-html',
                    icon: 'ti-code',
                    label: this.__('list.actions.generateHtml'),
                    class: 'btn-ghost text-cyan',
                    onClick: (row) => this.handleGenerateHtml(row)
                },
                {
                    name: 'duplicate',
                    icon: 'ti-copy',
                    label: this.__('list.actions.duplicate'),
                    class: 'btn-ghost text-brand',
                    onClick: (row) => this.duplicateProduct(row)
                },
                {
                    name: 'edit',
                    icon: 'ti-edit',
                    label: this.__('list.actions.edit'),
                    class: 'btn-ghost text-primary',
                    onClick: (row) => {
                        window.location.hash = `#/products/${row.id}/edit`;
                    }
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('list.actions.delete'),
                    class: 'btn-ghost text-danger',
                    onClick: (row) => this.deleteProduct(row.id)
                }
            ],
            serverSide: true,
            fetchData: (params) => this.fetchProducts(params),
            selectable: true,
            toolbar: {
                show: true,
                exports: true
            },
            exportFilename: 'urunler',
            exportTitle: this.__('export.listTitle'),
            exportSubtitle: this.__('subtitle'),
            defaultSort,
            onSortChange: (state) => this.handleSortCycle(state),
            onSelectionChange: (rows) => this.onSelectionChange(rows)
        });

        // Add bulk delete button to toolbar-actions
        this.addBulkDeleteButton();
    }

    /**
     * Add bulk action buttons to DataTable toolbar
     */
    addBulkDeleteButton() {
        const toolbarActions = document.querySelector('[data-table-toolbar-actions]');
        if (!toolbarActions) return;

        // Multi-product send button (always visible, no selection required)
        const multiSendBtn = document.createElement('button');
        multiSendBtn.id = 'btn-multi-product-send';
        multiSendBtn.className = 'btn btn-sm btn-success';
        multiSendBtn.innerHTML = `<i class="ti ti-layout-grid"></i> <span>${this.__('multiProductSend.buttonLabel')}</span>`;
        multiSendBtn.addEventListener('click', () => this.showMultiProductSendModal());
        toolbarActions.appendChild(multiSendBtn);

        // Bulk print labels button
        const printBtn = document.createElement('button');
        printBtn.id = 'btn-bulk-print';
        printBtn.className = 'btn btn-sm btn-info hidden';
        printBtn.innerHTML = `<i class="ti ti-printer"></i> <span>${this.__('actions.printBulkLabels')}</span>`;
        printBtn.addEventListener('click', () => this.showBulkPrintModal());
        toolbarActions.appendChild(printBtn);

        // Bulk HTML generate button
        const htmlBtn = document.createElement('button');
        htmlBtn.id = 'btn-bulk-html';
        htmlBtn.className = 'btn btn-sm btn-dark hidden';
        htmlBtn.innerHTML = `<i class="ti ti-code"></i> <span>${this.__('generateHtml.bulkButton')}</span>`;
        htmlBtn.addEventListener('click', () => this.bulkGenerateHtml());
        toolbarActions.appendChild(htmlBtn);

        // Bulk send button
        const sendBtn = document.createElement('button');
        sendBtn.id = 'btn-bulk-send';
        sendBtn.className = 'btn btn-sm btn-purple hidden';
        sendBtn.innerHTML = `<i class="ti ti-device-mobile-share"></i> <span>${this.__('actions.sendToDevice')}</span>`;
        sendBtn.addEventListener('click', () => this.bulkSendToDevice());
        toolbarActions.appendChild(sendBtn);

        // Bulk delete button
        const btn = document.createElement('button');
        btn.id = 'btn-bulk-delete';
        btn.className = 'btn btn-sm btn-danger hidden';
        btn.innerHTML = `<i class="ti ti-trash"></i> <span>${this.__('list.bulkDelete')}</span>`;
        btn.addEventListener('click', () => this.bulkDeleteProducts());
        toolbarActions.appendChild(btn);
    }

    /**
     * Fetch products from API
     */
    async fetchProducts(params) {
        try {
            const group = document.getElementById('filter-group')?.value;
            const category = document.getElementById('filter-category')?.value;
            const status = document.getElementById('filter-status')?.value;
            const hasLabel = document.getElementById('filter-label')?.value;
            const hasDevice = document.getElementById('filter-device')?.value;

            const requestParams = {
                ...params,
                group,
                category,
                status,
                has_label: hasLabel,
                has_device: hasDevice
            };

            if ((params?.sort_by === 'group' || params?.sort_by === 'category')) {
                const anchor = this.sortAnchor[params.sort_by];
                if (anchor) {
                    requestParams.sort_anchor = anchor;
                }
            }

            const response = await this.app.api.get('/products', {
                ...requestParams
            });

            return {
                data: response.data.products,
                total: response.data.pagination.total
            };

        } catch (error) {
            Logger.error('Error fetching products:', error);
            Toast.error(this.__('toast.loadError'));
            return { data: [], total: 0 };
        }
    }

    /**
     * Load filter options
     */
    async loadFilters() {
        try {
            // Load categories with hierarchy
            const catResponse = await this.app.api.get('/categories');
            const categories = catResponse.data || [];

            const select = document.getElementById('filter-category');

            // Build hierarchical tree and render options
            const categoryTree = this.buildCategoryTree(categories);
            this.renderCategoryFilterOptions(select, categoryTree, 0);

            // Load unique groups from products
            await this.loadGroupFilter();
            await this.loadCategoryCycleMap();

        } catch (error) {
            Logger.error('Error loading filters:', error);
        }
    }

    /**
     * Load unique groups for filter dropdown
     */
    async loadGroupFilter() {
        try {
            const response = await this.app.api.get('/products/groups');
            const groups = (response.data || [])
                .map((item) => item?.name)
                .filter(Boolean);
            this.sortCycleValues.group = [...groups];

            const select = document.getElementById('filter-group');
            if (!select) return;

            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group;
                option.textContent = group;
                select.appendChild(option);
            });
        } catch (error) {
            Logger.error('Error loading groups:', error);
        }
    }

    async loadCategoryCycleMap() {
        try {
            const response = await this.app.api.get('/products', {
                page: 1,
                limit: 5000,
                sort_by: 'category',
                sort_dir: 'ASC'
            });
            const products = response.data?.products || [];
            const byGroup = {};
            const all = new Set();

            products.forEach((p) => {
                const group = (p?.group || '').trim();
                const category = (p?.category || '').trim();
                if (!category) return;
                all.add(category);
                if (!group) return;
                if (!byGroup[group]) byGroup[group] = new Set();
                byGroup[group].add(category);
            });

            this.categoryCycleByGroup = Object.fromEntries(
                Object.entries(byGroup).map(([group, values]) => [group, Array.from(values).sort()])
            );
            this.sortCycleValues.category = Array.from(all).sort();
        } catch (error) {
            Logger.error('Error loading category cycle map:', error);
            this.categoryCycleByGroup = {};
        }
    }

    /**
     * Build category tree from flat list
     */
    buildCategoryTree(categories, parentId = null) {
        return categories
            .filter(cat => cat.parent_id === parentId)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(cat => ({
                ...cat,
                children: this.buildCategoryTree(categories, cat.id)
            }));
    }

    /**
     * Render hierarchical category options for filter
     */
    renderCategoryFilterOptions(select, categories, level) {
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;

            // Add visual indentation
            const prefix = level > 0 ? '─'.repeat(level) + ' ' : '';
            option.textContent = prefix + cat.name;

            select.appendChild(option);

            // Render children recursively
            if (cat.children && cat.children.length > 0) {
                this.renderCategoryFilterOptions(select, cat.children, level + 1);
            }
        });
    }

    handleSortCycle({ sortBy, sortDir, prevSortBy, prevSortDir }) {
        this.saveViewState();

        if (sortBy !== 'group' && sortBy !== 'category') {
            return;
        }

        if (sortBy === 'category' && this.sortCycleValues.category.length === 0) {
            const categoryOptions = Array.from(document.querySelectorAll('#filter-category option'))
                .map((opt) => (opt.value || '').trim())
                .filter(Boolean);
            this.sortCycleValues.category = [...new Set(categoryOptions)];
        }

        let values = this.sortCycleValues[sortBy] || [];
        if (sortBy === 'category') {
            const selectedGroup = document.getElementById('filter-group')?.value?.trim() || '';
            if (selectedGroup && Array.isArray(this.categoryCycleByGroup[selectedGroup]) && this.categoryCycleByGroup[selectedGroup].length > 0) {
                values = this.categoryCycleByGroup[selectedGroup];
            }
        }
        if (values.length === 0) {
            this.sortAnchor[sortBy] = '';
            return;
        }

        const changedColumn = prevSortBy !== sortBy;
        if (changedColumn) {
            this.sortCycleIndex[sortBy] = -1;
        }

        this.sortCycleIndex[sortBy] = (this.sortCycleIndex[sortBy] + 1) % values.length;
        this.sortAnchor[sortBy] = values[this.sortCycleIndex[sortBy]];
    }

    /**
     * Load statistics for products
     */
    async loadStats() {
        try {
            const response = await this.app.api.get('/products/stats');

            if (response.success && response.data) {
                const stats = response.data;

                document.getElementById('stat-total-products').textContent = stats.total_products || 0;
                document.getElementById('stat-assigned-products').textContent = stats.assigned_products || 0;
                document.getElementById('stat-total-categories').textContent = stats.total_categories || 0;

                if (stats.last_sent_at) {
                    document.getElementById('stat-last-sent').textContent = this.formatRelativeTime(new Date(stats.last_sent_at));
                } else {
                    document.getElementById('stat-last-sent').textContent = '-';
                }
            }
        } catch (error) {
            Logger.error('Error loading stats:', error);
        }
    }

    /**
     * Format relative time
     */
    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return this.__('time.justNow');
        if (minutes < 60) return `${minutes} ${this.__('time.minutesAgo')}`;
        if (hours < 24) return `${hours} ${this.__('time.hoursAgo')}`;
        if (days < 7) return `${days} ${this.__('time.daysAgo')}`;

        return date.toLocaleDateString('tr-TR');
    }

    /**
     * Bind events
     */
    bindEvents() {
        // Add product
        document.getElementById('btn-add')?.addEventListener('click', () => {
            window.location.hash = '#/products/new';
        });

        // Import
        document.getElementById('btn-import')?.addEventListener('click', () => {
            this.showImportModal();
        });

        // Export dropdown
        this.initExportDropdown();

        // Filter changes
        document.getElementById('filter-group')?.addEventListener('change', () => {
            this.table.state.page = 1;
            this.saveViewState();
            this.table.refresh();
        });

        document.getElementById('filter-category')?.addEventListener('change', () => {
            this.table.state.page = 1;
            this.saveViewState();
            this.table.refresh();
        });

        document.getElementById('filter-status')?.addEventListener('change', () => {
            this.table.state.page = 1;
            this.saveViewState();
            this.table.refresh();
        });

        document.getElementById('filter-label')?.addEventListener('change', () => {
            this.table.state.page = 1;
            this.saveViewState();
            this.table.refresh();
        });

        document.getElementById('filter-device')?.addEventListener('change', () => {
            this.table.state.page = 1;
            this.saveViewState();
            this.table.refresh();
        });

        // Clear filters
        document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
            document.getElementById('filter-group').value = '';
            document.getElementById('filter-category').value = '';
            document.getElementById('filter-status').value = '';
            document.getElementById('filter-label').value = '';
            document.getElementById('filter-device').value = '';
            this.table.state.page = 1;
            this.saveViewState();
            this.table.refresh();
        });

        // Product name click - view product
        document.getElementById('products-table')?.addEventListener('click', (e) => {
            const nameLink = e.target.closest('.product-name-link');
            if (nameLink) {
                e.preventDefault();
                e.stopPropagation();
                const productId = nameLink.dataset.productId;
                if (productId) {
                    this.viewProduct({ id: productId });
                }
            }
        });

    }

    loadViewState() {
        const defaults = {
            filters: {
                group: '',
                category: '',
                status: '',
                hasLabel: '',
                hasDevice: ''
            },
            sortBy: 'updated_at',
            sortDir: 'DESC',
            pageSize: 25
        };

        try {
            const raw = localStorage.getItem(this.viewStateStorageKey);
            if (!raw) return defaults;
            const parsed = JSON.parse(raw);
            return {
                ...defaults,
                ...parsed,
                filters: {
                    ...defaults.filters,
                    ...(parsed?.filters || {})
                }
            };
        } catch (error) {
            Logger.warn('Failed to load products view state:', error);
            return defaults;
        }
    }

    saveViewState() {
        const nextState = {
            filters: {
                group: document.getElementById('filter-group')?.value || '',
                category: document.getElementById('filter-category')?.value || '',
                status: document.getElementById('filter-status')?.value || '',
                hasLabel: document.getElementById('filter-label')?.value || '',
                hasDevice: document.getElementById('filter-device')?.value || ''
            },
            sortBy: this.table?.state?.sortBy || 'updated_at',
            sortDir: this.table?.state?.sortDir || 'DESC',
            pageSize: this.table?.state?.pageSize || 25
        };
        this.viewState = nextState;
        localStorage.setItem(this.viewStateStorageKey, JSON.stringify(nextState));
    }

    applySavedViewState() {
        const savedFilters = this.viewState?.filters || {};
        const setSelectIfExists = (id, value) => {
            if (!value) return false;
            const el = document.getElementById(id);
            if (!el) return false;
            const hasOption = Array.from(el.options || []).some((opt) => String(opt.value) === String(value));
            if (!hasOption) return false;
            el.value = value;
            return true;
        };

        const restored = [
            setSelectIfExists('filter-group', savedFilters.group),
            setSelectIfExists('filter-category', savedFilters.category),
            setSelectIfExists('filter-status', savedFilters.status),
            setSelectIfExists('filter-label', savedFilters.hasLabel),
            setSelectIfExists('filter-device', savedFilters.hasDevice)
        ].some(Boolean);

        if (restored && this.table) {
            this.table.state.page = 1;
            this.table.refresh();
        }
    }

    /**
     * Handle send to device action from DataTable actions
     */
    handleSendToDevice(row) {
        const productName = row.name || '';
        let assignedDeviceId = row.assigned_device_id || '';
        let assignedTemplateId = row.assigned_template_id || '';

        // Fallback to labels if assigned_device/template is empty
        if ((!assignedDeviceId || !assignedTemplateId) && row.labels && row.labels.length > 0) {
            assignedDeviceId = assignedDeviceId || row.labels[0].device_id || '';
            assignedTemplateId = assignedTemplateId || row.labels[0].template_id || '';
        }

        this.showSendToDeviceModal([row.id], productName, assignedDeviceId, assignedTemplateId);
    }

    /**
     * Handle assign label action from DataTable actions
     */
    handleAssignLabel(row) {
        const productName = row.name || '';
        const labels = row.labels || [];
        this.showAssignLabelModal(row.id, productName, labels);
    }

    /**
     * View product
     */
    viewProduct(row) {
        window.location.hash = `#/products/${row.id}`;
    }

    /**
     * Delete product
     */
    async deleteProduct(id) {
        Modal.confirm({
            title: this.__('deleteProduct'),
            message: this.__('deleteConfirm'),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/products/${id}`);
                    Toast.success(this.__('toast.deleted'));
                    this.table.refresh();
                } catch (error) {
                    Toast.error(error.message || this.__('toast.deleteError'));
                }
            }
        });
    }

    /**
     * Duplicate product
     */
    /**
     * Generate HTML from Fabric.js template for a product
     * Opens modal to select template, then creates HTML via API
     */
    async handleGenerateHtml(row) {
        try {
            // Load ALL templates (not just signage/tv)
            const templateRes = await this.app.api.get('/templates?per_page=200');
            const templates = templateRes.data || [];

            if (!templates.length) {
                Toast.warning(this.__('generateHtml.noTemplates'));
                return;
            }

            const templateOptions = templates.map(t => {
                const size = t.width && t.height ? ` (${t.width}×${t.height})` : '';
                const typeLabel = t.type ? ` [${t.type.toUpperCase()}]` : '';
                return `<option value="${t.id}">${escapeHTML(t.name)}${size}${typeLabel}</option>`;
            }).join('');

            const basePath = window.OmnexConfig?.basePath || '';
            const livePreviewLabel = this.__('sendToDevice.liveHtmlPreview') || 'Canlı HTML Önizleme';
            const productId = row.id;

            Modal.show({
                title: this.__('generateHtml.title'),
                icon: 'ti-code',
                size: 'md',
                content: `
                    <form id="generate-html-form">
                        <div class="form-group">
                            <label class="form-label form-label-required">${this.__('generateHtml.selectTemplate')}</label>
                            <select id="html-template-select" class="form-select">
                                <option value="">${this.__('generateHtml.selectTemplatePlaceholder')}</option>
                                ${templateOptions}
                            </select>
                        </div>
                        <div id="html-gen-preview" class="template-preview-card mt-3" style="display:none;">
                            <div class="template-preview-content">
                                <div class="template-preview-image template-preview-live">
                                    <iframe id="html-gen-preview-iframe"
                                            sandbox="allow-scripts"
                                            style="width:100%;height:100%;border:none;pointer-events:none;"
                                            loading="lazy"></iframe>
                                    <div class="live-preview-badge">
                                        <i class="ti ti-broadcast"></i> ${livePreviewLabel}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-group mt-3">
                            <label class="form-label">${this.__('generateHtml.customName')} (${this.__('form.optional')})</label>
                            <input type="text" id="html-template-name" class="form-input"
                                placeholder="${this.__('generateHtml.namePlaceholder')}">
                        </div>
                        <div class="alert alert-info mt-3">
                            <i class="ti ti-info-circle"></i>
                            <span>${this.__('generateHtml.info')}</span>
                        </div>
                    </form>
                `,
                confirmText: this.__('generateHtml.generate'),
                cancelText: this.__('modal.cancel'),
                onConfirm: async () => {
                    const templateId = document.getElementById('html-template-select')?.value;
                    const customName = document.getElementById('html-template-name')?.value?.trim();

                    if (!templateId) {
                        Toast.error(this.__('generateHtml.templateRequired'));
                        return false; // prevent close
                    }

                    try {
                        Toast.info(this.__('generateHtml.generating'));

                        const response = await this.app.api.post('/web-templates/generate-from-fabric', {
                            template_id: templateId,
                            product_ids: [row.id],
                            name: customName || ''
                        });

                        if (response.success) {
                            const msg = response.data?.is_update
                                ? this.__('generateHtml.updated')
                                : this.__('generateHtml.success');
                            Toast.success(msg);
                        } else {
                            Toast.error(response.message || this.__('generateHtml.failed'));
                            return false;
                        }
                    } catch (error) {
                        Toast.error(error.message || this.__('generateHtml.failed'));
                        return false;
                    }
                }
            });

            // Şablon değişince önizleme güncelle
            setTimeout(() => {
                const selectEl = document.getElementById('html-template-select');
                if (selectEl) {
                    selectEl.addEventListener('change', () => {
                        const previewCard = document.getElementById('html-gen-preview');
                        const iframe = document.getElementById('html-gen-preview-iframe');
                        const tid = selectEl.value;
                        if (tid && previewCard && iframe) {
                            iframe.src = `${basePath}/api/templates/${tid}/preview-html?product_id=${productId}`;
                            previewCard.style.display = '';
                            // Adjust preview height based on template aspect ratio
                            const tpl = templates.find(t => String(t.id) === String(tid));
                            if (tpl) {
                                const w = parseInt(tpl.width) || 800;
                                const h = parseInt(tpl.height) || 600;
                                const previewImg = previewCard.querySelector('.template-preview-image');
                                if (previewImg) {
                                    const containerWidth = previewImg.offsetWidth || 400;
                                    const aspectHeight = Math.round(containerWidth * (h / w));
                                    previewImg.style.height = Math.min(Math.max(aspectHeight, 200), 380) + 'px';
                                }
                            }
                        } else if (previewCard) {
                            previewCard.style.display = 'none';
                        }
                    });
                }
            }, 50);
        } catch (error) {
            Logger.error('Generate HTML templates load error:', error);
            Toast.error(error.message || this.__('generateHtml.failed'));
        }
    }

    async bulkGenerateHtml() {
        if (!this.selectedProducts || this.selectedProducts.length === 0) {
            Toast.warning(this.__('list.selectWarning'));
            return;
        }

        try {
            // Load ALL templates (not just signage/tv)
            const templateRes = await this.app.api.get('/templates?per_page=200');
            const templates = templateRes.data || [];

            if (!templates.length) {
                Toast.warning(this.__('generateHtml.noTemplates'));
                return;
            }

            const count = this.selectedProducts.length;
            const templateOptions = templates.map(t => {
                const size = t.width && t.height ? ` (${t.width}×${t.height})` : '';
                const typeLabel = t.type ? ` [${t.type.toUpperCase()}]` : '';
                return `<option value="${t.id}">${escapeHTML(t.name)}${size}${typeLabel}</option>`;
            }).join('');

            const basePath = window.OmnexConfig?.basePath || '';
            const livePreviewLabel = this.__('sendToDevice.liveHtmlPreview') || 'Canlı HTML Önizleme';
            const firstProductId = this.selectedProducts[0]?.id;

            Modal.show({
                title: this.__('generateHtml.bulkTitle', { count }),
                icon: 'ti-code',
                size: 'md',
                content: `
                    <form id="bulk-generate-html-form">
                        <div class="alert alert-info mb-3">
                            <i class="ti ti-info-circle"></i>
                            <span>${this.__('generateHtml.bulkInfo', { count })}</span>
                        </div>
                        <div class="form-group">
                            <label class="form-label form-label-required">${this.__('generateHtml.selectTemplate')}</label>
                            <select id="bulk-html-template-select" class="form-select">
                                <option value="">${this.__('generateHtml.selectTemplatePlaceholder')}</option>
                                ${templateOptions}
                            </select>
                        </div>
                        <div id="bulk-html-gen-preview" class="template-preview-card mt-3" style="display:none;">
                            <div class="template-preview-content">
                                <div class="template-preview-image template-preview-live">
                                    <iframe id="bulk-html-gen-preview-iframe"
                                            sandbox="allow-scripts"
                                            style="width:100%;height:100%;border:none;pointer-events:none;"
                                            loading="lazy"></iframe>
                                    <div class="live-preview-badge">
                                        <i class="ti ti-broadcast"></i> ${livePreviewLabel}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-group mt-3">
                            <div class="form-check">
                                <input type="checkbox" id="bulk-html-separate" class="form-check-input" checked>
                                <label for="bulk-html-separate" class="form-check-label">${this.__('generateHtml.separatePerProduct')}</label>
                            </div>
                        </div>
                    </form>
                `,
                confirmText: this.__('generateHtml.generate'),
                cancelText: this.__('modal.cancel'),
                onConfirm: async () => {
                    const templateId = document.getElementById('bulk-html-template-select')?.value;
                    const separate = document.getElementById('bulk-html-separate')?.checked;

                    if (!templateId) {
                        Toast.error(this.__('generateHtml.templateRequired'));
                        return false;
                    }

                    try {
                        Toast.info(this.__('generateHtml.bulkGenerating', { count }));

                        if (separate) {
                            // Her ürün için ayrı HTML oluştur
                            let successCount = 0;
                            let failCount = 0;

                            for (const product of this.selectedProducts) {
                                try {
                                    const resp = await this.app.api.post('/web-templates/generate-from-fabric', {
                                        template_id: templateId,
                                        product_ids: [product.id]
                                    });
                                    if (resp.success) successCount++;
                                    else failCount++;
                                } catch {
                                    failCount++;
                                }
                            }

                            if (successCount > 0) {
                                Toast.success(this.__('generateHtml.bulkSuccess', { count: successCount }));
                            }
                            if (failCount > 0) {
                                Toast.warning(this.__('generateHtml.bulkPartialFail', { failed: failCount }));
                            }
                        } else {
                            // Tüm ürünleri tek HTML'de birleştir
                            const productIds = this.selectedProducts.map(p => p.id);
                            const response = await this.app.api.post('/web-templates/generate-from-fabric', {
                                template_id: templateId,
                                product_ids: productIds
                            });

                            if (response.success) {
                                const msg = response.data?.is_update
                                    ? this.__('generateHtml.updated')
                                    : this.__('generateHtml.success');
                                Toast.success(msg);
                            } else {
                                Toast.error(response.message || this.__('generateHtml.failed'));
                                return false;
                            }
                        }
                    } catch (error) {
                        Toast.error(error.message || this.__('generateHtml.failed'));
                        return false;
                    }
                }
            });

            // Şablon değişince önizleme güncelle (ilk ürün ile)
            setTimeout(() => {
                const selectEl = document.getElementById('bulk-html-template-select');
                if (selectEl) {
                    selectEl.addEventListener('change', () => {
                        const previewCard = document.getElementById('bulk-html-gen-preview');
                        const iframe = document.getElementById('bulk-html-gen-preview-iframe');
                        const tid = selectEl.value;
                        if (tid && previewCard && iframe && firstProductId) {
                            iframe.src = `${basePath}/api/templates/${tid}/preview-html?product_id=${firstProductId}`;
                            previewCard.style.display = '';
                            // Adjust preview height based on template aspect ratio
                            const tpl = templates.find(t => String(t.id) === String(tid));
                            if (tpl) {
                                const w = parseInt(tpl.width) || 800;
                                const h = parseInt(tpl.height) || 600;
                                const previewImg = previewCard.querySelector('.template-preview-image');
                                if (previewImg) {
                                    const containerWidth = previewImg.offsetWidth || 400;
                                    const aspectHeight = Math.round(containerWidth * (h / w));
                                    previewImg.style.height = Math.min(Math.max(aspectHeight, 200), 380) + 'px';
                                }
                            }
                        } else if (previewCard) {
                            previewCard.style.display = 'none';
                        }
                    });
                }
            }, 50);
        } catch (error) {
            Logger.error('Bulk generate HTML error:', error);
            Toast.error(error.message || this.__('generateHtml.failed'));
        }
    }

    async duplicateProduct(row) {
        try {
            const response = await this.app.api.get(`/products/${row.id}`);
            if (!response.success) {
                Toast.error(this.__('toast.loadError'));
                return;
            }

            const p = response.data;
            const createResponse = await this.app.api.post('/products', {
                name: `${p.name} (${this.__('detail.duplicate.copySuffix') || 'Kopya'})`,
                sku: `${p.sku}-COPY-${Date.now()}`,
                barcode: p.barcode || '',
                current_price: p.current_price || 0,
                previous_price: p.previous_price || null,
                category: p.category || '',
                subcategory: p.subcategory || '',
                group: p.group || '',
                unit: p.unit || '',
                brand: p.brand || '',
                origin: p.origin || '',
                production_type: p.production_type || '',
                description: p.description || '',
                weight: p.weight || '',
                stock: p.stock || '',
                shelf_location: p.shelf_location || '',
                supplier_code: p.supplier_code || '',
                vat_rate: p.vat_rate || '',
                discount_percent: p.discount_percent || '',
                campaign_text: p.campaign_text || '',
                image_url: p.image_url || '',
                images: Array.isArray(p.images) ? JSON.stringify(p.images) : (p.images || '[]'),
                videos: Array.isArray(p.videos) ? JSON.stringify(p.videos) : (p.videos || '[]'),
                video_url: p.video_url || '',
                status: 'inactive'
            });

            if (createResponse.success) {
                Toast.success(this.__('messages.duplicated') || this.__('detail.duplicate.success'));
                this.table.refresh();
            } else {
                Toast.error(createResponse.message || this.__('toast.saveError'));
            }
        } catch (error) {
            Logger.error('Duplicate product failed:', error);
            Toast.error(error.message || this.__('toast.saveError'));
        }
    }

    /**
     * Show assign label modal for a product
     * @param {string} productId - Product ID
     * @param {string} productName - Product name
     * @param {Array} existingLabels - Existing label assignments from row data
     */
    async showAssignLabelModal(productId, productName, existingLabels = []) {
        try {
            // Fetch devices and templates in parallel
            const [devicesRes, templatesRes] = await Promise.all([
                this.app.api.get('/devices?status=online'),
                this.app.api.get('/templates?status=active')
            ]);

            const devices = devicesRes.data?.devices || devicesRes.data || [];
            const allTemplates = templatesRes.data?.templates || templatesRes.data || [];
            // Filter out TV/signage templates - ESL labels are typically ≤1280px wide
            const templates = allTemplates.filter(t => {
                const w = parseInt(t.width) || 0;
                const h = parseInt(t.height) || 0;
                // Exclude wide landscape templates (TV/signage: 1920x1080, 1280x720 etc.)
                if (w >= 1280 && h <= 800 && w > h) return false;
                return true;
            });
            const currentLabels = existingLabels || [];

            // Check if editing existing assignment
            const hasExistingLabels = currentLabels.length > 0;
            const firstLabel = hasExistingLabels ? currentLabels[0] : null;
            const modalTitle = hasExistingLabels
                ? this.__('assignLabel.titleEditWithProduct', { name: escapeHTML(productName) })
                : this.__('assignLabel.titleWithProduct', { name: escapeHTML(productName) });
            const buttonText = hasExistingLabels ? this.__('assignLabel.update') : this.__('assignLabel.assign');
            const buttonIcon = hasExistingLabels ? 'ti-refresh' : 'ti-check';

            // Render current labels with edit/remove buttons
            const currentLabelsHtml = currentLabels.length > 0 ? `
                <div class="mb-4">
                    <label class="form-label">${this.__('assignLabel.currentAssignments', { count: currentLabels.length })}</label>
                    <div class="space-y-2">
                        ${currentLabels.map(l => `
                            <div class="label-item-box">
                                <div class="flex items-center gap-2">
                                    <i class="ti ti-device-tablet text-muted"></i>
                                    <span class="text-sm font-medium">${escapeHTML(l.device_name || this.__('assignLabel.deviceColumn'))}</span>
                                    <span class="text-xs text-muted">→</span>
                                    <span class="text-xs text-primary">${escapeHTML(l.template_name || this.__('assignLabel.templateColumn'))}</span>
                                </div>
                                <div class="flex items-center gap-1">
                                    <button type="button" class="btn btn-icon btn-sm btn-ghost text-primary"
                                            onclick="window.productListPage?.editLabelAssignment('${l.device_id}', '${l.template_id}')"
                                            title="${this.__('assignLabel.editAssignment')}">
                                        <i class="ti ti-edit"></i>
                                    </button>
                                    <button type="button" class="btn btn-icon btn-sm btn-ghost text-danger"
                                            onclick="window.productListPage?.removeProductLabel('${productId}', '${l.id}')"
                                            title="${this.__('assignLabel.removeAssignment')}">
                                        <i class="ti ti-trash"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <hr class="my-4 border-gray-200 dark:border-gray-700">
                <p class="text-sm text-gray-500 mb-4">
                    <i class="ti ti-info-circle"></i>
                    ${this.__('assignLabel.newAssignmentHint')}
                </p>
            ` : '';

            Modal.show({
                title: modalTitle,
                icon: hasExistingLabels ? 'ti-edit' : 'ti-tags',
                size: 'md',
                content: `
                    <form id="assign-label-form">
                        ${currentLabelsHtml}

                        ${devices.length === 0 ? `
                            <div class="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 rounded-lg p-3 text-sm mb-4">
                                <i class="ti ti-alert-triangle mr-2"></i>
                                ${this._getNoDevicesMessage('assignLabel.noDevices')}
                            </div>
                        ` : ''}
                        <div class="form-group">
                            <label class="form-label">${this.__('assignLabel.selectDevice')}</label>
                            <select class="form-select" id="assign-device" required ${devices.length === 0 ? 'disabled' : ''}>
                                <option value="">${this.__('assignLabel.placeholders.device')}</option>
                                ${devices.map(d => `
                                    <option value="${d.id}" ${firstLabel && firstLabel.device_id === d.id ? 'selected' : ''}>
                                        ${escapeHTML(d.name)} (${escapeHTML(d.ip_address || d.serial_number || 'N/A')})
                                    </option>
                                `).join('')}
                            </select>
                            <p class="form-hint">${this.__('assignLabel.devicesFound', { count: devices.length })}</p>
                        </div>

                        <div class="form-group">
                            <label class="form-label">${this.__('assignLabel.selectTemplate')}</label>
                            <select class="form-select" id="assign-template" required>
                                <option value="">${this.__('assignLabel.placeholders.template')}</option>
                                ${templates.map(t => `
                                    <option value="${t.id}" ${firstLabel && firstLabel.template_id === t.id ? 'selected' : ''}>
                                        ${escapeHTML(t.name)}
                                    </option>
                                `).join('')}
                            </select>
                            <p class="form-hint">${this.__('assignLabel.templatesFound', { count: templates.length })}</p>
                        </div>

                        <div class="form-group">
                            <label class="form-label"><i class="ti ti-eye"></i> ${this.__('sendToDevice.templatePreview')}</label>
                            <div class="template-preview-card assign-label-preview" id="assign-template-preview-card">
                                ${firstLabel && firstLabel.template_id ? this._renderTemplatePreview({ id: firstLabel.template_id, name: firstLabel.template_name || '' }, productId) : `
                                    <div class="template-preview-empty">
                                        <i class="ti ti-layout"></i>
                                        <span>${this.__('sendToDevice.selectTemplateToPreview')}</span>
                                    </div>
                                `}
                            </div>
                        </div>
                    </form>
                `,
                footer: `
                    <button class="btn btn-outline" data-modal-close>${this.__('actions.cancel')}</button>
                    <button class="btn btn-primary" id="btn-assign-label">
                        <i class="ti ${buttonIcon}"></i>
                        ${buttonText}
                    </button>
                `,
                showFooter: true
            });

            // Bind submit event
            document.getElementById('btn-assign-label')?.addEventListener('click', () => {
                this.assignLabel(productId, hasExistingLabels);
            });

            // Bind template change for live preview
            const assignTemplateSelect = document.getElementById('assign-template');
            if (assignTemplateSelect) {
                assignTemplateSelect.addEventListener('change', (e) => {
                    const previewCard = document.getElementById('assign-template-preview-card');
                    if (!previewCard) return;
                    const selectedId = e.target.value;
                    if (selectedId) {
                        const selectedTemplate = templates.find(t => t.id === selectedId);
                        previewCard.innerHTML = this._renderTemplatePreview(
                            { id: selectedId, name: selectedTemplate?.name || '' },
                            productId
                        );
                    } else {
                        previewCard.innerHTML = `
                            <div class="template-preview-empty">
                                <i class="ti ti-layout"></i>
                                <span>${this.__('sendToDevice.selectTemplateToPreview')}</span>
                            </div>
                        `;
                    }
                });
            }

            // Store reference for removeProductLabel and editLabelAssignment
            window.productListPage = this;

        } catch (error) {
            Logger.error('Error loading assign label modal:', error);
            Toast.error(this.__('assignLabel.toast.loadFailed'));
        }
    }

    /**
     * Edit label assignment - sets the dropdown values
     */
    editLabelAssignment(deviceId, templateId) {
        const deviceSelect = document.getElementById('assign-device');
        const templateSelect = document.getElementById('assign-template');

        if (deviceSelect) deviceSelect.value = deviceId;
        if (templateSelect) templateSelect.value = templateId;

        // Scroll to form if needed
        const form = document.getElementById('assign-label-form');
        if (form) {
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * Assign label to product
     */
    async assignLabel(productId, isUpdate = false, force = false) {
        const deviceId = document.getElementById('assign-device')?.value;
        const templateId = document.getElementById('assign-template')?.value;

        if (!deviceId || !templateId) {
            Toast.warning(this.__('assignLabel.toast.selectRequired'));
            return;
        }

        const btn = document.getElementById('btn-assign-label');
        const loadingText = isUpdate ? this.__('assignLabel.updating') : this.__('assignLabel.assigning');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader-2 animate-spin"></i> ${loadingText}`;
        }

        try {
            await this.app.api.post(`/products/${productId}/assign-label`, {
                device_id: deviceId,
                template_id: templateId,
                force: force
            });

            const successText = isUpdate ? this.__('assignLabel.toast.updated') : this.__('assignLabel.toast.assigned');
            Toast.success(successText);
            Modal.closeAll();
            this.table.refresh(); // Refresh table to update icon state

        } catch (error) {
            Logger.error('Error assigning label:', error);

            // Check if this is a conflict error (device already assigned to another product)
            const errorData = error?.data || {};
            if (errorData.conflict && errorData.existing_product) {
                // Show conflict confirmation modal
                this.showDeviceConflictModal(productId, isUpdate, errorData);
                return;
            }

            Toast.error(error.message || this.__('assignLabel.toast.assignFailed'));
            if (btn) {
                btn.disabled = false;
                const btnIcon = isUpdate ? 'ti-refresh' : 'ti-check';
                const btnText = isUpdate ? this.__('assignLabel.update') : this.__('assignLabel.assign');
                btn.innerHTML = `<i class="ti ${btnIcon}"></i> ${btnText}`;
            }
        }
    }

    /**
     * Show device conflict confirmation modal
     */
    showDeviceConflictModal(productId, isUpdate, conflictData) {
        const existingProduct = conflictData.existing_product;
        const device = conflictData.device;

        // Reset the assign button state
        const btn = document.getElementById('btn-assign-label');
        if (btn) {
            btn.disabled = false;
            const btnIcon = isUpdate ? 'ti-refresh' : 'ti-check';
            const btnText = isUpdate ? this.__('assignLabel.update') : this.__('assignLabel.assign');
            btn.innerHTML = `<i class="ti ${btnIcon}"></i> ${btnText}`;
        }

        // Use Modal.show instead of Modal.confirm to allow HTML content
        Modal.show({
            title: this.__('assignLabel.conflict.title'),
            icon: 'ti-alert-triangle',
            size: 'md',
            content: `
                <div class="space-y-4">
                    <p class="text-gray-600 dark:text-gray-400">${this.__('assignLabel.conflict.message')}</p>

                    <div class="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div class="flex items-center gap-3 mb-2">
                            <i class="ti ti-device-tablet text-amber-600 text-xl"></i>
                            <span class="font-semibold text-amber-800 dark:text-amber-200">${escapeHTML(device.name)}</span>
                        </div>
                        <div class="text-sm text-amber-700 dark:text-amber-300">
                            ${this.__('assignLabel.conflict.currentlyAssignedTo')}:
                        </div>
                        <div class="mt-2 p-3 bg-white dark:bg-gray-800 rounded border border-amber-200 dark:border-amber-700">
                            <div class="font-medium">${escapeHTML(existingProduct.name)}</div>
                            ${existingProduct.sku ? `<div class="text-xs text-gray-500">SKU: ${escapeHTML(existingProduct.sku)}</div>` : ''}
                            ${existingProduct.template_name ? `<div class="text-xs text-gray-500">${this.__('assignLabel.templateColumn')}: ${escapeHTML(existingProduct.template_name)}</div>` : ''}
                        </div>
                    </div>

                    <div class="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <i class="ti ti-info-circle text-blue-600 mt-0.5"></i>
                        <p class="text-sm text-blue-700 dark:text-blue-300">
                            ${this.__('assignLabel.conflict.hint')}
                        </p>
                    </div>
                </div>
            `,
            confirmText: this.__('assignLabel.conflict.reassign'),
            cancelText: this.__('actions.cancel'),
            confirmClass: 'btn-primary',
            onConfirm: async () => {
                // Retry with force=true
                await this.assignLabel(productId, isUpdate, true);
            }
        });
    }

    /**
     * Remove label assignment from product
     */
    async removeProductLabel(productId, labelId) {
        Modal.confirm({
            title: this.__('assignLabel.removeConfirm.title'),
            message: this.__('assignLabel.removeConfirm.message'),
            type: 'warning',
            confirmText: this.__('assignLabel.removeConfirm.confirm'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/products/${productId}/labels/${labelId}`);
                    Toast.success(this.__('assignLabel.toast.removed'));
                    Modal.closeAll();
                    // Refresh table after modal close with small delay for DOM update
                    setTimeout(() => {
                        this.table?.refresh();
                    }, 100);
                } catch (error) {
                    Logger.error('Error removing label:', error);
                    Toast.error(error.message || this.__('assignLabel.toast.removeFailed'));
                }
            }
        });
    }

    /**
     * Show import modal
     */
    showImportModal() {
        Modal.show({
            title: this.__('import.title'),
            size: 'xl',
            content: `
                <div class="space-y-4">
                    <div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center"
                         id="import-dropzone">
                        <i class="ti ti-cloud-upload text-4xl text-gray-400 mb-2"></i>
                        <p class="text-gray-600 dark:text-gray-400 mb-2">
                            ${this.__('import.dragDrop')}
                        </p>
                        <label class="btn btn-primary cursor-pointer">
                            <i class="ti ti-upload"></i>
                            ${this.__('import.selectFile')}
                            <input type="file" class="hidden" id="import-file"
                                   accept=".txt,.csv,.json,.xml,.xlsx,.xls" />
                        </label>
                        <p class="text-xs text-gray-500 mt-2">
                            ${this.__('import.hint')}
                        </p>
                    </div>

                    <div class="hidden" id="import-preview">
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center gap-3">
                                <i class="ti ti-file text-2xl text-primary-600"></i>
                                <div>
                                    <p class="font-medium" id="import-filename"></p>
                                    <p class="text-sm text-gray-500" id="import-fileinfo"></p>
                                </div>
                            </div>
                            <button class="btn btn-sm btn-ghost" id="import-remove">
                                <i class="ti ti-x"></i>
                            </button>
                        </div>

                        <!-- Manual Mapping Section -->
                        <div class="mb-4" id="manual-mapping-section">
                            <h4 class="font-medium mb-3 flex items-center gap-2">
                                <i class="ti ti-arrows-exchange text-primary-600"></i>
                                ${this.__('import.mapping')}
                            </h4>
                            <label class="flex items-center gap-2 mb-3">
                                <input type="checkbox" id="remember-mapping-defaults" class="form-checkbox" ${this.mappingDefaults.remember ? 'checked' : ''}>
                                <span class="text-sm">${this.__('import.rememberMapping')}</span>
                            </label>
                            <div class="grid grid-cols-3 gap-3 overflow-y-auto p-2" style="max-height: 450px;" id="manual-mapping-grid">
                                <!-- Will be populated dynamically -->
                            </div>
                        </div>

                        <div class="label-info-box">
                            <div style="flex: 1;">
                                <h4 class="font-medium mb-2">${this.__('import.preview')}</h4>
                                <div class="overflow-x-auto" id="import-preview-table"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-outline" data-modal-close>${this.__('modal.cancel')}</button>
                <button class="btn btn-primary" id="btn-start-import" disabled>
                    <i class="ti ti-upload"></i>
                    ${this.__('actions.import')}
                </button>
            `,
            showFooter: true
        });

        this.initImportModal();
    }

    /**
     * Initialize import modal
     */
    initImportModal() {
        const fileInput = document.getElementById('import-file');
        const dropzone = document.getElementById('import-dropzone');
        const preview = document.getElementById('import-preview');
        const startBtn = document.getElementById('btn-start-import');
        const removeBtn = document.getElementById('import-remove');

        let selectedFile = null;

        // File select
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.handleImportFile(e.target.files[0]);
            }
        });

        // Drag and drop
        dropzone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('border-primary-500', 'bg-primary-50');
        });

        dropzone?.addEventListener('dragleave', () => {
            dropzone.classList.remove('border-primary-500', 'bg-primary-50');
        });

        dropzone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-primary-500', 'bg-primary-50');
            if (e.dataTransfer.files[0]) {
                this.handleImportFile(e.dataTransfer.files[0]);
            }
        });

        // Remove file
        removeBtn?.addEventListener('click', () => {
            selectedFile = null;
            dropzone.classList.remove('hidden');
            preview.classList.add('hidden');
            startBtn.disabled = true;
            fileInput.value = '';
            this.importFile = null;
            this.importPreviewData = null;
        });

        document.getElementById('remember-mapping-defaults')?.addEventListener('change', (e) => {
            const remember = e.target.checked;
            if (remember) {
                this.saveMappingDefaults(this.collectManualMappings());
            } else {
                this.clearMappingDefaults();
            }
        });

        // Start import
        startBtn?.addEventListener('click', () => this.startImport());
    }

    /**
     * Handle import file
     */
    async handleImportFile(file) {
        const dropzone = document.getElementById('import-dropzone');
        const preview = document.getElementById('import-preview');
        const startBtn = document.getElementById('btn-start-import');

        // Show preview
        dropzone.classList.add('hidden');
        preview.classList.remove('hidden');

        document.getElementById('import-filename').textContent = file.name;
        document.getElementById('import-fileinfo').textContent =
            `${(file.size / 1024).toFixed(1)} KB`;

        // Get preview from API
        try {
            // Api.upload expects File object directly, not FormData
            const response = await this.app.api.upload('/products/import/preview', file);

            if (response.data.sample_data?.length > 0) {
                this.renderImportPreview(response.data);
                this.renderManualMappingGrid(response.data);
                startBtn.disabled = false;
                startBtn.dataset.file = file.name;

                // Store file and preview data for import
                this.importFile = file;
                this.importPreviewData = response.data;
            } else {
                Toast.warning(this.__('import.noDataInFile'));
            }

        } catch (error) {
            Logger.error('Import preview failed', error);
            Toast.error(this.__('import.previewFailed') + ': ' + error.message);
        }
    }

    /**
     * Render manual mapping grid
     */
    renderManualMappingGrid(data) {
        const container = document.getElementById('manual-mapping-grid');
        if (!container) return;

        // Get detected source fields from sample data
        const sourceFields = data.detected_fields || [];

        // Target fields (database columns) - All product fields
        const targetFields = [
            // Temel Bilgiler
            { key: 'sku', label: this.__('import.fields.sku'), required: true },
            { key: 'name', label: this.__('import.fields.name'), required: true },
            { key: 'barcode', label: this.__('import.fields.barcode') },
            { key: 'slug', label: this.__('import.fields.slug') },
            { key: 'kunye_no', label: this.__('import.fields.kunyeNo') },
            { key: 'category', label: this.__('import.fields.category') },
            { key: 'subcategory', label: this.__('import.fields.subcategory') },
            { key: 'brand', label: this.__('import.fields.brand') },
            { key: 'origin', label: this.__('import.fields.origin') },
            { key: 'production_type', label: this.__('import.fields.productionType') },
            { key: 'description', label: this.__('import.fields.description') },

            // Fiyat Bilgileri
            { key: 'current_price', label: this.__('import.fields.currentPrice'), required: true },
            { key: 'previous_price', label: this.__('import.fields.previousPrice') },
            { key: 'price_valid_until', label: this.__('import.fields.priceValidUntil') },
            { key: 'price_updated_at', label: this.__('import.fields.priceUpdatedAt') },
            { key: 'previous_price_updated_at', label: this.__('import.fields.previousPriceUpdatedAt') },
            { key: 'vat_rate', label: this.__('import.fields.vatRate') },
            { key: 'discount_percent', label: this.__('import.fields.discountPercent') },
            { key: 'campaign_text', label: this.__('import.fields.campaignText') },

            // Stok ve Ölçü Bilgileri
            { key: 'unit', label: this.__('import.fields.unit') },
            { key: 'stock', label: this.__('import.fields.stock') },
            { key: 'weight', label: this.__('import.fields.weight') },
            { key: 'shelf_location', label: this.__('import.fields.shelfLocation') },
            { key: 'supplier_code', label: this.__('import.fields.supplierCode') },

            // Geçerlilik
            { key: 'valid_from', label: this.__('import.fields.validFrom') },
            { key: 'valid_until', label: this.__('import.fields.validUntil') },

            // Durum
            { key: 'status', label: this.__('import.fields.status') },
            { key: 'is_featured', label: this.__('import.fields.isFeatured') },

            // Görsel ve Medya
            { key: 'image_url', label: this.__('import.fields.imageUrl') },
            { key: 'images', label: this.__('import.fields.images') },
            { key: 'videos', label: this.__('import.fields.videos') },
            { key: 'video_url', label: this.__('import.fields.videoUrl') },

            // Depolama ve Grup
            { key: 'storage_info', label: this.__('import.fields.storageInfo') },
            { key: 'group', label: this.__('import.fields.group') },

            // ERP Entegrasyonu
            { key: 'erp_id', label: this.__('import.fields.erpId') }
        ];

        const manualDefaults = this.applyMappingDefaults(sourceFields);

        container.innerHTML = targetFields.map(field => {
            const autoValue = manualDefaults[field.key] || '';
            const isRequired = field.required ? '<span class="text-red-500">*</span>' : '';

            return `
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                        ${field.label} ${isRequired}
                    </label>
                    <select class="form-select form-select-sm manual-mapping-select"
                            data-target="${field.key}">
                        <option value="">${this.__('import.noMapping')}</option>
                        ${sourceFields.map(sf => `
                            <option value="${escapeHTML(sf)}" ${sf === autoValue ? 'selected' : ''}>
                                ${escapeHTML(sf)}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.manual-mapping-select').forEach(select => {
            select.addEventListener('change', () => {
                this.persistMappingDefaultsIfEnabled();
            });
        });
    }

    /**
     * Collect manual mappings from UI
     */
    collectManualMappings() {
        const mappings = {};
        document.querySelectorAll('.manual-mapping-select').forEach(select => {
            const target = select.dataset.target;
            const source = select.value;
            if (source) {
                mappings[target] = source;
            }
        });
        return mappings;
    }

    loadMappingDefaults() {
        const defaults = { remember: false, mappings: {} };
        try {
            const raw = localStorage.getItem('product_import_mapping_defaults');
            if (!raw) return defaults;
            const parsed = JSON.parse(raw);
            return {
                remember: !!parsed.remember,
                mappings: parsed.mappings && typeof parsed.mappings === 'object' ? parsed.mappings : {}
            };
        } catch (error) {
            Logger.warn('Failed to load mapping defaults:', error);
            return defaults;
        }
    }

    saveMappingDefaults(mappings) {
        const cleaned = Object.fromEntries(
            Object.entries(mappings || {}).filter(([, value]) => value)
        );
        this.mappingDefaults = { remember: true, mappings: cleaned };
        localStorage.setItem('product_import_mapping_defaults', JSON.stringify(this.mappingDefaults));
    }

    clearMappingDefaults() {
        this.mappingDefaults = { remember: false, mappings: {} };
        localStorage.removeItem('product_import_mapping_defaults');
    }

    applyMappingDefaults(sourceFields) {
        if (!this.mappingDefaults?.remember) return {};
        const fieldSet = new Set(sourceFields || []);
        const mapped = {};
        Object.entries(this.mappingDefaults.mappings || {}).forEach(([target, source]) => {
            if (source && fieldSet.has(source)) {
                mapped[target] = source;
            }
        });
        return mapped;
    }

    persistMappingDefaultsIfEnabled() {
        const remember = document.getElementById('remember-mapping-defaults')?.checked ?? false;
        if (remember) {
            this.saveMappingDefaults(this.collectManualMappings());
        }
    }

    /**
     * Render import preview
     */
    renderImportPreview(data) {
        const container = document.getElementById('import-preview-table');

        const rows = data.mapped_data?.slice(0, 5) || [];
        const fields = ['sku', 'name', 'current_price', 'category'];

        container.innerHTML = `
            <table class="text-sm w-full">
                <thead>
                    <tr class="text-left border-b">
                        ${fields.map(f => `<th class="pb-2 pr-4">${f}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr class="border-b border-gray-100">
                            ${fields.map(f => `
                                <td class="py-2 pr-4 truncate max-w-[150px]">${escapeHTML(row[f] || '-')}</td>
                            `).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <p class="text-xs text-gray-500 mt-2">
                ${this.__('import.totalRows', { count: data.total_rows, format: data.detected_format?.toUpperCase() })}
            </p>
        `;
    }

    /**
     * Start import
     */
    async startImport() {
        if (!this.importFile) return;

        const btn = document.getElementById('btn-start-import');
        btn.disabled = true;
        btn.innerHTML = `<i class="ti ti-loader-2 animate-spin"></i> ${this.__('import.importing')}`;

        try {
            // Build upload data
            const uploadData = {
                mapping: 'default'
            };

            const manualMappings = this.collectManualMappings();

            // Validate required fields
            if (!manualMappings.sku || !manualMappings.name || !manualMappings.current_price) {
                Toast.error(this.__('import.requiredFields'));
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-upload"></i> ${this.__('actions.import')}`;
                return;
            }

            uploadData.manual_mappings = JSON.stringify(manualMappings);

            // Pass file directly, upload() will create FormData
            const response = await this.app.api.upload('/products/import', this.importFile, uploadData);

            Modal.closeAll();

            const summary = response.data?.summary || response.data || {};
            const failed = summary.failed || 0;

            if (summary.inserted > 0 || summary.updated > 0) {
                let message = this.__('import.results.summary', {
                    inserted: summary.inserted || 0,
                    updated: summary.updated || 0
                });
                if (failed > 0) {
                    message += ` (${failed} ${this.__('import.results.failed').toLowerCase()})`;
                }
                Toast.success(message);
            } else if (failed > 0) {
                Toast.warning(this.__('import.rowsFailed', { count: failed }));
            } else {
                Toast.info(this.__('import.noNewData'));
            }

            this.table.refresh();

        } catch (error) {
            Logger.error('Import failed', error);
            Toast.error(this.__('import.failed') + ': ' + error.message);
            btn.disabled = false;
            btn.innerHTML = `<i class="ti ti-upload"></i> ${this.__('actions.import')}`;
        }
    }

    /**
     * Initialize export dropdown
     */
    initExportDropdown() {
        const container = document.getElementById('export-dropdown');
        if (!container) return;

        const btn = container.querySelector('.export-dropdown-btn');
        const menu = container.querySelector('.export-dropdown-menu');

        // Toggle menu
        btn?.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
            container.classList.toggle('open');
        });

        // Close on outside click
        if (this._exportOutsideClickHandler) {
            document.removeEventListener('click', this._exportOutsideClickHandler);
        }
        this._exportOutsideClickHandler = () => {
            menu?.classList.remove('show');
            container?.classList.remove('open');
        };
        document.addEventListener('click', this._exportOutsideClickHandler);

        // Export item click
        container.querySelectorAll('.export-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.exportType;
                menu.classList.remove('show');
                container.classList.remove('open');
                this.exportProducts(type);
            });
        });
    }

    /**
     * Export products
     * @param {string} type - Export type (excel, csv, html, json, md, txt, print)
     */
    async exportProducts(type = 'csv') {
        try {
            Toast.info(this.__('export.preparing'));

            // Fetch all products for export
            const response = await this.app.api.get('/products', {
                page: 1,
                per_page: 10000 // Get all products
            });

            const products = response.data.products || [];

            if (products.length === 0) {
                Toast.warning(this.__('messages.noData'));
                return;
            }

            // Define export columns
            const columns = [
                { key: 'sku', label: this.__('export.columns.sku') },
                { key: 'name', label: this.__('export.columns.name') },
                { key: 'barcode', label: this.__('export.columns.barcode') },
                { key: 'category', label: this.__('export.columns.category') },
                {
                    key: 'current_price',
                    label: this.__('export.columns.price'),
                    exportRender: (val) => this.app.i18n.formatPrice(val)
                },
                {
                    key: 'previous_price',
                    label: this.__('export.columns.previousPrice'),
                    exportRender: (val) => this.app.i18n.formatPrice(val)
                },
                { key: 'stock', label: this.__('export.columns.stock') },
                { key: 'unit', label: this.__('export.columns.unit') },
                {
                    key: 'status',
                    label: this.__('export.columns.status'),
                    badge: {
                        'active': { type: 'success', label: this.__('export.columns.statusActive'), icon: 'ti ti-check' },
                        'inactive': { type: 'warning', label: this.__('export.columns.statusInactive'), icon: 'ti ti-x' }
                    }
                },
                {
                    key: 'updated_at',
                    label: this.__('export.columns.updatedAt'),
                    exportRender: (val) => val ? new Date(val).toLocaleString(this.app.i18n.locale) : '-'
                }
            ];

            // Create export manager
            const exporter = new ExportManager({
                filename: 'urunler',
                title: this.__('export.listTitle'),
                subtitle: this.__('export.totalCount', { count: products.length }),
                author: 'Omnex Display Hub'
            });

            // Execute export
            await exporter.export(type, products, columns);

            if (type !== 'print') {
                Toast.success(this.__('export.success'));
            }

        } catch (error) {
            Logger.error('Export error:', error);
            Toast.error(this.__('export.failed') + ': ' + error.message);
        }
    }

    /**
     * Handle selection change
     */
    onSelectionChange(rows) {
        this.selectedProducts = rows;
        const bulkDeleteBtn = document.getElementById('btn-bulk-delete');
        const bulkSendBtn = document.getElementById('btn-bulk-send');
        const bulkPrintBtn = document.getElementById('btn-bulk-print');
        const bulkHtmlBtn = document.getElementById('btn-bulk-html');

        if (rows.length > 0) {
            bulkDeleteBtn?.classList.remove('hidden');
            bulkSendBtn?.classList.remove('hidden');
            bulkPrintBtn?.classList.remove('hidden');
            bulkHtmlBtn?.classList.remove('hidden');
        } else {
            bulkDeleteBtn?.classList.add('hidden');
            bulkSendBtn?.classList.add('hidden');
            bulkPrintBtn?.classList.add('hidden');
            bulkHtmlBtn?.classList.add('hidden');
        }

        Logger.log('Selected:', rows.length, 'products');
    }

    /**
     * Bulk delete products - uses single delete API for each product
     */
    async bulkDeleteProducts() {
        if (!this.selectedProducts || this.selectedProducts.length === 0) {
            Toast.warning(this.__('list.selectWarning'));
            return;
        }

        const count = this.selectedProducts.length;
        const ids = this.selectedProducts.map(p => p.id);

        Modal.confirm({
            title: this.__('list.bulkDeleteTitle'),
            message: this.__('list.bulkDeleteConfirm', { count }),
            type: 'danger',
            confirmText: this.__('list.bulkDeleteBtn', { count }),
            onConfirm: async () => {
                // Close modal immediately
                Modal.closeAll();

                let deletedCount = 0;
                let failedCount = 0;

                // Delete each product using single delete API
                for (const id of ids) {
                    try {
                        await this.app.api.delete(`/products/${id}`);
                        deletedCount++;
                    } catch (err) {
                        Logger.error('Delete failed for product:', id, err);
                        failedCount++;
                    }
                }

                // Clear selection
                this.selectedProducts = [];
                this.table.clearSelection();

                // Show result
                if (deletedCount > 0) {
                    if (failedCount > 0) {
                        Toast.success(this.__('toast.bulkDeletePartial', {
                            count: deletedCount,
                            failed: failedCount
                        }));
                    } else {
                        Toast.success(this.__('toast.bulkDeleted', { count: deletedCount }));
                    }
                } else {
                    Toast.error(this.__('toast.deleteFailed'));
                }

                // Refresh table
                this.table.refresh();
            }
        });
    }

    /**
     * Format currency - uses i18n currency settings
     */
    formatCurrency(value) {
        return this.app.i18n.formatPrice(value);
    }

    /**
     * Print için barkod metnini hazırla (terazi barkodu desteği)
     */
    _getPrintBarcode(product) {
        const raw = (product?.barcode || product?.sku || '').trim();
        if (!raw) return '';
        if (/^\d{5}$/.test(raw)) {
            const settings = this.app?.state?.get('settings') || {};
            const flagCode = settings.weighing_flag_code || '27';
            return `${flagCode}${raw}`;
        }
        return raw;
    }

    /**
     * Format relative time (e.g., "5 dk önce", "Dün", "3 gün önce")
     */
    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) {
            return this.__('relativeTime.justNow');
        } else if (minutes < 60) {
            return this.__('relativeTime.minutesAgo', { count: minutes });
        } else if (hours < 24) {
            return this.__('relativeTime.hoursAgo', { count: hours });
        } else if (days === 1) {
            return this.__('relativeTime.yesterday');
        } else if (days < 7) {
            return this.__('relativeTime.daysAgo', { count: days });
        } else if (days < 30) {
            const weeks = Math.floor(days / 7);
            return this.__('relativeTime.weeksAgo', { count: weeks });
        } else {
            return date.toLocaleDateString(this.app.i18n.locale);
        }
    }

    /**
     * Get cover image URL from product
     */
    getCoverImageUrl(row) {
        // Check for images array first (new format)
        if (row.images) {
            try {
                const images = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
                if (Array.isArray(images) && images.length > 0) {
                    // Use cover_image_index if set, otherwise first image
                    const coverIndex = row.cover_image_index || 0;
                    const coverImage = images[coverIndex] || images[0];
                    return coverImage.url || coverImage;
                }
            } catch (e) {
                // Ignore parse error
            }
        }
        // Fallback to image_url (old format)
        return row.image_url || null;
    }

    /**
     * Convert stored path to display URL
     * Uses MediaUtils for cross-environment compatibility
     */
    getDisplayUrl(url) {
        return MediaUtils.getDisplayUrl(url);
    }

    /**
     * Render cover image cell with hover preview
     */
    renderCoverImage(row) {
        const imageUrl = this.getCoverImageUrl(row);

        if (!imageUrl) {
            return `
                <div class="product-table-thumb product-table-thumb-empty">
                    <i class="ti ti-photo"></i>
                </div>
            `;
        }

        const fullUrl = this.getDisplayUrl(imageUrl);

        return `
            <div class="product-table-thumb"
                 data-preview-url="${escapeHTML(fullUrl)}"
                 data-product-name="${escapeHTML(row.name || '')}">
                <img src="${escapeHTML(fullUrl)}" alt="${escapeHTML(row.name || '')}" loading="lazy"
                     onerror="this.parentElement.innerHTML='<i class=\\'ti ti-photo\\'></i>'">
            </div>
        `;
    }

    /**
     * Initialize image hover preview
     */
    initImageHoverPreview() {
        // Create preview popup element if not exists
        if (!document.getElementById('image-preview-popup')) {
            const popup = document.createElement('div');
            popup.id = 'image-preview-popup';
            popup.className = 'product-image-preview-popup';
            popup.innerHTML = `
                <img src="" alt="Preview">
                <div class="preview-popup-name"></div>
            `;
            document.body.appendChild(popup);
        }

        const popup = document.getElementById('image-preview-popup');
        const popupImg = popup.querySelector('img');
        const popupName = popup.querySelector('.preview-popup-name');

        // Event delegation for hover
        const tableContainer = document.getElementById('products-table');
        if (!tableContainer) return;

        tableContainer.addEventListener('mouseenter', (e) => {
            const thumb = e.target.closest('.product-table-thumb[data-preview-url]');
            if (!thumb) return;

            const previewUrl = thumb.dataset.previewUrl;
            const productName = thumb.dataset.productName;

            if (!previewUrl) return;

            popupImg.src = previewUrl;
            popupName.textContent = productName || '';

            // Position popup intelligently
            this.positionPreviewPopup(popup, thumb);
            popup.classList.add('visible');
        }, true);

        tableContainer.addEventListener('mouseleave', (e) => {
            const thumb = e.target.closest('.product-table-thumb[data-preview-url]');
            if (!thumb) return;

            popup.classList.remove('visible');
        }, true);
    }

    /**
     * Position preview popup intelligently based on element position
     */
    positionPreviewPopup(popup, targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const popupWidth = 250;
        const popupHeight = 280;
        const padding = 12;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate vertical position - show above or below based on available space
        let top;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow >= popupHeight + padding) {
            // Show below
            top = rect.bottom + padding;
        } else if (spaceAbove >= popupHeight + padding) {
            // Show above
            top = rect.top - popupHeight - padding;
        } else {
            // Not enough space above or below, center vertically
            top = Math.max(padding, (viewportHeight - popupHeight) / 2);
        }

        // Calculate horizontal position - show to the right of the element
        let left = rect.right + padding;

        // If not enough space on right, show on left
        if (left + popupWidth > viewportWidth - padding) {
            left = rect.left - popupWidth - padding;
        }

        // Ensure popup stays within viewport
        left = Math.max(padding, Math.min(left, viewportWidth - popupWidth - padding));
        top = Math.max(padding, Math.min(top, viewportHeight - popupHeight - padding));

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }

    // ========================================
    // SEND TO DEVICE METHODS
    // ========================================

    /**
     * Show send to device modal
     * @param {string[]} productIds - Product IDs to send
     * @param {string} productName - Single product name (for display)
     * @param {string} assignedDeviceId - Pre-assigned device ID
     * @param {string} assignedTemplateId - Pre-assigned template ID
     */
    async showSendToDeviceModal(productIds, productName = '', assignedDeviceId = '', assignedTemplateId = '') {
        const isBulk = productIds.length > 1;

        // Tek ürün için eski davranış - doğrudan cihaz ve şablon seçimi
        if (!isBulk) {
            return this._showSingleProductSendModal(productIds[0], productName, assignedDeviceId, assignedTemplateId);
        }

        // Toplu gönderim için cihaz tipi bazlı yeni modal
        return this._showBulkSendByDeviceTypeModal(productIds);
    }

    /**
     * Tek ürün için cihaza gönder modalı (eski davranış)
     */
    async _showSingleProductSendModal(productId, productName, assignedDeviceId, assignedTemplateId) {
        let devices = [];
        let templates = [];

        try {
            // Tüm cihazları ve şablonları getir (atanan cihaz/şablon görünsün diye)
            const [devicesRes, templatesRes] = await Promise.all([
                this.app.api.get('/devices'),
                this.app.api.get('/templates')
            ]);

            devices = devicesRes.data || [];
            const allTpls = templatesRes.data || [];
            // Filter out TV/signage templates for ESL label assignment
            templates = allTpls.filter(t => {
                const w = parseInt(t.width) || 0;
                const h = parseInt(t.height) || 0;
                if (w >= 1280 && h <= 800 && w > h) return false;
                return true;
            });
        } catch (error) {
            Logger.error('Failed to load devices/templates:', error);
            Toast.error(this.__('sendToDevice.loadFailed'));
            return;
        }

        if (devices.length === 0) {
            Toast.warning(this._getNoDevicesMessage('sendToDevice.noDevices'));
            return;
        }

        if (templates.length === 0) {
            Toast.warning(this.__('sendToDevice.noTemplates'));
            return;
        }

        const templateOptions = templates.map(t => {
            const selected = t.id === assignedTemplateId ? 'selected' : '';
            return `<option value="${t.id}" data-width="${t.width || 800}" data-height="${t.height || 1280}" data-name="${escapeHTML(t.name)}" data-preview="${escapeHTML(t.render_image || t.preview_url || t.thumbnail || t.preview_image || '')}" ${selected}>
                ${escapeHTML(t.name)} (${t.width || 800}x${t.height || 1280})
            </option>`;
        }).join('');

        const deviceOptions = devices.map(d => {
            const selected = d.id === assignedDeviceId ? 'selected' : '';
            const isOnline = d.status === 'online';
            const statusIcon = isOnline ? '🟢' : '🔴';
            const isHanshow = d.model === 'hanshow_esl' || d.type === 'hanshow_esl';
            const deviceInfo = isHanshow ? (d.device_id || 'ESL') : escapeHTML(d.ip_address || this.__('sendToDevice.noIp'));
            return `<option value="${d.id}" data-ip="${escapeHTML(d.ip_address || '')}" data-model="${escapeHTML(d.model || '')}" data-status="${d.status || 'offline'}" ${selected}>
                ${statusIcon} ${escapeHTML(d.name)} (${deviceInfo})
            </option>`;
        }).join('');

        const initialTemplate = templates.find(t => t.id === assignedTemplateId) || null;
        const initialDevice = devices.find(d => d.id === assignedDeviceId) || null;

        // Mevcut etiket atama bilgisi
        const hasAssignment = initialDevice || initialTemplate;
        const assignmentInfoHtml = hasAssignment ? `
            <div class="current-assignment-info">
                <div class="assignment-info-header">
                    <i class="ti ti-tag"></i>
                    <span>${this.__('sendToDevice.currentAssignment')}</span>
                </div>
                <div class="assignment-info-content">
                    ${initialDevice ? `
                        <div class="assignment-item">
                            <span class="assignment-label">${this.__('sendToDevice.targetDevice')}:</span>
                            <span class="assignment-value">
                                <span class="status-dot ${initialDevice.status === 'online' ? 'online' : 'offline'}"></span>
                                ${escapeHTML(initialDevice.name)}
                            </span>
                        </div>
                    ` : ''}
                    ${initialTemplate ? `
                        <div class="assignment-item">
                            <span class="assignment-label">${this.__('sendToDevice.template')}:</span>
                            <span class="assignment-value">${escapeHTML(initialTemplate.name)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : '';

        const content = `
            <div class="send-to-device-form">
                ${assignmentInfoHtml}
                <div class="send-to-device-layout">
                    <div class="template-preview-section">
                        <h4><i class="ti ti-eye"></i> ${this.__('sendToDevice.templatePreview')}</h4>
                        <div class="template-preview-card" id="template-preview-card">
                            ${initialTemplate ? this._renderTemplatePreview(initialTemplate, productId) : `
                                <div class="template-preview-empty">
                                    <i class="ti ti-layout"></i>
                                    <span>${this.__('sendToDevice.selectTemplateToPreview')}</span>
                                </div>
                            `}
                        </div>
                    </div>
                    <div class="send-to-device-fields">
                        <div class="form-group">
                            <label class="form-label">
                                <i class="ti ti-device-desktop"></i>
                                ${this.__('sendToDevice.targetDevice')} *
                            </label>
                            <select id="send-device-select" class="form-select">
                                <option value="">${this.__('sendToDevice.selectDevicePlaceholder')}</option>
                                ${deviceOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">
                                <i class="ti ti-layout"></i>
                                ${this.__('sendToDevice.template')} *
                            </label>
                            <select id="send-template-select" class="form-select">
                                <option value="">${this.__('sendToDevice.selectTemplatePlaceholder')}</option>
                                ${templateOptions}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-check">
                                <input type="checkbox" id="save-assignment-check" class="form-check-input" checked>
                                <span class="form-check-label">${this.__('sendToDevice.saveAssignment')}</span>
                            </label>
                            <small class="form-help">${this.__('sendToDevice.saveAssignmentHelp')}</small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        Modal.show({
            title: this.__('sendToDevice.titleSingle', { name: escapeHTML(productName) }),
            icon: 'ti-device-mobile-share',
            content: content,
            size: 'lg',
            confirmText: this.__('sendToDevice.send'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const deviceId = document.getElementById('send-device-select')?.value;
                const templateId = document.getElementById('send-template-select')?.value;
                const saveAssignment = document.getElementById('save-assignment-check')?.checked;

                if (!deviceId) {
                    Toast.warning(this.__('sendToDevice.deviceRequired'));
                    throw new Error('Device required');
                }

                if (!templateId) {
                    Toast.warning(this.__('sendToDevice.templateRequired'));
                    throw new Error('Template required');
                }

                const deviceSelect = document.getElementById('send-device-select');
                const deviceOption = deviceSelect.options[deviceSelect.selectedIndex];
                const deviceIp = deviceOption.dataset.ip;
                const deviceModel = deviceOption.dataset.model || '';
                const isHanshowEsl = deviceModel === 'hanshow_esl';

                if (!deviceIp && !isHanshowEsl) {
                    Toast.error(this.__('sendToDevice.noIpAddress'));
                    throw new Error('Device IP missing');
                }

                if (saveAssignment) {
                    try {
                        // force: true ile çağır - kullanıcı zaten cihazı seçti,
                        // mevcut atama varsa güncellensin
                        await this.app.api.post(`/products/${productId}/assign-label`, {
                            device_id: deviceId,
                            template_id: templateId,
                            force: true
                        });
                    } catch (error) {
                        Logger.warn('Failed to save assignment:', error);
                    }
                }

                await this.executeSendToDevice([productId], deviceId, templateId);
            }
        });

        setTimeout(() => {
            const templateSelect = document.getElementById('send-template-select');
            if (templateSelect) {
                templateSelect.addEventListener('change', (e) => {
                    const selectedOption = e.target.options[e.target.selectedIndex];
                    const previewCard = document.getElementById('template-preview-card');

                    if (selectedOption.value && previewCard) {
                        const templateData = {
                            id: selectedOption.value,
                            name: selectedOption.dataset.name,
                            width: selectedOption.dataset.width,
                            height: selectedOption.dataset.height,
                            render_image: selectedOption.dataset.preview
                        };
                        previewCard.innerHTML = this._renderTemplatePreview(templateData, productId);
                    } else if (previewCard) {
                        previewCard.innerHTML = `
                            <div class="template-preview-empty">
                                <i class="ti ti-layout"></i>
                                <span>${this.__('sendToDevice.selectTemplateToPreview')}</span>
                            </div>
                        `;
                    }
                });
            }
        }, 100);
    }

    /**
     * Toplu gönderim için cihaz tipi bazlı modal
     * Seçilen ürünlerden, seçilen cihaz tipine atanmış olanları bulup gönderir
     */
    async _showBulkSendByDeviceTypeModal(productIds) {
        // Önce seçilen ürünlerin detaylarını ve atamalarını al
        let productsWithAssignments = [];
        let allDevices = [];

        try {
            // Ürün detaylarını al (labels dahil)
            const productPromises = productIds.map(id => this.app.api.get(`/products/${id}`));
            const productResults = await Promise.all(productPromises);
            productsWithAssignments = productResults.map(r => r.data).filter(p => p);

            // Tüm cihazları al
            const devicesRes = await this.app.api.get('/devices');
            allDevices = devicesRes.data || [];
        } catch (error) {
            Logger.error('Failed to load products/devices:', error);
            Toast.error(this.__('sendToDevice.loadFailed'));
            return;
        }

        // Cihaz tiplerini ve her tipe atanmış ürün sayısını hesapla
        const deviceTypes = {
            'esl': { label: 'ESL (E-Paper)', icon: 'ti-tag', count: 0, products: [] },
            'esl_android': { label: 'ESL Tablet', icon: 'ti-device-tablet', count: 0, products: [] },
            'hanshow_esl': { label: 'Hanshow ESL', icon: 'ti-tag', count: 0, products: [] },
            'android_tv': { label: 'Android TV', icon: 'ti-device-tv', count: 0, products: [] },
            'web_display': { label: 'Web Display', icon: 'ti-browser', count: 0, products: [] },
            'tablet': { label: 'Tablet', icon: 'ti-device-tablet', count: 0, products: [] }
        };

        // Her ürün için atanmış cihaz tipini bul
        productsWithAssignments.forEach(product => {
            if (product.assigned_device_id) {
                const assignedDevice = allDevices.find(d => d.id === product.assigned_device_id);
                if (assignedDevice) {
                    const deviceType = assignedDevice.type || assignedDevice.model || 'esl';
                    // Normalize device type
                    let normalizedType = deviceType;
                    if (deviceType === 'esl_rtos') normalizedType = 'esl';

                    if (deviceTypes[normalizedType]) {
                        deviceTypes[normalizedType].count++;
                        deviceTypes[normalizedType].products.push({
                            product: product,
                            device: assignedDevice,
                            templateId: product.assigned_template_id
                        });
                    }
                }
            }
        });

        // Atanmamış ürün sayısı
        const unassignedCount = productsWithAssignments.filter(p => !p.assigned_device_id).length;

        // En az 1 atama olan cihaz tiplerini filtrele
        const availableTypes = Object.entries(deviceTypes).filter(([_, data]) => data.count > 0);

        if (availableTypes.length === 0) {
            Toast.warning(this.__('sendToDevice.noAssignments'));
            return;
        }

        const content = `
            <div class="bulk-send-by-type">
                <div class="bulk-send-info alert alert-info mb-4">
                    <i class="ti ti-info-circle"></i>
                    <div>
                        <strong>${this.__('sendToDevice.productsSelected', { count: productIds.length })}</strong>
                        ${unassignedCount > 0 ? `<br><small class="text-warning">${this.__('sendToDevice.unassignedWarning', { count: unassignedCount })}</small>` : ''}
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">
                        <i class="ti ti-category"></i>
                        ${this.__('sendToDevice.selectDeviceType')} *
                    </label>
                    <p class="form-help mb-3">${this.__('sendToDevice.selectDeviceTypeHelp')}</p>

                    <div class="device-type-grid">
                        ${availableTypes.map(([type, data]) => `
                            <label class="device-type-card">
                                <input type="radio" name="device-type" value="${type}" class="device-type-radio">
                                <div class="device-type-content">
                                    <i class="${data.icon}"></i>
                                    <span class="device-type-label">${this.__('sendToDevice.deviceTypes.' + type) || data.label}</span>
                                    <span class="device-type-count">${this.__('sendToDevice.productCount', { count: data.count })}</span>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div id="selected-type-preview" class="selected-type-preview mt-4" style="display: none;">
                    <h4><i class="ti ti-list"></i> ${this.__('sendToDevice.productsToSend')}</h4>
                    <div id="type-products-list" class="type-products-list"></div>
                </div>

                <div id="bulk-html-preview-section" class="bulk-html-preview-section mt-4" style="display: none;">
                    <div class="bulk-html-preview-header">
                        <h4><i class="ti ti-eye"></i> ${this.__('sendToDevice.htmlPreviewTitle')}</h4>
                        <button type="button" class="btn btn-sm btn-cyan" id="btn-bulk-create-html">
                            <i class="ti ti-code"></i> ${this.__('sendToDevice.createHtmlTemplate')}
                        </button>
                    </div>
                    <div id="bulk-html-preview-grid" class="bulk-html-preview-grid"></div>
                </div>
            </div>
        `;

        // Store device types data for later use
        this._bulkSendDeviceTypes = deviceTypes;

        Modal.show({
            title: this.__('sendToDevice.bulkTitle', { count: productIds.length }),
            icon: 'ti-send',
            content: content,
            size: 'lg',
            confirmText: this.__('sendToDevice.send'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const selectedType = document.querySelector('input[name="device-type"]:checked')?.value;

                if (!selectedType) {
                    Toast.warning(this.__('sendToDevice.deviceTypeRequired'));
                    throw new Error('Device type required');
                }

                const typeData = this._bulkSendDeviceTypes[selectedType];
                if (!typeData || typeData.products.length === 0) {
                    Toast.warning(this.__('sendToDevice.noProductsForType'));
                    throw new Error('No products for type');
                }

                // Seçilen tipteki her ürünü kendi atandığı cihaza gönder
                await this._executeBulkSendByType(typeData.products);
            }
        });

        // Cihaz tipi seçildiğinde önizleme göster
        setTimeout(() => {
            const radios = document.querySelectorAll('input[name="device-type"]');
            radios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const type = e.target.value;
                    const typeData = this._bulkSendDeviceTypes[type];
                    const previewDiv = document.getElementById('selected-type-preview');
                    const listDiv = document.getElementById('type-products-list');
                    const htmlPreviewSection = document.getElementById('bulk-html-preview-section');
                    const htmlPreviewGrid = document.getElementById('bulk-html-preview-grid');

                    if (typeData && previewDiv && listDiv) {
                        previewDiv.style.display = 'block';
                        listDiv.innerHTML = typeData.products.map(item => `
                            <div class="type-product-item">
                                <span class="product-name">${escapeHTML(item.product.name)}</span>
                                <span class="product-arrow">→</span>
                                <span class="device-name">${escapeHTML(item.device.name)}</span>
                            </div>
                        `).join('');

                        // Şablonu olan ürünlerin HTML önizlemesini göster
                        const productsWithTemplates = typeData.products.filter(item => item.templateId);
                        if (productsWithTemplates.length > 0 && htmlPreviewSection && htmlPreviewGrid) {
                            htmlPreviewSection.style.display = 'block';
                            const basePath = window.OmnexConfig?.basePath || '';
                            htmlPreviewGrid.innerHTML = productsWithTemplates.map(item => {
                                const iframeSrc = `${basePath}/api/templates/${item.templateId}/preview-html?product_id=${item.product.id}`;
                                return `
                                    <div class="bulk-html-preview-card">
                                        <div class="bulk-html-preview-iframe">
                                            <iframe src="${escapeHTML(iframeSrc)}"
                                                    sandbox="allow-scripts"
                                                    loading="lazy"
                                                    title="${escapeHTML(item.product.name)}"></iframe>
                                            <div class="live-preview-badge">
                                                <i class="ti ti-broadcast"></i> HTML
                                            </div>
                                        </div>
                                        <div class="bulk-html-preview-info">
                                            <span class="product-name">${escapeHTML(item.product.name)}</span>
                                            <span class="device-name">${escapeHTML(item.device.name)}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('');
                        } else if (htmlPreviewSection) {
                            htmlPreviewSection.style.display = 'none';
                        }
                    }

                    // Aktif kartı işaretle
                    document.querySelectorAll('.device-type-card').forEach(card => {
                        card.classList.remove('active');
                    });
                    e.target.closest('.device-type-card')?.classList.add('active');
                });
            });

            // HTML şablon oluştur butonu
            document.getElementById('btn-bulk-create-html')?.addEventListener('click', () => {
                const selectedType = document.querySelector('input[name="device-type"]:checked')?.value;
                if (!selectedType) {
                    Toast.warning(this.__('sendToDevice.deviceTypeRequired'));
                    return;
                }
                const typeData = this._bulkSendDeviceTypes[selectedType];
                if (!typeData || typeData.products.length === 0) return;

                // Şablonu olan ürünlerin template ID'lerini topla
                const templateIds = [...new Set(typeData.products.filter(p => p.templateId).map(p => p.templateId))];
                const productIds = typeData.products.map(p => p.product.id);

                if (templateIds.length === 0) {
                    Toast.warning(this.__('sendToDevice.noTemplateData'));
                    return;
                }

                // Her template+product kombinasyonu için HTML oluştur
                this._bulkCreateHtmlFromSendModal(templateIds[0], productIds);
            });
        }, 100);
    }

    /**
     * Toplu gönderim modalından HTML şablon oluştur
     */
    async _bulkCreateHtmlFromSendModal(templateId, productIds) {
        const count = productIds.length;
        const separateLabel = this.__('generateHtml.separatePerProduct');
        const combinedLabel = this.__('sendToDevice.createHtmlCombined') || 'Tümünü tek şablonda birleştir';

        Modal.show({
            title: this.__('sendToDevice.createHtmlTitle') || 'HTML Şablon Oluştur',
            icon: 'ti-code',
            size: 'sm',
            content: `
                <div class="mb-3">
                    <p class="text-sm text-muted mb-3">
                        <i class="ti ti-info-circle"></i>
                        ${this.__('sendToDevice.createHtmlInfo', { count }) || `${count} ürün için HTML şablon oluşturulacak.`}
                    </p>
                    <div class="form-group">
                        <div class="form-check mb-2">
                            <input type="radio" id="html-mode-separate" name="html-mode" value="separate" class="form-check-input" checked>
                            <label for="html-mode-separate" class="form-check-label">${separateLabel}</label>
                        </div>
                        <div class="form-check">
                            <input type="radio" id="html-mode-combined" name="html-mode" value="combined" class="form-check-input">
                            <label for="html-mode-combined" class="form-check-label">${combinedLabel}</label>
                        </div>
                    </div>
                </div>
            `,
            confirmText: this.__('generateHtml.generate'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const mode = document.querySelector('input[name="html-mode"]:checked')?.value || 'separate';
                try {
                    Toast.info(this.__('generateHtml.bulkGenerating', { count }));

                    if (mode === 'separate') {
                        let successCount = 0;
                        let failCount = 0;
                        for (const pid of productIds) {
                            try {
                                const resp = await this.app.api.post('/web-templates/generate-from-fabric', {
                                    template_id: templateId,
                                    product_ids: [pid]
                                });
                                if (resp.success) successCount++;
                                else failCount++;
                            } catch {
                                failCount++;
                            }
                        }
                        if (successCount > 0) {
                            Toast.success(this.__('generateHtml.bulkSuccess', { count: successCount }));
                        }
                        if (failCount > 0) {
                            Toast.warning(this.__('generateHtml.bulkPartialFail', { failed: failCount }));
                        }
                    } else {
                        const response = await this.app.api.post('/web-templates/generate-from-fabric', {
                            template_id: templateId,
                            product_ids: productIds
                        });
                        if (response.success) {
                            const msg = response.data?.is_update
                                ? this.__('generateHtml.updated')
                                : this.__('generateHtml.success');
                            Toast.success(msg);
                        } else {
                            Toast.error(response.message || this.__('generateHtml.failed'));
                            return false;
                        }
                    }
                } catch (error) {
                    Toast.error(error.message || this.__('generateHtml.failed'));
                    return false;
                }
            }
        });
    }

    /**
     * Cihaz tipine göre toplu gönderim yap - Render Queue mekanizması ile
     * Her ürün kendi atandığı cihaza gönderilir
     */
    async _executeBulkSendByType(productsToSend) {
        const total = productsToSend.length;

        // Ürün ID'lerini ve template ID'lerini hazırla
        const productData = productsToSend.map(item => ({
            id: item.product.id,
            template_id: item.templateId
        }));
        const productIds = productData.map(p => p.id);

        // Progress modal göster
        Modal.show({
            id: 'send-progress-modal',
            title: this.__('sendToDevice.bulkSending'),
            icon: 'ti-loader',
            content: `
                <div class="send-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="send-progress-bar" style="width: 10%"></div>
                    </div>
                    <div class="progress-text mt-3">
                        <span id="send-progress-text">${this.__('sendToDevice.checkingCache')}</span>
                    </div>
                    <div class="progress-status mt-2" id="send-progress-status">
                        ${total} ${this.__('sendToDevice.productsProcessing')}
                    </div>
                </div>
            `,
            showFooter: false,
            closable: false,
            closeOnEscape: false,
            closeOnBackdrop: false
        });

        // Modal DOM'a bağlanmasını bekle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Timeout mekanizması (90 saniye)
        const timeoutId = setTimeout(() => {
            Modal.close('send-progress-modal');
            Toast.error(this.__('sendToDevice.timeout'));
        }, 90000);

        try {
            // Render cache durumunu kontrol et
            const cacheStatus = await this._checkRenderCacheStatus(productData);

            if (cacheStatus && cacheStatus.all_ready) {
                // Tüm ürünler cache'de, doğrudan gönder
                Logger.debug('All products have cached renders, using cache');
                await this._submitBulkWithCache(productIds, cacheStatus.ready);
            } else if (cacheStatus && (cacheStatus.pending_count > 0 || cacheStatus.not_cached_count > 0)) {
                // Bazı ürünler cache'de değil
                Modal.close('send-progress-modal');
                this._showBulkRenderCacheWarning(cacheStatus, productIds);
            } else {
                // Cache kontrolü başarısız, pre-render ile gönder
                Logger.debug('Cache check failed, falling back to pre-render');
                await this._submitBulkWithPreRender(productsToSend);
            }
            clearTimeout(timeoutId);
        } catch (error) {
            clearTimeout(timeoutId);
            Logger.error('Bulk send failed:', error);
            Modal.close('send-progress-modal');
            Toast.error(error.message || this.__('sendToDevice.failed'));
        }

        // Tabloyu yenile
        this.table.refresh();

        // Seçimi temizle
        this.selectedProducts = [];
        this.table.clearSelection();
    }

    /**
     * Render cache durumunu kontrol et
     * @private
     */
    async _checkRenderCacheStatus(productData) {
        try {
            const products = productData.map(p => ({
                id: p.id,
                template_id: p.template_id
            }));

            const response = await this.app.api.post('/render-cache/check', {
                products: products,
                create_jobs_for_missing: true
            });

            if (response.success) {
                return response.data;
            }

            return {
                all_ready: false,
                ready_count: 0,
                pending_count: 0,
                not_cached_count: products.length,
                ready: [],
                pending: [],
                not_cached: products.map(p => ({ product_id: p.id, template_id: p.template_id }))
            };
        } catch (error) {
            Logger.error('Failed to check render cache status:', error);
            return null;
        }
    }

    /**
     * Cache uyarı modalı göster (toplu gönderim için)
     * @private
     */
    _showBulkRenderCacheWarning(cacheStatus, productIds) {
        const { ready_count, pending_count, not_cached_count, progress_percent } = cacheStatus;

        Modal.show({
            id: 'render-cache-warning',
            title: this.__('sendToDevice.renderCacheTitle') || 'Render Durumu',
            icon: 'ti-alert-triangle',
            content: `
                <div class="render-cache-warning-content">
                    <div class="render-cache-status-icon warning">
                        <i class="ti ti-loader"></i>
                    </div>
                    <p class="render-cache-message">
                        ${this.__('sendToDevice.cacheNotReady')}
                    </p>

                    <div class="render-cache-stats">
                        <div class="render-cache-stat ready">
                            <i class="ti ti-check"></i>
                            <span>${ready_count}</span>
                            <small>${this.__('sendToDevice.ready')}</small>
                        </div>
                        <div class="render-cache-stat pending">
                            <i class="ti ti-clock"></i>
                            <span>${pending_count + not_cached_count}</span>
                            <small>${this.__('sendToDevice.pending')}</small>
                        </div>
                    </div>

                    <div class="render-cache-progress">
                        <div class="render-cache-progress-bar">
                            <div class="render-cache-progress-fill" style="width: ${progress_percent || 0}%"></div>
                        </div>
                        <span class="render-cache-progress-text">${progress_percent || 0}%</span>
                    </div>

                    <div class="render-cache-options">
                        <p class="render-cache-options-title">${this.__('sendToDevice.selectOption')}</p>

                        <button type="button" class="render-cache-option-btn wait" id="render-cache-wait">
                            <i class="ti ti-clock-play"></i>
                            <div>
                                <span class="option-title">${this.__('sendToDevice.waitForRender')}</span>
                                <span class="option-desc">${this.__('sendToDevice.waitForRenderDesc')}</span>
                            </div>
                        </button>

                        <button type="button" class="render-cache-option-btn continue" id="render-cache-continue">
                            <i class="ti ti-send"></i>
                            <div>
                                <span class="option-title">${this.__('sendToDevice.sendReady')}</span>
                                <span class="option-desc">${this.__('sendToDevice.sendReadyDesc', { count: ready_count })}</span>
                            </div>
                        </button>

                        <button type="button" class="render-cache-option-btn render-now" id="render-cache-render-now">
                            <i class="ti ti-refresh"></i>
                            <div>
                                <span class="option-title">${this.__('sendToDevice.renderNow')}</span>
                                <span class="option-desc">${this.__('sendToDevice.renderNowDesc')}</span>
                            </div>
                        </button>
                    </div>
                </div>
            `,
            showFooter: false,
            size: 'md'
        });

        // Buton event'leri
        setTimeout(() => {
            document.getElementById('render-cache-wait')?.addEventListener('click', () => {
                Modal.close('render-cache-warning');
                this._startRenderWorkerAndSend(cacheStatus, productIds);
            });
            document.getElementById('render-cache-continue')?.addEventListener('click', () => {
                Modal.close('render-cache-warning');
                if (cacheStatus.ready && cacheStatus.ready.length > 0) {
                    const readyIds = cacheStatus.ready.map(r => r.product_id);
                    this._submitBulkWithCache(readyIds, cacheStatus.ready);
                } else {
                    Toast.warning(this.__('sendToDevice.noReadyProducts'));
                }
            });
            document.getElementById('render-cache-render-now')?.addEventListener('click', () => {
                Modal.close('render-cache-warning');
                this._startRenderWorkerAndSend(cacheStatus, productIds);
            });
        }, 100);
    }

    /**
     * RenderWorker başlat ve tamamlanınca gönder
     * @private
     */
    async _startRenderWorkerAndSend(cacheStatus, productIds) {
        const notReady = [...(cacheStatus.pending || []), ...(cacheStatus.not_cached || [])];

        if (notReady.length === 0) {
            await this._submitBulkWithCache(productIds, cacheStatus.ready);
            return;
        }

        const makeRenderKey = (productId, templateId) => `${String(productId || '').trim()}::${String(templateId || '').trim()}`;
        const expectedKeys = new Set(
            notReady
                .map(n => makeRenderKey(n.product_id, n.template_id))
                .filter(k => !k.startsWith('::'))
        );
        const expectedCount = Math.max(expectedKeys.size, 1);

        // Progress modal göster
        Modal.show({
            id: 'render-progress-modal',
            title: this.__('sendToDevice.rendering'),
            icon: 'ti-loader',
            content: `
                <div class="render-progress-container">
                    <div class="render-progress-info">
                        <p>${this.__('sendToDevice.renderingProducts')}</p>
                        <p class="render-progress-count">
                            <span id="render-completed-count">0</span> / ${expectedCount}
                        </p>
                    </div>
                    <div class="render-progress-bar">
                        <div class="render-progress-fill" id="render-progress-fill" style="width: 0%"></div>
                    </div>
                </div>
            `,
            showFooter: false,
            closable: false,
            closeOnEscape: false,
            closeOnBackdrop: false
        });

        // RenderWorker başlat
        const { getRenderWorker } = await import('../../components/RenderWorker.js?v=1.0.67');
        const worker = getRenderWorker(this.app);
        const expectedProducts = new Set(notReady.map(n => String(n.product_id)));
        const expectedTemplateIds = [...new Set(
            notReady
                .map(n => String(n.template_id || '').trim())
                .filter(Boolean)
        )];
        const completedKeys = new Set();

        const focusContext = {
            batchId: cacheStatus.batch_id || null,
            productIds: [...expectedProducts],
            templateIds: expectedTemplateIds,
            notifications: false
        };

        if (typeof worker.setFocusContext === 'function') {
            worker.setFocusContext(focusContext);
        }

        const previousNotificationMode = typeof worker.getNotificationsEnabled === 'function'
            ? worker.getNotificationsEnabled()
            : true;
        if (typeof worker.setNotificationsEnabled === 'function') {
            worker.setNotificationsEnabled(false);
        }

        let failSafeTimer = null;
        const cleanup = () => {
            if (failSafeTimer) {
                clearTimeout(failSafeTimer);
                failSafeTimer = null;
            }
            worker.off('jobCompleted', onJobCompleted);
            worker.off('jobFailed', onJobFailed);
            worker.off('focusCompleted', onFocusCompleted);
            if (typeof worker.setNotificationsEnabled === 'function') {
                worker.setNotificationsEnabled(previousNotificationMode);
            }
        };

        const resolveJobKey = (data) => {
            const productId = String(data?.job?.product_id || data?.product?.id || '').trim();
            const templateId = String(data?.job?.template_id || '').trim();
            let key = makeRenderKey(productId, templateId);
            if (expectedKeys.has(key)) {
                return key;
            }

            if (!productId) return '';
            const fallback = [...expectedKeys].find(k => k.startsWith(`${productId}::`) && !completedKeys.has(k));
            return fallback || '';
        };

        const onJobCompleted = (data) => {
            const key = resolveJobKey(data);
            if (!key || completedKeys.has(key)) {
                return;
            }

            completedKeys.add(key);
            const progressFill = document.getElementById('render-progress-fill');
            const countEl = document.getElementById('render-completed-count');
            const completedCount = completedKeys.size;

            if (progressFill) progressFill.style.width = `${(completedCount / expectedCount) * 100}%`;
            if (countEl) countEl.textContent = completedCount;

            if (completedCount >= expectedCount) {
                cleanup();

                setTimeout(() => {
                    Modal.close('render-progress-modal');
                    Toast.success(this.__('sendToDevice.renderComplete'));
                    // Cache'i tekrar kontrol et ve gönder
                    this._retryBulkSendWithCache(productIds);
                }, 500);
            }
        };

        const onJobFailed = (data) => {
            const key = resolveJobKey(data);
            if (key && !completedKeys.has(key)) {
                completedKeys.add(key);
                const progressFill = document.getElementById('render-progress-fill');
                const countEl = document.getElementById('render-completed-count');
                const completedCount = completedKeys.size;
                if (progressFill) progressFill.style.width = `${(completedCount / expectedCount) * 100}%`;
                if (countEl) countEl.textContent = completedCount;

                if (completedCount >= expectedCount) {
                    cleanup();
                    setTimeout(() => {
                        Modal.close('render-progress-modal');
                        this._retryBulkSendWithCache(productIds);
                    }, 500);
                }
            }
        };

        const onFocusCompleted = () => {
            cleanup();
            setTimeout(() => {
                Modal.close('render-progress-modal');
                this._retryBulkSendWithCache(productIds);
            }, 300);
        };

        worker.on('jobCompleted', onJobCompleted);
        worker.on('jobFailed', onJobFailed);
        worker.on('focusCompleted', onFocusCompleted);

        if (!worker.isRunning) {
            worker.start(focusContext);
        } else if (worker.isPaused) {
            worker.resume();
        }

        failSafeTimer = setTimeout(() => {
            cleanup();
            Modal.close('render-progress-modal');
            Toast.warning(this.__('sendToDevice.cacheStillNotReady'));
            this._retryBulkSendWithCache(productIds);
        }, 90000);
    }

    /**
     * Cache kontrolü sonrası tekrar gönder
     * @private
     */
    async _retryBulkSendWithCache(productIds) {
        try {
            // Önce ürün verilerini tekrar al (template_id için)
            const productPromises = productIds.map(id => this.app.api.get(`/products/${id}`));
            const productResults = await Promise.all(productPromises);
            const products = productResults.map(r => r.data).filter(p => p);

            const productData = products.map(p => ({
                id: p.id,
                template_id: p.assigned_template_id
            })).filter(p => p.template_id);

            const cacheStatus = await this._checkRenderCacheStatus(productData);

            if (cacheStatus && cacheStatus.ready && cacheStatus.ready.length > 0) {
                await this._submitBulkWithCache(productIds, cacheStatus.ready);
            } else {
                Toast.warning(this.__('sendToDevice.cacheStillNotReady'));
            }
        } catch (error) {
            Logger.error('Retry bulk send failed:', error);
            Toast.error(this.__('sendToDevice.failed'));
        }
    }

    /**
     * Cache'li görseller ile toplu gönder
     * @private
     */
    async _submitBulkWithCache(productIds, readyProducts) {
        try {
            const cachedImages = {};
            for (const item of readyProducts) {
                if (item.image_path) {
                    cachedImages[item.product_id] = item.image_path;
                }
            }

            const productIdsToSend = readyProducts.map(r => r.product_id);

            if (productIdsToSend.length === 0) {
                Toast.warning(this.__('sendToDevice.noReadyProducts'));
                return;
            }

            // Progress güncelle
            const progressBar = document.getElementById('send-progress-bar');
            const progressText = document.getElementById('send-progress-text');
            const progressStatus = document.getElementById('send-progress-status');

            if (progressBar) progressBar.style.width = '50%';
            if (progressText) progressText.textContent = this.__('sendToDevice.sendingToQueue');
            if (progressStatus) progressStatus.textContent = `${productIdsToSend.length} ${this.__('sendToDevice.products')}`;

            const response = await this.app.api.post('/render-queue/auto', {
                product_ids: productIdsToSend,
                use_cache: true,
                cached_images: cachedImages,
                priority: 'high'
            });

            // Progress modal kapat
            Modal.close('send-progress-modal');

            if (response.success) {
                Toast.success(this.__('sendToDevice.queueSuccess', { count: productIdsToSend.length }));
                await this._refreshNotificationsAfterQueueAction();

                // Worker'ı başlat
                this._triggerQueueProcessing();
            } else {
                Toast.error(response.message || this.__('sendToDevice.failed'));
            }
        } catch (error) {
            Logger.error('Submit bulk with cache failed:', error);
            Modal.close('send-progress-modal');
            Toast.error(this.__('sendToDevice.failed'));
        }
    }

    /**
     * Pre-render ile toplu gönder (fallback)
     * @private
     */
    async _submitBulkWithPreRender(productsToSend) {
        const total = productsToSend.length;
        const renderer = getTemplateRenderer();
        const preRenderedImages = {};
        const templateCache = {};

        const updateProgress = (current, status) => {
            // Modal varlığını kontrol et
            const modal = document.getElementById('send-progress-modal');
            if (!modal) return;

            const progressBar = document.getElementById('send-progress-bar');
            const progressText = document.getElementById('send-progress-text');
            const progressStatus = document.getElementById('send-progress-status');

            if (progressBar) progressBar.style.width = `${(current / total) * 100}%`;
            if (progressText) progressText.textContent = `${current} / ${total}`;
            if (progressStatus) progressStatus.textContent = status;
        };

        // Her ürünü render et
        for (let i = 0; i < productsToSend.length; i++) {
            const { product, templateId } = productsToSend[i];

            updateProgress(i + 1, `${this.__('sendToDevice.rendering')}: ${product.name}`);

            try {
                let template = templateCache[templateId];
                if (!template) {
                    const templateRes = await this.app.api.get(`/templates/${templateId}`);
                    if (templateRes.success && templateRes.data) {
                        template = templateRes.data;
                        templateCache[templateId] = template;
                    } else {
                        continue;
                    }
                }

                const renderedImage = await renderer.render(template, product, this._getRenderOptions(template));
                if (renderedImage) {
                    preRenderedImages[product.id] = renderedImage;
                }
            } catch (renderError) {
                Logger.error(`Failed to pre-render product ${product.id}:`, renderError);
            }
        }

        updateProgress(total, this.__('sendToDevice.sendingToQueue'));

        // Kuyruğa gönder
        const productIds = productsToSend.map(p => p.product.id);

        const response = await this.app.api.post('/render-queue/auto', {
            product_ids: productIds,
            pre_rendered_images: preRenderedImages,
            priority: 'high'
        });

        Modal.close('send-progress-modal');

        if (response.success) {
            Toast.success(this.__('sendToDevice.queueSuccess', { count: productIds.length }));
            await this._refreshNotificationsAfterQueueAction();
            this._triggerQueueProcessing();
        } else {
            Toast.error(response.message || this.__('sendToDevice.failed'));
        }
    }

    /**
     * Kuyruk işlemeyi tetikle
     * @private
     */
    async _triggerQueueProcessing() {
        try {
            await this.app.api.post('/render-queue/process', {
                max_jobs: 10
            });
        } catch (error) {
            Logger.warn('Queue processing trigger failed:', error);
        }
    }

    /**
     * Render template preview card - matches templates page card style
     * @param {Object} template - Template data
     * @returns {string} HTML string
     */
    _renderTemplatePreview(template, productId = null) {
        const basePath = window.OmnexConfig?.basePath || '';
        const templateLabel = this.__('sendToDevice.template');
        const previewNotAvailable = this.__('sendToDevice.previewNotAvailable');
        const previewLoadError = this.__('sendToDevice.previewLoadError');
        const livePreviewLabel = this.__('sendToDevice.liveHtmlPreview') || 'Canlı HTML Önizleme';

        // productId varsa canlı HTML iframe önizleme kullan
        if (productId && template.id) {
            const iframeSrc = `${basePath}/api/templates/${template.id}/preview-html?product_id=${productId}`;
            return `
                <div class="template-preview-content">
                    <div class="template-preview-image template-preview-live">
                        <iframe src="${escapeHTML(iframeSrc)}"
                                sandbox="allow-scripts"
                                style="width:100%;height:100%;border:none;pointer-events:none;"
                                loading="lazy"
                                title="${escapeHTML(template.name || templateLabel)}"></iframe>
                        <div class="live-preview-badge">
                            <i class="ti ti-broadcast"></i> ${livePreviewLabel}
                        </div>
                    </div>
                    <div class="template-preview-info">
                        <div class="template-preview-name">${escapeHTML(template.name || templateLabel)}</div>
                        <div class="template-preview-size">${template.width || '?'} x ${template.height || '?'} px</div>
                    </div>
                </div>
            `;
        }

        // Statik görsel önizleme (productId yoksa fallback)
        let previewUrl = template.render_image || template.preview_url || template.thumbnail || template.preview_image || '';

        // Build full URL - ensure proper path joining
        let fullUrl = '';
        if (previewUrl) {
            if (previewUrl.startsWith('http') || previewUrl.startsWith('data:')) {
                fullUrl = previewUrl;
            } else {
                // Template paths are usually stored relative to storage root.
                if (
                    previewUrl.startsWith('templates/')
                    || previewUrl.startsWith('companies/')
                    || previewUrl.startsWith('renders/')
                ) {
                    previewUrl = 'storage/' + previewUrl;
                }
                // Ensure path starts with /
                const cleanPath = previewUrl.startsWith('/') ? previewUrl : '/' + previewUrl;
                fullUrl = basePath + cleanPath;
            }
        }

        return `
            <div class="template-preview-content">
                <div class="template-preview-image">
                    ${fullUrl ?
                        `<img src="${escapeHTML(fullUrl)}" alt="${escapeHTML(template.name)}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'preview-placeholder\\'><i class=\\'ti ti-photo-off\\'></i><span>${previewLoadError}</span></div>'" />` :
                        `<div class="preview-placeholder">
                            <i class="ti ti-layout"></i>
                            <span>${previewNotAvailable}</span>
                        </div>`
                    }
                </div>
                <div class="template-preview-info">
                    <div class="template-preview-name">${escapeHTML(template.name || templateLabel)}</div>
                    <div class="template-preview-size">${template.width || '?'} x ${template.height || '?'} px</div>
                </div>
            </div>
        `;
    }

    /**
     * Bulk send selected products to device
     */
    bulkSendToDevice() {
        if (this.selectedProducts.length === 0) {
            Toast.warning(this.__('sendToDevice.selectProducts'));
            return;
        }

        const productIds = this.selectedProducts.map(p => p.id);

        // Tek ürün seçildiğinde atanmış cihaz/şablon bilgilerini de gönder
        if (this.selectedProducts.length === 1) {
            const product = this.selectedProducts[0];
            const productName = product.name || '';
            let assignedDeviceId = product.assigned_device_id || '';
            let assignedTemplateId = product.assigned_template_id || '';

            // Fallback to labels if assigned_device/template is empty
            if ((!assignedDeviceId || !assignedTemplateId) && product.labels && product.labels.length > 0) {
                assignedDeviceId = assignedDeviceId || product.labels[0].device_id || '';
                assignedTemplateId = assignedTemplateId || product.labels[0].template_id || '';
            }

            this.showSendToDeviceModal(productIds, productName, assignedDeviceId, assignedTemplateId);
        } else {
            this.showSendToDeviceModal(productIds);
        }
    }

    /**
     * Execute send to device with render queue mechanism
     * @param {string[]} productIds - Product IDs
     * @param {string} deviceId - Target device ID
     * @param {string} templateId - Template ID
     */
    async executeSendToDevice(productIds, deviceId, templateId) {
        const total = productIds.length;
        const forceFreshRenderForSingle = total === 1;

        // Progress modal göster
        Modal.show({
            id: 'send-progress-modal',
            title: this.__('sendToDevice.sending'),
            icon: 'ti-loader',
            content: `
                <div class="send-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="send-progress-bar" style="width: 10%"></div>
                    </div>
                    <div class="progress-text mt-3">
                        <span id="send-progress-text">${this.__('sendToDevice.checkingCache')}</span>
                    </div>
                    <div class="progress-status mt-2" id="send-progress-status">
                        ${total} ${this.__('sendToDevice.productsProcessing')}
                    </div>
                </div>
            `,
            showFooter: false,
            closable: false,
            closeOnEscape: false,
            closeOnBackdrop: false
        });

        // Modal DOM'a bağlanmasını bekle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Timeout mekanizması (90 saniye)
        const timeoutId = setTimeout(() => {
            Modal.close('send-progress-modal');
            Toast.error(this.__('sendToDevice.timeout'));
        }, 90000);

        try {
            if (forceFreshRenderForSingle) {
                Logger.debug('Single send detected, bypassing cache and using fresh pre-render');
                await this._submitSingleWithPreRender(productIds, deviceId, templateId);
                clearTimeout(timeoutId);
            } else {
            // Ürün verilerini hazırla
            const productData = productIds.map(id => ({
                id: id,
                template_id: templateId
            }));

            // Render cache durumunu kontrol et
            const cacheStatus = await this._checkRenderCacheStatus(productData);

            if (cacheStatus && cacheStatus.all_ready) {
                // Tüm ürünler cache'de
                Logger.debug('All products have cached renders, using cache');
                await this._submitSingleWithCache(productIds, deviceId, templateId, cacheStatus.ready);
            } else if (cacheStatus && (cacheStatus.pending_count > 0 || cacheStatus.not_cached_count > 0)) {
                // Cache hazir degilse ilgili render job'larini bekle ve tekrar dene
                clearTimeout(timeoutId);
                Modal.close('send-progress-modal');
                await this._startRenderWorkerAndRetrySingle(cacheStatus, productIds, deviceId, templateId);
            } else if (cacheStatus && cacheStatus.ready_count > 0) {
                // Bazı ürünler hazır - cache'li olanları gönder
                const readyIds = cacheStatus.ready.map(r => r.product_id);
                await this._submitSingleWithCache(readyIds, deviceId, templateId, cacheStatus.ready);
            } else {
                // Hiç cache yok, pre-render ile gönder
                Logger.debug('No cache available, falling back to pre-render');
                await this._submitSingleWithPreRender(productIds, deviceId, templateId);
            }
            clearTimeout(timeoutId);
            }
        } catch (error) {
            clearTimeout(timeoutId);
            Logger.error('Send to device failed:', error);
            Modal.close('send-progress-modal');
            Toast.error(error.message || this.__('sendToDevice.failed'));
        }

        // Refresh table to update assigned device/template info
        this.table.refresh();

        // Clear selection
        if (total > 1) {
            this.selectedProducts = [];
            this.table.clearSelection();
        }
    }

    /**
     * Tekli gonderim icin render job'larini hedefli isle ve cache ile tekrar dene
     * @private
     */
    async _startRenderWorkerAndRetrySingle(cacheStatus, productIds, deviceId, templateId) {
        const notReady = [...(cacheStatus.pending || []), ...(cacheStatus.not_cached || [])];

        if (notReady.length === 0) {
            await this._retrySingleSendWithCache(productIds, deviceId, templateId);
            return;
        }

        const makeRenderKey = (productId, templateIdValue) => `${String(productId || '').trim()}::${String(templateIdValue || '').trim()}`;
        const expectedKeys = new Set(
            notReady
                .map(n => makeRenderKey(n.product_id, n.template_id))
                .filter(k => !k.startsWith('::'))
        );
        const expectedCount = Math.max(expectedKeys.size, 1);
        const expectedProducts = new Set(notReady.map(n => String(n.product_id)));
        const expectedTemplateIds = [...new Set(
            notReady
                .map(n => String(n.template_id || '').trim())
                .filter(Boolean)
        )];

        Modal.show({
            id: 'render-progress-modal',
            title: this.__('sendToDevice.rendering'),
            icon: 'ti-loader',
            content: `
                <div class="render-progress-container">
                    <div class="render-progress-info">
                        <p>${this.__('sendToDevice.renderingProducts')}</p>
                        <p class="render-progress-count">
                            <span id="render-completed-count">0</span> / ${expectedCount}
                        </p>
                    </div>
                    <div class="render-progress-bar">
                        <div class="render-progress-fill" id="render-progress-fill" style="width: 0%"></div>
                    </div>
                </div>
            `,
            showFooter: false,
            closable: false,
            closeOnEscape: false,
            closeOnBackdrop: false
        });

        const { getRenderWorker } = await import('../../components/RenderWorker.js?v=1.0.67');
        const worker = getRenderWorker(this.app);
        const completedKeys = new Set();

        const focusContext = {
            batchId: cacheStatus.batch_id || null,
            productIds: [...expectedProducts],
            templateIds: expectedTemplateIds.length > 0 ? expectedTemplateIds : [String(templateId || '').trim()].filter(Boolean),
            notifications: false
        };

        if (typeof worker.setFocusContext === 'function') {
            worker.setFocusContext(focusContext);
        }

        const previousNotificationMode = typeof worker.getNotificationsEnabled === 'function'
            ? worker.getNotificationsEnabled()
            : true;
        if (typeof worker.setNotificationsEnabled === 'function') {
            worker.setNotificationsEnabled(false);
        }

        const updateProgress = () => {
            const progressFill = document.getElementById('render-progress-fill');
            const countEl = document.getElementById('render-completed-count');
            const total = expectedCount;
            const done = completedKeys.size;

            if (progressFill) progressFill.style.width = `${(done / total) * 100}%`;
            if (countEl) countEl.textContent = done;
        };

        const resolveJobKey = (data) => {
            const productId = String(data?.job?.product_id || data?.product?.id || '').trim();
            const templateIdValue = String(data?.job?.template_id || '').trim();
            let key = makeRenderKey(productId, templateIdValue);
            if (expectedKeys.has(key)) {
                return key;
            }
            if (!productId) return '';
            const fallback = [...expectedKeys].find(k => k.startsWith(`${productId}::`) && !completedKeys.has(k));
            return fallback || '';
        };

        const markDone = (data) => {
            const key = resolveJobKey(data);
            if (!key || completedKeys.has(key)) {
                return false;
            }
            completedKeys.add(key);
            updateProgress();
            return completedKeys.size >= expectedCount;
        };

        await new Promise((resolve) => {
            let finished = false;
            let failSafeTimer = null;

            const cleanup = () => {
                worker.off('jobCompleted', onJobCompleted);
                worker.off('jobFailed', onJobFailed);
                worker.off('focusCompleted', onFocusCompleted);
                if (typeof worker.setNotificationsEnabled === 'function') {
                    worker.setNotificationsEnabled(previousNotificationMode);
                }
            };

            const finish = async () => {
                if (finished) return;
                finished = true;
                if (failSafeTimer) clearTimeout(failSafeTimer);
                cleanup();
                setTimeout(async () => {
                    Modal.close('render-progress-modal');
                    await this._retrySingleSendWithCache(productIds, deviceId, templateId);
                    resolve();
                }, 400);
            };

            const onJobCompleted = async (data) => {
                if (markDone(data)) {
                    await finish();
                }
            };

            const onJobFailed = async (data) => {
                if (markDone(data)) {
                    await finish();
                }
            };

            const onFocusCompleted = async () => {
                await finish();
            };

            worker.on('jobCompleted', onJobCompleted);
            worker.on('jobFailed', onJobFailed);
            worker.on('focusCompleted', onFocusCompleted);

            failSafeTimer = setTimeout(async () => {
                await finish();
            }, 90000);

            if (!worker.isRunning) {
                worker.start(focusContext);
            } else if (worker.isPaused) {
                worker.resume();
            }
        });
    }

    /**
     * Tekli gonderimde render tamamlandiktan sonra cache ile tekrar dene
     * @private
     */
    async _retrySingleSendWithCache(productIds, deviceId, templateId) {
        try {
            if ((productIds?.length || 0) === 1) {
                await this._submitSingleWithPreRender(productIds, deviceId, templateId);
                return;
            }

            const productData = productIds.map(id => ({
                id,
                template_id: templateId
            }));

            const cacheStatus = await this._checkRenderCacheStatus(productData);

            if (cacheStatus && cacheStatus.ready && cacheStatus.ready.length > 0) {
                await this._submitSingleWithCache(productIds, deviceId, templateId, cacheStatus.ready);
            } else {
                await this._submitSingleWithPreRender(productIds, deviceId, templateId);
            }
        } catch (error) {
            Logger.error('Retry single send with cache failed:', error);
            await this._submitSingleWithPreRender(productIds, deviceId, templateId);
        }
    }

    /**
     * Cache'li görsel ile tekli gönder
     * @private
     */
    async _submitSingleWithCache(productIds, deviceId, templateId, readyProducts) {
        try {
            const cachedImages = {};
            for (const item of readyProducts) {
                if (item.image_path) {
                    cachedImages[item.product_id] = item.image_path;
                }
            }

            // Progress güncelle
            const progressBar = document.getElementById('send-progress-bar');
            const progressText = document.getElementById('send-progress-text');

            if (progressBar) progressBar.style.width = '50%';
            if (progressText) progressText.textContent = this.__('sendToDevice.sendingToQueue');

            // Render queue'ya gönder (belirli device_id ile)
            const response = await this.app.api.post('/render-queue/auto', {
                product_ids: productIds,
                use_cache: true,
                cached_images: cachedImages,
                target_device_id: deviceId,
                target_template_id: templateId,
                priority: 'urgent'
            });

            Modal.close('send-progress-modal');

            if (response.success) {
                Toast.success(this.__('sendToDevice.queueSuccess', { count: productIds.length }));
                await this._refreshNotificationsAfterQueueAction();
                this._triggerQueueProcessing();
            } else {
                Toast.error(response.message || this.__('sendToDevice.failed'));
            }
        } catch (error) {
            Logger.error('Submit single with cache failed:', error);
            Modal.close('send-progress-modal');
            Toast.error(this.__('sendToDevice.failed'));
        }
    }

    /**
     * Pre-render ile tekli gönder (fallback)
     * @private
     */
    async _submitSingleWithPreRender(productIds, deviceId, templateId) {
        const renderer = getTemplateRenderer();
        const preRenderedImages = {};

        try {
            // Template'i al
            const templateRes = await this.app.api.get(`/templates/${templateId}`);
            const template = templateRes.data;

            if (!template || (!template.design_data && !template.content)) {
                Modal.close('send-progress-modal');
                Toast.error(this.__('sendToDevice.noTemplateData'));
                return;
            }

            // Güvenli progress güncelleme fonksiyonu
            const updateProgressSafe = (percent, text) => {
                const modal = document.getElementById('send-progress-modal');
                if (!modal) return;
                const progressBar = document.getElementById('send-progress-bar');
                const progressText = document.getElementById('send-progress-text');
                if (progressBar) progressBar.style.width = `${percent}%`;
                if (progressText) progressText.textContent = text;
            };

            updateProgressSafe(30, this.__('sendToDevice.rendering'));

            // Her ürünü render et
            for (let i = 0; i < productIds.length; i++) {
                const productId = productIds[i];

                const productRes = await this.app.api.get(`/products/${productId}`);
                const product = productRes.data;

                const renderedImage = await renderer.render(template, product, this._getRenderOptions(template));
                if (renderedImage) {
                    preRenderedImages[productId] = renderedImage;
                }

                updateProgressSafe(30 + ((i + 1) / productIds.length) * 40, this.__('sendToDevice.rendering'));
            }

            updateProgressSafe(80, this.__('sendToDevice.sendingToQueue'));

            // Kuyruğa gönder
            const response = await this.app.api.post('/render-queue/auto', {
                product_ids: productIds,
                pre_rendered_images: preRenderedImages,
                target_device_id: deviceId,
                target_template_id: templateId,
                priority: 'urgent'
            });

            Modal.close('send-progress-modal');

            if (response.success) {
                Toast.success(this.__('sendToDevice.queueSuccess', { count: productIds.length }));
                await this._refreshNotificationsAfterQueueAction();
                this._triggerQueueProcessing();
            } else {
                Toast.error(response.message || this.__('sendToDevice.failed'));
            }
        } catch (error) {
            Logger.error('Submit single with pre-render failed:', error);
            Modal.close('send-progress-modal');
            Toast.error(this.__('sendToDevice.failed'));
        }
    }

    /**
     * Show bulk print labels modal
     */
    async showBulkPrintModal() {
        if (!this.selectedProducts || this.selectedProducts.length === 0) {
            Toast.warning(this.__('bulkPrint.selectProducts'));
            return;
        }

        try {
            // Load templates for print - all label types (ESL + label_printer)
            const templatesRes = await this.app.api.get('/templates?type=esl&per_page=100');
            const templates = templatesRes.data?.templates || templatesRes.data || [];
            const defaultTemplateId = templates.find(t => t.is_default)?.id || '';

            const productCount = this.selectedProducts.length;

            const formContent = `
                <div class="space-y-4">
                    <div class="alert alert-info mb-4">
                        <i class="ti ti-info-circle"></i>
                        <span>${this.__('bulkPrint.info', { count: productCount })}</span>
                    </div>

                    <div class="form-group">
                        <label class="form-label">${this.__('bulkPrint.template')}</label>
                        <select id="bulk-print-template" class="form-select">
                            <option value="">${this.__('bulkPrint.templatePlaceholder')}</option>
                            ${templates.map(t => `<option value="${t.id}" ${defaultTemplateId === t.id ? 'selected' : ''}>${escapeHTML(t.name)}</option>`).join('')}
                        </select>
                        <p class="form-hint">${this.__('bulkPrint.templateHint')}</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">${this.__('bulkPrint.paperSize')}</label>
                        <select id="bulk-print-paper" class="form-select">
                            <option value="" data-width="0" data-height="0">${this.__('bulkPrint.paperSizeNone')}</option>
                            <option value="a4" data-width="210" data-height="297">A4 (210 x 297 mm)</option>
                            <option value="a3" data-width="297" data-height="420">A3 (297 x 420 mm)</option>
                            <option value="a5" data-width="148" data-height="210">A5 (148 x 210 mm)</option>
                            <option value="letter" data-width="216" data-height="279">Letter (216 x 279 mm)</option>
                            <option value="legal" data-width="216" data-height="356">Legal (216 x 356 mm)</option>
                        </select>
                        <p class="form-hint">${this.__('bulkPrint.paperSizeHint')}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">${this.__('bulkPrint.copies')}</label>
                            <input type="number" id="bulk-print-copies" class="form-input" value="1" min="1" max="100">
                            <p class="form-hint">${this.__('bulkPrint.copiesHint')}</p>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('bulkPrint.labelSize')}</label>
                            <select id="bulk-print-size" class="form-select">
                                <option value="">${this.__('messages.loading')}</option>
                            </select>
                            <div class="flex items-center justify-between mt-1">
                                <span class="form-hint text-xs">${this.__('bulkPrint.labelSizeHint')}</span>
                                <a href="#/settings/labels" class="text-xs text-primary hover:underline">
                                    <i class="ti ti-settings text-xs"></i> ${this.__('bulkPrint.manageSizes')}
                                </a>
                            </div>
                        </div>
                    </div>

                    <div id="bulk-print-grid-info" class="alert alert-success mb-0" style="display: none;">
                        <i class="ti ti-layout-grid"></i>
                        <span id="bulk-print-grid-text"></span>
                    </div>

                    <div class="form-group mt-3 mb-0">
                        <label class="flex items-center gap-2 cursor-pointer" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="checkbox" id="bulk-print-use-html" style="width:16px;height:16px;">
                            <span style="font-size:13px;">
                                <strong>${this.__('bulkPrint.htmlPrint.label')}</strong>
                                <span style="color:var(--text-muted);margin-left:4px;font-size:12px;">${this.__('bulkPrint.htmlPrint.hint')}</span>
                            </span>
                        </label>
                    </div>
                </div>
            `;

            Modal.show({
                title: this.__('bulkPrint.title'),
                icon: 'ti-printer',
                content: formContent,
                size: 'md',
                confirmText: this.__('bulkPrint.print'),
                cancelText: this.__('actions.cancel'),
                onConfirm: async () => {
                    const templateId = document.getElementById('bulk-print-template')?.value || defaultTemplateId;
                    const copies = parseInt(document.getElementById('bulk-print-copies')?.value) || 1;
                    const sizeSelect = document.getElementById('bulk-print-size');
                    const selectedOption = sizeSelect?.options[sizeSelect.selectedIndex];
                    const width = selectedOption?.dataset?.width;
                    const height = selectedOption?.dataset?.height;
                    const unit = selectedOption?.dataset?.unit || 'mm';

                    // Paper size selection
                    const paperSelect = document.getElementById('bulk-print-paper');
                    const paperOption = paperSelect?.options[paperSelect.selectedIndex];
                    const paperWidth = parseInt(paperOption?.dataset?.width) || 0;
                    const paperHeight = parseInt(paperOption?.dataset?.height) || 0;

                    if (!width || !height) {
                        Toast.error(this.__('bulkPrint.sizeRequired'));
                        throw new Error('Size not selected');
                    }

                    // mm to inch conversion if needed
                    let widthInch = parseFloat(width);
                    let heightInch = parseFloat(height);
                    if (unit === 'mm') {
                        widthInch = widthInch / 25.4;
                        heightInch = heightInch / 25.4;
                    }

                    // Fetch template if selected
                    let template = null;
                    if (templateId) {
                        try {
                            const templateRes = await this.app.api.get(`/templates/${templateId}`);
                            template = templateRes.data;
                        } catch (err) {
                            Logger.warn('Template fetch failed, using default layout:', err);
                        }
                    }

                    // HTML Baskı seçili mi?
                    const useHtmlPrint = document.getElementById('bulk-print-use-html')?.checked;

                    if (useHtmlPrint && templateId) {
                        await this.bulkPrintViaHtml({
                            templateId,
                            copies,
                            labelWidthMm: parseInt(width),
                            labelHeightMm: parseInt(height),
                            paperWidthMm: paperWidth,
                            paperHeightMm: paperHeight,
                            type: 'product'
                        });
                    } else if (paperWidth > 0 && paperHeight > 0) {
                        // If paper size selected, use multi-label grid layout
                        this.bulkPrintPreviewGrid(copies, parseInt(width), parseInt(height), paperWidth, paperHeight, template);
                    } else {
                        // Original single label per page mode
                        this.bulkPrintPreview(copies, `${widthInch.toFixed(2)}x${heightInch.toFixed(2)}`, parseInt(width), parseInt(height), template);
                    }
                }
            });

            // Load label sizes
            setTimeout(() => this.loadBulkPrintLabelSizes(), 100);

        } catch (error) {
            Logger.error('Error showing bulk print modal:', error);
            Toast.error(this.__('bulkPrint.loadFailed'));
        }
    }

    /**
     * HTML Baskı - Sunucu taraflı FabricToHtmlConverter ile baskı
     */
    async bulkPrintViaHtml({ templateId, copies, labelWidthMm, labelHeightMm, paperWidthMm, paperHeightMm, type }) {
        const items = this.selectedProducts;
        if (!items || items.length === 0) return;

        // Popup'u await öncesi aç (popup blocker engeli)
        const popupWidth = Math.min(1400, window.screen.width - 100);
        const popupHeight = Math.min(900, window.screen.height - 100);
        const left = (window.screen.width - popupWidth) / 2;
        const top = (window.screen.height - popupHeight) / 2;
        const printWindow = window.open('', 'htmlPrintPreview',
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`);

        if (!printWindow) {
            Toast.error(this.__('bulkPrint.popupBlocked') || 'Popup engellendi. Lütfen popup engelleyicisini kapatın.');
            return;
        }

        // Yükleniyor durumu göster
        printWindow.document.write(`<!DOCTYPE html><html><head><title>Yükleniyor...</title></head><body style="background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:12px;"><div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.2);border-top:3px solid #228be6;border-radius:50%;animation:spin 1s linear infinite;"></div><p>Etiketler hazırlanıyor... (${items.length} ${type === 'bundle' ? 'paket' : 'ürün'})</p><style>@keyframes spin{to{transform:rotate(360deg)}}</style></body></html>`);

        try {
            const itemIds = items.map(p => p.id);
            const basePath = window.OmnexConfig?.basePath || '';

            const response = await fetch(
                `${basePath}/api/templates/${templateId}/print-html`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.app.api.token || localStorage.getItem('omnex_token')}`,
                        'X-Active-Company': localStorage.getItem('omnex_active_company') || ''
                    },
                    body: JSON.stringify({
                        product_ids: itemIds,
                        type: type || 'product',
                        copies,
                        label_width_mm: labelWidthMm,
                        label_height_mm: labelHeightMm,
                        paper_width_mm: paperWidthMm,
                        paper_height_mm: paperHeightMm
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
            }

            const html = await response.text();

            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();

            Toast.success(this.__('bulkPrint.previewOpened') || 'Baskı önizlemesi açıldı');
        } catch (err) {
            Logger.error('HTML print error:', err);
            printWindow.close();
            Toast.error(this.__('bulkPrint.htmlPrint.failed') || 'HTML baskı başarısız oldu');
        }
    }

    /**
     * Load label sizes for bulk print modal
     */
    async loadBulkPrintLabelSizes() {
        try {
            const response = await this.app.api.get('/label-sizes');
            const sizes = response.data || [];
            const select = document.getElementById('bulk-print-size');
            if (select) {
                select.innerHTML = '';

                if (sizes.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = this.__('bulkPrint.noSizesFound');
                    select.appendChild(option);
                    return;
                }

                sizes.forEach((size, index) => {
                    const option = document.createElement('option');
                    option.value = size.id;
                    option.dataset.width = size.width;
                    option.dataset.height = size.height;
                    option.dataset.unit = size.unit;

                    // Format display text
                    const displayName = size.name || `${size.width}x${size.height} ${size.unit}`;
                    const inchWidth = size.unit === 'mm' ? (size.width / 25.4).toFixed(2) : size.width;
                    const inchHeight = size.unit === 'mm' ? (size.height / 25.4).toFixed(2) : size.height;
                    option.textContent = `${displayName} (${inchWidth}" x ${inchHeight}")`;

                    // Mark default
                    if (size.is_default) {
                        option.selected = true;
                    }

                    select.appendChild(option);
                });

                // If no default, select first
                if (!sizes.some(s => s.is_default) && select.options.length > 0) {
                    select.selectedIndex = 0;
                }

                // Add event listeners to update grid info
                select.addEventListener('change', () => this.updateBulkPrintGridInfo());
            }

            // Add event listener to paper size selector
            const paperSelect = document.getElementById('bulk-print-paper');
            if (paperSelect) {
                paperSelect.addEventListener('change', () => this.updateBulkPrintGridInfo());
            }

            // Initial grid info update
            this.updateBulkPrintGridInfo();
        } catch (error) {
            Logger.error('Label sizes load error:', error);
            const select = document.getElementById('bulk-print-size');
            if (select) {
                select.innerHTML = `<option value="">${this.__('toast.loadError')}</option>`;
            }
        }
    }

    /**
     * Update grid info display in bulk print modal
     */
    updateBulkPrintGridInfo() {
        const paperSelect = document.getElementById('bulk-print-paper');
        const sizeSelect = document.getElementById('bulk-print-size');
        const gridInfo = document.getElementById('bulk-print-grid-info');
        const gridText = document.getElementById('bulk-print-grid-text');

        if (!paperSelect || !sizeSelect || !gridInfo || !gridText) return;

        const paperOption = paperSelect.options[paperSelect.selectedIndex];
        const paperWidth = parseInt(paperOption?.dataset?.width) || 0;
        const paperHeight = parseInt(paperOption?.dataset?.height) || 0;

        const sizeOption = sizeSelect.options[sizeSelect.selectedIndex];
        let labelWidth = parseInt(sizeOption?.dataset?.width) || 0;
        let labelHeight = parseInt(sizeOption?.dataset?.height) || 0;
        const unit = sizeOption?.dataset?.unit || 'mm';

        // Convert to mm if needed
        if (unit === 'inch') {
            labelWidth = Math.round(labelWidth * 25.4);
            labelHeight = Math.round(labelHeight * 25.4);
        }

        if (paperWidth === 0 || labelWidth === 0) {
            gridInfo.style.display = 'none';
            return;
        }

        // Calculate grid dimensions (with 2mm margin on each side)
        const marginMm = 2;
        const usablePaperWidth = paperWidth - (marginMm * 2);
        const usablePaperHeight = paperHeight - (marginMm * 2);

        const cols = Math.floor(usablePaperWidth / labelWidth);
        const rows = Math.floor(usablePaperHeight / labelHeight);
        const labelsPerPage = cols * rows;

        if (labelsPerPage > 0) {
            const productCount = this.selectedProducts?.length || 0;
            const copies = parseInt(document.getElementById('bulk-print-copies')?.value) || 1;
            const totalLabels = productCount * copies;
            const pagesNeeded = Math.ceil(totalLabels / labelsPerPage);

            gridText.textContent = this.__('bulkPrint.gridInfo', {
                cols: cols,
                rows: rows,
                labelsPerPage: labelsPerPage,
                totalLabels: totalLabels,
                pages: pagesNeeded
            });
            gridInfo.style.display = 'flex';
        } else {
            gridText.textContent = this.__('bulkPrint.labelTooLarge');
            gridInfo.className = 'alert alert-warning mb-0';
            gridInfo.style.display = 'flex';
        }
    }

    /**
     * Open bulk print preview popup with multi-label grid layout on paper
     */
    bulkPrintPreviewGrid(copies, labelWidthMm, labelHeightMm, paperWidthMm, paperHeightMm, template = null) {
        const products = this.selectedProducts;
        const totalLabels = products.length * copies;

        // Calculate grid dimensions (with 2mm margin on each side)
        const marginMm = 2;
        const usablePaperWidth = paperWidthMm - (marginMm * 2);
        const usablePaperHeight = paperHeightMm - (marginMm * 2);

        const cols = Math.floor(usablePaperWidth / labelWidthMm);
        const rows = Math.floor(usablePaperHeight / labelHeightMm);
        const labelsPerPage = cols * rows;

        if (labelsPerPage === 0) {
            Toast.error(this.__('bulkPrint.labelTooLarge'));
            return;
        }

        // Build array of all labels to print (with copies)
        const allLabels = [];
        products.forEach(product => {
            for (let i = 0; i < copies; i++) {
                allLabels.push(product);
            }
        });

        // Split labels into pages
        const pages = [];
        for (let i = 0; i < allLabels.length; i += labelsPerPage) {
            pages.push(allLabels.slice(i, i + labelsPerPage));
        }

        // Help text
        const helpPaperSize = this.__('bulkPrint.previewHelp.paperSize');
        const helpProductCount = this.__('bulkPrint.previewHelp.productCount');
        const helpCopies = this.__('bulkPrint.previewHelp.copies');
        const helpTotalLabels = this.__('bulkPrint.previewHelp.totalLabels');
        const helpWarning = this.__('bulkPrint.previewHelp.warning', { width: labelWidthMm, height: labelHeightMm });
        const printBtnText = this.__('bulkPrint.print');
        const closeBtnText = this.__('actions.close') || 'Kapat';

        // Calculate font sizes based on label height (proportional scaling)
        const baseFontScale = labelHeightMm / 50;
        const nameFontSize = Math.max(6, Math.min(14, 10 * baseFontScale));
        const priceFontSize = Math.max(10, Math.min(28, 18 * baseFontScale));
        const oldPriceFontSize = Math.max(6, Math.min(12, 8 * baseFontScale));
        const barcodeFontSize = Math.max(5, Math.min(10, 7 * baseFontScale));
        const skuFontSize = Math.max(4, Math.min(8, 5 * baseFontScale));
        const labelPadding = Math.max(2, Math.min(10, 6 * baseFontScale));

        // Generate label HTML
        const generateLabelHtml = (product) => {
            const displayBarcode = this._getPrintBarcode(product);
            if (template && template.design_data) {
                return this.renderTemplateLabel(product, template, labelWidthMm, labelHeightMm, 1);
            }
            return `
                <div class="label-content">
                    <div class="product-name">${this.escapeHtml(product.name)}</div>
                    <div class="price-section">
                        ${product.previous_price ? `<div class="old-price">${this.formatCurrency(product.previous_price)}</div>` : ''}
                        <div class="price">${this.formatCurrency(product.current_price)}</div>
                    </div>
                    <div class="barcode">${escapeHTML(displayBarcode)}</div>
                    <div class="sku">SKU: ${escapeHTML(product.sku)}</div>
                </div>
            `;
        };

        // Generate pages HTML
        const generatePageHtml = (pageLabels, pageIndex) => {
            let labelsHtml = '';
            for (let i = 0; i < labelsPerPage; i++) {
                if (i < pageLabels.length) {
                    labelsHtml += `<div class="label">${generateLabelHtml(pageLabels[i])}</div>`;
                } else {
                    // Empty placeholder to maintain grid structure
                    labelsHtml += `<div class="label empty"></div>`;
                }
            }
            return `
                <div class="page" data-page="${pageIndex + 1}">
                    <div class="page-grid">
                        ${labelsHtml}
                    </div>
                </div>
            `;
        };

        // Popup window dimensions
        const popupWidth = Math.min(1400, window.screen.width - 100);
        const popupHeight = Math.min(900, window.screen.height - 100);
        const left = (window.screen.width - popupWidth) / 2;
        const top = (window.screen.height - popupHeight) / 2;

        // Open popup window
        const printWindow = window.open(
            '',
            'printPreviewGrid',
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );

        if (!printWindow) {
            Toast.error(this.__('bulkPrint.popupBlocked') || 'Popup engellendi.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${this.__('bulkPrint.previewTitle', { count: products.length })}</title>
                <style>
                    @page {
                        size: ${paperWidthMm}mm ${paperHeightMm}mm;
                        margin: ${marginMm}mm;
                    }
                    @media print {
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                        }
                        .toolbar, .info-panel { display: none !important; }
                        .main-content { padding: 0 !important; }
                        .page {
                            width: ${paperWidthMm - (marginMm * 2)}mm !important;
                            height: ${paperHeightMm - (marginMm * 2)}mm !important;
                            page-break-after: always;
                            page-break-inside: avoid;
                            box-shadow: none !important;
                            border: none !important;
                            margin: 0 !important;
                        }
                        .page:last-child {
                            page-break-after: auto;
                        }
                        .label.empty {
                            visibility: hidden;
                        }
                    }
                    * { box-sizing: border-box; }
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        min-height: 100vh;
                        color: #f8f9fa;
                    }
                    .toolbar {
                        position: sticky;
                        top: 0;
                        z-index: 100;
                        background: rgba(26, 26, 46, 0.95);
                        backdrop-filter: blur(10px);
                        padding: 16px 24px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid rgba(255,255,255,0.1);
                    }
                    .toolbar-left {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                    }
                    .toolbar-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #fff;
                    }
                    .toolbar-stats {
                        display: flex;
                        gap: 20px;
                        font-size: 13px;
                        color: rgba(255,255,255,0.7);
                    }
                    .toolbar-stat {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    .toolbar-stat strong { color: #4dabf7; }
                    .toolbar-right { display: flex; gap: 12px; }
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: all 0.2s;
                    }
                    .btn-primary {
                        background: linear-gradient(135deg, #228be6, #1971c2);
                        color: white;
                    }
                    .btn-primary:hover {
                        background: linear-gradient(135deg, #339af0, #1c7ed6);
                        transform: translateY(-1px);
                    }
                    .btn-secondary {
                        background: rgba(255,255,255,0.1);
                        color: rgba(255,255,255,0.8);
                    }
                    .btn-secondary:hover { background: rgba(255,255,255,0.15); }
                    .info-panel {
                        background: rgba(34, 139, 230, 0.1);
                        border: 1px solid rgba(34, 139, 230, 0.3);
                        border-radius: 12px;
                        padding: 16px 24px;
                        margin: 20px 24px;
                        display: flex;
                        align-items: center;
                        gap: 24px;
                        flex-wrap: wrap;
                    }
                    .info-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 13px;
                    }
                    .info-item-label { color: rgba(255,255,255,0.6); }
                    .info-item-value { font-weight: 600; color: #fff; }
                    .info-warning {
                        margin-left: auto;
                        background: rgba(250, 176, 5, 0.15);
                        border: 1px solid rgba(250, 176, 5, 0.3);
                        border-radius: 8px;
                        padding: 8px 14px;
                        font-size: 12px;
                        color: #fcc419;
                    }
                    .main-content {
                        padding: 24px;
                        display: flex;
                        flex-direction: column;
                        gap: 24px;
                        align-items: center;
                    }
                    .page {
                        width: ${paperWidthMm - (marginMm * 2)}mm;
                        height: ${paperHeightMm - (marginMm * 2)}mm;
                        background: white;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                        border-radius: 4px;
                        flex-shrink: 0;
                        position: relative;
                    }
                    .page-grid {
                        display: grid;
                        grid-template-columns: repeat(${cols}, ${labelWidthMm}mm);
                        grid-template-rows: repeat(${rows}, ${labelHeightMm}mm);
                        width: 100%;
                        height: 100%;
                        justify-content: center;
                        align-content: center;
                    }
                    .label {
                        width: ${labelWidthMm}mm;
                        height: ${labelHeightMm}mm;
                        border: 1px dashed rgba(0,0,0,0.15);
                        overflow: hidden;
                        color: #212529;
                        background: white;
                    }
                    .label.empty {
                        background: rgba(0,0,0,0.02);
                    }
                    .label-content {
                        width: 100%;
                        height: 100%;
                        padding: ${labelPadding}px;
                        display: flex;
                        flex-direction: column;
                    }
                    .label-template-wrapper {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-sizing: border-box;
                    }
                    .template-canvas {
                        position: relative;
                        overflow: hidden;
                    }
                    .product-name {
                        font-size: ${nameFontSize}px;
                        font-weight: 700;
                        color: #212529;
                        margin-bottom: auto;
                        line-height: 1.1;
                        overflow: hidden;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                    }
                    .price-section { margin-top: auto; }
                    .old-price {
                        font-size: ${oldPriceFontSize}px;
                        color: #444;
                        text-decoration: line-through;
                    }
                    .price {
                        font-size: ${priceFontSize}px;
                        font-weight: 800;
                        color: #e03131;
                        line-height: 1;
                    }
                    .barcode {
                        font-family: 'Courier New', monospace;
                        font-size: ${barcodeFontSize}px;
                        background: #f8f9fa;
                        padding: 2px 4px;
                        border-radius: 2px;
                        margin-top: 2px;
                        color: #212529;
                        letter-spacing: 1px;
                        text-align: center;
                        font-weight: 600;
                    }
                    .sku {
                        font-size: ${skuFontSize}px;
                        color: #333;
                        margin-top: 1px;
                        text-align: center;
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <div class="toolbar-left">
                        <div class="toolbar-title">🖨️ ${this.__('bulkPrint.previewTitle', { count: products.length })}</div>
                        <div class="toolbar-stats">
                            <div class="toolbar-stat">
                                <span>${helpProductCount}:</span>
                                <strong>${products.length}</strong>
                            </div>
                            <div class="toolbar-stat">
                                <span>${helpCopies}:</span>
                                <strong>${copies}</strong>
                            </div>
                            <div class="toolbar-stat">
                                <span>${helpTotalLabels}:</span>
                                <strong>${totalLabels}</strong>
                            </div>
                            <div class="toolbar-stat">
                                <span>${this.__('bulkPrint.pages')}:</span>
                                <strong>${pages.length}</strong>
                            </div>
                            <div class="toolbar-stat">
                                <span>${this.__('bulkPrint.labelsPerPage')}:</span>
                                <strong>${labelsPerPage} (${cols}x${rows})</strong>
                            </div>
                        </div>
                    </div>
                    <div class="toolbar-right">
                        <button class="btn btn-secondary" onclick="window.close()">
                            ✕ ${closeBtnText}
                        </button>
                        <button class="btn btn-primary" onclick="window.print()">
                            🖨️ ${printBtnText}
                        </button>
                    </div>
                </div>
                <div class="info-panel">
                    <div class="info-item">
                        <span class="info-item-label">📄 ${helpPaperSize}:</span>
                        <span class="info-item-value">${paperWidthMm} x ${paperHeightMm} mm</span>
                    </div>
                    <div class="info-item">
                        <span class="info-item-label">🏷️ ${this.__('bulkPrint.labelSize')}:</span>
                        <span class="info-item-value">${labelWidthMm} x ${labelHeightMm} mm</span>
                    </div>
                    <div class="info-item">
                        <span class="info-item-label">📐 Grid:</span>
                        <span class="info-item-value">${cols} x ${rows} = ${labelsPerPage} ${this.__('bulkPrint.labelsPerPageSuffix')}</span>
                    </div>
                    <div class="info-warning">⚠️ ${helpWarning}</div>
                </div>
                <div class="main-content">
                    ${pages.map((pageLabels, pageIndex) => generatePageHtml(pageLabels, pageIndex)).join('')}
                </div>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
                <script>
                    document.addEventListener('DOMContentLoaded', function() {
                        document.querySelectorAll('.print-barcode').forEach(function(svg) {
                            var val = svg.getAttribute('data-barcode');
                            var w = parseFloat(svg.getAttribute('data-width'));
                            var h = parseFloat(svg.getAttribute('data-height'));
                            if (!val) return;
                            try {
                                var format = 'CODE128';
                                var cleaned = val.replace(/[^0-9]/g, '');
                                if (/^\\d{13}$/.test(cleaned)) format = 'EAN13';
                                else if (/^\\d{8}$/.test(cleaned)) format = 'EAN8';
                                else if (/^\\d{12}$/.test(cleaned)) format = 'UPC';
                                JsBarcode(svg, val, {
                                    format: format,
                                    width: Math.max(1, w / 80),
                                    height: Math.max(20, h * 0.7),
                                    displayValue: true,
                                    fontSize: Math.max(8, Math.min(14, h * 0.15)),
                                    margin: 2,
                                    textMargin: 1
                                });
                            } catch(e) {
                                try { JsBarcode(svg, val, { format: 'CODE128', width: 1, height: Math.max(20, h*0.7), displayValue: true, fontSize: 10, margin: 2 }); } catch(e2) {}
                            }
                        });
                    });
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        Toast.success(this.__('bulkPrint.previewOpened'));
    }

    /**
     * Open bulk print preview popup with all selected products
     * Labels are shown at their actual size (mm)
     * If template is provided, renders template content scaled to fit with padding
     */
    bulkPrintPreview(copies, size, widthMm, heightMm, template = null) {
        const [width, height] = size.split('x').map(s => parseFloat(s));
        const products = this.selectedProducts;
        const totalLabels = products.length * copies;

        // Padding in mm (all 4 sides)
        const paddingMm = 2;

        // Help text
        const helpTitle = this.__('bulkPrint.previewHelp.title');
        const helpPaperSize = this.__('bulkPrint.previewHelp.paperSize');
        const helpProductCount = this.__('bulkPrint.previewHelp.productCount');
        const helpCopies = this.__('bulkPrint.previewHelp.copies');
        const helpTotalLabels = this.__('bulkPrint.previewHelp.totalLabels');
        const helpWarning = this.__('bulkPrint.previewHelp.warning', { width: widthMm, height: heightMm });
        const helpTip = this.__('bulkPrint.previewHelp.tip');
        const printBtnText = this.__('bulkPrint.print');
        const closeBtnText = this.__('actions.close') || 'Kapat';

        // Calculate font sizes based on label height (proportional scaling)
        const baseFontScale = heightMm / 50; // Normalize to 50mm reference
        const nameFontSize = Math.max(8, Math.min(18, 12 * baseFontScale));
        const priceFontSize = Math.max(14, Math.min(36, 24 * baseFontScale));
        const oldPriceFontSize = Math.max(8, Math.min(16, 11 * baseFontScale));
        const barcodeFontSize = Math.max(6, Math.min(12, 9 * baseFontScale));
        const skuFontSize = Math.max(5, Math.min(10, 7 * baseFontScale));
        const labelPadding = Math.max(4, Math.min(16, 10 * baseFontScale));

        // Generate labels HTML for each product
        const generateProductLabels = (product) => {
            const displayBarcode = this._getPrintBarcode(product);
            const labels = [];
            for (let i = 0; i < copies; i++) {
                // If template with design data provided, render template-based label
                if (template && template.design_data) {
                    labels.push(this.renderTemplateLabel(product, template, widthMm, heightMm, paddingMm));
                } else {
                    // Default basic layout
                    labels.push(`
                        <div class="label">
                            <div class="label-content">
                                <div class="product-name">${this.escapeHtml(product.name)}</div>
                                <div class="price-section">
                                    ${product.previous_price ? `<div class="old-price">${this.formatCurrency(product.previous_price)}</div>` : ''}
                                    <div class="price">${this.formatCurrency(product.current_price)}</div>
                                </div>
                                <div class="barcode">${escapeHTML(displayBarcode)}</div>
                                <div class="sku">SKU: ${escapeHTML(product.sku)}</div>
                            </div>
                        </div>
                    `);
                }
            }
            return labels.join('');
        };

        // Popup pencere boyutları - geniş format
        const popupWidth = Math.min(1400, window.screen.width - 100);
        const popupHeight = Math.min(900, window.screen.height - 100);
        const left = (window.screen.width - popupWidth) / 2;
        const top = (window.screen.height - popupHeight) / 2;

        // Open popup window
        const printWindow = window.open(
            '',
            'printPreview',
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
        );

        if (!printWindow) {
            Toast.error(this.__('bulkPrint.popupBlocked'));
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${this.__('bulkPrint.previewTitle', { count: products.length })}</title>
                <style>
                    @page {
                        size: ${widthMm}mm ${heightMm}mm;
                        margin: 0;
                    }
                    @media print {
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                        }
                        .toolbar, .info-panel, .size-indicator { display: none !important; }
                        .main-content { padding: 0 !important; }
                        .labels-container {
                            padding: 0 !important;
                            gap: 0 !important;
                            display: block !important;
                        }
                        .label {
                            width: ${widthMm}mm !important;
                            height: ${heightMm}mm !important;
                            box-shadow: none !important;
                            border: none !important;
                            border-radius: 0 !important;
                            margin: 0 !important;
                            page-break-after: always;
                            page-break-inside: avoid;
                        }
                        .label:last-child {
                            page-break-after: auto;
                        }
                    }
                    * { box-sizing: border-box; }
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        min-height: 100vh;
                        color: #f8f9fa;
                    }
                    .toolbar {
                        position: sticky;
                        top: 0;
                        z-index: 100;
                        background: rgba(26, 26, 46, 0.95);
                        backdrop-filter: blur(10px);
                        padding: 16px 24px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid rgba(255,255,255,0.1);
                    }
                    .toolbar-left {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                    }
                    .toolbar-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #fff;
                    }
                    .toolbar-stats {
                        display: flex;
                        gap: 20px;
                        font-size: 13px;
                        color: rgba(255,255,255,0.7);
                    }
                    .toolbar-stat {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    .toolbar-stat strong {
                        color: #4dabf7;
                    }
                    .toolbar-right {
                        display: flex;
                        gap: 12px;
                    }
                    .btn {
                        padding: 10px 20px;
                        border: none;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: all 0.2s;
                    }
                    .btn-primary {
                        background: linear-gradient(135deg, #228be6, #1971c2);
                        color: white;
                    }
                    .btn-primary:hover {
                        background: linear-gradient(135deg, #339af0, #1c7ed6);
                        transform: translateY(-1px);
                    }
                    .btn-secondary {
                        background: rgba(255,255,255,0.1);
                        color: rgba(255,255,255,0.8);
                    }
                    .btn-secondary:hover {
                        background: rgba(255,255,255,0.15);
                    }
                    .info-panel {
                        background: rgba(34, 139, 230, 0.1);
                        border: 1px solid rgba(34, 139, 230, 0.3);
                        border-radius: 12px;
                        padding: 16px 24px;
                        margin: 20px 24px;
                        display: flex;
                        align-items: center;
                        gap: 24px;
                        flex-wrap: wrap;
                    }
                    .info-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 13px;
                    }
                    .info-item-label { color: rgba(255,255,255,0.6); }
                    .info-item-value { font-weight: 600; color: #fff; }
                    .info-warning {
                        margin-left: auto;
                        background: rgba(250, 176, 5, 0.15);
                        border: 1px solid rgba(250, 176, 5, 0.3);
                        border-radius: 8px;
                        padding: 8px 14px;
                        font-size: 12px;
                        color: #fcc419;
                    }
                    .size-indicator {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        background: rgba(64, 192, 87, 0.15);
                        border: 1px solid rgba(64, 192, 87, 0.3);
                        border-radius: 8px;
                        padding: 6px 12px;
                        font-size: 12px;
                        color: #51cf66;
                    }
                    .main-content {
                        padding: 24px;
                    }
                    .labels-container {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 20px;
                        justify-content: center;
                        align-items: flex-start;
                    }
                    .label {
                        /* Gerçek boyutlar - mm cinsinden */
                        width: ${widthMm}mm;
                        height: ${heightMm}mm;
                        min-width: ${widthMm}mm;
                        min-height: ${heightMm}mm;
                        max-width: ${widthMm}mm;
                        max-height: ${heightMm}mm;
                        background: white;
                        border-radius: 4px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                        color: #212529;
                        overflow: hidden;
                        flex-shrink: 0;
                        position: relative;
                        border: 1px solid rgba(0,0,0,0.1);
                    }
                    .label-content {
                        width: 100%;
                        height: 100%;
                        padding: ${labelPadding}px;
                        display: flex;
                        flex-direction: column;
                    }
                    .label-template-wrapper {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-sizing: border-box;
                    }
                    .template-canvas {
                        position: relative;
                        overflow: hidden;
                    }
                    .template-canvas * {
                        box-sizing: border-box;
                    }
                    .product-name {
                        font-size: ${nameFontSize}px;
                        font-weight: 700;
                        color: #212529;
                        margin-bottom: auto;
                        line-height: 1.2;
                        overflow: hidden;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                    }
                    .price-section {
                        margin-top: auto;
                    }
                    .old-price {
                        font-size: ${oldPriceFontSize}px;
                        color: #444;
                        text-decoration: line-through;
                    }
                    .price {
                        font-size: ${priceFontSize}px;
                        font-weight: 800;
                        color: #e03131;
                        line-height: 1;
                    }
                    .barcode {
                        font-family: 'Courier New', monospace;
                        font-size: ${barcodeFontSize}px;
                        background: #f8f9fa;
                        padding: 3px 6px;
                        border-radius: 3px;
                        margin-top: 4px;
                        color: #212529;
                        letter-spacing: 1px;
                        text-align: center;
                        font-weight: 600;
                    }
                    .sku {
                        font-size: ${skuFontSize}px;
                        color: #333;
                        margin-top: 2px;
                        text-align: center;
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <div class="toolbar-left">
                        <div class="toolbar-title">🖨️ ${this.__('bulkPrint.previewTitle', { count: products.length })}</div>
                        <div class="toolbar-stats">
                            <div class="toolbar-stat">
                                <span>${helpProductCount}:</span>
                                <strong>${products.length}</strong>
                            </div>
                            <div class="toolbar-stat">
                                <span>${helpCopies}:</span>
                                <strong>${copies}</strong>
                            </div>
                            <div class="toolbar-stat">
                                <span>${helpTotalLabels}:</span>
                                <strong>${totalLabels}</strong>
                            </div>
                        </div>
                    </div>
                    <div class="toolbar-right">
                        <button class="btn btn-secondary" onclick="window.close()">
                            ✕ ${closeBtnText}
                        </button>
                        <button class="btn btn-primary" onclick="window.print()">
                            🖨️ ${printBtnText}
                        </button>
                    </div>
                </div>
                <div class="info-panel">
                    <div class="info-item">
                        <span class="info-item-label">📄 ${helpPaperSize}:</span>
                        <span class="info-item-value">${widthMm} x ${heightMm} mm</span>
                    </div>
                    <div class="size-indicator">
                        📐 Gerçek Boyut Önizleme
                    </div>
                    <div class="info-warning">⚠️ ${helpWarning}</div>
                </div>
                <div class="main-content">
                    <div class="labels-container">
                        ${products.map(p => generateProductLabels(p)).join('')}
                    </div>
                </div>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
                <script>
                    document.addEventListener('DOMContentLoaded', function() {
                        document.querySelectorAll('.print-barcode').forEach(function(svg) {
                            var val = svg.getAttribute('data-barcode');
                            var w = parseFloat(svg.getAttribute('data-width'));
                            var h = parseFloat(svg.getAttribute('data-height'));
                            if (!val) return;
                            try {
                                var format = 'CODE128';
                                var cleaned = val.replace(/[^0-9]/g, '');
                                if (/^\\d{13}$/.test(cleaned)) format = 'EAN13';
                                else if (/^\\d{8}$/.test(cleaned)) format = 'EAN8';
                                else if (/^\\d{12}$/.test(cleaned)) format = 'UPC';
                                JsBarcode(svg, val, {
                                    format: format,
                                    width: Math.max(1, w / 80),
                                    height: Math.max(20, h * 0.7),
                                    displayValue: true,
                                    fontSize: Math.max(8, Math.min(14, h * 0.15)),
                                    margin: 2,
                                    textMargin: 1
                                });
                            } catch(e) {
                                try { JsBarcode(svg, val, { format: 'CODE128', width: 1, height: Math.max(20, h*0.7), displayValue: true, fontSize: 10, margin: 2 }); } catch(e2) {}
                            }
                        });
                    });
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        Toast.success(this.__('bulkPrint.previewOpened'));
    }

    /**
     * Render a template-based label with product data
     * Centers and scales the content to fit within label dimensions with padding
     */
    renderTemplateLabel(product, template, labelWidthMm, labelHeightMm, paddingMm) {
        // Calculate available space after padding (in pixels at 96 DPI for screen)
        const mmToPx = 96 / 25.4; // 96 DPI conversion
        const labelWidthPx = labelWidthMm * mmToPx;
        const labelHeightPx = labelHeightMm * mmToPx;
        const paddingPx = paddingMm * mmToPx;
        const availableWidthPx = labelWidthPx - (paddingPx * 2);
        const availableHeightPx = labelHeightPx - (paddingPx * 2);

        // Template original dimensions
        const templateWidth = template.width || 227;
        const templateHeight = template.height || 151;

        // Fit template to available space - fill entire area
        const scaleX = availableWidthPx / templateWidth;
        const scaleY = availableHeightPx / templateHeight;
        const scale = Math.min(scaleX, scaleY);

        // Canvas fills entire available area
        const scaledWidth = availableWidthPx;
        const scaledHeight = availableHeightPx;

        // Spread factors: object sizes stay proportional, positions spread to fill space
        const spreadX = scaleX / scale;
        const spreadY = scaleY / scale;

        // Parse design data
        let designData;
        const rawDesignData = template.design_data || template.content || '{}';
        try {
            designData = typeof rawDesignData === 'string'
                ? JSON.parse(rawDesignData)
                : rawDesignData;
        } catch (e) {
            Logger.error('Failed to parse template design data:', e);
            return this.renderDefaultLabel(product, labelWidthMm, labelHeightMm);
        }

        // Build HTML for each object in the Fabric.js canvas
        const objects = designData.objects || [];
        let elementsHtml = '';

        objects.forEach(obj => {
            const html = this.renderFabricObject(obj, product, scale, spreadX, spreadY);
            if (html) {
                elementsHtml += html;
            }
        });

        // Background color from template or white
        const bgColor = designData.background || template.background_color || '#ffffff';

        return `
            <div class="label">
                <div class="label-template-wrapper" style="
                    width: 100%;
                    height: 100%;
                    padding: ${paddingMm}mm;
                    box-sizing: border-box;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <div class="template-canvas" style="
                        position: relative;
                        width: ${scaledWidth}px;
                        height: ${scaledHeight}px;
                        background: ${bgColor};
                        overflow: hidden;
                    ">
                        ${elementsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render a Fabric.js object to HTML
     */
    renderFabricObject(obj, product, scale, spreadX = 1, spreadY = 1) {
        if (!obj || obj.visible === false) return '';

        // Skip transient/helper objects and video placeholders
        if (obj.isTransient || obj.isHelper || obj.excludeFromExport) return '';
        const ct = obj.customType || '';
        if (ct === 'video-placeholder' || ct === 'dynamic-video') return '';
        if (obj.isVideoPlaceholder) return '';

        const objScaleX = obj.scaleX || 1;
        const objScaleY = obj.scaleY || 1;
        const rawWidth = (obj.width || 0) * objScaleX;
        const rawHeight = (obj.height || 0) * objScaleY;

        // Fabric.js v7 origin correction: center origin -> top-left
        let rawLeft = obj.left || 0;
        let rawTop = obj.top || 0;
        const originX = obj.originX || 'center';
        const originY = obj.originY || 'center';
        if (originX === 'center') rawLeft -= rawWidth / 2;
        else if (originX === 'right') rawLeft -= rawWidth;
        if (originY === 'center') rawTop -= rawHeight / 2;
        else if (originY === 'bottom') rawTop -= rawHeight;

        // Object dimensions with proportional scale (no deformation)
        const width = rawWidth * scale;
        const height = rawHeight * scale;
        // Positions spread with spread factor (gaps distribute proportionally)
        const left = rawLeft * scale * spreadX;
        const top = rawTop * scale * spreadY;
        const angle = obj.angle || 0;
        const opacity = obj.opacity !== undefined ? obj.opacity : 1;

        // Get content with dynamic field replacement
        let text = obj.text || '';
        const dynamicKey = this.extractDynamicFieldKey(obj);
        const dynamicValue = dynamicKey ? this.getDynamicFieldValue(dynamicKey, product) : '';
        if (dynamicKey) {
            text = dynamicValue;
        }
        if (typeof text === 'string' && text.includes('{{')) {
            text = text.replace(/\{\{([^}]+)\}\}/g, (_, key) => this.getDynamicFieldValue(key, product) || '');
        }

        const baseStyle = `
            position: absolute;
            left: ${left}px;
            top: ${top}px;
            transform: rotate(${angle}deg);
            transform-origin: left top;
            opacity: ${opacity};
        `;

        // Barcode rendering with SVG
        if (ct === 'barcode' || obj.customType === 'barcode') {
            const barcodeVal = dynamicValue || text || '';
            const barcodeId = 'bc_' + Math.random().toString(36).substr(2, 8);
            return `
                <div style="${baseStyle} width: ${width}px; height: ${height}px; display: flex; align-items: center; justify-content: center; background: #fff;">
                    <svg id="${barcodeId}" class="print-barcode" data-barcode="${this.escapeHtml(barcodeVal)}" data-width="${width}" data-height="${height}"></svg>
                </div>
            `;
        }

        // QRCode rendering
        if (ct === 'qrcode' || obj.customType === 'qrcode') {
            const qrVal = dynamicValue || text || '';
            return `
                <div style="
                    ${baseStyle}
                    width: ${width}px;
                    height: ${height}px;
                    font-family: 'Courier New', monospace;
                    font-size: ${Math.max(10, (obj.fontSize || 14) * scale)}px;
                    color: ${obj.fill || '#000'};
                    background: #fff;
                    border: 1px solid rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                ">${this.escapeHtml(qrVal)}</div>
            `;
        }

        switch (obj.type) {
            case 'textbox':
            case 'i-text':
            case 'text':
            case 'Text':
            case 'IText':
            case 'Textbox': {
                const fontSize = (obj.fontSize || 16) * scale;
                const fontFamily = obj.fontFamily || 'Arial';
                const fontWeight = obj.fontWeight || 'normal';
                const fontStyle = obj.fontStyle || 'normal';
                const fill = obj.fill || '#000000';
                const textAlign = obj.textAlign || 'left';
                const lineHeight = obj.lineHeight || 1.2;
                const textDecoration = [];
                if (obj.underline) textDecoration.push('underline');
                if (obj.linethrough) textDecoration.push('line-through');

                return `
                    <div style="
                        ${baseStyle}
                        width: ${width}px;
                        font-size: ${fontSize}px;
                        font-family: ${fontFamily}, sans-serif;
                        font-weight: ${fontWeight};
                        font-style: ${fontStyle};
                        color: ${fill};
                        text-align: ${textAlign};
                        line-height: ${lineHeight};
                        text-decoration: ${textDecoration.join(' ') || 'none'};
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        overflow: hidden;
                    ">${this.escapeHtml(text)}</div>
                `;
            }

            case 'rect':
            case 'Rect': {
                // Image placeholder in rect - show product image
                if (ct === 'image-placeholder' || obj.dynamicField === 'image_url') {
                    const prodImg = product.image_url || product.cover_image || product.erp_image_url || '';
                    if (prodImg) {
                        const imgUrl = prodImg.startsWith('data:') ? prodImg : this.getDisplayUrl(prodImg);
                        return `
                            <img src="${imgUrl}" style="
                                ${baseStyle}
                                width: ${width}px;
                                height: ${height}px;
                                object-fit: cover;
                            " onerror="this.style.display='none'"/>
                        `;
                    }
                    return '';
                }

                const rectFill = obj.fill || 'transparent';
                const stroke = obj.stroke || 'transparent';
                const strokeWidth = (obj.strokeWidth || 0) * scale;
                const rx = (obj.rx || 0) * scale;

                return `
                    <div style="
                        ${baseStyle}
                        width: ${width}px;
                        height: ${height}px;
                        background: ${rectFill};
                        border: ${strokeWidth}px solid ${stroke};
                        border-radius: ${rx}px;
                        box-sizing: border-box;
                    "></div>
                `;
            }

            case 'circle':
            case 'Circle': {
                const circleFill = obj.fill || 'transparent';
                const circleStroke = obj.stroke || 'transparent';
                const circleStrokeWidth = (obj.strokeWidth || 0) * scale;
                const radius = (obj.radius || 0) * scale;

                return `
                    <div style="
                        ${baseStyle}
                        width: ${radius * 2}px;
                        height: ${radius * 2}px;
                        background: ${circleFill};
                        border: ${circleStrokeWidth}px solid ${circleStroke};
                        border-radius: 50%;
                        box-sizing: border-box;
                    "></div>
                `;
            }

            case 'line':
            case 'Line': {
                const lineStroke = obj.stroke || '#000000';
                const lineWidth = (obj.strokeWidth || 1) * scale;
                const x1 = (obj.x1 || 0) * scale;
                const y1 = (obj.y1 || 0) * scale;
                const x2 = (obj.x2 || 0) * scale;
                const y2 = (obj.y2 || 0) * scale;
                const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                const lineAngle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

                return `
                    <div style="
                        position: absolute;
                        left: ${left + x1}px;
                        top: ${top + y1}px;
                        width: ${lineLength}px;
                        height: ${lineWidth}px;
                        background: ${lineStroke};
                        transform: rotate(${lineAngle}deg);
                        transform-origin: left center;
                        opacity: ${opacity};
                    "></div>
                `;
            }

            case 'image':
            case 'Image': {
                // Barcode in image type
                const isBarcodeImg = ct === 'barcode' || obj.dynamicField === 'barcode' || obj.dynamic_field === 'barcode';
                const isQrcodeImg = ct === 'qrcode' || obj.dynamicField === 'kunye_no' || obj.dynamic_field === 'kunye_no';

                if (isBarcodeImg) {
                    const bcVal = dynamicValue || text || '';
                    const bcId = 'bc_' + Math.random().toString(36).substr(2, 8);
                    return `
                        <div style="${baseStyle} width: ${width}px; height: ${height}px; display: flex; align-items: center; justify-content: center; background: #fff;">
                            <svg id="${bcId}" class="print-barcode" data-barcode="${this.escapeHtml(bcVal)}" data-width="${width}" data-height="${height}"></svg>
                        </div>
                    `;
                }
                if (isQrcodeImg) {
                    const qrVal = dynamicValue || text || '';
                    const qrId = 'qr_' + Math.random().toString(36).substr(2, 8);
                    return `
                        <div id="${qrId}" class="print-qrcode" data-qrcode="${this.escapeHtml(qrVal)}" style="${baseStyle} width: ${width}px; height: ${height}px; display: flex; align-items: center; justify-content: center; background: #fff;"></div>
                    `;
                }

                // Image placeholder - show product image
                const isImgPlaceholder = ct === 'image-placeholder' ||
                    obj.dynamicField === 'image_url' || obj.dynamic_field === 'image_url';

                let imgSrc = obj.src || '';
                if (isImgPlaceholder) {
                    const prodImg = product.image_url || product.cover_image || product.erp_image_url || '';
                    if (prodImg) {
                        imgSrc = prodImg.startsWith('data:') ? prodImg : this.getDisplayUrl(prodImg);
                    } else {
                        return '';
                    }
                } else if (dynamicValue) {
                    imgSrc = dynamicValue;
                }
                if (imgSrc && !imgSrc.startsWith('data:')) {
                    imgSrc = this.getDisplayUrl(imgSrc);
                }
                return `
                    <img src="${imgSrc}" style="
                        ${baseStyle}
                        width: ${width}px;
                        height: ${height}px;
                        object-fit: ${isImgPlaceholder ? 'cover' : 'contain'};
                    " onerror="this.style.display='none'"/>
                `;
            }

            case 'group':
            case 'Group': {
                // Recursively render group objects
                let groupHtml = '';
                (obj.objects || []).forEach(childObj => {
                    const childHtml = this.renderFabricObject(childObj, product, scale, spreadX, spreadY);
                    if (childHtml) groupHtml += childHtml;
                });
                return `
                    <div style="
                        ${baseStyle}
                        width: ${width}px;
                        height: ${height}px;
                    ">${groupHtml}</div>
                `;
            }

            default:
                return '';
        }
    }

    /**
     * Get dynamic field value from product
     */
    getDynamicFieldValue(fieldKey, product) {
        if (!fieldKey || !product) return '';

        const normalizedKey = String(fieldKey).replace(/[{}\s]/g, '');
        const fieldMap = {
            'product_name': product.name,
            'name': product.name,
            'current_price': this.formatCurrency(product.current_price),
            'price': this.formatCurrency(product.current_price),
            'previous_price': product.previous_price ? this.formatCurrency(product.previous_price) : '',
            'old_price': product.previous_price ? this.formatCurrency(product.previous_price) : '',
            'price_with_currency': this.formatCurrency(product.current_price),
            'alis_fiyati': this.formatCurrency(product.alis_fiyati),
            'barcode': this._getPrintBarcode(product),
            'sku': product.sku || '',
            'category': product.category || '',
            'subcategory': product.subcategory || '',
            'unit': product.unit || '',
            'brand': product.brand || '',
            'origin': product.origin || '',
            'production_type': product.production_type || '',
            'description': product.description || '',
            'weight': product.weight || '',
            'stock': product.stock || '',
            'kunye_no': product.kunye_no || '',
            'shelf_location': product.shelf_location || '',
            'supplier_code': product.supplier_code || '',
            'vat_rate': product.vat_rate ? `%${product.vat_rate}` : '',
            'discount_percent': product.discount_percent ? `%${product.discount_percent}` : '',
            'campaign_text': product.campaign_text || '',
            'price_updated_at': product.price_updated_at || '',
            'price_valid_until': product.price_valid_until || '',
            'image_url': product.image_url || product.cover_image || '',
            'date_today': new Date().toLocaleDateString('tr-TR'),
            'date_time': new Date().toLocaleString('tr-TR')
        };

        // Handle nested keys like 'slot-text' for multi-frame
        const cleanKey = normalizedKey.replace(/^slot-/, '').replace(/^dynamic-/, '');
        return fieldMap[cleanKey] || fieldMap[normalizedKey] || fieldMap[fieldKey] || '';
    }

    extractDynamicFieldKey(obj) {
        if (!obj) return '';
        if (typeof obj.dynamicField === 'string' && obj.dynamicField.trim()) {
            return obj.dynamicField;
        }
        if (obj.isDynamicField || obj.isDataField) {
            const text = typeof obj.text === 'string' ? obj.text : '';
            const match = text.match(/\{\{([^}]+)\}\}/);
            if (match) {
                return match[1];
            }
        }
        return '';
    }

    /**
     * Render default label when template parsing fails
     */
    renderDefaultLabel(product, widthMm, heightMm) {
        const baseFontScale = heightMm / 50;
        const nameFontSize = Math.max(8, Math.min(18, 12 * baseFontScale));
        const priceFontSize = Math.max(14, Math.min(36, 24 * baseFontScale));

        return `
            <div class="label">
                <div class="label-content">
                    <div style="font-size: ${nameFontSize}px; font-weight: 700;">${this.escapeHtml(product.name)}</div>
                    <div style="font-size: ${priceFontSize}px; font-weight: 800; color: #e03131; margin-top: auto;">
                        ${this.formatCurrency(product.current_price)}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Escape HTML entities
     */
    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ==========================================
    // Multi-Product Send Methods
    // ==========================================

    /**
     * Şablon design_data'sından multi-product-frame objelerini bul
     * @param {Object} template - Şablon verisi
     * @returns {Array} - [{ frameCols, frameRows, slots: [{id, x, y, width, height}] }]
     */
    _mpFindMultiProductFrames(template) {
        let designData = template.design_data || template.content;
        if (typeof designData === 'string') {
            try { designData = JSON.parse(designData); } catch (e) { return []; }
        }
        if (!designData || !designData.objects) return [];

        const frames = [];
        designData.objects.forEach(obj => {
            if (obj.customType === 'multi-product-frame') {
                frames.push({
                    frameCols: obj.frameCols || 1,
                    frameRows: obj.frameRows || 1,
                    slots: obj.slots || [],
                    frameWidth: obj.frameWidth || obj.width || 400,
                    frameHeight: obj.frameHeight || obj.height || 400
                });
            }
        });
        return frames;
    }

    /**
     * Show multi-product send modal
     */
    async showMultiProductSendModal() {
        try {
            // Fetch templates (with design_data for multi-product frame detection) and devices
            const [templateRes, deviceRes] = await Promise.all([
                this.app.api.get('/templates?include_content=1&per_page=200'),
                this.app.api.get('/devices')
            ]);

            const allTemplates = templateRes.data || [];
            const allDevices = (deviceRes.data?.devices || deviceRes.data || [])
                .filter(d => d.status === 'online' || d.status === 'active');

            // Filter templates that contain multi-product-frame objects
            const multiTemplates = allTemplates.filter(t => {
                const frames = this._mpFindMultiProductFrames(t);
                return frames.length > 0 && frames.some(f => f.slots.length > 1);
            });

            if (multiTemplates.length === 0) {
                Toast.warning(this.__('multiProductSend.noTemplates'));
                return;
            }

            // Store for modal scope
            this._mpTemplates = multiTemplates;
            this._mpDevices = allDevices;
            this._mpSlotAssignments = [];
            this._mpSelectedTemplate = null;
            this._mpSelectedFrameSlots = [];
            this._mpSearchTimers = {};

            // Slot colors for visual identification
            this._mpSlotColors = [
                '#228be6', '#40c057', '#fab005', '#fa5252',
                '#7950f2', '#15aabf', '#e64980', '#fd7e14',
                '#20c997'
            ];

            // Build template list items (vertical list with radio selection)
            const templateListItems = multiTemplates.map((t, i) => {
                const frames = this._mpFindMultiProductFrames(t);
                const totalSlots = frames.reduce((sum, f) => sum + f.slots.length, 0);
                const frameDesc = frames.map(f => `${f.frameCols}x${f.frameRows}`).join(', ');
                const dims = `${t.width || 800}x${t.height || 1280}`;
                return `
                    <label class="mp-template-item" data-index="${i}" data-template-id="${t.id}">
                        <input type="radio" name="mp-template" value="${i}" class="mp-template-radio" />
                        <div class="mp-template-item-icon"><i class="ti ti-layout-grid"></i></div>
                        <div class="mp-template-item-info">
                            <div class="mp-template-item-name">${escapeHTML(t.name)}</div>
                            <div class="mp-template-item-meta">${frameDesc} &middot; ${this.__('multiProductSend.templateSlots', { count: totalSlots })} &middot; ${dims}</div>
                        </div>
                    </label>
                `;
            }).join('');

            // Build device options
            const deviceOptions = allDevices.map(d => {
                const isOnline = d.status === 'online';
                const statusIcon = isOnline ? '🟢' : '🔴';
                return `<option value="${d.id}">${statusIcon} ${escapeHTML(d.name)} (${d.ip_address || '-'})</option>`;
            }).join('');

            const content = `
                <div class="multi-product-send-form">
                    <div class="mp-section">
                        <label class="mp-section-label"><i class="ti ti-layout"></i> ${this.__('multiProductSend.selectTemplate')}</label>
                        <div class="mp-template-list">${templateListItems}</div>
                    </div>

                    <div class="multi-product-layout" style="display:none;" id="mp-layout-area">
                        <div class="mp-preview-area" id="mp-preview-area">
                            <div class="mp-preview-placeholder">
                                <i class="ti ti-layout-grid" style="font-size:48px;opacity:0.3;"></i>
                            </div>
                        </div>
                        <div class="mp-slots-area" id="mp-slots-area">
                            <label class="mp-section-label"><i class="ti ti-package"></i> ${this.__('multiProductSend.assignProducts')}</label>
                            <div class="mp-slots-summary" id="mp-slots-summary"></div>
                            <div class="mp-slots-list" id="mp-slots-list"></div>
                        </div>
                    </div>

                    <div class="mp-section">
                        <label class="mp-section-label"><i class="ti ti-device-desktop"></i> ${this.__('multiProductSend.targetDevice')}</label>
                        <select class="form-select" id="mp-device-select">
                            <option value="">${this.__('multiProductSend.selectDevicePlaceholder')}</option>
                            ${deviceOptions}
                        </select>
                        ${allDevices.length === 0 ? `<p class="text-muted mt-1" style="font-size:12px;">${this.__('multiProductSend.noDevices')}</p>` : ''}
                    </div>

                    <div class="mp-section mp-html-section" id="mp-html-section" style="display:none;">
                        <div class="mp-html-header">
                            <label class="mp-section-label"><i class="ti ti-code"></i> ${this.__('sendToDevice.createHtmlTemplate')}</label>
                        </div>
                        <div class="mp-html-preview" id="mp-html-preview"></div>
                        <div class="mp-html-actions">
                            <button type="button" class="btn btn-sm btn-cyan" id="btn-mp-save-html">
                                <i class="ti ti-file-code"></i> ${this.__('multiProductSend.saveAsHtml')}
                            </button>
                            <small class="text-muted d-block mt-1">${this.__('multiProductSend.saveAsHtmlHint')}</small>
                        </div>
                    </div>
                </div>
            `;

            Modal.show({
                title: this.__('multiProductSend.title'),
                icon: 'ti-layout-grid',
                content,
                size: 'lg',
                confirmText: this.__('multiProductSend.send'),
                cancelText: this.__('actions.cancel'),
                onConfirm: async () => {
                    await this._executeMultiProductSend();
                }
            });

            // Bind events after DOM is ready (Modal has no onShow callback)
            setTimeout(() => this._bindMultiProductModalEvents(), 50);

        } catch (error) {
            Logger.error('showMultiProductSendModal error:', error);
            Toast.error(this.__('multiProductSend.failed'));
        }
    }

    /**
     * Bind events inside the multi-product send modal
     */
    _bindMultiProductModalEvents() {
        // Template list item selection via radio buttons
        document.querySelectorAll('.mp-template-radio').forEach(radio => {
            radio.addEventListener('change', () => {
                // Update visual selection
                document.querySelectorAll('.mp-template-item').forEach(item => item.classList.remove('selected'));
                const parentItem = radio.closest('.mp-template-item');
                if (parentItem) parentItem.classList.add('selected');

                const index = parseInt(radio.value);
                this._mpSelectedTemplate = this._mpTemplates[index];
                this._mpUpdateSlotUI(this._mpSelectedTemplate);
            });
        });

        // HTML şablon olarak kaydet butonu
        const btnSaveHtml = document.getElementById('btn-mp-save-html');
        if (btnSaveHtml) {
            btnSaveHtml.addEventListener('click', () => this._mpSaveAsHtmlTemplate());
        }
    }

    /**
     * Update slot UI when a template is selected — uses multi-product-frame slots
     */
    _mpUpdateSlotUI(template) {
        const layoutArea = document.getElementById('mp-layout-area');
        const slotsListEl = document.getElementById('mp-slots-list');
        const previewArea = document.getElementById('mp-preview-area');

        if (!layoutArea || !slotsListEl) return;

        // Find multi-product-frame objects and their slots
        const frames = this._mpFindMultiProductFrames(template);
        if (frames.length === 0) return;

        // Collect all slots across all frames (usually 1 frame per template)
        const allSlots = [];
        frames.forEach(frame => {
            frame.slots.forEach(slot => {
                allSlots.push({
                    ...slot,
                    frameCols: frame.frameCols,
                    frameRows: frame.frameRows,
                    frameWidth: frame.frameWidth,
                    frameHeight: frame.frameHeight
                });
            });
        });

        this._mpSelectedFrameSlots = allSlots;
        this._mpSlotAssignments = new Array(allSlots.length).fill(null);

        layoutArea.style.display = '';

        // Build frame slot preview with colored overlay
        if (previewArea && allSlots.length > 0) {
            const frame = frames[0]; // Use first frame for preview
            const fW = frame.frameWidth;
            const fH = frame.frameHeight;

            const overlayHtml = allSlots.map((slot, i) => {
                const color = this._mpSlotColors[i % this._mpSlotColors.length];
                const leftPct = (slot.x / fW) * 100;
                const topPct = (slot.y / fH) * 100;
                const widthPct = (slot.width / fW) * 100;
                const heightPct = (slot.height / fH) * 100;
                return `<div class="mp-region-overlay" style="
                    left:${leftPct}%;top:${topPct}%;
                    width:${widthPct}%;height:${heightPct}%;
                    background:${color}20;border:2px solid ${color};
                " title="Slot ${slot.id}">
                    <span class="mp-region-label" style="color:${color};">${slot.id}</span>
                </div>`;
            }).join('');

            previewArea.innerHTML = `
                <div class="mp-preview-box" style="aspect-ratio:${frame.frameCols}/${frame.frameRows};">
                    ${overlayHtml}
                </div>
            `;
        }

        // Build slot assignment rows
        const slotsHtml = allSlots.map((slot, i) => {
            const color = this._mpSlotColors[i % this._mpSlotColors.length];
            const slotLabel = this.__('multiProductSend.slotLabel', { index: slot.id });
            return `
                <div class="slot-assignment-row" data-slot="${i}">
                    <div class="slot-header">
                        <span class="slot-color-dot" style="background:${color};"></span>
                        <span class="slot-name">${slotLabel}</span>
                    </div>
                    <div class="slot-search-wrapper" id="slot-search-wrapper-${i}">
                        <input type="text" class="form-input slot-product-search" id="slot-search-${i}"
                            placeholder="${this.__('multiProductSend.searchPlaceholder')}" autocomplete="off" />
                        <div class="slot-search-dropdown" id="slot-dropdown-${i}"></div>
                    </div>
                    <div class="slot-selected-product" id="slot-selected-${i}" style="display:none;">
                        <div class="slot-product-info" id="slot-product-info-${i}"></div>
                        <button type="button" class="btn btn-sm btn-ghost slot-clear-btn" data-slot="${i}">
                            <i class="ti ti-x"></i> ${this.__('multiProductSend.clearSlot')}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        slotsListEl.innerHTML = slotsHtml;

        // Update summary
        this._mpUpdateSummary();

        // Bind search events
        this._mpBindSlotSearchEvents(allSlots.length);

        // Bind clear events
        document.querySelectorAll('.slot-clear-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const slot = parseInt(btn.dataset.slot);
                this._mpClearSlotAssignment(slot);
            });
        });
    }

    /**
     * Bind debounced search events for each slot
     */
    _mpBindSlotSearchEvents(slotCount) {
        for (let i = 0; i < slotCount; i++) {
            const input = document.getElementById(`slot-search-${i}`);
            if (!input) continue;

            input.addEventListener('input', () => {
                clearTimeout(this._mpSearchTimers[i]);
                this._mpSearchTimers[i] = setTimeout(() => {
                    this._mpSearchProducts(i, input.value.trim());
                }, 300);
            });

            // Close dropdown on blur (with delay for click to register)
            input.addEventListener('blur', () => {
                setTimeout(() => {
                    const dropdown = document.getElementById(`slot-dropdown-${i}`);
                    if (dropdown) dropdown.style.display = 'none';
                }, 200);
            });

            input.addEventListener('focus', () => {
                if (input.value.trim().length >= 2) {
                    this._mpSearchProducts(i, input.value.trim());
                }
            });
        }
    }

    /**
     * Search products for a specific slot
     */
    async _mpSearchProducts(slotIndex, query) {
        const dropdown = document.getElementById(`slot-dropdown-${slotIndex}`);
        if (!dropdown) return;

        if (query.length < 2) {
            dropdown.style.display = 'none';
            return;
        }

        try {
            const response = await this.app.api.get('/products', { search: query, per_page: 10 });
            const products = response.data?.products || response.data || [];

            if (products.length === 0) {
                dropdown.innerHTML = `<div class="slot-dropdown-empty">${this.__('multiProductSend.noResults')}</div>`;
                dropdown.style.display = 'block';
                return;
            }

            dropdown.innerHTML = products.map(p => `
                <div class="slot-dropdown-item" data-product-id="${p.id}" data-product-name="${escapeHTML(p.name)}" data-product-sku="${escapeHTML(p.sku || '')}">
                    <div class="slot-dropdown-item-name">${escapeHTML(p.name)}</div>
                    <div class="slot-dropdown-item-meta">
                        ${p.sku ? `<span>SKU: ${escapeHTML(p.sku)}</span>` : ''}
                        ${p.barcode ? `<span>BC: ${escapeHTML(p.barcode)}</span>` : ''}
                        ${p.current_price ? `<span class="slot-dropdown-price">${parseFloat(p.current_price).toFixed(2)} ₺</span>` : ''}
                    </div>
                </div>
            `).join('');

            dropdown.style.display = 'block';

            // Bind click events on dropdown items
            dropdown.querySelectorAll('.slot-dropdown-item').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Prevent blur from firing first
                    const productId = item.dataset.productId;
                    const productName = item.dataset.productName;
                    const productSku = item.dataset.productSku;
                    this._mpAssignProductToSlot(slotIndex, productId, productName, productSku);
                    dropdown.style.display = 'none';
                });
            });

        } catch (error) {
            Logger.error('_mpSearchProducts error:', error);
        }
    }

    /**
     * Assign a product to a slot
     */
    _mpAssignProductToSlot(slotIndex, productId, name, sku) {
        this._mpSlotAssignments[slotIndex] = { id: productId, name, sku };

        // Hide search, show selected
        const searchWrapper = document.getElementById(`slot-search-wrapper-${slotIndex}`);
        const selectedEl = document.getElementById(`slot-selected-${slotIndex}`);
        const infoEl = document.getElementById(`slot-product-info-${slotIndex}`);

        if (searchWrapper) searchWrapper.style.display = 'none';
        if (selectedEl) selectedEl.style.display = '';
        if (infoEl) {
            infoEl.innerHTML = `
                <strong>${escapeHTML(name)}</strong>
                ${sku ? `<small style="opacity:0.6;margin-left:8px;">SKU: ${escapeHTML(sku)}</small>` : ''}
            `;
        }

        this._mpUpdateSummary();
    }

    /**
     * Clear a slot assignment
     */
    _mpClearSlotAssignment(slotIndex) {
        this._mpSlotAssignments[slotIndex] = null;

        const searchWrapper = document.getElementById(`slot-search-wrapper-${slotIndex}`);
        const selectedEl = document.getElementById(`slot-selected-${slotIndex}`);
        const searchInput = document.getElementById(`slot-search-${slotIndex}`);

        if (searchWrapper) searchWrapper.style.display = '';
        if (selectedEl) selectedEl.style.display = 'none';
        if (searchInput) searchInput.value = '';

        this._mpUpdateSummary();
    }

    /**
     * Update slot assignment summary
     */
    _mpUpdateSummary() {
        const summaryEl = document.getElementById('mp-slots-summary');
        if (!summaryEl) return;

        const total = this._mpSlotAssignments.length;
        const assigned = this._mpSlotAssignments.filter(s => s !== null).length;
        summaryEl.textContent = this.__('multiProductSend.slotsAssigned', { assigned, total });

        // HTML preview + oluşturma bölümünü güncelle
        this._mpUpdateHtmlPreview();
    }

    /**
     * Slot atamaları değiştiğinde HTML önizleme ve oluşturma bölümünü güncelle
     */
    _mpUpdateHtmlPreview() {
        const htmlSection = document.getElementById('mp-html-section');
        const htmlPreview = document.getElementById('mp-html-preview');
        if (!htmlSection || !htmlPreview) return;

        const template = this._mpSelectedTemplate;
        const assignedProducts = this._mpSlotAssignments.filter(s => s !== null);

        if (!template || assignedProducts.length === 0) {
            htmlSection.style.display = 'none';
            return;
        }

        htmlSection.style.display = '';

        // Atanmış ürün ID'leri ile canlı HTML önizleme iframe'i oluştur
        const basePath = window.OmnexConfig?.basePath || '';
        const productIds = assignedProducts.map(s => s.id).join(',');
        const iframeSrc = `${basePath}/api/templates/${template.id}/preview-html?product_ids=${productIds}`;

        htmlPreview.innerHTML = `
            <div class="mp-html-preview-frame">
                <iframe src="${escapeHTML(iframeSrc)}"
                        sandbox="allow-scripts"
                        loading="lazy"
                        title="${escapeHTML(template.name)}"></iframe>
                <div class="live-preview-badge">
                    <i class="ti ti-broadcast"></i> ${this.__('sendToDevice.liveHtmlPreview')}
                </div>
            </div>
        `;
    }

    /**
     * Çoklu ürün tasarımını bağımsız olarak HTML şablon olarak kaydet (cihaza göndermeden)
     */
    async _mpSaveAsHtmlTemplate() {
        const template = this._mpSelectedTemplate;
        if (!template) {
            Toast.warning(this.__('multiProductSend.templateRequired'));
            return;
        }

        const assignedSlots = this._mpSlotAssignments.filter(s => s !== null);
        if (assignedSlots.length === 0) {
            Toast.warning(this.__('multiProductSend.noSlotAssigned'));
            return;
        }

        const btn = document.getElementById('btn-mp-save-html');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader ti-spin"></i> ${this.__('actions.saving')}`;
        }

        try {
            const productIds = assignedSlots.map(s => s.id);
            const resp = await this.app.api.post('/web-templates/generate-from-fabric', {
                template_id: template.id,
                product_ids: productIds
            });
            if (resp.success) {
                const msg = resp.data?.is_update
                    ? this.__('multiProductSend.htmlUpdated')
                    : this.__('multiProductSend.htmlSaved');
                Toast.success(msg);
            } else {
                Toast.error(resp.message || this.__('multiProductSend.htmlSaveFailed'));
            }
        } catch (error) {
            Logger.error('_mpSaveAsHtmlTemplate error:', error);
            Toast.error(this.__('multiProductSend.htmlSaveFailed'));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-file-code"></i> ${this.__('multiProductSend.saveAsHtml')}`;
            }
        }
    }

    /**
     * Execute multi-product send — renders composite image and sends to device
     */
    async _executeMultiProductSend() {
        // Validation — throw to prevent Modal from closing
        const template = this._mpSelectedTemplate;
        if (!template) {
            Toast.warning(this.__('multiProductSend.templateRequired'));
            throw new Error('validation');
        }

        const deviceId = document.getElementById('mp-device-select')?.value;
        if (!deviceId) {
            Toast.warning(this.__('multiProductSend.deviceRequired'));
            throw new Error('validation');
        }

        const slots = this._mpSelectedFrameSlots || [];
        const assignedSlots = this._mpSlotAssignments
            .map((s, i) => s ? { slotIndex: i, slotId: slots[i]?.id, ...s } : null)
            .filter(Boolean);

        if (assignedSlots.length === 0) {
            Toast.warning(this.__('multiProductSend.noSlotsAssigned'));
            throw new Error('validation');
        }

        // Modal will be closed by Modal component after onConfirm resolves

        // Show progress
        Toast.info(this.__('multiProductSend.rendering'));

        try {
            // Fetch full product data for assigned slots in parallel
            const productFetches = assignedSlots.map(async (slot) => {
                const res = await this.app.api.get(`/products/${slot.id}`);
                return { slotId: slot.slotId, product: res.data };
            });

            const slotProducts = await Promise.all(productFetches);

            // Build slotProductMap: { slotId: productData }
            const slotProductMap = {};
            slotProducts.forEach(({ slotId, product }) => {
                slotProductMap[slotId] = product;
            });

            // Render composite image using TemplateRenderer
            const renderer = getTemplateRenderer();
            const dataUrl = await renderer.renderMultiProduct(template, slotProductMap, this._getRenderOptions(template));

            // Generate synthetic product ID
            const syntheticId = 'multi_' + Date.now();

            // Send to backend via auto.php
            const payload = {
                products: [{
                    id: syntheticId,
                    labels: [{
                        template_id: template.id,
                        device_ids: [deviceId]
                    }]
                }],
                pre_rendered_images: {
                    [syntheticId]: dataUrl
                },
                priority: 'urgent'
            };

            const response = await this.app.api.post('/render-queue/auto', payload);

            if (response.success) {
                Toast.success(this.__('multiProductSend.success'));
                await this._refreshNotificationsAfterQueueAction();

                // Trigger queue processing
                try {
                    await this.app.api.post('/render-queue/process');
                } catch (e) {
                    // Ignore - worker will process it
                }

                // Not: HTML şablon oluşturma artık bağımsız buton ile yapılıyor (_mpSaveAsHtmlTemplate)
            } else {
                Toast.error(response.message || this.__('multiProductSend.failed'));
            }

        } catch (error) {
            Logger.error('_executeMultiProductSend error:', error);
            Toast.error(this.__('multiProductSend.failed'));
        }
    }

    async _refreshNotificationsAfterQueueAction() {
        try {
            const manager = this.app?.layout?.notificationManager;
            if (manager && typeof manager.refresh === 'function') {
                await manager.refresh();
            }
        } catch (error) {
            Logger.debug('Notification refresh skipped:', error);
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this._exportOutsideClickHandler) {
            document.removeEventListener('click', this._exportOutsideClickHandler);
            this._exportOutsideClickHandler = null;
        }
        this.table?.destroy();
        // Remove preview popup
        const popup = document.getElementById('image-preview-popup');
        if (popup) popup.remove();
        this.app.i18n.clearPageTranslations();
    }
}

export default ProductListPage;
