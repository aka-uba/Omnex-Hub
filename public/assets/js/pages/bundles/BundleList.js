/**
 * BundleList Page - Paket/Koli/Menü Listesi
 * ProductList.js ile aynı tasarım ve özellik seti
 */
import { DataTable } from '../../components/DataTable.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { Logger } from '../../core/Logger.js';
import { escapeHTML } from '../../core/SecurityUtils.js';
import { MediaUtils } from '../../utils/MediaUtils.js';
import { ExportManager } from '../../utils/ExportManager.js';

const BUNDLE_TYPE_ICONS = {
    menu: 'ti-menu-2',
    koli: 'ti-box',
    package: 'ti-package',
    pallet: 'ti-forklift',
    basket: 'ti-basket',
    custom: 'ti-dots'
};

export class BundleListPage {
    constructor(app) {
        this.app = app;
        this.table = null;
        this.selectedBundles = [];
        this.stats = { total: 0, active: 0, draft: 0, total_items: 0 };
        this._exportOutsideClickHandler = null;
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('bundles');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('nav.dashboard')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon blue">
                            <i class="ti ti-box-multiple"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('title')}</h1>
                            <p class="page-subtitle">${this.__('subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
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
                        <button class="btn btn-primary" id="btn-add-bundle">
                            <i class="ti ti-plus"></i>
                            <span>${this.__('addBundle')}</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stats Cards -->
            <div class="products-stats-grid">
                <div class="product-stat-card">
                    <div class="stat-card-icon blue">
                        <i class="ti ti-box-multiple"></i>
                    </div>
                    <div class="stat-card-info">
                        <span class="stat-card-value" id="stat-total">0</span>
                        <span class="stat-card-label">${this.__('stats.totalBundles')}</span>
                    </div>
                </div>
                <div class="product-stat-card">
                    <div class="stat-card-icon green">
                        <i class="ti ti-circle-check"></i>
                    </div>
                    <div class="stat-card-info">
                        <span class="stat-card-value" id="stat-active">0</span>
                        <span class="stat-card-label">${this.__('stats.activeBundles')}</span>
                    </div>
                </div>
                <div class="product-stat-card">
                    <div class="stat-card-icon orange">
                        <i class="ti ti-file-text"></i>
                    </div>
                    <div class="stat-card-info">
                        <span class="stat-card-value" id="stat-draft">0</span>
                        <span class="stat-card-label">${this.__('stats.draftBundles')}</span>
                    </div>
                </div>
                <div class="product-stat-card">
                    <div class="stat-card-icon purple">
                        <i class="ti ti-package"></i>
                    </div>
                    <div class="stat-card-info">
                        <span class="stat-card-value" id="stat-items">0</span>
                        <span class="stat-card-label">${this.__('stats.totalItems')}</span>
                    </div>
                </div>
            </div>

            <!-- Filters -->
            <div class="card mb-4">
                <div class="products-filter-bar">
                    <div class="filter-item">
                        <select class="form-select form-select-sm" id="filter-type">
                            <option value="">${this.__('filters.allTypes')}</option>
                            <option value="menu">${this.__('types.menu')}</option>
                            <option value="koli">${this.__('types.koli')}</option>
                            <option value="package">${this.__('types.package')}</option>
                            <option value="pallet">${this.__('types.pallet')}</option>
                            <option value="basket">${this.__('types.basket')}</option>
                            <option value="custom">${this.__('types.custom')}</option>
                        </select>
                    </div>
                    <div class="filter-item">
                        <select class="form-select form-select-sm" id="filter-status">
                            <option value="">${this.__('filters.allStatus')}</option>
                            <option value="active">${this.__('status.active')}</option>
                            <option value="inactive">${this.__('status.inactive')}</option>
                            <option value="draft">${this.__('status.draft')}</option>
                        </select>
                    </div>
                    <button class="btn btn-sm btn-outline filter-clear" id="btn-clear-filters">
                        <i class="ti ti-x"></i>
                    </button>
                </div>
            </div>

            <!-- Bundles Table -->
            <div class="card card-table">
                <div class="card-body">
                    <div id="bundles-table"></div>
                </div>
            </div>
        `;
    }

    async init() {
        this.initDataTable();
        this.bindEvents();
        this.initImageHoverPreview();
        await this.loadData();
    }

    initDataTable() {
        const self = this;
        this.table = new DataTable({
            container: '#bundles-table',
            columns: [
                {
                    key: 'cover_image',
                    label: '',
                    width: '50px',
                    sortable: false,
                    render: (_, row) => this.renderCoverImage(row)
                },
                {
                    key: 'name',
                    label: this.__('columns.name'),
                    sortable: true,
                    render: (value, row) => `<a href="javascript:void(0)" class="product-name-link font-medium text-primary hover:text-primary-dark hover:underline" data-bundle-id="${row.id}">${escapeHTML(value)}</a>`
                },
                {
                    key: 'type',
                    label: this.__('columns.type'),
                    sortable: true,
                    width: '120px',
                    render: (val) => {
                        const icon = BUNDLE_TYPE_ICONS[val] || 'ti-dots';
                        const label = self.__(`types.${val}`) || val;
                        return `<span class="bundle-type-badge bundle-type-${val}"><i class="ti ${icon}"></i> ${label}</span>`;
                    }
                },
                {
                    key: 'item_count',
                    label: this.__('columns.items'),
                    sortable: true,
                    width: '80px',
                    render: (val) => `<span class="badge badge-light">${val || 0}</span>`
                },
                {
                    key: 'total_price',
                    label: this.__('columns.totalPrice'),
                    sortable: true,
                    width: '120px',
                    render: (val) => `<span class="font-medium">${this._formatPrice(val)}</span>`
                },
                {
                    key: 'final_price',
                    label: this.__('columns.finalPrice'),
                    sortable: true,
                    width: '130px',
                    render: (val, row) => {
                        const price = this._formatPrice(val);
                        const discount = parseFloat(row.discount_percent);
                        if (discount > 0) {
                            return `
                                <div>
                                    <span class="font-medium text-green-600">${price}</span>
                                    <span class="badge bg-green-100 text-green-800" style="font-size:0.7rem;">-%${discount.toFixed(0)}</span>
                                </div>
                            `;
                        }
                        return `<span class="font-medium">${price}</span>`;
                    }
                },
                {
                    key: 'category',
                    label: this.__('columns.category'),
                    width: '120px',
                    render: (val) => val ? `<span class="badge bg-purple-100 text-purple-800">${escapeHTML(val)}</span>` : '-'
                },
                {
                    key: 'status',
                    label: this.__('columns.status'),
                    sortable: true,
                    width: '100px',
                    render: (val) => {
                        const colors = { active: 'success', inactive: 'secondary', draft: 'warning' };
                        const label = self.__(`status.${val}`) || val;
                        return `<span class="badge badge-${colors[val] || 'light'}">${label}</span>`;
                    }
                },
                {
                    key: 'updated_at',
                    label: this.__('columns.updated'),
                    sortable: true,
                    width: '130px',
                    render: (val) => {
                        if (!val) return '-';
                        const date = new Date(val);
                        return `<span class="text-sm text-gray-500" title="${date.toLocaleString('tr-TR')}">${this.formatRelativeTime(date)}</span>`;
                    }
                }
            ],
            actions: [
                {
                    name: 'send-to-device',
                    icon: 'ti-device-mobile-share',
                    label: this.__('actions.sendToDevice'),
                    class: 'btn-ghost text-purple',
                    onClick: (row) => this.handleSendToDevice(row)
                },
                {
                    name: 'edit',
                    icon: 'ti-edit',
                    label: this.__('actions.edit'),
                    class: 'btn-ghost text-primary',
                    onClick: (row) => this.app.router.navigate(`/bundles/${row.id}/edit`)
                },
                {
                    name: 'duplicate',
                    icon: 'ti-copy',
                    label: this.__('actions.duplicate'),
                    class: 'btn-ghost text-brand',
                    onClick: (row) => this.duplicateBundle(row)
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('actions.delete'),
                    class: 'btn-ghost text-danger',
                    onClick: (row) => this.deleteBundle(row)
                }
            ],
            pagination: true,
            pageSize: 20,
            searchable: true,
            searchPlaceholder: this.__('filters.search'),
            selectable: true,
            toolbar: {
                show: true,
                exports: true
            },
            exportFilename: 'paketler',
            exportTitle: this.__('export.title'),
            exportSubtitle: this.__('subtitle'),
            onSelectionChange: (rows) => this.onSelectionChange(rows)
        });

        // Add bulk action buttons to toolbar
        this.addBulkActionButtons();
    }

    // ========================================
    // BULK ACTION BUTTONS
    // ========================================

    addBulkActionButtons() {
        const toolbarActions = document.querySelector('[data-table-toolbar-actions]');
        if (!toolbarActions) return;

        // Bulk print labels button
        const printBtn = document.createElement('button');
        printBtn.id = 'btn-bulk-print';
        printBtn.className = 'btn btn-sm btn-info hidden';
        printBtn.innerHTML = `<i class="ti ti-printer"></i> <span>${this.__('actions.print')}</span>`;
        printBtn.addEventListener('click', () => this.showBulkPrintModal());
        toolbarActions.appendChild(printBtn);

        // Bulk send button
        const sendBtn = document.createElement('button');
        sendBtn.id = 'btn-bulk-send';
        sendBtn.className = 'btn btn-sm btn-purple hidden';
        sendBtn.innerHTML = `<i class="ti ti-device-mobile-share"></i> <span>${this.__('actions.sendToDevice')}</span>`;
        sendBtn.addEventListener('click', () => this.bulkSendToDevice());
        toolbarActions.appendChild(sendBtn);

        // Bulk delete button
        const delBtn = document.createElement('button');
        delBtn.id = 'btn-bulk-delete';
        delBtn.className = 'btn btn-sm btn-danger hidden';
        delBtn.innerHTML = `<i class="ti ti-trash"></i> <span>${this.__('actions.bulkDelete')}</span>`;
        delBtn.addEventListener('click', () => this.bulkDeleteBundles());
        toolbarActions.appendChild(delBtn);
    }

    onSelectionChange(rows) {
        this.selectedBundles = rows;
        const bulkDeleteBtn = document.getElementById('btn-bulk-delete');
        const bulkSendBtn = document.getElementById('btn-bulk-send');
        const bulkPrintBtn = document.getElementById('btn-bulk-print');

        if (rows.length > 0) {
            bulkDeleteBtn?.classList.remove('hidden');
            bulkSendBtn?.classList.remove('hidden');
            bulkPrintBtn?.classList.remove('hidden');
        } else {
            bulkDeleteBtn?.classList.add('hidden');
            bulkSendBtn?.classList.add('hidden');
            bulkPrintBtn?.classList.add('hidden');
        }

        Logger.log('Selected:', rows.length, 'bundles');
    }

    // ========================================
    // EVENTS
    // ========================================

    bindEvents() {
        document.getElementById('btn-add-bundle')?.addEventListener('click', () => {
            this.app.router.navigate('/bundles/new');
        });

        // Export dropdown
        this.initExportDropdown();

        // Filter changes
        document.getElementById('filter-type')?.addEventListener('change', () => this.loadData());
        document.getElementById('filter-status')?.addEventListener('change', () => this.loadData());

        // Clear filters
        document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
            document.getElementById('filter-type').value = '';
            document.getElementById('filter-status').value = '';
            this.loadData();
        });

        // Bundle name click - edit
        document.getElementById('bundles-table')?.addEventListener('click', (e) => {
            const nameLink = e.target.closest('.product-name-link');
            if (nameLink) {
                e.preventDefault();
                e.stopPropagation();
                const bundleId = nameLink.dataset.bundleId;
                if (bundleId) {
                    this.app.router.navigate(`/bundles/${bundleId}/edit`);
                }
            }
        });
    }

    // ========================================
    // EXPORT
    // ========================================

    initExportDropdown() {
        const container = document.getElementById('export-dropdown');
        if (!container) return;

        const btn = container.querySelector('.export-dropdown-btn');
        const menu = container.querySelector('.export-dropdown-menu');

        btn?.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
            container.classList.toggle('open');
        });

        if (this._exportOutsideClickHandler) {
            document.removeEventListener('click', this._exportOutsideClickHandler);
        }
        this._exportOutsideClickHandler = () => {
            menu?.classList.remove('show');
            container?.classList.remove('open');
        };
        document.addEventListener('click', this._exportOutsideClickHandler);

        container.querySelectorAll('.export-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.exportType;
                menu.classList.remove('show');
                container.classList.remove('open');
                this.exportBundles(type);
            });
        });
    }

    async exportBundles(type = 'csv') {
        try {
            Toast.info(this.__('export.preparing'));

            const response = await this.app.api.get('/bundles?limit=10000');
            const bundles = response.data?.bundles || [];

            if (bundles.length === 0) {
                Toast.warning(this.__('empty'));
                return;
            }

            const columns = [
                { key: 'name', label: this.__('columns.name') },
                {
                    key: 'type', label: this.__('columns.type'),
                    exportRender: (val) => this.__(`types.${val}`) || val
                },
                { key: 'item_count', label: this.__('columns.items') },
                {
                    key: 'total_price', label: this.__('columns.totalPrice'),
                    exportRender: (val) => this._formatPrice(val)
                },
                {
                    key: 'final_price', label: this.__('columns.finalPrice'),
                    exportRender: (val) => this._formatPrice(val)
                },
                {
                    key: 'discount_percent', label: this.__('columns.discount'),
                    exportRender: (val) => val ? `%${parseFloat(val).toFixed(0)}` : '-'
                },
                { key: 'category', label: this.__('columns.category') },
                { key: 'sku', label: this.__('form.sku') },
                { key: 'barcode', label: this.__('form.barcode') },
                {
                    key: 'status', label: this.__('columns.status'),
                    badge: {
                        'active': { type: 'success', label: this.__('status.active'), icon: 'ti ti-check' },
                        'inactive': { type: 'warning', label: this.__('status.inactive'), icon: 'ti ti-x' },
                        'draft': { type: 'secondary', label: this.__('status.draft'), icon: 'ti ti-file-text' }
                    }
                },
                {
                    key: 'updated_at', label: this.__('columns.updated'),
                    exportRender: (val) => val ? new Date(val).toLocaleString(this.app.i18n.locale) : '-'
                }
            ];

            const exporter = new ExportManager({
                filename: 'paketler',
                title: this.__('export.title'),
                subtitle: `${this.__('stats.totalBundles')}: ${bundles.length}`,
                author: 'Omnex Display Hub'
            });

            await exporter.export(type, bundles, columns);

            if (type !== 'print') {
                Toast.success(this.__('export.success'));
            }
        } catch (error) {
            Logger.error('Export error:', error);
            Toast.error(this.__('messages.saveFailed'));
        }
    }

    // ========================================
    // DATA LOADING
    // ========================================

    async loadData() {
        try {
            const type = document.getElementById('filter-type')?.value || '';
            const status = document.getElementById('filter-status')?.value || '';

            const params = new URLSearchParams({ limit: '100' });
            if (type) params.append('type', type);
            if (status) params.append('status', status);

            const response = await this.app.api.get(`/bundles?${params.toString()}`);
            if (response.success) {
                const data = response.data;
                this.table.setData(data.bundles || [], data.pagination);

                if (data.stats) {
                    this.stats = data.stats;
                    this.updateStats();
                }
            }
        } catch (error) {
            Logger.error('Failed to load bundles:', error);
            Toast.error(this.__('messages.loadFailed'));
        }
    }

    updateStats() {
        const el = (id) => document.getElementById(id);
        if (el('stat-total')) el('stat-total').textContent = this.stats.total || 0;
        if (el('stat-active')) el('stat-active').textContent = this.stats.active || 0;
        if (el('stat-draft')) el('stat-draft').textContent = this.stats.draft || 0;
        if (el('stat-items')) el('stat-items').textContent = this.stats.total_items || 0;
    }

    // ========================================
    // CRUD OPERATIONS
    // ========================================

    async deleteBundle(row) {
        Modal.confirm({
            title: this.__('deleteBundle'),
            message: this.__('deleteConfirm'),
            type: 'danger',
            confirmText: this.__('actions.delete'),
            onConfirm: async () => {
                try {
                    const response = await this.app.api.delete(`/bundles/${row.id}`);
                    if (response.success) {
                        Toast.success(this.__('messages.deleted'));
                        await this.loadData();
                    } else {
                        Toast.error(response.message || this.__('messages.saveFailed'));
                    }
                } catch (error) {
                    Logger.error('Delete bundle failed:', error);
                    Toast.error(this.__('messages.saveFailed'));
                }
            }
        });
    }

    async bulkDeleteBundles() {
        if (!this.selectedBundles || this.selectedBundles.length === 0) {
            Toast.warning(this.__('messages.noProductsSelected'));
            return;
        }

        const count = this.selectedBundles.length;
        const ids = this.selectedBundles.map(b => b.id);

        Modal.confirm({
            title: this.__('actions.bulkDelete'),
            message: this.__('messages.bulkDeleteConfirm', { count }),
            type: 'danger',
            confirmText: this.__('actions.bulkDeleteBtn', { count }),
            onConfirm: async () => {
                Modal.closeAll();

                let deletedCount = 0;
                let failedCount = 0;

                for (const id of ids) {
                    try {
                        await this.app.api.delete(`/bundles/${id}`);
                        deletedCount++;
                    } catch (err) {
                        Logger.error('Delete failed for bundle:', id, err);
                        failedCount++;
                    }
                }

                this.selectedBundles = [];
                this.table.clearSelection();

                if (deletedCount > 0) {
                    if (failedCount > 0) {
                        Toast.success(this.__('messages.bulkDeletePartial', { count: deletedCount, failed: failedCount }));
                    } else {
                        Toast.success(this.__('messages.bulkDeleted', { count: deletedCount }));
                    }
                } else {
                    Toast.error(this.__('messages.saveFailed'));
                }

                await this.loadData();
            }
        });
    }

    async duplicateBundle(row) {
        try {
            const response = await this.app.api.get(`/bundles/${row.id}`);
            if (!response.success) {
                Toast.error(this.__('messages.loadFailed'));
                return;
            }

            const bundle = response.data;
            const items = (bundle.items || []).map((item, index) => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                custom_price: item.custom_price,
                sort_order: index,
                notes: item.notes
            }));

            const createResponse = await this.app.api.post('/bundles', {
                name: bundle.name + ' (Kopya)',
                type: bundle.type,
                description: bundle.description,
                image_url: bundle.image_url,
                images: bundle.images,
                videos: bundle.videos,
                video_url: bundle.video_url,
                cover_image_index: bundle.cover_image_index,
                barcode: bundle.barcode,
                sku: bundle.sku ? bundle.sku + '-copy' : null,
                category: bundle.category,
                discount_percent: bundle.discount_percent,
                price_override: bundle.price_override,
                final_price: bundle.final_price,
                status: 'draft',
                items: items
            });

            if (createResponse.success) {
                Toast.success(this.__('messages.duplicated'));
                await this.loadData();
            } else {
                Toast.error(createResponse.message || this.__('messages.saveFailed'));
            }
        } catch (error) {
            Logger.error('Duplicate bundle failed:', error);
            Toast.error(this.__('messages.saveFailed'));
        }
    }

    // ========================================
    // SEND TO DEVICE
    // ========================================

    handleSendToDevice(row) {
        this.showSendToDeviceModal([row.id], row.name);
    }

    bulkSendToDevice() {
        if (this.selectedBundles.length === 0) {
            Toast.warning(this.__('messages.noProductsSelected'));
            return;
        }

        const bundleIds = this.selectedBundles.map(b => b.id);
        const name = this.selectedBundles.length === 1 ? this.selectedBundles[0].name : '';
        this.showSendToDeviceModal(bundleIds, name);
    }

    async showSendToDeviceModal(bundleIds, bundleName = '') {
        let devices = [];
        let templates = [];

        try {
            const [devicesRes, templatesRes] = await Promise.all([
                this.app.api.get('/devices'),
                this.app.api.get('/templates')
            ]);

            devices = devicesRes.data || [];
            templates = templatesRes.data || [];
        } catch (error) {
            Logger.error('Failed to load devices/templates:', error);
            Toast.error(this.__('messages.loadFailed'));
            return;
        }

        if (devices.length === 0) {
            Toast.warning(this.__('messages.noDevices'));
            return;
        }

        if (templates.length === 0) {
            Toast.warning(this.__('messages.noTemplates'));
            return;
        }

        const isBulk = bundleIds.length > 1;
        const title = isBulk
            ? this.__('messages.sendBulkTitle', { count: bundleIds.length })
            : this.__('messages.sendTitle', { name: escapeHTML(bundleName) });

        const deviceOptions = devices.map(d => {
            const isOnline = d.status === 'online';
            const statusIcon = isOnline ? '🟢' : '🔴';
            return `<option value="${d.id}" data-ip="${escapeHTML(d.ip_address || '')}" data-status="${d.status || 'offline'}">
                ${statusIcon} ${escapeHTML(d.name)} (${escapeHTML(d.ip_address || '-')})
            </option>`;
        }).join('');

        const templateOptions = templates.map(t => {
            return `<option value="${t.id}" data-width="${t.width || 800}" data-height="${t.height || 1280}" data-name="${escapeHTML(t.name)}">
                ${escapeHTML(t.name)} (${t.width || 800}x${t.height || 1280})
            </option>`;
        }).join('');

        const content = `
            <div class="send-to-device-form">
                ${isBulk ? `
                    <div class="alert alert-info mb-4">
                        <i class="ti ti-info-circle"></i>
                        <span>${this.__('messages.sendBulkInfo', { count: bundleIds.length })}</span>
                    </div>
                ` : ''}
                <div class="send-to-device-fields">
                    <div class="form-group">
                        <label class="form-label">
                            <i class="ti ti-device-desktop"></i>
                            ${this.__('messages.targetDevice')} *
                        </label>
                        <select id="send-device-select" class="form-select">
                            <option value="">${this.__('messages.selectDevice')}</option>
                            ${deviceOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">
                            <i class="ti ti-layout"></i>
                            ${this.__('messages.template')} *
                        </label>
                        <select id="send-template-select" class="form-select">
                            <option value="">${this.__('messages.selectTemplate')}</option>
                            ${templateOptions}
                        </select>
                    </div>
                </div>
            </div>
        `;

        Modal.show({
            title: title,
            icon: 'ti-device-mobile-share',
            content: content,
            size: 'md',
            confirmText: this.__('actions.send'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const deviceId = document.getElementById('send-device-select')?.value;
                const templateId = document.getElementById('send-template-select')?.value;

                if (!deviceId) {
                    Toast.warning(this.__('messages.deviceRequired'));
                    throw new Error('Device required');
                }

                if (!templateId) {
                    Toast.warning(this.__('messages.templateRequired'));
                    throw new Error('Template required');
                }

                try {
                    // Use render queue for sending
                    const response = await this.app.api.post('/render-queue', {
                        product_ids: bundleIds,
                        device_ids: [deviceId],
                        template_id: templateId,
                        priority: 'normal'
                    });

                    if (response.success) {
                        Toast.success(this.__('messages.sendSuccess'));
                    } else {
                        Toast.error(response.message || this.__('messages.sendFailed'));
                    }
                } catch (error) {
                    Logger.error('Send to device failed:', error);
                    Toast.error(this.__('messages.sendFailed'));
                }

                // Clear selection
                this.selectedBundles = [];
                this.table?.clearSelection();
            }
        });
    }

    // ========================================
    // BULK PRINT
    // ========================================

    async showBulkPrintModal() {
        if (!this.selectedBundles || this.selectedBundles.length === 0) {
            Toast.warning(this.__('messages.noProductsSelected'));
            return;
        }

        try {
            const templatesRes = await this.app.api.get('/templates?type=esl&per_page=100');
            const templates = templatesRes.data?.templates || templatesRes.data || [];
            const defaultTemplateId = templates.find(t => t.is_default)?.id || '';
            const bundleCount = this.selectedBundles.length;

            const formContent = `
                <div class="space-y-4">
                    <div class="alert alert-info mb-4">
                        <i class="ti ti-info-circle"></i>
                        <span>${this.__('messages.printInfo', { count: bundleCount })}</span>
                    </div>

                    <div class="form-group">
                        <label class="form-label">${this.__('messages.template')}</label>
                        <select id="bulk-print-template" class="form-select">
                            <option value="">${this.__('messages.selectTemplate')}</option>
                            ${templates.map(t => `<option value="${t.id}" ${defaultTemplateId === t.id ? 'selected' : ''}>${escapeHTML(t.name)}</option>`).join('')}
                        </select>
                        <p class="form-hint">${this.__('messages.templateHint') || ''}</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">${this.__('messages.paperSize')}</label>
                        <select id="bulk-print-paper" class="form-select">
                            <option value="" data-width="0" data-height="0">${this.__('messages.paperSizeNone')}</option>
                            <option value="a4" data-width="210" data-height="297">A4 (210 x 297 mm)</option>
                            <option value="a3" data-width="297" data-height="420">A3 (297 x 420 mm)</option>
                            <option value="a5" data-width="148" data-height="210">A5 (148 x 210 mm)</option>
                            <option value="letter" data-width="216" data-height="279">Letter (216 x 279 mm)</option>
                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">${this.__('messages.copies')}</label>
                            <input type="number" id="bulk-print-copies" class="form-input" value="1" min="1" max="100">
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('messages.labelSize')}</label>
                            <select id="bulk-print-size" class="form-select">
                                <option value="">${this.__('messages.loading')}</option>
                            </select>
                        </div>
                    </div>

                    <div id="bulk-print-grid-info" class="alert alert-success mb-0" style="display: none;">
                        <i class="ti ti-layout-grid"></i>
                        <span id="bulk-print-grid-text"></span>
                    </div>

                    <div class="form-group mt-3 mb-0">
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input type="checkbox" id="bulk-print-use-html" style="width:16px;height:16px;">
                            <span style="font-size:13px;">
                                <strong>${this.__('htmlPrint.label')}</strong>
                                <span style="color:var(--text-muted);margin-left:4px;font-size:12px;">${this.__('htmlPrint.hint')}</span>
                            </span>
                        </label>
                    </div>
                </div>
            `;

            Modal.show({
                title: this.__('messages.printTitle'),
                icon: 'ti-printer',
                content: formContent,
                size: 'md',
                confirmText: this.__('actions.print'),
                cancelText: this.__('actions.cancel'),
                onConfirm: async () => {
                    const templateId = document.getElementById('bulk-print-template')?.value || defaultTemplateId;
                    const copies = parseInt(document.getElementById('bulk-print-copies')?.value) || 1;
                    const sizeSelect = document.getElementById('bulk-print-size');
                    const selectedOption = sizeSelect?.options[sizeSelect.selectedIndex];
                    const width = selectedOption?.dataset?.width;
                    const height = selectedOption?.dataset?.height;
                    const unit = selectedOption?.dataset?.unit || 'mm';

                    const paperSelect = document.getElementById('bulk-print-paper');
                    const paperOption = paperSelect?.options[paperSelect.selectedIndex];
                    const paperWidth = parseInt(paperOption?.dataset?.width) || 0;
                    const paperHeight = parseInt(paperOption?.dataset?.height) || 0;

                    if (!width || !height) {
                        Toast.error(this.__('messages.sizeRequired'));
                        throw new Error('Size not selected');
                    }

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
                            type: 'bundle'
                        });
                    } else if (paperWidth > 0 && paperHeight > 0) {
                        // If paper size selected, use multi-label grid layout
                        this.bulkPrintPreviewGrid(copies, parseInt(width), parseInt(height), paperWidth, paperHeight, template);
                    } else {
                        this.bulkPrintPreview(copies, `${widthInch.toFixed(2)}x${heightInch.toFixed(2)}`, parseInt(width), parseInt(height), template);
                    }
                }
            });

            // Load label sizes
            setTimeout(() => this.loadBulkPrintLabelSizes(), 100);

        } catch (error) {
            Logger.error('Error showing bulk print modal:', error);
            Toast.error(this.__('messages.printFailed'));
        }
    }

    /**
     * HTML Baskı - Sunucu taraflı FabricToHtmlConverter ile baskı
     */
    async bulkPrintViaHtml({ templateId, copies, labelWidthMm, labelHeightMm, paperWidthMm, paperHeightMm, type }) {
        const items = this.selectedBundles;
        if (!items || items.length === 0) return;

        const popupWidth = Math.min(1400, window.screen.width - 100);
        const popupHeight = Math.min(900, window.screen.height - 100);
        const left = (window.screen.width - popupWidth) / 2;
        const top = (window.screen.height - popupHeight) / 2;
        const printWindow = window.open('', 'htmlPrintPreview',
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`);

        if (!printWindow) {
            Toast.error('Popup engellendi. Lütfen popup engelleyicisini kapatın.');
            return;
        }

        printWindow.document.write(`<!DOCTYPE html><html><head><title>Yükleniyor...</title></head><body style="background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column;gap:12px;"><div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.2);border-top:3px solid #228be6;border-radius:50%;animation:spin 1s linear infinite;"></div><p>Etiketler hazırlanıyor... (${items.length} paket)</p><style>@keyframes spin{to{transform:rotate(360deg)}}</style></body></html>`);

        try {
            const bundleIds = items.map(b => b.id);
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
                        bundle_ids: bundleIds,
                        type: 'bundle',
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

            Toast.success('Baskı önizlemesi açıldı');
        } catch (err) {
            Logger.error('HTML print error:', err);
            printWindow.close();
            Toast.error(this.__('htmlPrint.failed') || 'HTML baskı başarısız oldu');
        }
    }

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
                    option.textContent = '-';
                    select.appendChild(option);
                    return;
                }

                sizes.forEach(size => {
                    const option = document.createElement('option');
                    option.value = size.id;
                    option.dataset.width = size.width;
                    option.dataset.height = size.height;
                    option.dataset.unit = size.unit;

                    const displayName = size.name || `${size.width}x${size.height} ${size.unit}`;
                    const inchWidth = size.unit === 'mm' ? (size.width / 25.4).toFixed(2) : size.width;
                    const inchHeight = size.unit === 'mm' ? (size.height / 25.4).toFixed(2) : size.height;
                    option.textContent = `${displayName} (${inchWidth}" x ${inchHeight}")`;

                    if (size.is_default) option.selected = true;

                    select.appendChild(option);
                });

                if (!sizes.some(s => s.is_default) && select.options.length > 0) {
                    select.selectedIndex = 0;
                }

                select.addEventListener('change', () => this.updateBulkPrintGridInfo());
            }

            const paperSelect = document.getElementById('bulk-print-paper');
            if (paperSelect) {
                paperSelect.addEventListener('change', () => this.updateBulkPrintGridInfo());
            }

            this.updateBulkPrintGridInfo();
        } catch (error) {
            Logger.error('Label sizes load error:', error);
            const select = document.getElementById('bulk-print-size');
            if (select) {
                select.innerHTML = '<option value="">-</option>';
            }
        }
    }

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

        if (unit === 'inch') {
            labelWidth = Math.round(labelWidth * 25.4);
            labelHeight = Math.round(labelHeight * 25.4);
        }

        if (paperWidth === 0 || labelWidth === 0) {
            gridInfo.style.display = 'none';
            return;
        }

        const marginMm = 2;
        const cols = Math.floor((paperWidth - marginMm * 2) / labelWidth);
        const rows = Math.floor((paperHeight - marginMm * 2) / labelHeight);
        const labelsPerPage = cols * rows;

        if (labelsPerPage > 0) {
            const bundleCount = this.selectedBundles?.length || 0;
            const copies = parseInt(document.getElementById('bulk-print-copies')?.value) || 1;
            const totalLabels = bundleCount * copies;
            const pagesNeeded = Math.ceil(totalLabels / labelsPerPage);

            gridText.textContent = `${cols}x${rows} = ${labelsPerPage} / ${this.__('actions.print').toLowerCase()} | ${totalLabels} ${this.__('stats.totalBundles').toLowerCase()} → ${pagesNeeded} sayfa`;
            gridInfo.className = 'alert alert-success mb-0';
            gridInfo.style.display = 'flex';
        } else {
            gridText.textContent = this.__('messages.sizeRequired');
            gridInfo.className = 'alert alert-warning mb-0';
            gridInfo.style.display = 'flex';
        }
    }

    // ========================================
    // PRINT PREVIEW (from ProductList.js pattern)
    // ========================================

    /**
     * Single label per page print preview
     */
    bulkPrintPreview(copies, size, widthMm, heightMm, template = null) {
        const bundles = this.selectedBundles;
        const paddingMm = 2;

        const baseFontScale = heightMm / 50;
        const nameFontSize = Math.max(8, Math.min(18, 12 * baseFontScale));
        const priceFontSize = Math.max(14, Math.min(36, 24 * baseFontScale));
        const detailFontSize = Math.max(6, Math.min(12, 8 * baseFontScale));
        const barcodeFontSize = Math.max(6, Math.min(12, 9 * baseFontScale));
        const skuFontSize = Math.max(5, Math.min(10, 7 * baseFontScale));
        const labelPadding = Math.max(4, Math.min(16, 10 * baseFontScale));

        const generateBundleLabels = (bundle) => {
            const labels = [];
            for (let i = 0; i < copies; i++) {
                if (template && template.design_data) {
                    labels.push(this._renderTemplateLabelForBundle(bundle, template, widthMm, heightMm, paddingMm));
                } else {
                    labels.push(this._renderSimpleBundleLabel(bundle));
                }
            }
            return labels.join('');
        };

        const popupWidth = Math.min(1400, window.screen.width - 100);
        const popupHeight = Math.min(900, window.screen.height - 100);
        const left = (window.screen.width - popupWidth) / 2;
        const top = (window.screen.height - popupHeight) / 2;

        const printWindow = window.open('', 'printPreview', `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`);

        if (!printWindow) {
            Toast.error(this.__('messages.printFailed'));
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${this.__('messages.printTitle')}</title>
                <style>
                    @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
                    @media print {
                        html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
                        .toolbar { display: none !important; }
                        .main-content { padding: 0 !important; }
                        .labels-container { padding: 0 !important; gap: 0 !important; display: block !important; }
                        .label { width: ${widthMm}mm !important; height: ${heightMm}mm !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; margin: 0 !important; page-break-after: always; page-break-inside: avoid; }
                        .label:last-child { page-break-after: auto; }
                    }
                    * { box-sizing: border-box; }
                    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); min-height: 100vh; color: #f8f9fa; }
                    .toolbar { position: sticky; top: 0; z-index: 100; background: rgba(26,26,46,0.95); backdrop-filter: blur(10px); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); }
                    .toolbar-left { display: flex; align-items: center; gap: 16px; }
                    .toolbar-title { font-size: 18px; font-weight: 600; color: #fff; }
                    .toolbar-stats { display: flex; gap: 20px; font-size: 13px; color: rgba(255,255,255,0.7); }
                    .toolbar-stat { display: flex; align-items: center; gap: 6px; }
                    .toolbar-stat strong { color: #4dabf7; }
                    .toolbar-right { display: flex; gap: 12px; }
                    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px; }
                    .btn-primary { background: linear-gradient(135deg, #228be6, #1971c2); color: white; }
                    .btn-primary:hover { background: linear-gradient(135deg, #339af0, #1c7ed6); }
                    .btn-secondary { background: rgba(255,255,255,0.1); color: #e9ecef; border: 1px solid rgba(255,255,255,0.15); }
                    .btn-secondary:hover { background: rgba(255,255,255,0.15); }
                    .main-content { padding: 24px; display: flex; flex-direction: column; align-items: center; }
                    .labels-container { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
                    .label { width: ${widthMm}mm; height: ${heightMm}mm; background: white; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.3); color: #000; }
                    .label-content { width: 100%; height: 100%; padding: ${labelPadding}px; display: flex; flex-direction: column; justify-content: space-between; }
                    .bundle-name { font-size: ${nameFontSize}px; font-weight: 700; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; }
                    .bundle-type { font-size: ${detailFontSize}px; color: #718096; margin-top: 2px; }
                    .price-section { text-align: right; margin-top: auto; }
                    .total-price { font-size: ${detailFontSize}px; color: #a0aec0; text-decoration: line-through; }
                    .final-price { font-size: ${priceFontSize}px; font-weight: 800; color: #e03131; }
                    .discount-badge { font-size: ${detailFontSize}px; color: #40c057; font-weight: 600; }
                    .bundle-info { font-size: ${skuFontSize}px; color: #a0aec0; margin-top: 4px; }
                    .barcode { font-size: ${barcodeFontSize}px; color: #4a5568; text-align: center; margin-top: 2px; font-family: monospace; }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <div class="toolbar-left">
                        <div class="toolbar-title">${this.__('messages.printTitle')}</div>
                        <div class="toolbar-stats">
                            <span class="toolbar-stat">${this.__('stats.totalBundles')}: <strong>${bundles.length}</strong></span>
                            <span class="toolbar-stat">${this.__('messages.copies')}: <strong>${copies}</strong></span>
                            <span class="toolbar-stat">${widthMm}x${heightMm}mm</span>
                        </div>
                    </div>
                    <div class="toolbar-right">
                        <button class="btn btn-secondary" onclick="window.close()">&#10005; ${this.__('actions.cancel')}</button>
                        <button class="btn btn-primary" onclick="window.print()">&#128424; ${this.__('actions.print')}</button>
                    </div>
                </div>
                <div class="main-content">
                    <div class="labels-container">
                        ${bundles.map(b => generateBundleLabels(b)).join('')}
                    </div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        Toast.success(this.__('messages.printPreparing'));
    }

    /**
     * Multi-label grid layout print preview
     */
    bulkPrintPreviewGrid(copies, labelWidthMm, labelHeightMm, paperWidthMm, paperHeightMm, template = null) {
        const bundles = this.selectedBundles;
        const marginMm = 2;
        const usablePaperWidth = paperWidthMm - (marginMm * 2);
        const usablePaperHeight = paperHeightMm - (marginMm * 2);

        const cols = Math.floor(usablePaperWidth / labelWidthMm);
        const rows = Math.floor(usablePaperHeight / labelHeightMm);
        const labelsPerPage = cols * rows;

        if (labelsPerPage === 0) {
            Toast.error(this.__('messages.sizeRequired'));
            return;
        }

        const allLabels = [];
        bundles.forEach(bundle => {
            for (let i = 0; i < copies; i++) {
                allLabels.push(bundle);
            }
        });

        const pages = [];
        for (let i = 0; i < allLabels.length; i += labelsPerPage) {
            pages.push(allLabels.slice(i, i + labelsPerPage));
        }

        const baseFontScale = labelHeightMm / 50;
        const nameFontSize = Math.max(6, Math.min(14, 10 * baseFontScale));
        const priceFontSize = Math.max(10, Math.min(28, 18 * baseFontScale));
        const detailFontSize = Math.max(5, Math.min(10, 7 * baseFontScale));
        const labelPadding = Math.max(2, Math.min(10, 6 * baseFontScale));

        const generateLabelHtml = (bundle) => {
            if (template && template.design_data) {
                return this._renderTemplateLabelForBundle(bundle, template, labelWidthMm, labelHeightMm, 1);
            }
            return this._renderSimpleBundleLabel(bundle);
        };

        const generatePageHtml = (pageLabels, pageIndex) => {
            let labelsHtml = '';
            for (let i = 0; i < labelsPerPage; i++) {
                if (i < pageLabels.length) {
                    labelsHtml += `<div class="label">${generateLabelHtml(pageLabels[i])}</div>`;
                } else {
                    labelsHtml += `<div class="label empty"></div>`;
                }
            }
            return `<div class="page" data-page="${pageIndex + 1}"><div class="page-grid">${labelsHtml}</div></div>`;
        };

        const popupWidth = Math.min(1400, window.screen.width - 100);
        const popupHeight = Math.min(900, window.screen.height - 100);
        const left = (window.screen.width - popupWidth) / 2;
        const top = (window.screen.height - popupHeight) / 2;

        const printWindow = window.open('', 'printPreviewGrid', `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`);

        if (!printWindow) {
            Toast.error(this.__('messages.printFailed'));
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${this.__('messages.printTitle')}</title>
                <style>
                    @page { size: ${paperWidthMm}mm ${paperHeightMm}mm; margin: ${marginMm}mm; }
                    @media print {
                        html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
                        .toolbar { display: none !important; }
                        .main-content { padding: 0 !important; }
                        .page { width: ${usablePaperWidth}mm !important; height: ${usablePaperHeight}mm !important; page-break-after: always; page-break-inside: avoid; box-shadow: none !important; border: none !important; margin: 0 !important; }
                        .page:last-child { page-break-after: auto; }
                        .label.empty { visibility: hidden; }
                    }
                    * { box-sizing: border-box; }
                    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); min-height: 100vh; color: #f8f9fa; }
                    .toolbar { position: sticky; top: 0; z-index: 100; background: rgba(26,26,46,0.95); backdrop-filter: blur(10px); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); }
                    .toolbar-left { display: flex; align-items: center; gap: 16px; }
                    .toolbar-title { font-size: 18px; font-weight: 600; color: #fff; }
                    .toolbar-stats { display: flex; gap: 20px; font-size: 13px; color: rgba(255,255,255,0.7); }
                    .toolbar-stat strong { color: #4dabf7; }
                    .toolbar-right { display: flex; gap: 12px; }
                    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px; }
                    .btn-primary { background: linear-gradient(135deg, #228be6, #1971c2); color: white; }
                    .btn-primary:hover { background: linear-gradient(135deg, #339af0, #1c7ed6); }
                    .btn-secondary { background: rgba(255,255,255,0.1); color: #e9ecef; border: 1px solid rgba(255,255,255,0.15); }
                    .btn-secondary:hover { background: rgba(255,255,255,0.15); }
                    .main-content { padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 24px; }
                    .page { width: ${usablePaperWidth}mm; height: ${usablePaperHeight}mm; background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden; }
                    .page-grid { width: 100%; height: 100%; display: grid; grid-template-columns: repeat(${cols}, ${labelWidthMm}mm); grid-template-rows: repeat(${rows}, ${labelHeightMm}mm); }
                    .label { width: ${labelWidthMm}mm; height: ${labelHeightMm}mm; overflow: hidden; border: 0.5px solid #eee; color: #000; }
                    .label.empty { border: 0.5px dashed #ddd; }
                    .label-content { width: 100%; height: 100%; padding: ${labelPadding}px; display: flex; flex-direction: column; justify-content: space-between; }
                    .bundle-name { font-size: ${nameFontSize}px; font-weight: 700; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; }
                    .bundle-type { font-size: ${detailFontSize}px; color: #718096; }
                    .price-section { text-align: right; margin-top: auto; }
                    .total-price { font-size: ${detailFontSize}px; color: #a0aec0; text-decoration: line-through; }
                    .final-price { font-size: ${priceFontSize}px; font-weight: 800; color: #e03131; }
                    .discount-badge { font-size: ${detailFontSize}px; color: #40c057; font-weight: 600; }
                    .bundle-info { font-size: ${Math.max(4, detailFontSize - 1)}px; color: #a0aec0; }
                    .barcode { font-size: ${Math.max(5, detailFontSize)}px; color: #4a5568; text-align: center; font-family: monospace; }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <div class="toolbar-left">
                        <div class="toolbar-title">${this.__('messages.printTitle')}</div>
                        <div class="toolbar-stats">
                            <span class="toolbar-stat">${this.__('stats.totalBundles')}: <strong>${bundles.length}</strong></span>
                            <span class="toolbar-stat">${this.__('messages.copies')}: <strong>${copies}</strong></span>
                            <span class="toolbar-stat">${cols}x${rows}: <strong>${labelsPerPage}/${this.__('actions.print').toLowerCase()}</strong></span>
                        </div>
                    </div>
                    <div class="toolbar-right">
                        <button class="btn btn-secondary" onclick="window.close()">&#10005; ${this.__('actions.cancel')}</button>
                        <button class="btn btn-primary" onclick="window.print()">&#128424; ${this.__('actions.print')}</button>
                    </div>
                </div>
                <div class="main-content">
                    ${pages.map((page, idx) => generatePageHtml(page, idx)).join('')}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        Toast.success(this.__('messages.printPreparing'));
    }

    /**
     * Render simple bundle label (no template fallback)
     */
    _renderSimpleBundleLabel(bundle) {
        const name = this.escapeHtml(bundle.name);
        const type = this.__(`types.${bundle.type}`) || bundle.type || '';
        const totalPrice = parseFloat(bundle.total_price) || 0;
        const finalPrice = parseFloat(bundle.final_price) || 0;
        const discount = parseFloat(bundle.discount_percent) || 0;
        const itemCount = bundle.item_count || 0;
        const barcode = bundle.barcode || bundle.sku || '';
        const sku = bundle.sku || '';

        const hasDiscount = discount > 0 && totalPrice > finalPrice;

        return `
            <div class="label-content">
                <div>
                    <div class="bundle-name">${name}</div>
                    <div class="bundle-type">${this.escapeHtml(type)} ${itemCount > 0 ? `(${itemCount} ${this.__('columns.items').toLowerCase()})` : ''}</div>
                </div>
                <div class="price-section">
                    ${hasDiscount ? `<div class="total-price">${this.formatCurrency(totalPrice)}</div>` : ''}
                    <div class="final-price">${this.formatCurrency(finalPrice || totalPrice)}</div>
                    ${hasDiscount ? `<div class="discount-badge">-%${discount.toFixed(0)}</div>` : ''}
                </div>
                ${barcode ? `<div class="barcode">${this.escapeHtml(barcode)}</div>` : ''}
                ${sku ? `<div class="bundle-info">SKU: ${this.escapeHtml(sku)}</div>` : ''}
            </div>
        `;
    }

    /**
     * Render template-based label for bundle (maps bundle fields to product-like structure)
     */
    _renderTemplateLabelForBundle(bundle, template, labelWidthMm, labelHeightMm, paddingMm) {
        // Map bundle to product-like object for template rendering
        const pseudoProduct = {
            name: bundle.name,
            current_price: bundle.final_price || bundle.total_price,
            previous_price: parseFloat(bundle.discount_percent) > 0 ? bundle.total_price : null,
            barcode: bundle.barcode || '',
            sku: bundle.sku || '',
            category: bundle.category || '',
            description: bundle.description || '',
            unit: this.__(`types.${bundle.type}`) || bundle.type || '',
            image_url: bundle.image_url || '',
            discount_percent: bundle.discount_percent || '',
            campaign_text: parseFloat(bundle.discount_percent) > 0 ? `-%${parseFloat(bundle.discount_percent).toFixed(0)}` : ''
        };

        // Use a simplified template render approach
        const mmToPx = 96 / 25.4;
        const labelWidthPx = labelWidthMm * mmToPx;
        const labelHeightPx = labelHeightMm * mmToPx;
        const paddingPx = paddingMm * mmToPx;
        const availableWidthPx = labelWidthPx - (paddingPx * 2);
        const availableHeightPx = labelHeightPx - (paddingPx * 2);

        const templateWidth = template.width || 227;
        const templateHeight = template.height || 151;

        const scaleX = availableWidthPx / templateWidth;
        const scaleY = availableHeightPx / templateHeight;
        const scale = Math.min(scaleX, scaleY);

        const scaledWidth = availableWidthPx;
        const scaledHeight = availableHeightPx;
        const spreadX = scaleX / scale;
        const spreadY = scaleY / scale;

        let designData;
        const rawDesignData = template.design_data || template.content || '{}';
        try {
            designData = typeof rawDesignData === 'string' ? JSON.parse(rawDesignData) : rawDesignData;
        } catch (e) {
            return `<div class="label">${this._renderSimpleBundleLabel(bundle)}</div>`;
        }

        const objects = designData.objects || [];
        let elementsHtml = '';
        objects.forEach(obj => {
            if (!obj || obj.visible === false || obj.isTransient || obj.isHelper || obj.excludeFromExport) return;
            const ct = obj.customType || '';
            if (ct === 'video-placeholder' || ct === 'dynamic-video' || obj.isVideoPlaceholder) return;

            const html = this._renderFabricObjectForBundle(obj, pseudoProduct, scale, spreadX, spreadY);
            if (html) elementsHtml += html;
        });

        const bgColor = designData.background || template.background_color || '#ffffff';

        return `
            <div class="label">
                <div style="width:100%;height:100%;padding:${paddingMm}mm;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">
                    <div style="position:relative;width:${scaledWidth}px;height:${scaledHeight}px;background:${bgColor};overflow:hidden;">
                        ${elementsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render a single Fabric.js object for bundle label
     */
    _renderFabricObjectForBundle(obj, product, scale, spreadX = 1, spreadY = 1) {
        const objScaleX = obj.scaleX || 1;
        const objScaleY = obj.scaleY || 1;
        const rawWidth = (obj.width || 0) * objScaleX;
        const rawHeight = (obj.height || 0) * objScaleY;

        let rawLeft = obj.left || 0;
        let rawTop = obj.top || 0;
        const originX = obj.originX || 'center';
        const originY = obj.originY || 'center';
        if (originX === 'center') rawLeft -= rawWidth / 2;
        else if (originX === 'right') rawLeft -= rawWidth;
        if (originY === 'center') rawTop -= rawHeight / 2;
        else if (originY === 'bottom') rawTop -= rawHeight;

        const width = rawWidth * scale;
        const height = rawHeight * scale;
        const left = rawLeft * scale * spreadX;
        const top = rawTop * scale * spreadY;
        const angle = obj.angle || 0;
        const opacity = obj.opacity !== undefined ? obj.opacity : 1;

        // Dynamic field replacement
        let text = obj.text || '';
        const dynamicKey = this._extractDynamicKey(obj);
        if (dynamicKey) {
            text = this._getBundleDynamicValue(dynamicKey, product);
        }
        if (typeof text === 'string' && text.includes('{{')) {
            text = text.replace(/\{\{([^}]+)\}\}/g, (_, key) => this._getBundleDynamicValue(key, product) || '');
        }

        const baseStyle = `position:absolute;left:${left}px;top:${top}px;transform:rotate(${angle}deg);transform-origin:left top;opacity:${opacity};`;
        const ct = obj.customType || '';

        // Barcode
        if (ct === 'barcode') {
            return `<div style="${baseStyle}width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;background:#fff;font-family:monospace;font-size:${Math.max(8, 10 * scale)}px;">${this.escapeHtml(text || product.barcode || '')}</div>`;
        }

        // QR Code
        if (ct === 'qrcode') {
            return `<div style="${baseStyle}width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid rgba(0,0,0,0.2);font-family:monospace;font-size:${Math.max(8, 10 * scale)}px;">${this.escapeHtml(text || '')}</div>`;
        }

        // Image
        if (obj.type === 'image' || obj.type === 'Image') {
            const src = obj.src || '';
            if (!src) return '';
            return `<img src="${this.escapeHtml(src)}" style="${baseStyle}width:${width}px;height:${height}px;object-fit:contain;" />`;
        }

        // Text objects
        if (['textbox', 'i-text', 'text', 'Text', 'IText', 'Textbox'].includes(obj.type)) {
            const fontSize = (obj.fontSize || 16) * scale;
            const fontFamily = obj.fontFamily || 'Arial';
            const fontWeight = obj.fontWeight || 'normal';
            const fontStyle = obj.fontStyle || 'normal';
            const fill = obj.fill || '#000000';
            const textAlign = obj.textAlign || 'left';
            const lineHeight = obj.lineHeight || 1.2;

            return `<div style="${baseStyle}width:${width}px;font-size:${fontSize}px;font-family:${fontFamily},sans-serif;font-weight:${fontWeight};font-style:${fontStyle};color:${fill};text-align:${textAlign};line-height:${lineHeight};white-space:pre-wrap;word-wrap:break-word;overflow:hidden;">${this.escapeHtml(text)}</div>`;
        }

        // Rect
        if (obj.type === 'rect' || obj.type === 'Rect') {
            const fill = obj.fill || 'transparent';
            const stroke = obj.stroke || 'transparent';
            const strokeWidth = (obj.strokeWidth || 0) * scale;
            const rx = (obj.rx || 0) * scale;
            return `<div style="${baseStyle}width:${width}px;height:${height}px;background:${fill};border:${strokeWidth}px solid ${stroke};border-radius:${rx}px;"></div>`;
        }

        return '';
    }

    _extractDynamicKey(obj) {
        if (!obj) return '';
        if (typeof obj.dynamicField === 'string' && obj.dynamicField.trim()) return obj.dynamicField;
        if (obj.isDynamicField || obj.isDataField) {
            const text = typeof obj.text === 'string' ? obj.text : '';
            const match = text.match(/\{\{([^}]+)\}\}/);
            if (match) return match[1];
        }
        return '';
    }

    _getBundleDynamicValue(fieldKey, product) {
        const normalizedKey = fieldKey.replace(/^slot-/, '').replace(/^dynamic-/, '').toLowerCase().replace(/[\s_-]+/g, '_');
        const fieldMap = {
            'name': product.name,
            'current_price': this.formatCurrency(product.current_price),
            'price': this.formatCurrency(product.current_price),
            'previous_price': product.previous_price ? this.formatCurrency(product.previous_price) : '',
            'old_price': product.previous_price ? this.formatCurrency(product.previous_price) : '',
            'price_with_currency': this.formatCurrency(product.current_price),
            'barcode': product.barcode || '',
            'sku': product.sku || '',
            'category': product.category || '',
            'description': product.description || '',
            'unit': product.unit || '',
            'discount_percent': product.discount_percent ? `%${product.discount_percent}` : '',
            'campaign_text': product.campaign_text || '',
            'image_url': product.image_url || '',
            'date_today': new Date().toLocaleDateString('tr-TR'),
            'date_time': new Date().toLocaleString('tr-TR')
        };
        return fieldMap[normalizedKey] || fieldMap[fieldKey] || '';
    }

    formatCurrency(value) {
        return this.app.i18n.formatPrice(value);
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // ========================================
    // IMAGE METHODS (ProductList.js pattern)
    // ========================================

    getCoverImageUrl(row) {
        if (row.images) {
            try {
                const images = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
                if (Array.isArray(images) && images.length > 0) {
                    const coverIndex = row.cover_image_index || 0;
                    const coverImage = images[coverIndex] || images[0];
                    return coverImage.url || coverImage;
                }
            } catch (e) {
                // Ignore parse error
            }
        }
        return row.image_url || null;
    }

    getDisplayUrl(url) {
        return MediaUtils.getDisplayUrl(url);
    }

    renderCoverImage(row) {
        const imageUrl = this.getCoverImageUrl(row);

        if (!imageUrl) {
            return `
                <div class="product-table-thumb product-table-thumb-empty">
                    <i class="ti ti-box-multiple"></i>
                </div>
            `;
        }

        const fullUrl = this.getDisplayUrl(imageUrl);

        return `
            <div class="product-table-thumb"
                 data-preview-url="${escapeHTML(fullUrl)}"
                 data-product-name="${escapeHTML(row.name || '')}">
                <img src="${escapeHTML(fullUrl)}" alt="${escapeHTML(row.name || '')}" loading="lazy"
                     onerror="this.parentElement.innerHTML='<i class=\\'ti ti-box-multiple\\'></i>'">
            </div>
        `;
    }

    initImageHoverPreview() {
        if (!document.getElementById('bundle-image-preview-popup')) {
            const popup = document.createElement('div');
            popup.id = 'bundle-image-preview-popup';
            popup.className = 'product-image-preview-popup';
            popup.innerHTML = `
                <img src="" alt="Preview">
                <div class="preview-popup-name"></div>
            `;
            document.body.appendChild(popup);
        }

        const popup = document.getElementById('bundle-image-preview-popup');
        const popupImg = popup.querySelector('img');
        const popupName = popup.querySelector('.preview-popup-name');

        const tableContainer = document.getElementById('bundles-table');
        if (!tableContainer) return;

        tableContainer.addEventListener('mouseenter', (e) => {
            const thumb = e.target.closest('.product-table-thumb[data-preview-url]');
            if (!thumb) return;

            const previewUrl = thumb.dataset.previewUrl;
            const productName = thumb.dataset.productName;

            if (!previewUrl) return;

            popupImg.src = previewUrl;
            popupName.textContent = productName || '';

            this.positionPreviewPopup(popup, thumb);
            popup.classList.add('visible');
        }, true);

        tableContainer.addEventListener('mouseleave', (e) => {
            const thumb = e.target.closest('.product-table-thumb[data-preview-url]');
            if (!thumb) return;

            popup.classList.remove('visible');
        }, true);
    }

    positionPreviewPopup(popup, targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const popupWidth = 250;
        const popupHeight = 280;
        const padding = 12;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow >= popupHeight + padding) {
            top = rect.bottom + padding;
        } else if (spaceAbove >= popupHeight + padding) {
            top = rect.top - popupHeight - padding;
        } else {
            top = Math.max(padding, (viewportHeight - popupHeight) / 2);
        }

        let left = rect.right + padding;

        if (left + popupWidth > viewportWidth - padding) {
            left = rect.left - popupWidth - padding;
        }

        left = Math.max(padding, Math.min(left, viewportWidth - popupWidth - padding));
        top = Math.max(padding, Math.min(top, viewportHeight - popupHeight - padding));

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }

    // ========================================
    // HELPERS
    // ========================================

    _formatPrice(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return '-';
        return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return this.__('time.justNow');
        if (minutes < 60) return `${minutes} ${this.__('time.minutesAgo')}`;
        if (hours < 24) return `${hours} ${this.__('time.hoursAgo')}`;
        if (days === 1) return this.__('time.yesterday');
        if (days < 7) return `${days} ${this.__('time.daysAgo')}`;

        return date.toLocaleDateString(this.app.i18n.locale);
    }

    destroy() {
        if (this._exportOutsideClickHandler) {
            document.removeEventListener('click', this._exportOutsideClickHandler);
            this._exportOutsideClickHandler = null;
        }
        const popup = document.getElementById('bundle-image-preview-popup');
        if (popup) popup.remove();
        this.app.i18n.clearPageTranslations();
    }
}

export default BundleListPage;
