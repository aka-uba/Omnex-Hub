/**
 * Branch Management Page Component (Admin)
 * Uses centralized DataTable component
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class BranchManagementPage {
    constructor(app) {
        this.app = app;
        this.dataTable = null;
        this.regions = [];
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
        await this.app.i18n.loadPageTranslations('branches');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.dashboard') || 'Panel'}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon teal">
                            <i class="ti ti-building-store"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('title')}</h1>
                            <p class="page-subtitle">${this.__('subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="add-region-btn" class="btn btn-outline">
                            <i class="ti ti-map-pin"></i>
                            ${this.__('list.addRegion')}
                        </button>
                        <button id="add-branch-btn" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.__('list.addBranch')}
                        </button>
                    </div>
                </div>
            </div>

            <div class="card card-table">
                <div id="branches-table"></div>
            </div>
        `;
    }

    async init() {
        await this.loadRegions();
        this.initDataTable();
        this.bindEvents();
    }

    async loadRegions() {
        try {
            const response = await this.app.api.get('/branches?type=region');
            this.regions = response.data || [];
        } catch (error) {
            Logger.error('Failed to load regions:', error);
            this.regions = [];
        }
    }

    initDataTable() {
        const container = document.getElementById('branches-table');
        if (!container) return;

        this.dataTable = new DataTable(container, {
            serverSide: true,
            fetchData: (params) => this.fetchBranches(params),
            columns: [
                {
                    key: 'type',
                    label: '',
                    type: 'icon',
                    sortable: false,
                    render: (value, row) => {
                        // Hiyerarşik ikon: Bölge için harita ikonu, şube için mağaza ikonu
                        const icons = {
                            'region': '<i class="ti ti-map-2" style="color: var(--color-warning); font-size: 20px;"></i>',
                            'store': '<i class="ti ti-building-store" style="color: var(--color-primary);"></i>',
                            'warehouse': '<i class="ti ti-building-warehouse" style="color: var(--color-info);"></i>',
                            'online': '<i class="ti ti-world" style="color: var(--color-success);"></i>'
                        };
                        // Alt şube ise daha küçük ikon
                        if (row.parent_id && value !== 'region') {
                            return `<span style="opacity: 0.7;">${icons[value] || '<i class="ti ti-building"></i>'}</span>`;
                        }
                        return icons[value] || '<i class="ti ti-building"></i>';
                    }
                },
                {
                    key: 'code',
                    label: this.__('form.code'),
                    render: (value) => `<code class="text-primary">${escapeHTML(value) || '-'}</code>`
                },
                {
                    key: 'name',
                    label: this.__('form.name'),
                    title: true,
                    render: (value, row) => {
                        // Hiyerarşik görünüm: Bölgeler üst seviye, şubeler girintili
                        if (row.type === 'region') {
                            // Bölge: Üst seviye, bold ve badge ile
                            return `
                                <div class="branch-item branch-region">
                                    <i class="ti ti-map-2 text-warning mr-2"></i>
                                    <span class="font-semibold">${escapeHTML(value)}</span>
                                </div>
                            `;
                        } else if (row.parent_id) {
                            // Alt şube: Girintili gösterim
                            return `
                                <div class="branch-item branch-child" style="padding-left: 24px;">
                                    <i class="ti ti-corner-down-right text-muted mr-1" style="font-size: 14px;"></i>
                                    <span class="font-medium">${escapeHTML(value)}</span>
                                </div>
                            `;
                        } else {
                            // Bağımsız şube
                            return `
                                <div class="branch-item">
                                    <span class="font-medium">${escapeHTML(value)}</span>
                                </div>
                            `;
                        }
                    }
                },
                {
                    key: 'type',
                    label: this.__('form.type'),
                    render: (value) => {
                        const badges = {
                            'region': 'badge-warning',
                            'store': 'badge-primary',
                            'warehouse': 'badge-info',
                            'online': 'badge-success'
                        };
                        const typeName = this.__(`types.${value}`) || value;
                        return `<span class="badge ${badges[value] || 'badge-secondary'}">${escapeHTML(typeName)}</span>`;
                    }
                },
                {
                    key: 'parent_name',
                    label: this.__('form.parentRegion'),
                    render: (value) => value ? escapeHTML(value) : `<span class="text-muted">-</span>`
                },
                {
                    key: 'city',
                    label: this.__('form.city'),
                    render: (value, row) => {
                        if (value && row.district) {
                            return `${escapeHTML(value)} / ${escapeHTML(row.district)}`;
                        }
                        return escapeHTML(value) || `<span class="text-muted">-</span>`;
                    }
                },
                {
                    key: 'is_active',
                    label: this.__('form.isActive'),
                    render: (value) => {
                        const isActive = value === true || value === 1 || value === '1' || value === 't' || value === 'true';
                        const label = isActive ? (this.__('status.active') || 'Aktif') : (this.__('status.inactive') || 'Pasif');
                        const cls = isActive ? 'badge-success' : 'badge-secondary';
                        return `<span class="badge ${cls}">${escapeHTML(label)}</span>`;
                    }
                }
            ],
            actions: [
                {
                    name: 'edit',
                    icon: 'ti-edit',
                    label: this.__('actions.edit'),
                    onClick: (row) => this.edit(row)
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('actions.delete') || 'Sil',
                    class: 'btn-ghost text-danger',
                    onClick: (row) => this.delete(row)
                }
            ],
            toolbar: {
                show: true,
                exports: true,
                filters: false
            },
            searchPlaceholder: this.__('list.search'),
            emptyText: this.__('list.empty'),
            emptyIcon: 'ti-building-store'
        });
    }

    async fetchBranches(params) {
        try {
            const queryParams = new URLSearchParams({
                page: params.page,
                per_page: params.limit,
                search: params.search || '',
                sort_by: params.sort_by || 'sort_order',
                sort_dir: params.sort_dir || 'ASC',
                hierarchy: '1'
            });

            const response = await this.app.api.get(`/branches?${queryParams}`);

            if (response.success) {
                // Hiyerarşik sıralama: Bölge → Alt Şubeler → Bölgesiz Şubeler
                let sortedData = [];
                const data = response.data;

                if (data?.regions) {
                    // Önce bölgeler ve altındaki şubeler
                    data.regions.forEach(region => {
                        sortedData.push(region);
                        if (region.children?.length > 0) {
                            sortedData.push(...region.children);
                        }
                    });
                    // Sonra bölgesiz şubeler
                    if (data.orphans?.length > 0) {
                        sortedData.push(...data.orphans);
                    }
                } else {
                    // Hiyerarşi yoksa düz liste
                    sortedData = data?.all || data || [];
                }

                return {
                    data: sortedData,
                    total: response.pagination?.total || sortedData.length || 0,
                    page: response.pagination?.page || params.page,
                    perPage: response.pagination?.per_page || params.perPage
                };
            }

            return { data: [], total: 0, page: 1, perPage: params.perPage };
        } catch (error) {
            Logger.error('Failed to fetch branches:', error);
            Toast.error(this.__('messages.fetchError'));
            return { data: [], total: 0, page: 1, perPage: params.perPage };
        }
    }

    bindEvents() {
        document.getElementById('add-branch-btn')?.addEventListener('click', () => {
            this.showForm(null, 'store');
        });

        document.getElementById('add-region-btn')?.addEventListener('click', () => {
            this.showForm(null, 'region');
        });
    }

    showForm(branch = null, type = 'store') {
        const isEdit = !!branch;
        const isRegion = type === 'region' || branch?.type === 'region';

        // Bölge için basit modal, Şube için tam modal
        if (isRegion) {
            this.showRegionForm(branch, isEdit);
        } else {
            this.showBranchForm(branch, isEdit);
        }
    }

    /**
     * Bölge için basit form
     */
    showRegionForm(branch = null, isEdit = false) {
        const title = isEdit ? this.__('form.editRegion') : this.__('form.createRegion');

        const content = `
            <form id="branch-form" class="form">
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label form-label-required">${this.__('form.regionCode')}</label>
                        <input type="text" id="branch-code" class="form-input"
                            placeholder="${this.__('form.regionCodeHint')}"
                            value="${escapeHTML(branch?.code || '')}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label form-label-required">${this.__('form.regionName')}</label>
                        <input type="text" id="branch-name" class="form-input"
                            value="${escapeHTML(branch?.name || '')}" required>
                    </div>
                </div>
                <input type="hidden" id="branch-type" value="region">

                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.sortOrder')}</label>
                        <input type="number" id="branch-sort" class="form-input"
                            value="${branch?.sort_order || 0}" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.externalCode')}</label>
                        <input type="text" id="branch-external" class="form-input"
                            placeholder="${this.__('form.externalCodeHint')}"
                            value="${escapeHTML(branch?.external_code || '')}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-check">
                        <input type="checkbox" id="branch-active" ${branch?.is_active !== false ? 'checked' : ''}>
                        <span class="form-check-label">${this.__('form.isActive')}</span>
                    </label>
                </div>
            </form>
        `;

        Modal.show({
            title: title,
            icon: 'ti ti-map-2',
            content: content,
            size: 'md',
            confirmText: isEdit ? this.__('actions.update') : this.__('actions.create'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                await this.save(branch?.id);
            }
        });
    }

    /**
     * Şube için tam form
     */
    showBranchForm(branch = null, isEdit = false) {
        const title = isEdit ? this.__('form.edit') : this.__('form.create');

        const content = `
            <form id="branch-form" class="form">
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label form-label-required">${this.__('form.code')}</label>
                        <input type="text" id="branch-code" class="form-input"
                            placeholder="${this.__('form.codeHint')}"
                            value="${escapeHTML(branch?.code || '')}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label form-label-required">${this.__('form.name')}</label>
                        <input type="text" id="branch-name" class="form-input"
                            value="${escapeHTML(branch?.name || '')}" required>
                    </div>
                </div>

                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.type')}</label>
                        <select id="branch-type" class="form-select">
                            <option value="store" ${(branch?.type || 'store') === 'store' ? 'selected' : ''}>${this.__('types.store')}</option>
                            <option value="warehouse" ${branch?.type === 'warehouse' ? 'selected' : ''}>${this.__('types.warehouse')}</option>
                            <option value="online" ${branch?.type === 'online' ? 'selected' : ''}>${this.__('types.online')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.parentRegion')}</label>
                        <select id="branch-parent" class="form-select">
                            <option value="">${this.__('form.noParent')}</option>
                            ${this.regions.map(r => `
                                <option value="${r.id}" ${branch?.parent_id === r.id ? 'selected' : ''}>
                                    ${escapeHTML(r.name)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-section-title">${this.__('form.contact')}</div>

                <div class="form-group">
                    <label class="form-label">${this.__('form.address')}</label>
                    <textarea id="branch-address" class="form-textarea" rows="2">${escapeHTML(branch?.address || '')}</textarea>
                </div>

                <div class="form-grid form-grid-3">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.city')}</label>
                        <input type="text" id="branch-city" class="form-input"
                            value="${escapeHTML(branch?.city || '')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.district')}</label>
                        <input type="text" id="branch-district" class="form-input"
                            value="${escapeHTML(branch?.district || '')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.postalCode')}</label>
                        <input type="text" id="branch-postal" class="form-input"
                            value="${escapeHTML(branch?.postal_code || '')}">
                    </div>
                </div>

                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.phone')}</label>
                        <input type="tel" id="branch-phone" class="form-input"
                            value="${escapeHTML(branch?.phone || '')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.email')}</label>
                        <input type="email" id="branch-email" class="form-input"
                            value="${escapeHTML(branch?.email || '')}">
                    </div>
                </div>

                <div class="form-section-title">${this.__('form.settings')}</div>

                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.sortOrder')}</label>
                        <input type="number" id="branch-sort" class="form-input"
                            value="${branch?.sort_order || 0}" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.externalCode')}</label>
                        <input type="text" id="branch-external" class="form-input"
                            placeholder="${this.__('form.externalCodeHint')}"
                            value="${escapeHTML(branch?.external_code || '')}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-check">
                        <input type="checkbox" id="branch-active" ${branch?.is_active !== false ? 'checked' : ''}>
                        <span class="form-check-label">${this.__('form.isActive')}</span>
                    </label>
                </div>
            </form>
        `;

        Modal.show({
            title: title,
            icon: 'ti ti-building-store',
            content: content,
            size: 'lg',
            confirmText: isEdit ? this.__('actions.update') : this.__('actions.create'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                await this.save(branch?.id);
            }
        });
    }

    async save(id = null) {
        const codeInput = document.getElementById('branch-code');
        const nameInput = document.getElementById('branch-name');
        const code = codeInput?.value?.trim();
        const name = nameInput?.value?.trim();
        const type = document.getElementById('branch-type')?.value;
        const parent_id = document.getElementById('branch-parent')?.value || null;
        const address = document.getElementById('branch-address')?.value?.trim();
        const city = document.getElementById('branch-city')?.value?.trim();
        const district = document.getElementById('branch-district')?.value?.trim();
        const postal_code = document.getElementById('branch-postal')?.value?.trim();
        const phone = document.getElementById('branch-phone')?.value?.trim();
        const email = document.getElementById('branch-email')?.value?.trim();
        const sort_order = parseInt(document.getElementById('branch-sort')?.value) || 0;
        const external_code = document.getElementById('branch-external')?.value?.trim();
        const is_active = document.getElementById('branch-active')?.checked ? 1 : 0;

        // Zorunlu alan kontrolü ve görsel geri bildirim
        const errors = [];

        // Önce hata class'larını temizle
        codeInput?.classList.remove('is-invalid', 'error');
        nameInput?.classList.remove('is-invalid', 'error');

        const isRegion = type === 'region';
        const codeLabel = isRegion ? this.__('form.regionCode') : this.__('form.code');
        const nameLabel = isRegion ? this.__('form.regionName') : this.__('form.name');

        if (!code) {
            codeInput?.classList.add('is-invalid', 'error');
            errors.push(this.__('validation.requiredField', { field: codeLabel }));
        }

        if (!name) {
            nameInput?.classList.add('is-invalid', 'error');
            errors.push(this.__('validation.requiredField', { field: nameLabel }));
        }

        if (errors.length > 0) {
            errors.forEach(msg => Toast.error(msg));
            ((!code ? codeInput : nameInput))?.focus();
            throw new Error('Required fields missing');
        }

        const data = {
            code,
            name,
            type,
            parent_id: type === 'region' ? null : parent_id,
            address,
            city,
            district,
            postal_code,
            phone,
            email,
            sort_order,
            external_code,
            is_active
        };

        try {
            if (id) {
                await this.app.api.put(`/branches/${id}`, data);
                Toast.success(this.__('messages.updated'));
            } else {
                await this.app.api.post('/branches', data);
                Toast.success(this.__('messages.created'));
            }

            // Reload regions if we added/edited a region
            if (type === 'region') {
                await this.loadRegions();
            }

            this.dataTable?.refresh();
        } catch (error) {
            Logger.error('Failed to save branch:', error);
            Toast.error(error.message || this.__('messages.saveError'));
            throw error;
        }
    }

    edit(branch) {
        this.showForm(branch, branch.type);
    }

    delete(branch) {
        Modal.show({
            title: this.__('confirm.deleteTitle'),
            icon: 'danger',
            size: 'sm',
            content: `
                <p class="text-gray-600 dark:text-gray-400">${escapeHTML(this.__('confirm.delete'))}</p>
                <p class="mt-3 mb-3"><strong>${escapeHTML(branch.name)}</strong></p>
                <p class="text-sm text-muted">${escapeHTML(this.__('confirm.deleteWarning'))}</p>
            `,
            confirmText: this.__('actions.delete') || 'Sil',
            cancelText: this.__('actions.cancel'),
            confirmClass: 'btn-danger',
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/branches/${branch.id}`);
                    Toast.success(this.__('messages.deleted'));

                    // Reload regions if we deleted a region
                    if (branch.type === 'region') {
                        await this.loadRegions();
                    }

                    this.dataTable?.refresh();
                } catch (error) {
                    Logger.error('Failed to delete branch:', error);
                    Toast.error(error.message || this.__('messages.deleteError'));
                }
            }
        });
    }

    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}

export default BranchManagementPage;
