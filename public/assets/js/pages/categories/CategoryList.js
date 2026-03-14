/**
 * Category List Page Component
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class CategoryListPage {
    constructor(app) {
        this.app = app;
        this.categories = [];
    }

    /**
     * Translation helper - uses page translations with fallback to common
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.dashboard')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('categories.title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon teal">
                            <i class="ti ti-category"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('categories.title')}</h1>
                            <p class="page-subtitle">${this.__('categories.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="btn-add-category" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            <span>${this.__('categories.addCategory')}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Category Tree -->
                <div class="lg:col-span-2">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">${this.__('categories.list')}</h3>
                            <div class="flex items-center gap-2">
                                <input type="text" id="category-search" class="form-input form-input-sm"
                                    placeholder="${this.__('actions.search')}..." style="width: 200px;">
                            </div>
                        </div>
                        <div class="card-body">
                            <div id="categories-container">
                                ${this.renderLoading()}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Category Form -->
                <div>
                    <div class="card" id="category-form-card">
                        <div class="card-header">
                            <h3 class="card-title" id="form-title">${this.__('categories.newCategory')}</h3>
                        </div>
                        <div class="card-body">
                            <form id="category-form" class="space-y-4">
                                <div class="form-group">
                                    <label class="form-label form-label-required">${this.__('categories.fields.name')}</label>
                                    <input type="text" id="category-name" class="form-input"
                                        placeholder="${this.__('categories.placeholders.name')}" required>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">${this.__('categories.fields.parent')}</label>
                                    <select id="category-parent" class="form-select">
                                        <option value="">${this.__('categories.placeholders.parent')}</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">${this.__('categories.fields.description')}</label>
                                    <textarea id="category-description" class="form-input" rows="3"
                                        placeholder="${this.__('categories.placeholders.description')}"></textarea>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">${this.__('categories.fields.color')}</label>
                                    <div class="color-picker-wrapper">
                                        <input type="color" id="category-color" class="form-color" value="#228be6">
                                        <input type="text" id="category-color-text" class="form-input"
                                            value="#228be6" pattern="^#[0-9A-Fa-f]{6}$">
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">${this.__('categories.fields.order')}</label>
                                    <input type="number" id="category-order" class="form-input"
                                        value="0" min="0">
                                </div>

                                <div class="form-group">
                                    <label class="form-checkbox-label">
                                        <input type="checkbox" id="category-active" class="form-checkbox" checked>
                                        <span>${this.__('status.active')}</span>
                                    </label>
                                </div>

                                <input type="hidden" id="category-id" value="">

                                <div class="flex gap-2">
                                    <button type="submit" class="btn btn-primary flex-1">
                                        <i class="ti ti-check"></i>
                                        ${this.__('actions.save')}
                                    </button>
                                    <button type="button" id="btn-cancel" class="btn btn-ghost">
                                        ${this.__('actions.cancel')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderLoading() {
        return `
            <div class="flex items-center justify-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        `;
    }

    renderCategories(filter = '') {
        let filteredCategories = this.categories;

        if (filter) {
            const search = filter.toLowerCase();
            filteredCategories = this.categories.filter(c =>
                c.name.toLowerCase().includes(search)
            );
        }

        if (!filteredCategories.length) {
            return `
                <div class="text-center py-8 text-gray-500">
                    <i class="ti ti-folder text-4xl mb-2"></i>
                    <p>${filter ? this.__('messages.noResults') : this.__('categories.empty')}</p>
                </div>
            `;
        }

        // Build tree structure
        const rootCategories = filteredCategories.filter(c => !c.parent_id);
        return this.renderCategoryTree(rootCategories, filteredCategories);
    }

    renderCategoryTree(categories, allCategories, level = 0) {
        return categories.map(category => {
            const children = allCategories.filter(c => c.parent_id === category.id);
            const hasChildren = children.length > 0;
            const productCount = category.product_count || 0;

            return `
                <div class="category-item" data-id="${category.id}" style="margin-left: ${level * 24}px;">
                    <div class="category-item-content">
                        <div class="category-item-left">
                            ${hasChildren ? `
                                <button class="category-toggle" onclick="window.categoryPage?.toggleChildren('${category.id}')">
                                    <i class="ti ti-chevron-right"></i>
                                </button>
                            ` : `<span class="category-toggle-placeholder"></span>`}
                            <span class="category-color" style="background: ${escapeHTML(category.color || '#228be6')}"></span>
                            <span class="category-name">${escapeHTML(category.name)}</span>
                            <span class="category-count badge badge-sm">${productCount}</span>
                        </div>
                        <div class="category-item-actions">
                            <button onclick="window.categoryPage?.edit('${category.id}')"
                                class="btn btn-sm btn-ghost" title="${this.__('actions.edit')}">
                                <i class="ti ti-edit"></i>
                            </button>
                            <button onclick="window.categoryPage?.addChild('${category.id}')"
                                class="btn btn-sm btn-ghost" title="${this.__('categories.actions.addChild')}">
                                <i class="ti ti-plus"></i>
                            </button>
                            <button onclick="window.categoryPage?.delete('${category.id}')"
                                class="btn btn-sm btn-ghost text-red-500" title="${this.__('actions.delete')}">
                                <i class="ti ti-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${hasChildren ? `
                        <div class="category-children" id="children-${category.id}">
                            ${this.renderCategoryTree(children, allCategories, level + 1)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('products');
    }

    async init() {
        window.categoryPage = this;

        await this.loadCategories();
        this.bindEvents();
        this.addStyles();
    }

    async loadCategories() {
        try {
            const response = await this.app.api.get('/categories');
            this.categories = response.data || [];
            document.getElementById('categories-container').innerHTML = this.renderCategories();
            this.updateParentSelect();
        } catch (error) {
            Logger.error('Categories load error:', error);
            document.getElementById('categories-container').innerHTML = this.renderCategories();
        }
    }

    updateParentSelect(excludeId = null) {
        const select = document.getElementById('category-parent');

        select.innerHTML = `<option value="">${this.__('categories.placeholders.parent')}</option>`;

        // Build hierarchical parent options (exclude self and descendants)
        const excludeIds = excludeId ? this.getDescendantIds(excludeId) : [];
        if (excludeId) {
            excludeIds.push(excludeId);
        }

        // Build tree and render options
        const tree = this.buildCategoryTree(this.categories.filter(c => !excludeIds.includes(c.id)));
        this.renderParentOptions(select, tree, 0);
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
     * Render parent select options with indentation
     */
    renderParentOptions(select, categories, level) {
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            // Add visual indentation
            const prefix = level > 0 ? '│ '.repeat(level - 1) + '├─ ' : '';
            option.textContent = prefix + cat.name;
            select.appendChild(option);

            // Render children recursively
            if (cat.children && cat.children.length > 0) {
                this.renderParentOptions(select, cat.children, level + 1);
            }
        });
    }

    /**
     * Get all descendant IDs of a category
     */
    getDescendantIds(categoryId) {
        const ids = [];
        const children = this.categories.filter(c => c.parent_id === categoryId);
        children.forEach(child => {
            ids.push(child.id);
            ids.push(...this.getDescendantIds(child.id));
        });
        return ids;
    }

    bindEvents() {
        document.getElementById('btn-add-category')?.addEventListener('click', () => {
            this.resetForm();
        });

        document.getElementById('btn-cancel')?.addEventListener('click', () => {
            this.resetForm();
        });

        document.getElementById('category-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.save();
        });

        document.getElementById('category-name')?.addEventListener('input', () => {
            document.getElementById('category-name')?.classList.remove('error');
        });

        document.getElementById('category-search')?.addEventListener('input', (e) => {
            document.getElementById('categories-container').innerHTML = this.renderCategories(e.target.value);
        });

        // Color picker sync
        document.getElementById('category-color')?.addEventListener('input', (e) => {
            document.getElementById('category-color-text').value = e.target.value;
        });

        document.getElementById('category-color-text')?.addEventListener('input', (e) => {
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                document.getElementById('category-color').value = e.target.value;
            }
        });
    }

    resetForm() {
        document.getElementById('form-title').textContent = this.__('categories.newCategory');
        document.getElementById('category-id').value = '';
        document.getElementById('category-name').value = '';
        document.getElementById('category-name').classList.remove('error');
        document.getElementById('category-parent').value = '';
        document.getElementById('category-description').value = '';
        document.getElementById('category-color').value = '#228be6';
        document.getElementById('category-color-text').value = '#228be6';
        document.getElementById('category-order').value = '0';
        document.getElementById('category-active').checked = true;
        this.updateParentSelect();
    }

    edit(id) {
        const category = this.categories.find(c => c.id === id);
        if (!category) return;

        document.getElementById('form-title').textContent = this.__('categories.editCategory');
        document.getElementById('category-id').value = category.id;
        document.getElementById('category-name').value = category.name || '';
        document.getElementById('category-description').value = category.description || '';
        document.getElementById('category-color').value = category.color || '#228be6';
        document.getElementById('category-color-text').value = category.color || '#228be6';
        document.getElementById('category-order').value = category.sort_order || 0;
        document.getElementById('category-active').checked = category.status === 'active';

        // First update parent select (excluding self and descendants)
        this.updateParentSelect(category.id);

        // Then set parent value AFTER dropdown is populated
        document.getElementById('category-parent').value = category.parent_id || '';

        // Scroll to form on mobile
        document.getElementById('category-form-card')?.scrollIntoView({ behavior: 'smooth' });
    }

    addChild(parentId) {
        this.resetForm();
        document.getElementById('category-parent').value = parentId;
    }

    toggleChildren(id) {
        const children = document.getElementById(`children-${id}`);
        const toggle = document.querySelector(`.category-item[data-id="${id}"] .category-toggle i`);

        if (children) {
            children.classList.toggle('collapsed');
            toggle?.classList.toggle('ti-chevron-right');
            toggle?.classList.toggle('ti-chevron-down');
        }
    }

    async save() {
        const id = document.getElementById('category-id')?.value;
        const name = document.getElementById('category-name')?.value.trim();
        const parentId = document.getElementById('category-parent')?.value || null;
        const description = document.getElementById('category-description')?.value.trim();
        const color = document.getElementById('category-color')?.value;
        const sortOrder = parseInt(document.getElementById('category-order')?.value) || 0;
        const isActive = document.getElementById('category-active')?.checked;

        if (!name) {
            const nameInput = document.getElementById('category-name');
            if (nameInput) nameInput.classList.add('error');
            Toast.error(this.__('validation.requiredField', { field: this.__('categories.fields.name') }));
            return;
        }

        const data = {
            name,
            parent_id: parentId,
            description,
            color,
            sort_order: sortOrder,
            status: isActive ? 'active' : 'inactive'
        };

        try {
            if (id) {
                await this.app.api.put(`/categories/${id}`, data);
                Toast.success(this.__('categories.toast.updated'));
            } else {
                await this.app.api.post('/categories', data);
                Toast.success(this.__('categories.toast.created'));
            }
            this.resetForm();
            await this.loadCategories();
        } catch (error) {
            Logger.error('Save error:', error);
            Toast.error(this.__('messages.saveFailed'));
        }
    }

    async delete(id) {
        const category = this.categories.find(c => c.id === id);
        const hasChildren = this.categories.some(c => c.parent_id === id);

        if (hasChildren) {
            Toast.error(this.__('categories.deleteWithChildren', { name: category?.name }));
            return;
        }

        Modal.confirm({
            title: this.__('categories.deleteCategory'),
            message: this.__('categories.deleteConfirm', { name: category?.name }),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/categories/${id}`);
                    Toast.success(this.__('categories.toast.deleted'));
                    await this.loadCategories();
                } catch (error) {
                    Logger.error('Delete error:', error);
                    Toast.error(this.__('messages.deleteFailed'));
                    throw error;
                }
            }
        });
    }

    addStyles() {
        if (document.getElementById('category-list-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'category-list-styles';
        styles.textContent = `
            .category-item {
                border-bottom: 1px solid var(--border-color);
            }

            .category-item:last-child {
                border-bottom: none;
            }

            .category-item-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 0;
                gap: 12px;
            }

            .category-item-left {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
            }

            .category-toggle {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                border-radius: var(--radius-sm);
            }

            .category-toggle:hover {
                background: var(--bg-secondary);
            }

            .category-toggle-placeholder {
                width: 24px;
            }

            .category-color {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                flex-shrink: 0;
            }

            .category-name {
                font-weight: 500;
            }

            .category-count {
                background: var(--bg-secondary);
                color: var(--text-muted);
                font-size: 0.75rem;
            }

            .category-item-actions {
                display: flex;
                gap: 4px;
                opacity: 0;
                transition: opacity 0.2s;
            }

            .category-item-content:hover .category-item-actions {
                opacity: 1;
            }

            .category-children {
                padding-left: 0;
            }

            .category-children.collapsed {
                display: none;
            }

            .color-picker-wrapper {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .form-color {
                width: 40px;
                height: 40px;
                padding: 2px;
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
                cursor: pointer;
            }

            .color-picker-wrapper .form-input {
                flex: 1;
            }

            @media (max-width: 768px) {
                .category-item-actions {
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    destroy() {
        window.categoryPage = null;
        this.app.i18n.clearPageTranslations();
    }
}

export default CategoryListPage;
