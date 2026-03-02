/**
 * User Management Page Component (Admin)
 * Uses centralized DataTable component
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class UserManagementPage {
    constructor(app) {
        this.app = app;
        this.dataTable = null;
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
        await this.app.i18n.loadPageTranslations('admin');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.dashboard')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('users.pageTitle')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon indigo">
                            <i class="ti ti-users"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('users.pageTitle')}</h1>
                            <p class="page-subtitle">${this.__('users.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <a href="#/admin" class="btn btn-outline">
                            <i class="ti ti-arrow-left"></i>
                            ${this.__('actions.back')}
                        </a>
                        <button id="add-user-btn" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.__('users.createUser')}
                        </button>
                    </div>
                </div>
            </div>

            <div class="card card-table">
                <div id="users-table"></div>
            </div>
        `;
    }

    async init() {
        this.initDataTable();
        this.bindEvents();
    }

    initDataTable() {
        const container = document.getElementById('users-table');
        if (!container) return;

        this.dataTable = new DataTable(container, {
            serverSide: true,
            fetchData: (params) => this.fetchUsers(params),
            columns: [
                {
                    key: 'avatar',
                    label: this.__('users.columns.preview'),
                    type: 'icon',
                    icon: 'ti-user',
                    sortable: false,
                    preview: true,
                    render: (value, row) => {
                        const basePath = window.OmnexConfig?.basePath || '';
                        if (row.avatar) {
                            return `<img src="${basePath}/${row.avatar}" class="data-table-avatar" alt="${escapeHTML(row.first_name)}">`;
                        }
                        const initials = escapeHTML(this.getInitials(row.name || `${row.first_name} ${row.last_name}`));
                        return `
                            <div class="data-table-avatar-placeholder">
                                ${initials}
                            </div>
                        `;
                    }
                },
                {
                    key: 'name',
                    label: this.__('users.columns.user'),
                    title: true,
                    render: (value, row) => {
                        const name = row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim();
                        return `<span class="font-medium">${escapeHTML(name) || '-'}</span>`;
                    }
                },
                {
                    key: 'email',
                    label: this.__('users.columns.email'),
                    type: 'email'
                },
                {
                    key: 'company_name',
                    label: this.__('users.columns.company'),
                    render: (value) => escapeHTML(value) || '-'
                },
                {
                    key: 'branch_names',
                    label: this.__('users.columns.branch'),
                    render: (value, row) => {
                        if (!value) return '<span class="text-muted">-</span>';
                        const branches = value.split(', ');
                        if (branches.length === 1) {
                            return `<span class="badge badge-info">${escapeHTML(branches[0])}</span>`;
                        }
                        // Make clickable when multiple branches
                        return `
                            <span class="branches-preview" data-user-id="${row.id}" data-branches="${escapeHTML(value)}" style="cursor: pointer;">
                                <span class="badge badge-info">${escapeHTML(branches[0])}</span>
                                <span class="badge badge-secondary badge-clickable" title="${this.__('users.branches.viewAll')}">+${branches.length - 1}</span>
                            </span>
                        `;
                    }
                },
                {
                    key: 'role',
                    label: this.__('users.columns.role'),
                    render: (value) => {
                        const badges = {
                            'SuperAdmin': 'badge-danger',
                            'Admin': 'badge-warning',
                            'Manager': 'badge-info',
                            'Operator': 'badge-primary',
                            'Viewer': 'badge-secondary'
                        };
                        return `<span class="badge ${badges[value] || 'badge-secondary'}">${escapeHTML(value) || '-'}</span>`;
                    }
                },
                {
                    key: 'status',
                    label: this.__('users.columns.status'),
                    type: 'status',
                    statusConfig: {
                        active: { label: this.__('status.active'), class: 'badge-success' },
                        inactive: { label: this.__('status.inactive'), class: 'badge-secondary' }
                    }
                },
                {
                    key: 'last_login',
                    label: this.__('users.columns.lastLogin'),
                    render: (value) => {
                        if (!value) return `<span class="text-muted">-</span>`;
                        return new Date(value).toLocaleString('tr-TR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    }
                }
            ],
            actions: [
                {
                    name: 'history',
                    icon: 'ti-history',
                    label: this.__('users.actions.history'),
                    onClick: (row) => this.showHistory(row)
                },
                {
                    name: 'view',
                    icon: 'ti-eye',
                    label: this.__('users.actions.view'),
                    onClick: (row) => this.view(row)
                },
                {
                    name: 'edit',
                    icon: 'ti-edit',
                    label: this.__('users.actions.edit'),
                    onClick: (row) => this.edit(row)
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('users.actions.delete'),
                    class: 'btn-ghost text-danger',
                    onClick: (row) => this.delete(row)
                }
            ],
            toolbar: {
                show: true,
                exports: true,
                filters: false
            },
            searchPlaceholder: this.__('users.searchPlaceholder'),
            emptyText: this.__('users.emptyText'),
            emptyIcon: 'ti-users-minus'
        });
    }

    async fetchUsers(params) {
        try {
            const queryParams = new URLSearchParams({
                page: params.page,
                per_page: params.limit
            });

            if (params.search) queryParams.append('search', params.search);
            if (params.sort_by) queryParams.append('sort_by', params.sort_by);
            if (params.sort_dir) queryParams.append('sort_dir', params.sort_dir);

            const response = await this.app.api.get(`/users?${queryParams}`);
            return {
                data: response.data || [],
                total: response.meta?.total || response.data?.length || 0
            };
        } catch (error) {
            Logger.error('Users fetch error:', error);
            return { data: [], total: 0 };
        }
    }

    bindEvents() {
        document.getElementById('add-user-btn')?.addEventListener('click', () => {
            this.showUserModal(null);
        });

        // Delegate click event for branches preview
        document.getElementById('users-table')?.addEventListener('click', (e) => {
            const branchesPreview = e.target.closest('.branches-preview');
            if (branchesPreview) {
                const branches = branchesPreview.dataset.branches;
                const userId = branchesPreview.dataset.userId;
                if (branches) {
                    this.showBranchesModal(branches, userId);
                }
            }
        });
    }

    /**
     * Show modal with all branches for a user
     */
    showBranchesModal(branchesStr, userId) {
        const branches = branchesStr.split(', ').filter(b => b.trim());

        const branchList = branches.map(branch => `
            <div class="branch-list-item">
                <i class="ti ti-building-store"></i>
                <span>${escapeHTML(branch)}</span>
            </div>
        `).join('');

        Modal.show({
            title: this.__('users.branches.title'),
            icon: 'ti-building-store',
            size: 'sm',
            content: `
                <div class="branches-modal-content">
                    <p class="text-muted mb-3">${this.__('users.branches.assignedBranches')}:</p>
                    <div class="branch-list">
                        ${branchList}
                    </div>
                    <div class="branches-count mt-3">
                        <span class="badge badge-info">${branches.length}</span>
                        <span class="text-muted">${this.__('users.branches.totalBranches')}</span>
                    </div>
                </div>
                <style>
                    .branches-modal-content { padding: 0.5rem 0; }
                    .branch-list {
                        display: flex;
                        flex-direction: column;
                        gap: 0.5rem;
                        max-height: 300px;
                        overflow-y: auto;
                    }
                    .branch-list-item {
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                        padding: 0.75rem 1rem;
                        background: var(--bg-secondary);
                        border-radius: 8px;
                        transition: background 0.2s;
                    }
                    .branch-list-item:hover {
                        background: var(--bg-tertiary);
                    }
                    .branch-list-item i {
                        color: var(--color-primary);
                        font-size: 1.1rem;
                    }
                    .branches-count {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        padding-top: 0.75rem;
                        border-top: 1px solid var(--border-color);
                    }
                    .badge-clickable {
                        transition: transform 0.15s, box-shadow 0.15s;
                    }
                    .badge-clickable:hover {
                        transform: scale(1.1);
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                </style>
            `,
            showConfirm: false,
            cancelText: this.__('modal.close')
        });
    }

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    view(user) {
        const basePath = window.OmnexConfig?.basePath || '';
        Modal.show({
            title: this.__('users.detail'),
            icon: 'ti-user',
            size: 'md',
            content: `
                <div class="space-y-4">
                    <div class="flex items-center gap-4 pb-4 border-b">
                        <div class="avatar-preview-large">
                            ${user?.avatar
                                ? `<img src="${basePath}/${user.avatar}" alt="Avatar">`
                                : `<div class="avatar-placeholder-large">
                                    <span>${escapeHTML(this.getInitials(user.name || `${user.first_name} ${user.last_name}`))}</span>
                                   </div>`
                            }
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold">${escapeHTML(user.name || `${user.first_name || ''} ${user.last_name || ''}`)}</h3>
                            <p class="text-gray-500">${escapeHTML(user.email)}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm text-gray-500">${this.__('users.fields.role')}</label>
                            <p class="font-medium">${escapeHTML(user.role) || '-'}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">${this.__('users.fields.status')}</label>
                            <p class="font-medium">${user.status === 'active' ? this.__('status.active') : this.__('status.inactive')}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">${this.__('users.fields.company')}</label>
                            <p class="font-medium">${escapeHTML(user.company_name) || '-'}</p>
                        </div>
                        <div>
                            <label class="text-sm text-gray-500">${this.__('users.fields.lastLogin')}</label>
                            <p class="font-medium">${user.last_login_at ? new Date(user.last_login_at).toLocaleString('tr-TR') : '-'}</p>
                        </div>
                    </div>
                </div>
            `,
            showConfirm: false,
            cancelText: this.__('modal.close')
        });
    }

    edit(user) {
        this.showUserModal(user);
    }

    showHistory(user) {
        Toast.info(this.__('users.historyFeature'));
    }

    async showUserModal(user = null) {
        const isEdit = !!user;
        const title = isEdit ? this.__('users.editUser') : this.__('users.addUser');
        const basePath = window.OmnexConfig?.basePath || '';
        const currentUser = this.app.auth.getUser();
        const currentUserRole = currentUser?.role || '';

        // Fetch companies for SuperAdmin
        let companies = [];
        if (currentUserRole === 'SuperAdmin') {
            try {
                const response = await this.app.api.get('/companies');
                companies = response.data || [];
            } catch (error) {
                Logger.error('Companies fetch error:', error);
            }
        }

        // Fetch branches for the user's company (or selected company for new users)
        let branches = [];
        try {
            // For edit: use the user's company_id
            // For new: branches will be loaded when company is selected
            const targetCompanyId = user?.company_id;
            if (targetCompanyId) {
                const branchResponse = await this.app.api.get(`/branches?company_id=${targetCompanyId}`);
                branches = branchResponse.data || [];
            } else if (currentUserRole !== 'SuperAdmin') {
                // Non-SuperAdmin creating new user - get current company's branches
                const branchResponse = await this.app.api.get('/branches');
                branches = branchResponse.data || [];
            }
        } catch (error) {
            Logger.error('Branches fetch error:', error);
        }

        // Get user's assigned branches
        const userBranchIds = user?.branch_ids ? user.branch_ids.split(',') : [];

        const formContent = `
            <form id="user-form" class="space-y-4">
                <!-- Modal Tabs -->
                <div class="modal-tabs">
                    <button type="button" class="modal-tab active" data-tab="info">
                        <i class="ti ti-user"></i> ${this.__('users.tabs.info')}
                    </button>
                    <button type="button" class="modal-tab" data-tab="branches">
                        <i class="ti ti-building-store"></i> ${this.__('users.tabs.branches')}
                    </button>
                    <button type="button" class="modal-tab" data-tab="avatar">
                        <i class="ti ti-photo"></i> ${this.__('users.tabs.avatar')}
                    </button>
                </div>

                <!-- Info Tab -->
                <div id="modal-tab-info" class="modal-tab-content active">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">${this.__('users.fields.firstName')} *</label>
                            <input type="text" id="user-first-name" class="form-input"
                                value="${escapeHTML(user?.first_name || '')}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('users.fields.lastName')} *</label>
                            <input type="text" id="user-last-name" class="form-input"
                                value="${escapeHTML(user?.last_name || '')}" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('users.fields.email')} *</label>
                        <input type="email" id="user-email" class="form-input"
                            value="${escapeHTML(user?.email || '')}" required>
                    </div>
                    ${!isEdit ? `
                    <div class="form-group">
                        <label class="form-label">${this.__('users.fields.password')} *</label>
                        <input type="password" id="user-password" class="form-input"
                            minlength="8" required>
                    </div>
                    ` : ''}
                    ${currentUserRole === 'SuperAdmin' && companies.length > 0 ? `
                    <div class="form-group">
                        <label class="form-label">${this.__('users.fields.company')} *</label>
                        <select id="user-company" class="form-select" required>
                            <option value="">${this.__('users.placeholders.selectCompany')}</option>
                            ${companies.map(c => `<option value="${c.id}" ${user?.company_id === c.id ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    ` : ''}
                    <div class="form-group">
                        <label class="form-label">${this.__('users.fields.role')} *</label>
                        <select id="user-role" class="form-select" required>
                            <option value="">${this.__('users.placeholders.selectRole')}</option>
                            ${currentUserRole === 'SuperAdmin' ? `<option value="SuperAdmin" ${user?.role === 'SuperAdmin' ? 'selected' : ''}>${this.__('users.roles.superadmin')}</option>` : ''}
                            <option value="Admin" ${user?.role === 'Admin' ? 'selected' : ''}>${this.__('users.roles.admin')}</option>
                            <option value="Manager" ${user?.role === 'Manager' ? 'selected' : ''}>${this.__('users.roles.manager')}</option>
                            <option value="Operator" ${user?.role === 'Operator' ? 'selected' : ''}>${this.__('users.roles.operator')}</option>
                            <option value="Viewer" ${user?.role === 'Viewer' ? 'selected' : ''}>${this.__('users.roles.viewer')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('users.fields.status')}</label>
                        <select id="user-status" class="form-select">
                            <option value="active" ${user?.status === 'active' || !isEdit ? 'selected' : ''}>${this.__('status.active')}</option>
                            <option value="inactive" ${user?.status === 'inactive' ? 'selected' : ''}>${this.__('status.inactive')}</option>
                        </select>
                    </div>
                </div>

                <!-- Branches Tab -->
                <div id="modal-tab-branches" class="modal-tab-content" style="display: none;">
                    <div class="branches-selection-section">
                        ${branches.length > 0 ? `
                        <div class="form-group">
                            <label class="form-label">${this.__('users.branches.selectBranches')}</label>
                            <p class="text-muted text-sm mb-3">${this.__('users.branches.hint')}</p>
                            <div class="branch-checkbox-list">
                                ${branches.map(b => `
                                <label class="branch-checkbox-item ${userBranchIds.includes(b.id) ? 'selected' : ''}">
                                    <input type="checkbox" name="user-branches" value="${b.id}"
                                        ${userBranchIds.includes(b.id) ? 'checked' : ''}>
                                    <div class="branch-info">
                                        <span class="branch-name">${escapeHTML(b.name)}</span>
                                        <span class="branch-code text-muted">${escapeHTML(b.code || '')}</span>
                                    </div>
                                    <span class="branch-type badge badge-${b.type === 'region' ? 'info' : b.type === 'store' ? 'primary' : 'secondary'}">
                                        ${b.type === 'region' ? (this.__('users.branches.typeRegion')) :
                                          b.type === 'store' ? (this.__('users.branches.typeStore')) :
                                          b.type === 'warehouse' ? (this.__('users.branches.typeWarehouse') || 'Depo') :
                                          (this.__('users.branches.typeOnline') || 'Online')}
                                    </span>
                                </label>
                                `).join('')}
                            </div>
                        </div>
                        <div class="form-group mt-3">
                            <label class="form-label">${this.__('users.branches.defaultBranch')}</label>
                            <select id="user-default-branch" class="form-select">
                                <option value="">${this.__('users.branches.selectDefault')}</option>
                                ${branches.filter(b => userBranchIds.includes(b.id)).map(b => `
                                <option value="${b.id}" ${user?.default_branch_id === b.id ? 'selected' : ''}>${escapeHTML(b.name)}</option>
                                `).join('')}
                            </select>
                        </div>
                        ` : `
                        <div class="empty-branches-message">
                            <i class="ti ti-building-store text-muted" style="font-size: 2rem;"></i>
                            <p class="text-muted mt-2">${this.__('users.branches.noBranches')}</p>
                            <a href="#/branches" class="btn btn-outline btn-sm mt-2">
                                <i class="ti ti-plus"></i>
                                ${this.__('users.branches.createBranch')}
                            </a>
                        </div>
                        `}
                    </div>
                </div>

                <!-- Avatar Tab -->
                <div id="modal-tab-avatar" class="modal-tab-content" style="display: none;">
                    <div class="avatar-upload-section">
                        <div class="avatar-preview-container">
                            <div class="avatar-preview-large" id="avatar-preview">
                                ${user?.avatar
                                    ? `<img src="${basePath}/${user.avatar}" alt="Avatar" id="avatar-preview-img">`
                                    : `<div class="avatar-placeholder-large">
                                        <span>${isEdit ? escapeHTML(this.getInitials(user?.first_name + ' ' + user?.last_name)) : '?'}</span>
                                       </div>`
                                }
                            </div>
                            <div class="avatar-upload-info">
                                <h4>${this.__('users.avatar.title')}</h4>
                                <p class="text-muted text-sm">${this.__('users.avatar.hint')}</p>
                                ${isEdit ? `
                                <label class="btn btn-primary btn-sm">
                                    <i class="ti ti-upload"></i>
                                    <span>${this.__('users.avatar.upload')}</span>
                                    <input type="file" id="upload-avatar" accept=".jpg,.jpeg,.png,.webp,.gif" hidden>
                                </label>
                                ` : `
                                <p class="text-muted text-sm mt-2">
                                    <i class="ti ti-info-circle"></i>
                                    ${this.__('users.avatar.saveFirst')}
                                </p>
                                `}
                            </div>
                        </div>
                    </div>
                </div>

                <input type="hidden" id="user-id" value="${user?.id || ''}">
            </form>
        `;

        Modal.show({
            title: title,
            icon: isEdit ? 'ti-user-edit' : 'ti-user-plus',
            content: formContent,
            size: 'md',
            confirmText: isEdit ? this.__('modal.save') : this.__('modal.create'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this.saveUser();
            }
        });

        // Bind events after modal is shown
        setTimeout(() => {
            this.bindModalTabs();
            this.bindBranchCheckboxes(branches);
            if (isEdit) {
                this.bindAvatarUpload(user.id);
            }
        }, 100);
    }

    bindBranchCheckboxes(branches) {
        const checkboxes = document.querySelectorAll('input[name="user-branches"]');
        const defaultSelect = document.getElementById('user-default-branch');

        if (!defaultSelect || !checkboxes.length) return;

        // Update selected state on checkbox items
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                // Update visual selection state
                cb.closest('.branch-checkbox-item')?.classList.toggle('selected', cb.checked);

                // Update default branch dropdown options
                const selectedIds = Array.from(checkboxes)
                    .filter(c => c.checked)
                    .map(c => c.value);

                const currentDefault = defaultSelect.value;
                defaultSelect.innerHTML = `<option value="">${this.__('users.branches.selectDefault')}</option>`;

                branches
                    .filter(b => selectedIds.includes(b.id))
                    .forEach(b => {
                        const option = document.createElement('option');
                        option.value = b.id;
                        option.textContent = b.name;
                        if (b.id === currentDefault) option.selected = true;
                        defaultSelect.appendChild(option);
                    });

                // If current default is no longer in selected, auto-select first
                if (selectedIds.length > 0 && !selectedIds.includes(currentDefault)) {
                    defaultSelect.value = selectedIds[0];
                }
            });
        });
    }

    bindModalTabs() {
        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;

                // Update tab buttons
                document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Update tab content
                document.querySelectorAll('.modal-tab-content').forEach(content => {
                    content.style.display = 'none';
                    content.classList.remove('active');
                });
                const targetContent = document.getElementById(`modal-tab-${tabId}`);
                if (targetContent) {
                    targetContent.style.display = 'block';
                    targetContent.classList.add('active');
                }
            });
        });
    }

    bindAvatarUpload(userId) {
        const uploadInput = document.getElementById('upload-avatar');
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => {
                this.handleAvatarUpload(e.target.files[0], userId);
            });
        }
    }

    async handleAvatarUpload(file, userId) {
        if (!file) return;

        if (file.size > 500 * 1024) {
            Toast.error(this.__('users.validation.fileTooLarge'));
            return;
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            Toast.error(this.__('users.validation.invalidFileFormat'));
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('user_id', userId);

            const response = await fetch(`${this.app.config.apiUrl}/users/upload-avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem(this.app.config.storageKeys.token)}`
                },
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                Toast.success(this.__('users.avatar.uploaded'));

                // Update preview
                const basePath = window.OmnexConfig?.basePath || '';
                const previewContainer = document.getElementById('avatar-preview');
                if (previewContainer) {
                    previewContainer.innerHTML = `<img src="${basePath}/${result.data.path}?t=${Date.now()}" alt="Avatar">`;
                }

                // Refresh table
                this.dataTable?.refresh();
            } else {
                Toast.error(result.message || this.__('users.validation.uploadError'));
            }
        } catch (error) {
            Logger.error('Avatar upload error:', error);
            Toast.error(this.__('users.validation.uploadError'));
        }
    }

    async saveUser() {
        const id = document.getElementById('user-id')?.value;
        const firstName = document.getElementById('user-first-name')?.value.trim();
        const lastName = document.getElementById('user-last-name')?.value.trim();
        const email = document.getElementById('user-email')?.value.trim();
        const password = document.getElementById('user-password')?.value;
        const role = document.getElementById('user-role')?.value;
        const status = document.getElementById('user-status')?.value;
        const companyId = document.getElementById('user-company')?.value;

        // Get selected branches
        const selectedBranches = Array.from(
            document.querySelectorAll('input[name="user-branches"]:checked')
        ).map(cb => cb.value);
        const defaultBranchId = document.getElementById('user-default-branch')?.value;

        if (!firstName || !lastName || !email || !role) {
            Toast.error(this.__('users.validation.requiredFields'));
            throw new Error('Validation failed');
        }

        const userData = {
            first_name: firstName,
            last_name: lastName,
            email: email,
            role: role,
            status: status
        };

        // Add company_id if present (SuperAdmin only)
        if (companyId) {
            userData.company_id = companyId;
        }

        if (!id && password) {
            userData.password = password;
        }

        // Add branch assignments
        if (selectedBranches.length > 0) {
            userData.branch_ids = selectedBranches;
            userData.default_branch_id = defaultBranchId || selectedBranches[0];
        }

        try {
            if (id) {
                await this.app.api.put(`/users/${id}`, userData);
                Toast.success(this.__('users.toast.updated'));
            } else {
                const response = await this.app.api.post('/users', userData);
                Toast.success(this.__('users.toast.created'));
            }

            this.dataTable?.refresh();
        } catch (error) {
            Logger.error('User save error:', error);
            Toast.error(error.message || this.__('users.toast.operationFailed'));
            throw error;
        }
    }

    async delete(user) {
        Modal.confirm({
            title: this.__('users.deleteUser'),
            message: this.__('users.deleteConfirm', { name: user.name || user.email }),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/users/${user.id}`);
                    Toast.success(this.__('users.toast.deleted'));
                    this.dataTable?.refresh();
                } catch (error) {
                    Toast.error(this.__('users.toast.deleteFailed'));
                    throw error;
                }
            }
        });
    }

    destroy() {
        if (this.dataTable) {
            this.dataTable.destroy();
            this.dataTable = null;
        }

        // Clear page translations
        this.app.i18n.clearPageTranslations();
    }
}

export default UserManagementPage;
