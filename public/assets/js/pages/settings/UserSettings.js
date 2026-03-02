/**
 * User Settings Page Component
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';

export class UserSettingsPage {
    constructor(app) {
        this.app = app;
        this.users = [];
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n ? this.app.i18n.t(key, params) : key;
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/settings">${this.__('breadcrumb.settings')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('users.title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon slate">
                            <i class="ti ti-users"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('users.title')}</h1>
                            <p class="page-subtitle">${this.__('users.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="add-user-btn" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.__('users.addUser')}
                        </button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Settings Navigation -->
                <div class="lg:col-span-1">
                    <div class="card">
                        <div class="card-body p-0">
                            <nav class="settings-nav">
                                <a href="#/settings" class="settings-nav-item">
                                    <i class="ti ti-settings"></i>
                                    ${this.__('nav.general')}
                                </a>
                                <a href="#/settings/users" class="settings-nav-item active">
                                    <i class="ti ti-users"></i>
                                    ${this.__('nav.users')}
                                </a>
                                <a href="#/settings/integrations" class="settings-nav-item">
                                    <i class="ti ti-plug"></i>
                                    ${this.__('nav.integrations')}
                                </a>
                            </nav>
                        </div>
                    </div>
                </div>

                <!-- Users List -->
                <div class="lg:col-span-2">
                    <div class="card">
                        <div class="card-body">
                            <div id="users-container">
                                ${this.renderLoading()}
                            </div>
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

    renderUsers() {
        if (!this.users.length) {
            return `
                <div class="text-center py-8 text-gray-500">
                    <i class="ti ti-users text-4xl mb-2"></i>
                    <p>${this.__('users.emptyText')}</p>
                </div>
            `;
        }

        return `
            <div class="overflow-x-auto">
                <table class="table">
                    <thead>
                        <tr>
                            <th>${this.__('users.columns.user')}</th>
                            <th>${this.__('users.columns.email')}</th>
                            <th>${this.__('users.columns.role')}</th>
                            <th>${this.__('users.columns.status')}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.users.map(u => `
                            <tr>
                                <td>
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                                            <span class="text-primary-600 font-medium">${this.getInitials(u.name)}</span>
                                        </div>
                                        <span class="font-medium">${u.name}</span>
                                    </div>
                                </td>
                                <td>${u.email}</td>
                                <td>
                                    <span class="badge badge-${this.getRoleBadge(u.role)}">${u.role}</span>
                                </td>
                                <td>
                                    <span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-secondary'}">
                                        ${u.status === 'active' ? this.__('status.active') : this.__('status.inactive')}
                                    </span>
                                </td>
                                <td>
                                    <div class="flex gap-1">
                                        <button onclick="window.userSettingsPage?.editUser('${u.id}')" class="btn btn-sm btn-ghost">
                                            <i class="ti ti-edit"></i>
                                        </button>
                                        <button onclick="window.userSettingsPage?.deleteUser('${u.id}')" class="btn btn-sm btn-ghost text-red-500">
                                            <i class="ti ti-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    getRoleBadge(role) {
        const badges = {
            'SuperAdmin': 'danger',
            'Admin': 'warning',
            'Manager': 'info',
            'Operator': 'primary',
            'Viewer': 'secondary'
        };
        return badges[role] || 'secondary';
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('settings');
    }

    async init() {
        window.userSettingsPage = this;
        await this.loadUsers();
        this.bindEvents();
    }

    async loadUsers() {
        try {
            const response = await this.app.api.get('/users');
            this.users = response.data || [];
            document.getElementById('users-container').innerHTML = this.renderUsers();
        } catch (error) {
            Logger.error('Users load error:', error);
            document.getElementById('users-container').innerHTML = this.renderUsers();
        }
    }

    bindEvents() {
        document.getElementById('add-user-btn')?.addEventListener('click', () => {
            this.showAddModal();
        });
    }

    showAddModal() {
        this.showUserModal(null);
    }

    editUser(id) {
        const user = this.users.find(u => u.id === id);
        if (user) {
            this.showUserModal(user);
        } else {
            Toast.error(this.__('messages.notFound'));
        }
    }

    showUserModal(user = null) {
        const isEdit = !!user;

        const formContent = `
            <form id="user-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('users.fields.firstName')}</label>
                        <input type="text" id="user-first-name" class="form-input"
                            value="${user?.first_name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('users.fields.lastName')}</label>
                        <input type="text" id="user-last-name" class="form-input"
                            value="${user?.last_name || ''}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('users.fields.email')}</label>
                    <input type="email" id="user-email" class="form-input"
                        value="${user?.email || ''}" required>
                </div>
                ${!isEdit ? `
                <div class="form-group">
                    <label class="form-label">${this.__('users.fields.password')}</label>
                    <input type="password" id="user-password" class="form-input"
                        minlength="8" required>
                </div>
                ` : ''}
                <div class="form-group">
                    <label class="form-label">${this.__('users.fields.role')}</label>
                    <select id="user-role" class="form-select" required>
                        <option value="">${this.__('users.placeholders.selectRole')}</option>
                        <option value="Admin" ${user?.role === 'Admin' ? 'selected' : ''}>${this.__('users.roles.admin')}</option>
                        <option value="Editor" ${user?.role === 'Editor' ? 'selected' : ''}>${this.__('users.roles.editor')}</option>
                        <option value="Viewer" ${user?.role === 'Viewer' ? 'selected' : ''}>${this.__('users.roles.viewer')}</option>
                    </select>
                </div>
                <input type="hidden" id="user-id" value="${user?.id || ''}">
            </form>
        `;

        Modal.show({
            title: isEdit ? this.__('users.editUser') : this.__('users.addUser'),
            icon: 'ti-user',
            content: formContent,
            size: 'md',
            confirmText: isEdit ? this.__('modal.save') : this.__('modal.create'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this.saveUser();
            }
        });
    }

    async saveUser() {
        const id = document.getElementById('user-id')?.value;
        const firstName = document.getElementById('user-first-name')?.value.trim();
        const lastName = document.getElementById('user-last-name')?.value.trim();
        const email = document.getElementById('user-email')?.value.trim();
        const password = document.getElementById('user-password')?.value;
        const role = document.getElementById('user-role')?.value;

        if (!firstName || !lastName || !email || !role) {
            Toast.error(this.__('validation.required'));
            return;
        }

        const userData = {
            first_name: firstName,
            last_name: lastName,
            email: email,
            role: role
        };

        // Add password only for new users
        if (!id && password) {
            userData.password = password;
        }

        try {
            if (id) {
                await this.app.api.put(`/users/${id}`, userData);
                Toast.success(this.__('users.toast.updated'));
            } else {
                await this.app.api.post('/users', userData);
                Toast.success(this.__('users.toast.created'));
            }

            await this.loadUsers();
        } catch (error) {
            Logger.error('User save error:', error);
            Toast.error(error.message || this.__('toast.failed'));
            throw error;
        }
    }

    async deleteUser(id) {
        Modal.confirm({
            title: this.__('users.deleteUser'),
            message: this.__('users.deleteConfirm'),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/users/${id}`);
                    Toast.success(this.__('users.toast.deleted'));
                    await this.loadUsers();
                } catch (error) {
                    Toast.error(this.__('messages.deleteFailed'));
                    throw error;
                }
            }
        });
    }

    destroy() {
        window.userSettingsPage = null;
        this.app.i18n.clearPageTranslations();
    }
}

export default UserSettingsPage;
