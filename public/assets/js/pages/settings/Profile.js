/**
 * User Profile Page Component
 * Tab-based design matching GeneralSettings page
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';

export class ProfilePage {
    constructor(app) {
        this.app = app;
        this.user = null;
        this.activeTab = 'info';
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
                    <span class="breadcrumb-current">${this.__('profile.title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon slate">
                            <i class="ti ti-user"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('profile.title')}</h1>
                            <p class="page-subtitle">${this.__('profile.subtitle')}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Profile Tab Navigation -->
            <div class="settings-tabs">
                <button class="settings-tab ${this.activeTab === 'info' ? 'active' : ''}" data-tab="info">
                    <i class="ti ti-user"></i>
                    <span>${this.__('profile.personalInfo')}</span>
                </button>
                <button class="settings-tab ${this.activeTab === 'password' ? 'active' : ''}" data-tab="password">
                    <i class="ti ti-key"></i>
                    <span>${this.__('profile.changePassword')}</span>
                </button>
                <button class="settings-tab ${this.activeTab === 'account' ? 'active' : ''}" data-tab="account">
                    <i class="ti ti-info-circle"></i>
                    <span>${this.__('profile.accountInfo')}</span>
                </button>
            </div>

            <div id="profile-container">
                ${this.renderLoading()}
            </div>
        `;
    }

    renderLoading() {
        return `
            <div class="card">
                <div class="card-body">
                    <div class="flex items-center justify-center py-8">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                </div>
            </div>
        `;
    }

    renderProfile() {
        if (!this.user) {
            return `
                <div class="card">
                    <div class="card-body text-center py-8">
                        <i class="ti ti-user-off text-4xl text-gray-400 mb-2"></i>
                        <p class="text-gray-500">${this.__('profile.loadFailed')}</p>
                    </div>
                </div>
            `;
        }

        const initials = this.getInitials(this.user.first_name, this.user.last_name);

        return `
            <!-- Personal Info Tab -->
            <div id="tab-info" class="settings-tab-content ${this.activeTab === 'info' ? 'active' : ''}">
                <div class="settings-grid">
                    <!-- Avatar & Name Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-photo"></i>
                                ${this.__('profile.avatar.title')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <div class="flex items-center gap-6">
                                <div class="relative">
                                    <div class="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center text-3xl font-semibold text-primary-600">
                                        ${this.user.avatar
                                            ? `<img src="${this.user.avatar}" alt="${this.user.first_name}" class="w-full h-full rounded-full object-cover">`
                                            : initials
                                        }
                                    </div>
                                    <button id="change-avatar-btn" class="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition">
                                        <i class="ti ti-camera text-sm"></i>
                                    </button>
                                </div>
                                <div>
                                    <h2 class="text-xl font-semibold">${this.user.first_name} ${this.user.last_name}</h2>
                                    <p class="text-gray-500">${this.user.email}</p>
                                    <span class="badge badge-${this.getRoleBadge(this.user.role)} mt-2">${this.getRoleLabel(this.user.role)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Profile Form Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-user-edit"></i>
                                ${this.__('profile.personalInfo')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <form id="profile-form">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label class="form-label">${this.__('profile.form.firstName')}</label>
                                        <input type="text" id="first-name" class="form-input" value="${this.user.first_name || ''}" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('profile.form.lastName')}</label>
                                        <input type="text" id="last-name" class="form-input" value="${this.user.last_name || ''}" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('profile.form.email')}</label>
                                        <input type="email" id="email" class="form-input" value="${this.user.email || ''}" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('profile.form.phone')}</label>
                                        <input type="tel" id="phone" class="form-input" value="${this.user.phone || ''}" placeholder="+90 5XX XXX XXXX">
                                    </div>
                                </div>
                                <div class="settings-footer">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="ti ti-check"></i>
                                        ${this.__('actions.save')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Password Change Tab -->
            <div id="tab-password" class="settings-tab-content ${this.activeTab === 'password' ? 'active' : ''}">
                <div class="settings-grid">
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-key"></i>
                                ${this.__('profile.changePassword')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <form id="password-form">
                                <div class="form-grid">
                                    <div class="form-group full-width">
                                        <label class="form-label">${this.__('profile.form.currentPassword')}</label>
                                        <input type="password" id="current-password" class="form-input" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('profile.form.newPassword')}</label>
                                        <input type="password" id="new-password" class="form-input" required minlength="8">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('profile.form.confirmPassword')}</label>
                                        <input type="password" id="confirm-password" class="form-input" required minlength="8">
                                    </div>
                                </div>
                                <div class="settings-footer">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="ti ti-key"></i>
                                        ${this.__('profile.changePasswordBtn')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <!-- Password Tips Card -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-shield-check"></i>
                                ${this.__('profile.passwordTips')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <div class="info-box info-box-blue">
                                <i class="ti ti-bulb"></i>
                                <div>
                                    <strong>${this.__('profile.passwordTipsTitle')}</strong>
                                    <ul class="text-sm mt-2" style="list-style: disc; padding-left: 1.25rem; margin: 0;">
                                        <li>${this.__('profile.passwordTip1')}</li>
                                        <li>${this.__('profile.passwordTip2')}</li>
                                        <li>${this.__('profile.passwordTip3')}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Account Info Tab -->
            <div id="tab-account" class="settings-tab-content ${this.activeTab === 'account' ? 'active' : ''}">
                <div class="settings-grid">
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-info-circle"></i>
                                ${this.__('profile.accountInfo')}
                            </h2>
                        </div>
                        <div class="chart-card-body">
                            <div class="space-y-3 text-sm">
                                <div class="flex justify-between py-3 border-b" style="border-color: var(--border-color);">
                                    <span class="text-muted">${this.__('profile.company')}</span>
                                    <span class="font-medium">${this.user.role === 'SuperAdmin' ? this.__('profile.allCompanies') : (this.user.company_name || '-')}</span>
                                </div>
                                <div class="flex justify-between py-3 border-b" style="border-color: var(--border-color);">
                                    <span class="text-muted">${this.__('profile.role')}</span>
                                    <span class="font-medium">${this.getRoleLabel(this.user.role)}</span>
                                </div>
                                <div class="flex justify-between py-3 border-b" style="border-color: var(--border-color);">
                                    <span class="text-muted">${this.__('profile.createdAt')}</span>
                                    <span class="font-medium">${this.formatDate(this.user.created_at)}</span>
                                </div>
                                <div class="flex justify-between py-3">
                                    <span class="text-muted">${this.__('profile.lastLogin')}</span>
                                    <span class="font-medium">${this.formatDateTime(this.user.last_login)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;
    }

    getInitials(firstName, lastName) {
        const first = firstName?.[0] || '';
        const last = lastName?.[0] || '';
        return (first + last).toUpperCase() || '?';
    }

    getRoleBadge(role) {
        const badges = {
            'SuperAdmin': 'danger',
            'Admin': 'warning',
            'Manager': 'info',
            'Editor': 'primary',
            'Viewer': 'secondary'
        };
        return badges[role] || 'secondary';
    }

    getRoleLabel(role) {
        return this.__(`roles.${role}`) || role;
    }

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('settings');
    }

    async init() {
        await this.loadProfile();
        this.bindEvents();
    }

    async loadProfile() {
        try {
            // Get current user from auth state
            this.user = this.app.auth.getUser();

            // If needed, fetch more details from API
            try {
                const response = await this.app.api.get('/auth/session');
                if (response.success && response.data?.user) {
                    this.user = { ...this.user, ...response.data.user };
                }
            } catch (e) {
                // Use cached user data
            }

            document.getElementById('profile-container').innerHTML = this.renderProfile();
        } catch (error) {
            Logger.error('Profile load error:', error);
            document.getElementById('profile-container').innerHTML = this.renderProfile();
        }
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // Profile form submit
        document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateProfile();
        });

        // Password form submit
        document.getElementById('password-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.changePassword();
        });

        // Avatar change
        document.getElementById('change-avatar-btn')?.addEventListener('click', () => {
            this.showAvatarModal();
        });
    }

    switchTab(tabId) {
        this.activeTab = tabId;

        // Update tab buttons
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });

        // Update tab content
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });
    }

    showAvatarModal() {
        const formContent = `
            <div class="space-y-4">
                <div id="avatar-preview" class="w-32 h-32 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                    ${this.user?.avatar
                        ? `<img src="${this.user.avatar}" class="w-full h-full object-cover">`
                        : `<i class="ti ti-user text-4xl text-gray-400"></i>`
                    }
                </div>
                <div class="space-y-3">
                    <label class="btn btn-outline w-full cursor-pointer">
                        <i class="ti ti-upload"></i>
                        ${this.__('profile.avatar.selectFile')}
                        <input type="file" id="avatar-file" class="hidden" accept="image/*">
                    </label>
                    ${this.user?.avatar ? `
                        <button type="button" id="remove-avatar-btn" class="btn btn-outline-danger w-full">
                            <i class="ti ti-trash"></i>
                            ${this.__('profile.avatar.remove')}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        const modal = Modal.show({
            title: this.__('profile.avatar.title'),
            icon: 'ti-camera',
            content: formContent,
            size: 'sm',
            showCancel: true,
            showConfirm: false,
            cancelText: this.__('modal.close')
        });

        // Bind events after modal renders
        setTimeout(() => {
            document.getElementById('avatar-file')?.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Show preview
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.getElementById('avatar-preview').innerHTML =
                        `<img src="${ev.target.result}" class="w-full h-full object-cover">`;
                };
                reader.readAsDataURL(file);

                // Upload
                await this.uploadAvatar(file);
                Modal.close(modal.id);
            });

            document.getElementById('remove-avatar-btn')?.addEventListener('click', async () => {
                await this.removeAvatar();
                Modal.close(modal.id);
            });
        }, 100);
    }

    async uploadAvatar(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'avatar');

        try {
            const response = await this.app.api.upload('/media/upload', formData);
            if (response.success && response.data?.url) {
                // Update profile with new avatar
                await this.app.api.put('/users/profile', { avatar: response.data.url });

                // Update local state
                if (this.user) {
                    this.user.avatar = response.data.url;
                    const currentUser = this.app.auth.getUser();
                    this.app.state.set('user', { ...currentUser, avatar: response.data.url });
                }

                Toast.success(this.__('profile.toast.avatarUpdated'));
                await this.loadProfile();
            }
        } catch (error) {
            Logger.error('Avatar upload error:', error);
            Toast.error(this.__('messages.uploadFailed'));
        }
    }

    async removeAvatar() {
        try {
            await this.app.api.put('/users/profile', { avatar: null });

            if (this.user) {
                this.user.avatar = null;
                const currentUser = this.app.auth.getUser();
                this.app.state.set('user', { ...currentUser, avatar: null });
            }

            Toast.success(this.__('profile.toast.avatarRemoved'));
            await this.loadProfile();
        } catch (error) {
            Toast.error(this.__('messages.updateFailed'));
        }
    }

    async updateProfile() {
        const firstName = document.getElementById('first-name').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();

        if (!firstName || !lastName || !email) {
            Toast.error(this.__('validation.required'));
            return;
        }

        try {
            const response = await this.app.api.put('/users/profile', {
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone
            });

            if (response.success) {
                Toast.success(this.__('profile.toast.updated'));

                // Update local user state
                if (this.app.auth) {
                    const currentUser = this.app.auth.getUser();
                    this.app.state.set('user', {
                        ...currentUser,
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        phone: phone
                    });
                }

                // Reload profile to reflect changes
                await this.loadProfile();
            }
        } catch (error) {
            Logger.error('Profile update error:', error);
            Toast.error(error.message || this.__('messages.updateFailed'));
        }
    }

    async changePassword() {
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            Toast.error(this.__('validation.required'));
            return;
        }

        if (newPassword !== confirmPassword) {
            Toast.error(this.__('validation.passwordMismatch'));
            return;
        }

        if (newPassword.length < 8) {
            Toast.error(this.__('validation.minLength', { min: 8 }));
            return;
        }

        try {
            const response = await this.app.api.post('/auth/change-password', {
                current_password: currentPassword,
                new_password: newPassword
            });

            if (response.success) {
                Toast.success(this.__('profile.toast.passwordChanged'));

                // Clear password fields
                document.getElementById('current-password').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-password').value = '';
            }
        } catch (error) {
            Logger.error('Password change error:', error);
            Toast.error(error.message || this.__('messages.updateFailed'));
        }
    }

    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}

export default ProfilePage;
