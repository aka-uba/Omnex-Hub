/**
 * Notification Settings Page Component
 * Allows users to configure their notification preferences
 *
 * @package OmnexDisplayHub
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';

export class NotificationSettingsPage {
    constructor(app) {
        this.app = app;
        this.settings = {
            enabled: true,
            sound: true,
            desktop: false,
            types: {
                info: { web: true, push: false, email: false },
                success: { web: true, push: false, email: false },
                warning: { web: true, push: true, email: false },
                error: { web: true, push: true, email: true },
                system: { web: true, push: false, email: false }
            },
            email_digest: 'never',
            dnd_enabled: false,
            dnd_start: '22:00',
            dnd_end: '08:00',
            device_notification_retention_days: 30
        };
        this.isSaving = false;
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
        await this.app.i18n.loadPageTranslations('notifications');
    }

    isSuperAdmin() {
        const user = this.app.state.get('user');
        return String(user?.role || '').toLowerCase() === 'superadmin';
    }

    /**
     * Get notification type display info
     */
    getTypeInfo(type) {
        const types = {
            info: {
                name: this.__('types.info'),
                icon: 'info-circle',
                color: '#228be6'
            },
            success: {
                name: this.__('types.success'),
                icon: 'circle-check',
                color: '#40c057'
            },
            warning: {
                name: this.__('types.warning'),
                icon: 'alert-triangle',
                color: '#fab005'
            },
            error: {
                name: this.__('types.error'),
                icon: 'alert-circle',
                color: '#fa5252'
            },
            system: {
                name: this.__('types.system'),
                icon: 'settings',
                color: '#7950f2'
            }
        };
        return types[type] || { name: type, icon: 'bell', color: '#868e96' };
    }

    /**
     * Render page
     */
    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.dashboard')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/notifications">${this.__('list.breadcrumb')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('settings.breadcrumb')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon yellow">
                            <i class="ti ti-bell-cog"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('settings.title')}</h1>
                            <p class="page-subtitle">${this.__('settings.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button class="btn btn-primary" id="btn-save-settings">
                            <i class="ti ti-check"></i>
                            <span>${this.__('actions.save')}</span>
                        </button>
                    </div>
                </div>
            </div>

            <form id="notification-settings-form">
                <!-- General Settings Card -->
                <div class="card mb-6">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="ti ti-settings mr-2"></i>
                            ${this.__('settings.generalTitle')}
                        </h3>
                    </div>
                    <div class="card-body">
                        <div class="notification-settings-list">
                            <!-- Master Switch -->
                            <div class="notification-setting-item">
                                <div class="notification-setting-info">
                                    <div class="notification-setting-icon blue">
                                        <i class="ti ti-bell"></i>
                                    </div>
                                    <div>
                                        <h4>${this.__('settings.enableNotifications')}</h4>
                                        <p>${this.__('settings.enableNotificationsDesc')}</p>
                                    </div>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="setting-enabled">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>

                            <!-- Sound Notifications -->
                            <div class="notification-setting-item">
                                <div class="notification-setting-info">
                                    <div class="notification-setting-icon indigo">
                                        <i class="ti ti-volume"></i>
                                    </div>
                                    <div>
                                        <h4>${this.__('settings.soundEnabled')}</h4>
                                        <p>${this.__('settings.soundEnabledDesc')}</p>
                                    </div>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="setting-sound">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>

                            <!-- Desktop Notifications -->
                            <div class="notification-setting-item">
                                <div class="notification-setting-info">
                                    <div class="notification-setting-icon green">
                                        <i class="ti ti-device-desktop"></i>
                                    </div>
                                    <div>
                                        <h4>${this.__('settings.desktopEnabled')}</h4>
                                        <p>${this.__('settings.desktopEnabledDesc')}</p>
                                    </div>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="setting-desktop">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Notification Types Card -->
                <div class="card mb-6">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="ti ti-category mr-2"></i>
                            ${this.__('settings.typesTitle')}
                        </h3>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>${this.__('settings.typeColumn')}</th>
                                        <th class="text-center" style="width: 120px;">${this.__('settings.webPanel')}</th>
                                        <th class="text-center" style="width: 120px;">${this.__('settings.pushNotification')}</th>
                                        <th class="text-center" style="width: 120px;">${this.__('settings.email')}</th>
                                    </tr>
                                </thead>
                                <tbody id="notification-types-table">
                                    ${this.renderNotificationTypesRows()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Email Digest Card -->
                <div class="card mb-6">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="ti ti-mail mr-2"></i>
                            ${this.__('settings.emailDigest')}
                        </h3>
                    </div>
                    <div class="card-body">
                        <p class="text-muted mb-4">${this.__('settings.emailDigestDesc')}</p>

                        <div class="space-y-3">
                            <div class="form-check">
                                <input type="radio" class="form-check-input" name="email_digest" id="digest-never" value="never">
                                <label class="form-check-label" for="digest-never">
                                    <span class="font-medium">${this.__('settings.digestNever')}</span>
                                    <span class="text-muted block text-sm">${this.__('settings.digestNeverDesc')}</span>
                                </label>
                            </div>

                            <div class="form-check">
                                <input type="radio" class="form-check-input" name="email_digest" id="digest-daily" value="daily">
                                <label class="form-check-label" for="digest-daily">
                                    <span class="font-medium">${this.__('settings.digestDaily')}</span>
                                    <span class="text-muted block text-sm">${this.__('settings.digestDailyDesc')}</span>
                                </label>
                            </div>

                            <div class="form-check">
                                <input type="radio" class="form-check-input" name="email_digest" id="digest-weekly" value="weekly">
                                <label class="form-check-label" for="digest-weekly">
                                    <span class="font-medium">${this.__('settings.digestWeekly')}</span>
                                    <span class="text-muted block text-sm">${this.__('settings.digestWeeklyDesc')}</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Do Not Disturb Card -->
                <div class="card mb-6">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="ti ti-moon mr-2"></i>
                            ${this.__('settings.dndTitle')}
                        </h3>
                    </div>
                    <div class="card-body">
                        <div class="notification-setting-item mb-4">
                            <div class="notification-setting-info">
                                <div class="notification-setting-icon amber">
                                    <i class="ti ti-clock"></i>
                                </div>
                                <div>
                                    <h4>${this.__('settings.dndEnabled')}</h4>
                                    <p>${this.__('settings.dndEnabledDesc')}</p>
                                </div>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="setting-dnd-enabled">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>

                        <div id="dnd-time-settings" class="dnd-time-settings" style="display: none;">
                            <div class="form-row">
                                <div class="form-col">
                                    <div class="form-group">
                                        <label class="form-label">${this.__('settings.dndStart')}</label>
                                        <input type="time" class="form-control" id="setting-dnd-start" value="22:00">
                                    </div>
                                </div>
                                <div class="form-col">
                                    <div class="form-group">
                                        <label class="form-label">${this.__('settings.dndEnd')}</label>
                                        <input type="time" class="form-control" id="setting-dnd-end" value="08:00">
                                    </div>
                                </div>
                            </div>
                            <p class="text-muted text-sm mt-2">
                                <i class="ti ti-info-circle mr-1"></i>
                                ${this.__('settings.dndInfo')}
                            </p>
                        </div>
                    </div>
                </div>

                ${this.isSuperAdmin() ? `
                <div class="card mb-6">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="ti ti-device-desktop mr-2"></i>
                            ${this.__('settings.deviceNotificationsTitle')}
                        </h3>
                    </div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label" for="setting-device-retention-days">
                                ${this.__('settings.deviceRetentionDaysLabel')}
                            </label>
                            <input type="number"
                                   class="form-control"
                                   id="setting-device-retention-days"
                                   min="1"
                                   max="365"
                                   step="1"
                                   value="${Number(this.settings.device_notification_retention_days || 30)}">
                            <p class="text-muted text-sm mt-2">${this.__('settings.deviceRetentionDaysHelp')}</p>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- Save Button (Mobile) -->
                <div class="settings-footer">
                    <button type="submit" class="btn btn-primary btn-lg">
                        <i class="ti ti-check"></i>
                        ${this.__('settings.saveChanges')}
                    </button>
                </div>
            </form>
        `;
    }

    /**
     * Render notification types table rows
     */
    renderNotificationTypesRows() {
        const types = ['info', 'success', 'warning', 'error', 'system'];

        return types.map(type => {
            const info = this.getTypeInfo(type);
            const typeSettings = this.settings.types[type] || { web: true, push: false, email: false };

            return `
                <tr>
                    <td>
                        <div class="flex items-center gap-3">
                            <div class="notification-type-icon" style="background: ${info.color}20; color: ${info.color}">
                                <i class="ti ti-${info.icon}"></i>
                            </div>
                            <span class="font-medium">${info.name}</span>
                        </div>
                    </td>
                    <td class="text-center" data-label="${this.__('settings.webPanel')}">
                        <label class="toggle-switch toggle-switch-sm">
                            <input type="checkbox" id="type-${type}-web" data-type="${type}" data-channel="web" ${typeSettings.web ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="text-center" data-label="${this.__('settings.pushNotification')}">
                        <label class="toggle-switch toggle-switch-sm">
                            <input type="checkbox" id="type-${type}-push" data-type="${type}" data-channel="push" ${typeSettings.push ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                    <td class="text-center" data-label="${this.__('settings.email')}">
                        <label class="toggle-switch toggle-switch-sm">
                            <input type="checkbox" id="type-${type}-email" data-type="${type}" data-channel="email" ${typeSettings.email ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Initialize page
     */
    async init() {
        await this.loadSettings();
        this.bindEvents();
    }

    /**
     * Load settings from API
     */
    async loadSettings() {
        try {
            const response = await this.app.api.get('/notifications/settings');
            if (response.data) {
                this.settings = { ...this.settings, ...response.data };
            }

            // Also save to localStorage for NotificationManager to access
            localStorage.setItem('notification_settings', JSON.stringify(this.settings));

            this.populateForm();
            Logger.debug('Notification settings loaded:', this.settings);
        } catch (error) {
            Logger.error('Error loading notification settings:', error);
            // Use default settings, populate form
            this.populateForm();
        }
    }

    /**
     * Populate form with current settings
     */
    populateForm() {
        // General settings
        const enabledEl = document.getElementById('setting-enabled');
        const soundEl = document.getElementById('setting-sound');
        const desktopEl = document.getElementById('setting-desktop');

        if (enabledEl) enabledEl.checked = this.settings.enabled;
        if (soundEl) soundEl.checked = this.settings.sound;
        if (desktopEl) desktopEl.checked = this.settings.desktop;

        // Notification types
        Object.keys(this.settings.types).forEach(type => {
            const typeSettings = this.settings.types[type];
            ['web', 'push', 'email'].forEach(channel => {
                const el = document.getElementById(`type-${type}-${channel}`);
                if (el) el.checked = typeSettings[channel];
            });
        });

        // Email digest
        const digestValue = this.settings.email_digest || 'never';
        const digestEl = document.querySelector(`input[name="email_digest"][value="${digestValue}"]`);
        if (digestEl) digestEl.checked = true;

        // Do Not Disturb
        const dndEnabledEl = document.getElementById('setting-dnd-enabled');
        const dndStartEl = document.getElementById('setting-dnd-start');
        const dndEndEl = document.getElementById('setting-dnd-end');
        const dndTimeSettings = document.getElementById('dnd-time-settings');

        if (dndEnabledEl) dndEnabledEl.checked = this.settings.dnd_enabled;
        if (dndStartEl) dndStartEl.value = this.settings.dnd_start || '22:00';
        if (dndEndEl) dndEndEl.value = this.settings.dnd_end || '08:00';

        const retentionEl = document.getElementById('setting-device-retention-days');
        if (retentionEl) {
            retentionEl.value = String(
                Math.max(1, Math.min(365, Number(this.settings.device_notification_retention_days || 30)))
            );
        }

        // Show/hide DND time settings
        if (dndTimeSettings) {
            dndTimeSettings.style.display = this.settings.dnd_enabled ? 'block' : 'none';
        }

        // Keep disabled-state in sync with master switch after API load
        this.toggleAllSettings(this.settings.enabled);
    }

    /**
     * Bind events
     */
    bindEvents() {
        // Form submission
        document.getElementById('notification-settings-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

        // Header save button
        document.getElementById('btn-save-settings')?.addEventListener('click', () => {
            this.saveSettings();
        });

        // Desktop notification toggle - request permission
        document.getElementById('setting-desktop')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.requestDesktopPermission();
            }
        });

        // DND toggle - show/hide time settings
        document.getElementById('setting-dnd-enabled')?.addEventListener('change', (e) => {
            const dndTimeSettings = document.getElementById('dnd-time-settings');
            if (dndTimeSettings) {
                dndTimeSettings.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // Master switch - disable other settings when off
        document.getElementById('setting-enabled')?.addEventListener('change', (e) => {
            this.toggleAllSettings(e.target.checked);
        });
    }

    /**
     * Toggle all settings based on master switch
     */
    toggleAllSettings(enabled) {
        const settingsContainer = document.getElementById('notification-settings-form');
        if (!settingsContainer) return;

        // Get all inputs except the master switch
        const inputs = settingsContainer.querySelectorAll('input:not(#setting-enabled):not(#setting-device-retention-days)');
        inputs.forEach(input => {
            input.disabled = !enabled;
            const toggle = input.closest('.toggle-switch');
            if (toggle) {
                toggle.style.opacity = enabled ? '1' : '0.5';
            }
        });
    }

    /**
     * Request desktop notification permission
     */
    async requestDesktopPermission() {
        if (!('Notification' in window)) {
            Toast.warning(this.__('settings.desktopNotSupported'));
            document.getElementById('setting-desktop').checked = false;
            return;
        }

        if (Notification.permission === 'granted') {
            Toast.success(this.__('settings.desktopAlreadyEnabled'));
            return;
        }

        if (Notification.permission === 'denied') {
            Toast.error(this.__('settings.desktopBlocked'));
            document.getElementById('setting-desktop').checked = false;
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                Toast.success(this.__('settings.desktopEnabled'));
                // Show test notification
                new Notification('Omnex Display Hub', {
                    body: this.__('settings.desktopTestMessage'),
                    icon: window.OmnexConfig?.basePath + '/branding/favicon.png'
                });
            } else {
                Toast.warning(this.__('settings.desktopPermissionDenied'));
                document.getElementById('setting-desktop').checked = false;
            }
        } catch (error) {
            Logger.error('Error requesting notification permission:', error);
            Toast.error(this.__('settings.desktopPermissionError') + ': ' + (error.message || ''));
            document.getElementById('setting-desktop').checked = false;
        }
    }

    /**
     * Collect settings from form
     */
    collectSettings() {
        const settings = {
            enabled: document.getElementById('setting-enabled')?.checked ?? true,
            sound: document.getElementById('setting-sound')?.checked ?? true,
            desktop: document.getElementById('setting-desktop')?.checked ?? false,
            types: {},
            email_digest: document.querySelector('input[name="email_digest"]:checked')?.value || 'never',
            dnd_enabled: document.getElementById('setting-dnd-enabled')?.checked ?? false,
            dnd_start: document.getElementById('setting-dnd-start')?.value || '22:00',
            dnd_end: document.getElementById('setting-dnd-end')?.value || '08:00'
        };

        if (this.isSuperAdmin()) {
            const retentionInput = document.getElementById('setting-device-retention-days');
            const retentionDays = Number(retentionInput?.value || this.settings.device_notification_retention_days || 30);
            settings.device_notification_retention_days = Math.max(1, Math.min(365, Number.isFinite(retentionDays) ? retentionDays : 30));
        }

        // Collect type settings
        const types = ['info', 'success', 'warning', 'error', 'system'];
        types.forEach(type => {
            settings.types[type] = {
                web: document.getElementById(`type-${type}-web`)?.checked ?? true,
                push: document.getElementById(`type-${type}-push`)?.checked ?? false,
                email: document.getElementById(`type-${type}-email`)?.checked ?? false
            };
        });

        return settings;
    }

    /**
     * Save settings to API
     */
    async saveSettings() {
        if (this.isSaving) return;

        const btn = document.getElementById('btn-save-settings');
        const originalHtml = btn?.innerHTML;

        try {
            this.isSaving = true;

            if (btn) {
                btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('settings.saving')}`;
                btn.disabled = true;
            }

            const settings = this.collectSettings();
            Logger.debug('Saving notification settings:', settings);

            await this.app.api.put('/notifications/settings', settings);

            this.settings = settings;

            // Also save to localStorage for NotificationManager to access
            localStorage.setItem('notification_settings', JSON.stringify(settings));

            Toast.success(this.__('settings.saveSuccess'));

        } catch (error) {
            Logger.error('Error saving notification settings:', error);
            Toast.error(this.__('settings.saveError') + ': ' + (error.message || ''));
        } finally {
            this.isSaving = false;
            if (btn) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}

export default NotificationSettingsPage;
