/**
 * Label Settings Page Component
 * Manages label sizes for printing
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';

export class LabelSettingsPage {
    constructor(app) {
        this.app = app;
        this.labelSizes = [];
        this.dataTable = null;
    }

    /**
     * i18n helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('settings');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/settings">${this.__('title')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('labels.title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon amber">
                            <i class="ti ti-ruler-2"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('labels.title')}</h1>
                            <p class="page-subtitle">${this.__('labels.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <a href="#/settings" class="btn btn-outline">
                            <i class="ti ti-arrow-left"></i>
                            ${this.__('actions.back')}
                        </a>
                        <button id="add-label-size-btn" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.__('labels.addNew')}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Info Card -->
            <div class="chart-card mb-4">
                <div class="chart-card-body">
                    <div class="flex items-start gap-4">
                        <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <i class="ti ti-info-circle text-2xl text-amber-600"></i>
                        </div>
                        <div>
                            <h3 class="font-semibold text-gray-900 dark:text-white mb-1">${this.__('labels.infoTitle')}</h3>
                            <p class="text-sm text-gray-600 dark:text-gray-400">
                                ${this.__('labels.infoText')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Label Sizes Table -->
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title">
                        <i class="ti ti-list"></i>
                        ${this.__('labels.listTitle')}
                    </h2>
                    <span class="badge badge-secondary" id="label-count">0</span>
                </div>
                <div class="chart-card-body">
                    <div id="label-sizes-table"></div>
                </div>
            </div>
        `;
    }

    async init() {
        await this.loadLabelSizes();
        this.bindEvents();
    }

    async loadLabelSizes() {
        try {
            // Yönetim sayfası için tüm kayıtları getir (aktif + pasif)
            const response = await this.app.api.get('/label-sizes?all=1');
            this.labelSizes = response.data || [];
            this.renderTable();

            const countEl = document.getElementById('label-count');
            if (countEl) {
                countEl.textContent = this.labelSizes.length;
            }
        } catch (error) {
            Logger.error('Label sizes load error:', error);
            Toast.error(this.__('labels.toast.loadFailed'));
        }
    }

    renderTable() {
        const container = document.getElementById('label-sizes-table');
        if (!container) return;

        this.dataTable = new DataTable({
            container: '#label-sizes-table',
            columns: [
                {
                    key: 'name',
                    label: this.__('labels.columns.name'),
                    sortable: true,
                    render: (value, row) => {
                        const isSystem = !row.company_id;
                        const systemLabel = this.__('labels.system');
                        return `
                            <div class="flex items-center gap-2">
                                <i class="ti ti-ruler-2 text-gray-400"></i>
                                <span class="font-medium">${this.escapeHtml(value)}</span>
                                ${isSystem ? `<span class="badge badge-secondary text-xs">${systemLabel}</span>` : ''}
                            </div>
                        `;
                    }
                },
                {
                    key: 'dimensions',
                    label: this.__('labels.columns.dimensions'),
                    sortable: false,
                    render: (_, row) => {
                        return `<span class="font-mono text-sm">${row.width} x ${row.height} ${row.unit}</span>`;
                    }
                },
                {
                    key: 'dimensions_inch',
                    label: this.__('labels.columns.inchDimensions'),
                    sortable: false,
                    render: (_, row) => {
                        if (row.unit === 'inch') {
                            return `<span class="font-mono text-sm text-gray-500">${row.width}" x ${row.height}"</span>`;
                        }
                        // mm to inch conversion
                        const widthInch = (row.width / 25.4).toFixed(2);
                        const heightInch = (row.height / 25.4).toFixed(2);
                        return `<span class="font-mono text-sm text-gray-500">${widthInch}" x ${heightInch}"</span>`;
                    }
                },
                {
                    key: 'is_active',
                    label: this.__('labels.columns.status'),
                    sortable: true,
                    render: (value, row) => {
                        const activeLabel = this.__('labels.status.active');
                        const inactiveLabel = this.__('labels.status.inactive');

                        // Tüm kayıtlar için toggle switch (sistem dahil)
                        return `
                            <label class="toggle-switch" data-toggle-status data-id="${row.id}" data-is-system="${!row.company_id ? '1' : '0'}" title="${value ? activeLabel : inactiveLabel}">
                                <input type="checkbox" ${value ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        `;
                    }
                }
            ],
            actions: [
                {
                    name: 'edit',
                    icon: 'ti-edit',
                    label: this.__('actions.edit'),
                    class: 'btn-ghost text-primary',
                    // Tüm kayıtlar düzenlenebilir (sistem için sadece aktif/pasif)
                    onClick: (row) => this.editLabelSize(row)
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('actions.delete'),
                    class: 'btn-ghost text-danger',
                    condition: (row) => !!row.company_id, // Sadece şirkete özel olanlar silinebilir
                    onClick: (row) => this.deleteLabelSize(row)
                }
            ],
            pagination: true,
            pageSize: 20,
            searchable: true,
            emptyText: this.__('labels.noData')
        });

        this.dataTable.setData(this.labelSizes);

        // Force CSS reflow for toggle switches after DataTable render
        requestAnimationFrame(() => {
            const toggles = container.querySelectorAll('.toggle-slider');
            toggles.forEach(toggle => {
                // Force browser to recalculate styles
                toggle.offsetHeight;
            });
        });
    }

    bindEvents() {
        document.getElementById('add-label-size-btn')?.addEventListener('click', () => {
            this.showAddModal();
        });

        // Toggle switch event listener
        document.getElementById('label-sizes-table')?.addEventListener('change', (e) => {
            if (e.target.closest('[data-toggle-status]')) {
                const toggle = e.target.closest('[data-toggle-status]');
                const id = toggle.dataset.id;
                const isActive = e.target.checked;
                this.toggleLabelSizeStatus(id, isActive);
            }
        });
    }

    showAddModal() {
        const namePlaceholder = this.__('labels.placeholders.name');
        const formContent = `
            <div class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${this.__('labels.form.name')}</label>
                    <input type="text" id="label-name" class="form-input" placeholder="${namePlaceholder}">
                    <p class="form-hint">${this.__('labels.form.nameHint')}</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('labels.form.width')} *</label>
                        <input type="number" id="label-width" class="form-input" placeholder="100" step="0.1" min="1" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('labels.form.height')} *</label>
                        <input type="number" id="label-height" class="form-input" placeholder="50" step="0.1" min="1" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('labels.form.unit')}</label>
                    <select id="label-unit" class="form-select">
                        <option value="mm">${this.__('labels.units.mm')}</option>
                        <option value="inch">${this.__('labels.units.inch')}</option>
                    </select>
                </div>
            </div>
        `;

        Modal.show({
            title: this.__('labels.addTitle'),
            icon: 'ti-plus',
            content: formContent,
            size: 'md',
            confirmText: this.__('actions.save'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const name = document.getElementById('label-name')?.value?.trim();
                const width = parseFloat(document.getElementById('label-width')?.value);
                const height = parseFloat(document.getElementById('label-height')?.value);
                const unit = document.getElementById('label-unit')?.value;

                if (!width || !height || width <= 0 || height <= 0) {
                    Toast.error(this.__('labels.validation.dimensionsRequired'));
                    throw new Error('Validation failed');
                }

                try {
                    await this.app.api.post('/label-sizes', {
                        name: name || null,
                        width,
                        height,
                        unit
                    });
                    Toast.success(this.__('labels.toast.created'));
                    await this.loadLabelSizes();
                } catch (error) {
                    Toast.error(error.message || this.__('labels.toast.saveFailed'));
                    throw error;
                }
            }
        });
    }

    editLabelSize(row) {
        const isSystemRecord = !row.company_id;

        if (isSystemRecord) {
            // Sistem kaydı için sadece aktif/pasif seçeneği
            const formContent = `
                <div class="space-y-4">
                    <div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div class="flex items-start gap-3">
                            <i class="ti ti-info-circle text-amber-600 text-xl mt-0.5"></i>
                            <div>
                                <p class="text-sm text-amber-800 dark:text-amber-200">
                                    ${this.__('labels.systemEditInfo')}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="text-gray-500">${this.__('labels.form.name')}:</span>
                                <span class="font-medium ml-2">${this.escapeHtml(row.name)}</span>
                            </div>
                            <div>
                                <span class="text-gray-500">${this.__('labels.columns.dimensions')}:</span>
                                <span class="font-medium ml-2">${row.width} x ${row.height} ${row.unit}</span>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <input type="checkbox" id="edit-label-active" class="w-5 h-5" ${row.is_active ? 'checked' : ''}>
                            <div>
                                <span class="font-medium">${this.__('labels.form.active')}</span>
                                <p class="text-xs text-gray-500 mt-0.5">${this.__('labels.form.activeHint')}</p>
                            </div>
                        </label>
                    </div>
                </div>
            `;

            Modal.show({
                title: this.__('labels.editSystemTitle'),
                icon: 'ti-edit',
                content: formContent,
                size: 'md',
                confirmText: this.__('actions.save'),
                cancelText: this.__('actions.cancel'),
                onConfirm: async () => {
                    const isActive = document.getElementById('edit-label-active')?.checked;

                    try {
                        await this.app.api.put(`/label-sizes/${row.id}`, {
                            is_active: isActive ? 1 : 0
                        });
                        Toast.success(this.__('labels.toast.statusChanged'));
                        await this.loadLabelSizes();
                    } catch (error) {
                        Toast.error(error.message || this.__('labels.toast.saveFailed'));
                        throw error;
                    }
                }
            });
        } else {
            // Şirket kaydı için tam düzenleme
            const formContent = `
                <div class="space-y-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('labels.form.name')}</label>
                        <input type="text" id="edit-label-name" class="form-input" value="${this.escapeHtml(row.name)}">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">${this.__('labels.form.width')} *</label>
                            <input type="number" id="edit-label-width" class="form-input" value="${row.width}" step="0.1" min="1" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('labels.form.height')} *</label>
                            <input type="number" id="edit-label-height" class="form-input" value="${row.height}" step="0.1" min="1" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('labels.form.unit')}</label>
                        <select id="edit-label-unit" class="form-select">
                            <option value="mm" ${row.unit === 'mm' ? 'selected' : ''}>${this.__('labels.units.mm')}</option>
                            <option value="inch" ${row.unit === 'inch' ? 'selected' : ''}>${this.__('labels.units.inch')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="edit-label-active" ${row.is_active ? 'checked' : ''}>
                            <span>${this.__('labels.form.active')}</span>
                        </label>
                    </div>
                </div>
            `;

            Modal.show({
                title: this.__('labels.editTitle'),
                icon: 'ti-edit',
                content: formContent,
                size: 'md',
                confirmText: this.__('actions.save'),
                cancelText: this.__('actions.cancel'),
                onConfirm: async () => {
                    const name = document.getElementById('edit-label-name')?.value?.trim();
                    const width = parseFloat(document.getElementById('edit-label-width')?.value);
                    const height = parseFloat(document.getElementById('edit-label-height')?.value);
                    const unit = document.getElementById('edit-label-unit')?.value;
                    const isActive = document.getElementById('edit-label-active')?.checked;

                    if (!width || !height || width <= 0 || height <= 0) {
                        Toast.error(this.__('labels.validation.dimensionsRequired'));
                        throw new Error('Validation failed');
                    }

                    try {
                        await this.app.api.put(`/label-sizes/${row.id}`, {
                            name,
                            width,
                            height,
                            unit,
                            is_active: isActive ? 1 : 0
                        });
                        Toast.success(this.__('labels.toast.updated'));
                        await this.loadLabelSizes();
                    } catch (error) {
                        Toast.error(error.message || this.__('labels.toast.saveFailed'));
                        throw error;
                    }
                }
            });
        }
    }

    deleteLabelSize(row) {
        Modal.confirm({
            title: this.__('labels.deleteTitle'),
            message: this.__('labels.deleteConfirm', { name: row.name }),
            type: 'danger',
            confirmText: this.__('actions.delete'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/label-sizes/${row.id}`);
                    Toast.success(this.__('labels.toast.deleted'));
                    await this.loadLabelSizes();
                } catch (error) {
                    Toast.error(error.message || this.__('labels.toast.saveFailed'));
                    throw error;
                }
            }
        });
    }

    async toggleLabelSizeStatus(id, isActive) {
        try {
            await this.app.api.put(`/label-sizes/${id}`, {
                is_active: isActive ? 1 : 0
            });

            // Yerel veriyi güncelle
            const labelSize = this.labelSizes.find(ls => ls.id === id);
            if (labelSize) {
                labelSize.is_active = isActive ? 1 : 0;
            }

            Toast.success(this.__('labels.toast.statusChanged'));
        } catch (error) {
            Toast.error(error.message || this.__('labels.toast.saveFailed'));
            // Toggle'ı geri al
            await this.loadLabelSizes();
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        this.dataTable = null;
        this.app.i18n.clearPageTranslations();
    }
}

export default LabelSettingsPage;
