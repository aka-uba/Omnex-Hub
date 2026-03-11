/**
 * DataTable - Modern Interactive Table Component
 * Responsive tasarım - Mobilde card görünümü
 *
 * @package OmnexDisplayHub
 * @version 2.0.1
 */

import { Logger } from '../core/Logger.js';
import { ExportManager } from '../utils/ExportManager.js';
import { escapeHTML, isValidURL } from '../core/SecurityUtils.js';

/**
 * i18n helper with fallback
 * @param {string} key - Translation key (e.g., 'table.noData')
 * @param {string} fallback - Fallback text if translation not found
 * @param {object} params - Parameters to replace in the string
 * @returns {string}
 */
const __ = (key, fallback, params = {}) => {
    let text = (typeof window.__ === 'function' ? window.__(key) : null) || fallback;
    // Replace parameters like {count}, {start}, {end}, {total}
    if (params && typeof text === 'string') {
        Object.keys(params).forEach(param => {
            text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
        });
    }
    return text;
};

export class DataTable {
    constructor(containerOrOptions, options = {}) {
        // Support both old style: new DataTable('#container', options)
        // and new style: new DataTable({ container: '#container', ...options })
        let container;
        if (typeof containerOrOptions === 'object' && containerOrOptions !== null && !containerOrOptions.nodeType) {
            // New style: options object with container property
            options = containerOrOptions;
            container = options.container;
        } else {
            // Old style: container as first argument
            container = containerOrOptions;
        }

        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        this.options = {
            columns: [],
            data: [],
            pagination: true,
            pageSize: 25,
            pageSizes: [10, 25, 50, 100],
            showPageSizeSelector: true,
            searchable: true,
            searchPlaceholder: __('table.search'),
            sortable: true,
            selectable: false,
            loading: false,
            emptyText: __('table.noData'),
            emptyIcon: 'ti-database-off',
            loadingText: __('table.loading'),
            serverSide: false,
            fetchData: null,
            onRowClick: null,
            onSelectionChange: null,
            rowKey: 'id',
            showRowNumbers: true,
            showActions: true,
            actionsLabel: __('table.actions'),
            actions: [], // [{icon, label, class, onClick, name}]
            actionsDropdown: false, // true = dropdown menu, false = inline buttons
            toolbar: {
                show: true,
                exports: false,
                filters: false,
                columnSettings: true,
                extra: null,
                onFilterClick: null // Filter button callback
            },
            onSortChange: null,
            exportFilename: 'export', // Export filename prefix
            tableId: null,
            responsive: true, // Mobilde card görünümü
            striped: false,
            hover: true,
            bordered: false,
            compact: false,
            ...options
        };

        if (!this.options.tableId) {
            const inferredId = this.container?.id
                ? `datatable_${this.container.id}`
                : (typeof container === 'string' ? `datatable_${container.replace(/[^a-zA-Z0-9_-]/g, '_')}` : null);
            this.options.tableId = inferredId;
        }

        this.state = {
            page: 1,
            pageSize: this.options.pageSize,
            sortBy: this.options.defaultSort?.key || null,
            sortDir: (this.options.defaultSort?.direction || 'asc').toUpperCase(),
            search: '',
            total: 0,
            data: [],
            selectedRows: new Set(),
            loading: false
        };

        this._outsideClickHandler = null;
        this._containerClickHandler = null;
        this._closeOnScrollHandler = null;
        this._windowScrollHandler = null;
        this._documentScrollHandler = null;
        this._externalScrollTargets = [];
        this._defaultColumns = (this.options.columns || []).map(col => ({
            key: col.key,
            hidden: !!col.hidden,
            backgroundColor: col.backgroundColor || ''
        }));
        this.styleSettings = {
            showVerticalBorders: false,
            headerBackgroundColor: ''
        };
        this._settingsDraftColumns = [];
        this._settingsDraftStyle = { ...this.styleSettings };

        this._loadPersistedTableSettings();

        this.init();
    }

    /**
     * Initialize table
     */
    init() {
        if (!this.container) {
            Logger.error('DataTable: Container not found');
            return;
        }
        this.render();
        this.bindEvents();

        if (this.options.data.length > 0) {
            this.setData(this.options.data);
        } else if (this.options.serverSide && this.options.fetchData) {
            this.loadData();
        }
    }

    /**
     * Render table structure
     */
    render() {
        const tableClasses = [
            'data-table',
            this.options.striped ? 'data-table-striped' : '',
            this.options.hover ? 'data-table-hover' : '',
            this.options.bordered ? 'data-table-bordered' : '',
            this.options.compact ? 'data-table-compact' : '',
            this.styleSettings.showVerticalBorders ? 'data-table-vertical-borders' : ''
        ].filter(Boolean).join(' ');

        const wrapperClasses = [
            'data-table-wrapper',
            this.options.responsive ? 'data-table-responsive' : ''
        ].filter(Boolean).join(' ');

        this.container.innerHTML = `
            <div class="${wrapperClasses}">
                <!-- Toolbar -->
                ${this.options.toolbar.show ? `
                <div class="data-table-toolbar">
                    <div class="data-table-toolbar-left">
                        ${this.options.searchable ? `
                            <div class="data-table-search">
                                <i class="ti ti-search"></i>
                                <input
                                    type="text"
                                    class="data-table-search-input"
                                    placeholder="${this.options.searchPlaceholder}"
                                    data-table-search
                                />
                            </div>
                        ` : ''}
                        <div data-table-toolbar-extra></div>
                    </div>
                    <div class="data-table-toolbar-right">
                        ${this.options.selectable ? `
                            <span class="data-table-selection-count" data-table-selection-count></span>
                        ` : ''}
                        ${this.options.toolbar.exports ? `
                            <div class="data-table-exports">
                                <button class="btn btn-icon btn-ghost" title="Excel (.xlsx)" data-export="excel">
                                    <i class="ti ti-file-spreadsheet"></i>
                                </button>
                                <button class="btn btn-icon btn-ghost" title="CSV" data-export="csv">
                                    <i class="ti ti-file-type-csv"></i>
                                </button>
                                <button class="btn btn-icon btn-ghost" title="HTML" data-export="html">
                                    <i class="ti ti-file-code"></i>
                                </button>
                                <button class="btn btn-icon btn-ghost" title="JSON" data-export="json">
                                    <i class="ti ti-braces"></i>
                                </button>
                                <button class="btn btn-icon btn-ghost" title="Markdown" data-export="md">
                                    <i class="ti ti-markdown"></i>
                                </button>
                                <button class="btn btn-icon btn-ghost" title="Text (.txt)" data-export="txt">
                                    <i class="ti ti-file-text"></i>
                                </button>
                                <button class="btn btn-icon btn-ghost" title="${__('table.print', 'Yazdır')}" data-export="print">
                                    <i class="ti ti-printer"></i>
                                </button>
                            </div>
                        ` : ''}
                        ${this.options.toolbar.filters ? `
                            <button class="btn btn-outline btn-icon-text" data-table-filter-toggle>
                                <i class="ti ti-filter"></i>
                                <span>${__('table.filters', 'Filtreler')}</span>
                            </button>
                        ` : ''}
                        ${this.options.toolbar.columnSettings !== false ? `
                            <button class="btn btn-icon btn-ghost" title="${__('table.columnSettings.title', 'Sütun Ayarları')}" data-table-column-settings>
                                <i class="ti ti-layout-columns"></i>
                            </button>
                        ` : ''}
                        <div data-table-toolbar-actions></div>
                    </div>
                </div>
                ` : ''}

                <!-- Table Container -->
                <div class="data-table-container">
                    <table class="${tableClasses}">
                        <thead>
                            <tr data-table-header></tr>
                        </thead>
                        <tbody data-table-body></tbody>
                    </table>
                </div>

                <!-- Mobile Cards Container (hidden on desktop) -->
                <div class="data-table-cards" data-table-cards></div>

                <!-- Footer -->
                <div class="data-table-footer">
                    <div class="data-table-footer-left">
                        ${this.options.showPageSizeSelector ? `
                            <span class="data-table-footer-label">${__('table.perPage', 'Sayfa başına:')}</span>
                            <select class="data-table-page-size" data-table-page-size>
                                ${this.options.pageSizes.map(size => `
                                    <option value="${size}" ${size === this.state.pageSize ? 'selected' : ''}>
                                        ${size}
                                    </option>
                                `).join('')}
                            </select>
                        ` : ''}
                        <span class="data-table-info" data-table-info></span>
                    </div>
                    ${this.options.pagination ? `
                        <div class="data-table-pagination" data-table-pagination></div>
                    ` : ''}
                </div>
            </div>
            ${this.options.toolbar.columnSettings !== false ? `
                <div class="data-table-settings-modal" data-table-settings-modal hidden>
                    <div class="data-table-settings-backdrop" data-table-settings-close></div>
                    <div class="data-table-settings-dialog" role="dialog" aria-modal="true">
                        <div class="data-table-settings-header">
                            <h3>${__('table.columnSettings.title', 'Sütun Ayarları')}</h3>
                            <button class="btn btn-icon btn-ghost" data-table-settings-close title="${__('actions.close', 'Kapat')}">
                                <i class="ti ti-x"></i>
                            </button>
                        </div>
                        <div class="data-table-settings-body">
                            <div class="data-table-settings-section">
                                <h4>${__('table.columnSettings.tableStyle', 'Tablo Stili')}</h4>
                                <label class="data-table-settings-row-inline">
                                    <input type="checkbox" data-settings-vertical-borders />
                                    <span>${__('table.columnSettings.verticalBorders', 'Dikey Kenarlıklar')}</span>
                                </label>
                                <div class="data-table-settings-row-inline">
                                    <span>${__('table.columnSettings.headerBackground', 'Başlık Arkaplanı')}</span>
                                    <div class="data-table-settings-inline-actions">
                                        <input type="color" data-settings-header-bg />
                                        <button class="btn btn-sm btn-outline" data-settings-clear-header-bg>${__('actions.clear', 'Temizle')}</button>
                                    </div>
                                </div>
                            </div>
                            <div class="data-table-settings-section">
                                <h4>${__('table.columnSettings.columns', 'Sütunlar')}</h4>
                                <div class="data-table-settings-columns" data-settings-columns-list></div>
                            </div>
                        </div>
                        <div class="data-table-settings-footer">
                            <button class="btn btn-outline" data-table-settings-reset>${__('actions.reset', 'Sıfırla')}</button>
                            <div class="data-table-settings-footer-right">
                                <button class="btn btn-outline" data-table-settings-cancel>${__('actions.cancel', 'İptal')}</button>
                                <button class="btn btn-primary" data-table-settings-apply>${__('actions.apply', 'Uygula')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;

        this.renderHeader();
        this.applyTableStyleClass();
    }

    /**
     * Render table header
     */
    renderHeader() {
        const header = this.container.querySelector('[data-table-header]');
        if (!header) return;

        let html = '';
        const headerBg = this.styleSettings?.headerBackgroundColor || '';
        const headerTextColor = this.getContrastColor(headerBg);
        const baseHeaderStyle = [
            headerBg ? `background-color: ${headerBg}` : '',
            headerTextColor ? `color: ${headerTextColor}` : ''
        ].filter(Boolean).join('; ');

        // Row number
        if (this.options.showRowNumbers) {
            html += `<th class="data-table-th-number" style="${baseHeaderStyle}">#</th>`;
        }

        // Selection checkbox
        if (this.options.selectable) {
            html += `
                <th class="data-table-th-checkbox" style="${baseHeaderStyle}">
                    <input type="checkbox" class="form-checkbox" data-table-select-all />
                </th>
            `;
        }

        // Columns
        this.options.columns.forEach(col => {
            if (col.hidden) return;

            const sortable = this.options.sortable && col.sortable !== false;
            const isSorted = this.state.sortBy === col.key;
            const isActionsCol = col.key === 'actions';

            html += `
                <th class="data-table-th ${sortable ? 'data-table-th-sortable' : ''} ${isActionsCol ? 'data-table-th-actions' : ''} ${col.headerClass || ''}"
                    ${sortable ? `data-table-sort="${col.key}"` : ''}
                    style="${[
                        col.width ? `width: ${col.width}` : '',
                        baseHeaderStyle
                    ].filter(Boolean).join('; ')}">
                    <div class="data-table-th-content">
                        <span>${col.label}</span>
                        ${sortable ? `
                            <span class="data-table-sort-icon ${isSorted ? 'active' : ''}">
                                <i class="ti ${isSorted
                                    ? (this.state.sortDir === 'ASC' ? 'ti-sort-ascending' : 'ti-sort-descending')
                                    : 'ti-arrows-sort'
                                }"></i>
                            </span>
                        ` : ''}
                    </div>
                </th>
            `;
        });

        // Actions column
        if (this.options.showActions && this.options.actions.length > 0) {
            html += `<th class="data-table-th data-table-th-actions" style="${baseHeaderStyle}">${this.options.actionsLabel}</th>`;
        }

        header.innerHTML = html;
    }

    /**
     * Render table body
     */
    renderBody() {
        const body = this.container.querySelector('[data-table-body]');
        const cards = this.container.querySelector('[data-table-cards]');

        if (!body) return;

        if (this.state.loading) {
            const loadingHtml = `
                <div class="data-table-loading">
                    <div class="data-table-loading-spinner"></div>
                    <span>${this.options.loadingText}</span>
                </div>
            `;
            body.innerHTML = `
                <tr>
                    <td colspan="${this.getColSpan()}">${loadingHtml}</td>
                </tr>
            `;
            if (cards) cards.innerHTML = loadingHtml;
            return;
        }

        if (this.state.data.length === 0) {
            const emptyHtml = `
                <div class="data-table-empty">
                    <i class="ti ${this.options.emptyIcon}"></i>
                    <p>${this.options.emptyText}</p>
                </div>
            `;
            body.innerHTML = `
                <tr>
                    <td colspan="${this.getColSpan()}">${emptyHtml}</td>
                </tr>
            `;
            if (cards) cards.innerHTML = emptyHtml;
            return;
        }

        // Table rows
        body.innerHTML = this.state.data.map((row, index) => this.renderRow(row, index)).join('');

        // Mobile cards
        if (cards) cards.innerHTML = this.state.data.map((row, index) => this.renderCard(row, index)).join('');
    }

    /**
     * Render single table row
     */
    renderRow(row, index) {
        const rowKey = row[this.options.rowKey];
        const isSelected = this.state.selectedRows.has(rowKey);
        const rowNumber = (this.state.page - 1) * this.state.pageSize + index + 1;

        let html = `<tr data-row-key="${escapeHTML(rowKey)}" class="${isSelected ? 'selected' : ''} ${this.options.onRowClick ? 'clickable' : ''}">`;

        // Row number
        if (this.options.showRowNumbers) {
            html += `<td class="data-table-td-number">${rowNumber}</td>`;
        }

        // Selection checkbox
        if (this.options.selectable) {
            html += `
                <td class="data-table-td-checkbox">
                    <input type="checkbox"
                           class="form-checkbox"
                           data-table-select-row="${rowKey}"
                           ${isSelected ? 'checked' : ''} />
                </td>
            `;
        }

        // Columns
        this.options.columns.forEach(col => {
            if (col.hidden) return;

            const value = this.getNestedValue(row, col.key);
            let cellContent = value;
            const isActionsCol = col.key === 'actions';

            // Custom render function
            if (col.render) {
                cellContent = col.render(value, row, index);
            } else if (col.type) {
                cellContent = this.formatValue(value, col.type, col);
            }

            // Wrap custom actions column content with data-table-action-buttons for consistent styling
            if (isActionsCol && col.render) {
                // Check if content already has data-table-action-buttons wrapper
                const content = cellContent ?? '';
                if (!content.includes('data-table-action-buttons')) {
                    cellContent = `<div class="data-table-action-buttons">${content}</div>`;
                }
            }

            const cellBg = col.backgroundColor || '';
            const cellTextColor = this.getContrastColor(cellBg);
            const cellStyle = [
                cellBg ? `background-color: ${cellBg}` : '',
                cellTextColor ? `color: ${cellTextColor}` : ''
            ].filter(Boolean).join('; ');
            html += `<td class="data-table-td ${isActionsCol ? 'data-table-td-actions' : ''} ${col.cellClass || ''}" data-label="${col.label}" style="${cellStyle}">${cellContent ?? ''}</td>`;
        });

        // Actions column
        if (this.options.showActions && this.options.actions.length > 0) {
            html += `<td class="data-table-td-actions">${this.renderActions(row)}</td>`;
        }

        html += '</tr>';
        return html;
    }

    /**
     * Render mobile card view
     */
    renderCard(row, index) {
        const rowKey = row[this.options.rowKey];
        const isSelected = this.state.selectedRows.has(rowKey);
        const rowNumber = (this.state.page - 1) * this.state.pageSize + index + 1;

        // Find preview column (first column with image or icon, or first column)
        const previewCol = this.options.columns.find(c => c.type === 'image' || c.type === 'icon' || c.preview);
        const titleCol = this.options.columns.find(c => c.title) || this.options.columns[0];

        let previewHtml = '';
        if (previewCol) {
            const value = this.getNestedValue(row, previewCol.key);
            if (previewCol.render) {
                previewHtml = previewCol.render(value, row, index);
            } else if (previewCol.type === 'image') {
                previewHtml = value
                    ? `<img src="${escapeHTML(value)}" class="data-card-preview-img" alt="" />`
                    : `<div class="data-card-preview-placeholder"><i class="ti ti-photo"></i></div>`;
            } else {
                previewHtml = `<div class="data-card-preview-placeholder"><i class="ti ${previewCol.icon || 'ti-file'}"></i></div>`;
            }
        }

        let html = `
            <div class="data-card ${isSelected ? 'selected' : ''}" data-row-key="${rowKey}">
                <div class="data-card-header">
                    <div class="data-card-header-left">
                        ${this.options.selectable ? `
                            <input type="checkbox"
                                   class="form-checkbox"
                                   data-table-select-row="${rowKey}"
                                   ${isSelected ? 'checked' : ''} />
                        ` : ''}
                        ${this.options.showRowNumbers ? `<span class="data-card-number">${rowNumber}</span>` : ''}
                        ${previewHtml ? `<div class="data-card-preview">${previewHtml}</div>` : ''}
                        <div class="data-card-title">
                            ${titleCol ? escapeHTML(this.getNestedValue(row, titleCol.key) || '') : ''}
                        </div>
                    </div>
                    ${this.options.showActions && this.options.actions.length > 0 ? `
                        <div class="data-card-actions">${this.renderActions(row)}</div>
                    ` : ''}
                </div>
                <div class="data-card-body">
        `;

        // Card fields (skip preview and title columns)
        this.options.columns.forEach(col => {
            if (col.hidden || col === previewCol || col === titleCol) return;

            const value = this.getNestedValue(row, col.key);
            let cellContent = value;

            if (col.render) {
                cellContent = col.render(value, row, index);
            } else if (col.type) {
                cellContent = this.formatValue(value, col.type, col);
            }

            html += `
                <div class="data-card-field">
                    <span class="data-card-field-label">${col.label}</span>
                    <span class="data-card-field-value">${cellContent ?? '-'}</span>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Render action buttons or dropdown menu
     */
    renderActions(row) {
        const rowKey = row[this.options.rowKey];

        // Filter visible actions
        const visibleActions = this.options.actions.filter(action => {
            if (action.visible && !action.visible(row)) return false;
            return true;
        });

        if (visibleActions.length === 0) return '';

        // Dropdown mode
        if (this.options.actionsDropdown) {
            return this.renderActionsDropdown(row, visibleActions, rowKey);
        }

        // Inline buttons mode (default)
        return `
            <div class="data-table-action-buttons">
                ${visibleActions.map(action => {
                    const btnClass = action.class || 'btn-ghost';
                    const iconClass = action.iconClass || '';
                    const title = action.label || '';

                    return `
                        <button class="btn btn-icon btn-sm ${btnClass}"
                                data-action="${action.name}"
                                data-row-key="${rowKey}"
                                title="${title}">
                            <i class="ti ${action.icon} ${iconClass}"></i>
                        </button>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Render actions as dropdown menu
     */
    renderActionsDropdown(row, visibleActions, rowKey) {
        // Separate primary action (first) and secondary actions (rest)
        const [primaryAction, ...secondaryActions] = visibleActions;

        // If only one action, show as button
        if (visibleActions.length === 1) {
            const btnClass = primaryAction.class || 'btn-ghost';
            const iconClass = primaryAction.iconClass || '';
            return `
                <div class="data-table-action-buttons">
                    <button class="btn btn-icon btn-sm ${btnClass}"
                            data-action="${primaryAction.name}"
                            data-row-key="${rowKey}"
                            title="${primaryAction.label || ''}">
                        <i class="ti ${primaryAction.icon} ${iconClass}"></i>
                    </button>
                </div>
            `;
        }

        return `
            <div class="data-table-action-dropdown">
                <button class="btn btn-icon btn-sm btn-ghost data-table-action-dropdown-toggle"
                        data-dropdown-toggle="${rowKey}"
                        title="${__('table.actions')}">
                    <i class="ti ti-dots-vertical"></i>
                </button>
                <div class="data-table-action-dropdown-menu" data-dropdown-menu="${rowKey}">
                    ${visibleActions.map(action => {
                        const iconClass = action.iconClass || '';
                        const itemClass = action.class?.includes('text-danger') || action.class?.includes('text-red') ? 'danger' : '';

                        return `
                            <button class="data-table-action-dropdown-item ${itemClass}"
                                    data-action="${action.name}"
                                    data-row-key="${rowKey}">
                                <i class="ti ${action.icon} ${iconClass}"></i>
                                <span>${action.label || ''}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Format value based on type
     */
    formatValue(value, type, col = {}) {
        if (value === null || value === undefined) return '-';

        switch (type) {
            case 'currency':
                return new Intl.NumberFormat('tr-TR', {
                    style: 'currency',
                    currency: col.currency || 'TRY'
                }).format(value);

            case 'number':
                return new Intl.NumberFormat('tr-TR').format(value);

            case 'date':
                if (!value) return '-';
                return new Date(value).toLocaleDateString('tr-TR');

            case 'datetime':
                if (!value) return '-';
                return new Date(value).toLocaleString('tr-TR');

            case 'boolean':
                return value
                    ? '<span class="data-table-boolean true"><i class="ti ti-check"></i></span>'
                    : '<span class="data-table-boolean false"><i class="ti ti-x"></i></span>';

            case 'status':
                const statusConfig = col.statusConfig || {
                    active: { label: __('status.active', 'Aktif'), class: 'badge-success' },
                    inactive: { label: __('status.inactive', 'Pasif'), class: 'badge-secondary' },
                    pending: { label: __('status.pending', 'Beklemede'), class: 'badge-warning' },
                    suspended: { label: __('status.suspended', 'Askıda'), class: 'badge-danger' }
                };
                const status = statusConfig[value] || { label: value, class: 'badge-secondary' };
                return `<span class="badge ${status.class}">${status.label}</span>`;

            case 'badge':
                const badgeClass = col.badgeClass || 'badge-primary';
                return `<span class="badge ${typeof badgeClass === 'function' ? badgeClass(value) : badgeClass}">${escapeHTML(value)}</span>`;

            case 'image':
                return value
                    ? `<img src="${escapeHTML(value)}" class="data-table-image" alt="" />`
                    : `<div class="data-table-image-placeholder"><i class="ti ti-photo"></i></div>`;

            case 'avatar':
                if (value) {
                    return `<img src="${escapeHTML(value)}" class="data-table-avatar" alt="" />`;
                }
                const initials = col.initialsFrom
                    ? this.getInitials(this.getNestedValue(col._row, col.initialsFrom))
                    : '?';
                return `<div class="data-table-avatar-placeholder">${escapeHTML(initials)}</div>`;

            case 'icon':
                return `<div class="data-table-icon-cell"><i class="ti ${escapeHTML(value || col.defaultIcon || 'ti-file')}"></i></div>`;

            case 'link':
                if (!value) return '-';
                const safeUrl = isValidURL(value) ? escapeHTML(value) : '#';
                return `<a href="${safeUrl}" class="data-table-link" target="${col.target || '_self'}">${escapeHTML(col.linkText || value)}</a>`;

            case 'email':
                return value
                    ? `<a href="mailto:${escapeHTML(value)}" class="data-table-link">${escapeHTML(value)}</a>`
                    : '-';

            case 'phone':
                return value
                    ? `<a href="tel:${escapeHTML(value)}" class="data-table-link">${escapeHTML(value)}</a>`
                    : '-';

            case 'progress':
                const percent = Math.min(100, Math.max(0, parseFloat(value) || 0));
                const progressClass = percent >= 75 ? 'success' : percent >= 50 ? 'warning' : 'danger';
                return `
                    <div class="data-table-progress">
                        <div class="data-table-progress-bar ${progressClass}" style="width: ${percent}%"></div>
                        <span class="data-table-progress-text">${percent}%</span>
                    </div>
                `;

            case 'tags':
                if (!Array.isArray(value)) return '-';
                return value.map(tag => `<span class="badge badge-outline">${escapeHTML(tag)}</span>`).join(' ');

            default:
                return value;
        }
    }

    /**
     * Render pagination
     */
    renderPagination() {
        if (!this.options.pagination) return;

        const pagination = this.container.querySelector('[data-table-pagination]');
        if (!pagination) return;

        const totalPages = Math.ceil(this.state.total / this.state.pageSize);

        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let html = '';
        const page = this.state.page;

        // Previous button
        html += `
            <button class="data-table-page-btn" data-table-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>
                <i class="ti ti-chevron-left"></i>
            </button>
        `;

        // Page numbers
        const range = this.getPaginationRange(page, totalPages);
        range.forEach(p => {
            if (p === '...') {
                html += '<span class="data-table-page-dots">...</span>';
            } else {
                html += `
                    <button class="data-table-page-btn ${p === page ? 'active' : ''}"
                            data-table-page="${p}">
                        ${p}
                    </button>
                `;
            }
        });

        // Next button
        html += `
            <button class="data-table-page-btn" data-table-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>
                <i class="ti ti-chevron-right"></i>
            </button>
        `;

        pagination.innerHTML = html;
    }

    /**
     * Get pagination range
     */
    getPaginationRange(current, total) {
        const delta = 1;
        const range = [];
        const rangeWithDots = [];

        for (let i = 1; i <= total; i++) {
            if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
                range.push(i);
            }
        }

        let prev = 0;
        for (const i of range) {
            if (prev && i - prev !== 1) {
                rangeWithDots.push('...');
            }
            rangeWithDots.push(i);
            prev = i;
        }

        return rangeWithDots;
    }

    /**
     * Update info text
     */
    updateInfo() {
        const info = this.container.querySelector('[data-table-info]');
        if (!info) return;

        const start = this.state.total > 0 ? (this.state.page - 1) * this.state.pageSize + 1 : 0;
        const end = Math.min(this.state.page * this.state.pageSize, this.state.total);

        info.textContent = this.state.total > 0
            ? __('table.showingRecords', '{start} - {end} / {total}', { start, end, total: this.state.total })
            : __('table.noRecords', '');
    }

    /**
     * Update selection count
     */
    updateSelectionCount() {
        const countEl = this.container.querySelector('[data-table-selection-count]');
        if (!countEl) return;

        const selected = this.state.selectedRows.size;
        countEl.textContent = selected > 0 ? __('table.selected', '{count} seçili', { count: selected }) : '';
        countEl.style.display = selected > 0 ? 'inline' : 'none';
    }

    /**
     * Bind events
     */
    bindEvents() {
        if (!this.container) return;

        this._unbindGlobalListeners();

        // Search
        const searchInput = this.container.querySelector('[data-table-search]');
        if (searchInput) {
            let debounce;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    this.state.search = e.target.value;
                    this.state.page = 1;
                    this.loadData();
                }, 300);
            });
        }

        // Page size
        const pageSizeSelect = this.container.querySelector('[data-table-page-size]');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.state.pageSize = parseInt(e.target.value);
                this.state.page = 1;
                this.loadData();
            });
        }

        // Click events (sort, pagination, actions, row click, dropdown)
        this._containerClickHandler = (e) => {
            const settingsOpenBtn = e.target.closest('[data-table-column-settings]');
            if (settingsOpenBtn) {
                e.preventDefault();
                this.openColumnSettingsModal();
                return;
            }

            const settingsCloseBtn = e.target.closest('[data-table-settings-close], [data-table-settings-cancel]');
            if (settingsCloseBtn) {
                e.preventDefault();
                this.closeColumnSettingsModal();
                return;
            }

            const settingsApplyBtn = e.target.closest('[data-table-settings-apply]');
            if (settingsApplyBtn) {
                e.preventDefault();
                this.applyColumnSettings();
                return;
            }

            const settingsResetBtn = e.target.closest('[data-table-settings-reset]');
            if (settingsResetBtn) {
                e.preventDefault();
                this.resetColumnSettings();
                return;
            }

            const clearHeaderColorBtn = e.target.closest('[data-settings-clear-header-bg]');
            if (clearHeaderColorBtn) {
                e.preventDefault();
                this._settingsDraftStyle.headerBackgroundColor = '';
                this.renderColumnSettingsDraft();
                return;
            }

            const clearColumnColorBtn = e.target.closest('[data-settings-clear-color]');
            if (clearColumnColorBtn) {
                e.preventDefault();
                const idx = Number.parseInt(clearColumnColorBtn.dataset.settingsClearColor, 10);
                if (Number.isFinite(idx) && this._settingsDraftColumns[idx]) {
                    this._settingsDraftColumns[idx].backgroundColor = '';
                    this.renderColumnSettingsDraft();
                }
                return;
            }

            const moveUpBtn = e.target.closest('[data-settings-up]');
            if (moveUpBtn) {
                e.preventDefault();
                const idx = Number.parseInt(moveUpBtn.dataset.settingsUp, 10);
                if (Number.isFinite(idx) && idx > 0 && this._settingsDraftColumns[idx]) {
                    const current = this._settingsDraftColumns[idx];
                    this._settingsDraftColumns[idx] = this._settingsDraftColumns[idx - 1];
                    this._settingsDraftColumns[idx - 1] = current;
                    this.renderColumnSettingsDraft();
                }
                return;
            }

            const moveDownBtn = e.target.closest('[data-settings-down]');
            if (moveDownBtn) {
                e.preventDefault();
                const idx = Number.parseInt(moveDownBtn.dataset.settingsDown, 10);
                if (Number.isFinite(idx) && idx >= 0 && idx < this._settingsDraftColumns.length - 1) {
                    const current = this._settingsDraftColumns[idx];
                    this._settingsDraftColumns[idx] = this._settingsDraftColumns[idx + 1];
                    this._settingsDraftColumns[idx + 1] = current;
                    this.renderColumnSettingsDraft();
                }
                return;
            }

            // Sort
            const sortBtn = e.target.closest('[data-table-sort]');
            if (sortBtn) {
                const key = sortBtn.dataset.tableSort;
                const prevSortBy = this.state.sortBy;
                const prevSortDir = this.state.sortDir;
                if (this.state.sortBy === key) {
                    this.state.sortDir = this.state.sortDir === 'ASC' ? 'DESC' : 'ASC';
                } else {
                    this.state.sortBy = key;
                    this.state.sortDir = 'ASC';
                }
                // Always return to first page when sort changes to avoid stale page confusion.
                this.state.page = 1;
                if (typeof this.options.onSortChange === 'function') {
                    try {
                        this.options.onSortChange({
                            sortBy: this.state.sortBy,
                            sortDir: this.state.sortDir,
                            prevSortBy,
                            prevSortDir
                        });
                    } catch (err) {
                        Logger.error('DataTable onSortChange error:', err);
                    }
                }
                this.renderHeader();
                this.loadData();
                return;
            }

            // Pagination
            const pageBtn = e.target.closest('[data-table-page]');
            if (pageBtn && !pageBtn.disabled) {
                const page = parseInt(pageBtn.dataset.tablePage);
                if (page >= 1 && page <= Math.ceil(this.state.total / this.state.pageSize)) {
                    this.state.page = page;
                    this.loadData();
                }
                return;
            }

            // Dropdown toggle
            const dropdownToggle = e.target.closest('[data-dropdown-toggle]');
            if (dropdownToggle) {
                e.preventDefault();
                e.stopPropagation();
                const rowKey = dropdownToggle.dataset.dropdownToggle;
                this.toggleActionsDropdown(rowKey);
                return;
            }

            // Close dropdowns when clicking outside
            if (!e.target.closest('.data-table-action-dropdown')) {
                this.closeAllDropdowns();
            }

            // Actions (both inline and dropdown)
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();
                const actionName = actionBtn.dataset.action;
                const rowKey = actionBtn.dataset.rowKey;
                const rowData = this.state.data.find(d => String(d[this.options.rowKey]) === rowKey);
                const action = this.options.actions.find(a => a.name === actionName);

                // Close dropdown after action
                this.closeAllDropdowns();

                if (action && action.onClick && rowData) {
                    action.onClick(rowData, rowKey);
                }
                return;
            }

            // Row click
            if (this.options.onRowClick) {
                const row = e.target.closest('tr[data-row-key], .data-card[data-row-key]');
                if (row && !e.target.closest('input, button, a, .data-table-action-buttons, .data-card-actions, .data-table-action-dropdown')) {
                    const rowKey = row.dataset.rowKey;
                    const rowData = this.state.data.find(d => String(d[this.options.rowKey]) === rowKey);
                    if (rowData) {
                        this.options.onRowClick(rowData);
                    }
                }
            }
        };
        this.container.addEventListener('click', this._containerClickHandler);

        // Close dropdown on outside click
        this._outsideClickHandler = (e) => {
            if (!e.target.closest('.data-table-action-dropdown')) {
                this.closeAllDropdowns();
            }
        };
        document.addEventListener('click', this._outsideClickHandler);

        // Close dropdown on scroll (since it uses fixed positioning)
        // Listen to multiple scroll containers
        const closeOnScroll = () => {
            this.closeAllDropdowns();
        };
        this._closeOnScrollHandler = closeOnScroll;
        this._externalScrollTargets = [];

        // Table scroll container
        const scrollContainer = this.container.querySelector('.data-table-container');
        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', closeOnScroll, { passive: true });
            this._externalScrollTargets.push(scrollContainer);
        }

        // Data table wrapper
        const wrapperContainer = this.container.querySelector('.data-table-wrapper');
        if (wrapperContainer) {
            wrapperContainer.addEventListener('scroll', closeOnScroll, { passive: true });
            this._externalScrollTargets.push(wrapperContainer);
        }

        // Main content area (page scroll)
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.addEventListener('scroll', closeOnScroll, { passive: true });
            this._externalScrollTargets.push(mainContent);
        }

        // Page container
        const pageContainer = document.querySelector('.page-container');
        if (pageContainer) {
            pageContainer.addEventListener('scroll', closeOnScroll, { passive: true });
            this._externalScrollTargets.push(pageContainer);
        }

        // Window scroll
        this._windowScrollHandler = closeOnScroll;
        window.addEventListener('scroll', this._windowScrollHandler, { passive: true });

        // Also listen to document scroll (covers most cases)
        this._documentScrollHandler = closeOnScroll;
        document.addEventListener('scroll', this._documentScrollHandler, { passive: true, capture: true });

        // Column settings form controls
        this.container.addEventListener('change', (e) => {
            if (e.target.matches('[data-settings-vertical-borders]')) {
                this._settingsDraftStyle.showVerticalBorders = !!e.target.checked;
                return;
            }
            if (e.target.matches('[data-settings-header-bg]')) {
                this._settingsDraftStyle.headerBackgroundColor = e.target.value || '';
                return;
            }
            if (e.target.matches('[data-settings-visible]')) {
                const idx = Number.parseInt(e.target.dataset.settingsVisible, 10);
                if (Number.isFinite(idx) && this._settingsDraftColumns[idx]) {
                    this._settingsDraftColumns[idx].hidden = !e.target.checked;
                }
                return;
            }
            if (e.target.matches('[data-settings-color]')) {
                const idx = Number.parseInt(e.target.dataset.settingsColor, 10);
                if (Number.isFinite(idx) && this._settingsDraftColumns[idx]) {
                    this._settingsDraftColumns[idx].backgroundColor = e.target.value || '';
                }
            }
        });

        // Selection
        if (this.options.selectable) {
            this.container.addEventListener('change', (e) => {
                if (e.target.matches('[data-table-select-all]')) {
                    this.toggleSelectAll(e.target.checked);
                } else if (e.target.matches('[data-table-select-row]')) {
                    const rowKey = e.target.dataset.tableSelectRow;
                    this.toggleSelectRow(rowKey, e.target.checked);
                }
            });
        }

        // Export buttons
        this.container.addEventListener('click', (e) => {
            const exportBtn = e.target.closest('[data-export]');
            if (exportBtn) {
                const format = exportBtn.dataset.export;
                this.export(format);
            }

            // Filter toggle button
            const filterBtn = e.target.closest('[data-table-filter-toggle]');
            if (filterBtn) {
                if (this.options.toolbar.onFilterClick) {
                    this.options.toolbar.onFilterClick();
                }
            }
        });
    }

    _unbindGlobalListeners() {
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
            this._outsideClickHandler = null;
        }
        if (this._windowScrollHandler) {
            window.removeEventListener('scroll', this._windowScrollHandler);
            this._windowScrollHandler = null;
        }
        if (this._documentScrollHandler) {
            document.removeEventListener('scroll', this._documentScrollHandler, true);
            this._documentScrollHandler = null;
        }
        if (this._closeOnScrollHandler && this._externalScrollTargets.length) {
            this._externalScrollTargets.forEach((target) => {
                try {
                    target.removeEventListener('scroll', this._closeOnScrollHandler);
                } catch (e) {}
            });
        }
        this._closeOnScrollHandler = null;
        this._externalScrollTargets = [];
    }

    /**
     * Load data (server-side or client-side)
     */
    async loadData() {
        if (this.options.serverSide && this.options.fetchData) {
            this.state.loading = true;
            this.renderBody();

            try {
                const result = await this.options.fetchData({
                    page: this.state.page,
                    limit: this.state.pageSize,
                    search: this.state.search,
                    sort_by: this.state.sortBy,
                    sort_dir: this.state.sortDir
                });

                this.state.data = result.data || [];
                this.state.total = result.total || result.meta?.total || result.data?.length || 0;

            } catch (error) {
                Logger.error('DataTable fetch error:', error);
                this.state.data = [];
                this.state.total = 0;
            }

            this.state.loading = false;
        } else {
            // Client-side filtering/sorting
            let data = [...this.options.data];

            // Search
            if (this.state.search) {
                const search = this.state.search.toLowerCase();
                data = data.filter(row =>
                    this.options.columns.some(col =>
                        String(this.getNestedValue(row, col.key) || '')
                            .toLowerCase()
                            .includes(search)
                    )
                );
            }

            // Sort
            if (this.state.sortBy) {
                data.sort((a, b) => {
                    const aVal = this.getNestedValue(a, this.state.sortBy);
                    const bVal = this.getNestedValue(b, this.state.sortBy);
                    const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                    return this.state.sortDir === 'ASC' ? cmp : -cmp;
                });
            }

            this.state.total = data.length;

            // Paginate
            const start = (this.state.page - 1) * this.state.pageSize;
            this.state.data = data.slice(start, start + this.state.pageSize);
        }

        this.renderBody();
        this.renderPagination();
        this.updateInfo();
    }

    /**
     * Set data (for client-side mode)
     * @param {Array} data - Data array
     * @param {Object} options - Options
     * @param {boolean} options.preservePage - If true, keeps current page instead of resetting to 1
     */
    setData(data, options = {}) {
        this.options.data = data;

        // Reset page to 1 unless preservePage is true
        if (!options.preservePage) {
            this.state.page = 1;
        } else {
            // If preserving page, make sure current page is still valid
            const totalPages = Math.ceil(data.length / this.state.pageSize);
            if (this.state.page > totalPages && totalPages > 0) {
                this.state.page = totalPages;
            }
        }

        this.state.loading = false; // Reset loading state
        this.loadData();
    }

    /**
     * Refresh data
     */
    refresh() {
        // Clear selection on refresh
        this.state.selectedRows.clear();
        const selectAll = this.container.querySelector('[data-table-select-all]');
        if (selectAll) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
        }
        this.updateSelectionCount();

        this.loadData();
    }

    /**
     * Toggle select all
     */
    toggleSelectAll(checked) {
        if (checked) {
            this.state.data.forEach(row => {
                this.state.selectedRows.add(row[this.options.rowKey]);
            });
        } else {
            this.state.selectedRows.clear();
        }

        this.renderBody();
        this.updateSelectionCount();

        if (this.options.onSelectionChange) {
            this.options.onSelectionChange(this.getSelectedRows());
        }
    }

    /**
     * Toggle select row
     */
    toggleSelectRow(rowKey, checked) {
        if (checked) {
            this.state.selectedRows.add(rowKey);
        } else {
            this.state.selectedRows.delete(rowKey);
        }

        this.updateSelectionCount();

        // Update select all checkbox
        const selectAll = this.container.querySelector('[data-table-select-all]');
        if (selectAll) {
            selectAll.checked = this.state.selectedRows.size === this.state.data.length;
            selectAll.indeterminate = this.state.selectedRows.size > 0 &&
                                       this.state.selectedRows.size < this.state.data.length;
        }

        if (this.options.onSelectionChange) {
            this.options.onSelectionChange(this.getSelectedRows());
        }
    }

    /**
     * Get selected rows
     */
    getSelectedRows() {
        return this.state.data.filter(row =>
            this.state.selectedRows.has(row[this.options.rowKey])
        );
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.state.selectedRows.clear();
        this.renderBody();
        this.updateSelectionCount();

        // Reset header checkbox
        const selectAll = this.container.querySelector('[data-table-select-all]');
        if (selectAll) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
        }
    }

    /**
     * Get nested value from object
     */
    getNestedValue(obj, path) {
        if (!path) return obj;
        return path.split('.').reduce((o, k) => o?.[k], obj);
    }

    /**
     * Get initials from name
     */
    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    applyTableStyleClass() {
        const table = this.container?.querySelector('.data-table');
        if (!table) return;
        table.classList.toggle('data-table-vertical-borders', !!this.styleSettings.showVerticalBorders);
    }

    /**
     * Get readable text color for a background
     */
    getContrastColor(hexColor) {
        if (!hexColor || typeof hexColor !== 'string') return '';
        const hex = hexColor.replace('#', '').trim();
        if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(hex)) return '';

        const fullHex = hex.length === 3
            ? hex.split('').map(ch => ch + ch).join('')
            : hex;

        const r = parseInt(fullHex.slice(0, 2), 16);
        const g = parseInt(fullHex.slice(2, 4), 16);
        const b = parseInt(fullHex.slice(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.55 ? '#111827' : '#ffffff';
    }

    _getColumnsStorageKey() {
        return this.options.tableId ? `datatable-columns-${this.options.tableId}` : null;
    }

    _getStyleStorageKey() {
        return this.options.tableId ? `datatable-style-${this.options.tableId}` : null;
    }

    _loadPersistedTableSettings() {
        const columnsKey = this._getColumnsStorageKey();
        const styleKey = this._getStyleStorageKey();

        if (columnsKey) {
            try {
                const raw = localStorage.getItem(columnsKey);
                if (raw) {
                    const saved = JSON.parse(raw);
                    if (Array.isArray(saved) && saved.length > 0) {
                        const merged = this.options.columns.map((col) => {
                            const found = saved.find(s => s.key === col.key) || {};
                            return {
                                ...col,
                                hidden: typeof found.hidden === 'boolean' ? found.hidden : !!col.hidden,
                                backgroundColor: typeof found.backgroundColor === 'string'
                                    ? found.backgroundColor
                                    : (col.backgroundColor || '')
                            };
                        });
                        merged.sort((a, b) => {
                            const ao = saved.find(s => s.key === a.key)?.order ?? 9999;
                            const bo = saved.find(s => s.key === b.key)?.order ?? 9999;
                            return ao - bo;
                        });
                        this.options.columns = merged;
                    }
                }
            } catch (error) {
                Logger.warn('DataTable column settings load failed:', error);
            }
        }

        if (styleKey) {
            try {
                const raw = localStorage.getItem(styleKey);
                if (raw) {
                    const saved = JSON.parse(raw);
                    this.styleSettings = {
                        showVerticalBorders: !!saved?.showVerticalBorders,
                        headerBackgroundColor: saved?.headerBackgroundColor || ''
                    };
                }
            } catch (error) {
                Logger.warn('DataTable style settings load failed:', error);
            }
        }
    }

    _savePersistedTableSettings() {
        const columnsKey = this._getColumnsStorageKey();
        const styleKey = this._getStyleStorageKey();

        if (columnsKey) {
            try {
                const payload = this.options.columns.map((col, index) => ({
                    key: col.key,
                    hidden: !!col.hidden,
                    backgroundColor: col.backgroundColor || '',
                    order: index
                }));
                localStorage.setItem(columnsKey, JSON.stringify(payload));
            } catch (error) {
                Logger.warn('DataTable column settings save failed:', error);
            }
        }

        if (styleKey) {
            try {
                localStorage.setItem(styleKey, JSON.stringify(this.styleSettings));
            } catch (error) {
                Logger.warn('DataTable style settings save failed:', error);
            }
        }
    }

    _clearPersistedTableSettings() {
        const columnsKey = this._getColumnsStorageKey();
        const styleKey = this._getStyleStorageKey();
        try {
            if (columnsKey) localStorage.removeItem(columnsKey);
            if (styleKey) localStorage.removeItem(styleKey);
        } catch (error) {
            Logger.warn('DataTable settings clear failed:', error);
        }
    }

    openColumnSettingsModal() {
        const modal = this.container?.querySelector('[data-table-settings-modal]');
        if (!modal) return;

        this._settingsDraftColumns = this.options.columns.map(col => ({ ...col }));
        this._settingsDraftStyle = { ...this.styleSettings };
        this.renderColumnSettingsDraft();
        modal.hidden = false;
    }

    closeColumnSettingsModal() {
        const modal = this.container?.querySelector('[data-table-settings-modal]');
        if (!modal) return;
        modal.hidden = true;
    }

    renderColumnSettingsDraft() {
        const modal = this.container?.querySelector('[data-table-settings-modal]');
        if (!modal) return;

        const vertical = modal.querySelector('[data-settings-vertical-borders]');
        if (vertical) vertical.checked = !!this._settingsDraftStyle.showVerticalBorders;

        const headerBgInput = modal.querySelector('[data-settings-header-bg]');
        if (headerBgInput) {
            headerBgInput.value = this._settingsDraftStyle.headerBackgroundColor || '#228be6';
        }

        const columnsList = modal.querySelector('[data-settings-columns-list]');
        if (!columnsList) return;

        columnsList.innerHTML = this._settingsDraftColumns.map((col, index) => `
            <div class="data-table-settings-column-row" data-settings-index="${index}">
                <div class="data-table-settings-column-main">
                    <div class="data-table-settings-column-label">${col.label}</div>
                    <div class="data-table-settings-column-key">${col.key}</div>
                </div>
                <label class="data-table-settings-visible-toggle">
                    <input type="checkbox" data-settings-visible="${index}" ${col.hidden ? '' : 'checked'} />
                    <span>${__('table.columnSettings.visible', 'Görünür')}</span>
                </label>
                <div class="data-table-settings-inline-actions">
                    <input type="color" data-settings-color="${index}" value="${col.backgroundColor || '#ffffff'}" />
                    <button class="btn btn-sm btn-outline" data-settings-clear-color="${index}" title="${__('actions.clear', 'Temizle')}">
                        <i class="ti ti-x"></i>
                    </button>
                </div>
                <div class="data-table-settings-inline-actions">
                    <button class="btn btn-sm btn-ghost" data-settings-up="${index}" title="${__('table.columnSettings.moveUp', 'Yukarı')}">
                        <i class="ti ti-chevron-up"></i>
                    </button>
                    <button class="btn btn-sm btn-ghost" data-settings-down="${index}" title="${__('table.columnSettings.moveDown', 'Aşağı')}">
                        <i class="ti ti-chevron-down"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    applyColumnSettings() {
        this.options.columns = this._settingsDraftColumns.map(col => ({ ...col }));
        this.styleSettings = { ...this._settingsDraftStyle };
        this._savePersistedTableSettings();
        this.applyTableStyleClass();
        this.renderHeader();
        this.renderBody();
        this.closeColumnSettingsModal();
    }

    resetColumnSettings() {
        const defaultsByKey = new Map(this._defaultColumns.map(col => [col.key, col]));
        const restored = this.options.columns.map(col => {
            const def = defaultsByKey.get(col.key);
            return {
                ...col,
                hidden: def ? !!def.hidden : !!col.hidden,
                backgroundColor: def?.backgroundColor || ''
            };
        });

        restored.sort((a, b) => {
            const ai = this._defaultColumns.findIndex(c => c.key === a.key);
            const bi = this._defaultColumns.findIndex(c => c.key === b.key);
            return ai - bi;
        });

        this.options.columns = restored;
        this.styleSettings = { showVerticalBorders: false, headerBackgroundColor: '' };
        this._clearPersistedTableSettings();
        this.applyTableStyleClass();
        this.renderHeader();
        this.renderBody();
        this.closeColumnSettingsModal();
    }

    /**
     * Get column span
     */
    getColSpan() {
        let span = this.options.columns.filter(c => !c.hidden).length;
        if (this.options.showRowNumbers) span++;
        if (this.options.selectable) span++;
        if (this.options.showActions && this.options.actions.length > 0) span++;
        return span;
    }

    /**
     * Set loading state
     */
    setLoading(loading) {
        this.state.loading = loading;
        this.renderBody();
    }

    /**
     * Export data using ExportManager
     * @param {string} format - Export format: excel, csv, html, json, md, txt, print
     */
    async export(format) {
        try {
            // Get all data for export (not just current page)
            let exportData = [];

            if (this.options.serverSide) {
                // Server-side mode: fetch all rows using current search/sort/filter context.
                exportData = await this.getAllDataForExport();
            } else {
                // Client-side: export all filtered data
                let data = [...this.options.data];

                // Apply search filter
                if (this.state.search) {
                    const search = this.state.search.toLowerCase();
                    data = data.filter(row =>
                        this.options.columns.some(col =>
                            String(this.getNestedValue(row, col.key) || '')
                                .toLowerCase()
                                .includes(search)
                        )
                    );
                }

                // Apply sort
                if (this.state.sortBy) {
                    data.sort((a, b) => {
                        const aVal = this.getNestedValue(a, this.state.sortBy);
                        const bVal = this.getNestedValue(b, this.state.sortBy);
                        const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                        return this.state.sortDir === 'ASC' ? cmp : -cmp;
                    });
                }

                exportData = data;
            }

            // Prepare columns for export (excluding hidden and action columns)
            const exportColumns = this.options.columns
                .filter(col => !col.hidden && col.key)
                .map(col => ({
                    key: col.key,
                    label: col.label,
                    type: col.type
                }));

            // Create ExportManager instance with options
            const exportManager = new ExportManager({
                filename: this.options.exportFilename || 'export',
                title: this.options.exportTitle || '',
                subtitle: this.options.exportSubtitle || ''
            });

            // Execute export
            await exportManager.export(format, exportData, exportColumns);

            Logger.log('Export completed:', format, exportData.length, 'rows');

        } catch (error) {
            Logger.error('Export error:', error);
            // Show error toast if available
            if (window.Toast) {
                window.Toast.error(__('table.exportError', 'Dışa aktarma sırasında hata oluştu'));
            }
        }
    }

    /**
     * Get all data for export (fetches all if server-side)
     * @returns {Promise<Array>}
     */
    async getAllDataForExport() {
        if (!this.options.serverSide) {
            return this.options.data;
        }

        // For server-side, fetch all data without pagination
        if (this.options.fetchData) {
            try {
                const result = await this.options.fetchData({
                    page: 1,
                    limit: 999999, // Large number to get all
                    search: this.state.search,
                    sort_by: this.state.sortBy,
                    sort_dir: this.state.sortDir
                });
                return result.data || [];
            } catch (error) {
                Logger.error('Failed to fetch all data for export:', error);
                return this.state.data; // Fallback to current page
            }
        }

        return this.state.data;
    }

    /**
     * Toggle actions dropdown for a specific row
     */
    toggleActionsDropdown(rowKey) {
        const allDropdowns = this.container.querySelectorAll('.data-table-action-dropdown-menu');
        const targetDropdown = this.container.querySelector(`[data-dropdown-menu="${rowKey}"]`);

        // Close all other dropdowns
        allDropdowns.forEach(dropdown => {
            if (dropdown !== targetDropdown) {
                dropdown.classList.remove('show');
            }
        });

        // Toggle target dropdown
        if (targetDropdown) {
            targetDropdown.classList.toggle('show');

            // Position dropdown (ensure it stays within viewport)
            if (targetDropdown.classList.contains('show')) {
                this.positionDropdown(targetDropdown);
            }
        }
    }

    /**
     * Close all action dropdowns
     */
    closeAllDropdowns() {
        const allDropdowns = this.container?.querySelectorAll('.data-table-action-dropdown-menu.show');
        allDropdowns?.forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }

    /**
     * Position dropdown using fixed positioning relative to viewport
     * Dropdown escapes table overflow and appears above all elements
     */
    positionDropdown(dropdown) {
        // Reset classes and inline styles first
        dropdown.classList.remove('dropdown-up', 'dropdown-left');
        dropdown.style.top = '';
        dropdown.style.bottom = '';
        dropdown.style.left = '';
        dropdown.style.right = '';

        // Get toggle button position relative to viewport
        const toggleBtn = dropdown.previousElementSibling;
        const toggleRect = toggleBtn ? toggleBtn.getBoundingClientRect() : dropdown.parentElement.getBoundingClientRect();

        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Temporarily show to measure actual dimensions
        dropdown.style.visibility = 'hidden';
        dropdown.style.display = 'block';
        const dropdownHeight = dropdown.offsetHeight || 200;
        const dropdownWidth = dropdown.offsetWidth || 180;
        dropdown.style.visibility = '';
        dropdown.style.display = '';

        // Calculate available space
        const spaceBelow = viewportHeight - toggleRect.bottom;
        const spaceAbove = toggleRect.top;
        const spaceRight = viewportWidth - toggleRect.right;
        const spaceLeft = toggleRect.left;

        // Padding from viewport edges
        const edgePadding = 8;

        // Determine vertical position (down or up)
        let top, bottom;
        if (spaceBelow >= dropdownHeight + edgePadding || spaceBelow >= spaceAbove) {
            // Open downward
            top = toggleRect.bottom + 4;
            bottom = 'auto';
        } else {
            // Open upward
            dropdown.classList.add('dropdown-up');
            top = 'auto';
            bottom = viewportHeight - toggleRect.top + 4;
        }

        // Determine horizontal position - ensure menu stays within viewport
        let left, right;
        // Calculate where the right edge of menu would be if aligned to toggle's right
        const menuRightEdge = toggleRect.right;
        const menuLeftEdge = menuRightEdge - dropdownWidth;

        if (menuLeftEdge >= edgePadding) {
            // Align menu's right edge to toggle's right edge (normal case)
            right = viewportWidth - toggleRect.right;
            left = 'auto';
        } else if (toggleRect.left + dropdownWidth <= viewportWidth - edgePadding) {
            // Align menu's left edge to toggle's left edge
            dropdown.classList.add('dropdown-left');
            left = toggleRect.left;
            right = 'auto';
        } else {
            // Menu is wider than available space, align to left with padding
            dropdown.classList.add('dropdown-left');
            left = edgePadding;
            right = 'auto';
        }

        // Final check: ensure menu doesn't go off the right edge
        if (left !== 'auto' && typeof left === 'number') {
            if (left + dropdownWidth > viewportWidth - edgePadding) {
                left = viewportWidth - dropdownWidth - edgePadding;
            }
        }

        // Apply fixed positioning
        dropdown.style.top = typeof top === 'number' ? `${top}px` : top;
        dropdown.style.bottom = typeof bottom === 'number' ? `${bottom}px` : bottom;
        dropdown.style.left = typeof left === 'number' ? `${left}px` : left;
        dropdown.style.right = typeof right === 'number' ? `${right}px` : right;
    }

    /**
     * Destroy table
     */
    destroy() {
        this._unbindGlobalListeners();
        if (this.container) {
            if (this._containerClickHandler) {
                this.container.removeEventListener('click', this._containerClickHandler);
                this._containerClickHandler = null;
            }
            this.container.innerHTML = '';
        }
    }
}

export default DataTable;
