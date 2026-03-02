/**
 * Device Groups Page Component
 * Manage device groups for batch operations
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class DeviceGroupsPage {
    constructor(app) {
        this.app = app;
        this.groups = [];
        this.devices = [];
        this.selectedGroup = null;
    }

    /**
     * Translation helper - uses page translations
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('devices');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.dashboard')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/devices">${this.__('title')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('groups.groupsCard')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon cyan">
                            <i class="ti ti-folders"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('groups.title')}</h1>
                            <p class="page-subtitle">${this.__('groups.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="create-group-btn" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.__('groups.addGroup')}
                        </button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Groups List -->
                <div class="lg:col-span-1">
                    <div class="card card-table">
                        <div class="card-header">
                            <h3 class="card-title">${this.__('groups.groupsCard')}</h3>
                            <span class="badge badge-secondary" id="group-count">0</span>
                        </div>
                        <div class="card-body">
                            <div id="groups-container">
                                ${this.renderLoading()}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Group Details / Devices -->
                <div class="lg:col-span-2">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title" id="group-title">${this.__('groups.selectGroup')}</h3>
                            <div class="flex gap-2" id="group-actions" style="display:none;">
                                <button id="bulk-action-btn" class="btn btn-sm btn-outline">
                                    <i class="ti ti-send"></i>
                                    ${this.__('groups.bulkSend')}
                                </button>
                                <button id="edit-group-btn" class="btn btn-sm btn-ghost">
                                    <i class="ti ti-edit"></i>
                                </button>
                                <button id="delete-group-btn" class="btn btn-sm btn-ghost text-red-500">
                                    <i class="ti ti-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div id="group-details-container">
                                <div class="text-center py-12 text-gray-500">
                                    <i class="ti ti-devices text-4xl mb-2"></i>
                                    <p>${this.__('groups.selectGroupDesc')}</p>
                                </div>
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

    renderGroups() {
        if (!this.groups.length) {
            return `
                <div class="text-center py-8 text-gray-500">
                    <i class="ti ti-folder text-3xl mb-2"></i>
                    <p>${this.__('groups.empty')}</p>
                </div>
            `;
        }

        return `
            <div class="groups-list">
                ${this.groups.map(group => `
                    <div class="group-item ${this.selectedGroup?.id === group.id ? 'selected' : ''}"
                        onclick="window.deviceGroupsPage?.selectGroup('${group.id}')">
                        <div class="group-color" style="background:${group.color || '#228be6'}"></div>
                        <div class="group-info">
                            <h4>${escapeHTML(group.name)}</h4>
                            <p>${this.__('groups.deviceCount', { count: group.device_count || 0 })}</p>
                        </div>
                        <i class="ti ti-chevron-right text-gray-400"></i>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderGroupDetails() {
        if (!this.selectedGroup) {
            return `
                <div class="text-center py-12 text-gray-500">
                    <i class="ti ti-devices text-4xl mb-2"></i>
                    <p>${this.__('groups.selectGroupDesc')}</p>
                </div>
            `;
        }

        const groupDevices = this.devices.filter(d =>
            this.selectedGroup.device_ids?.includes(d.id)
        );

        return `
            <!-- Group Info -->
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-lg flex items-center justify-center"
                        style="background:${this.selectedGroup.color || '#228be6'}20;">
                        <i class="ti ti-folder text-xl" style="color:${this.selectedGroup.color || '#228be6'}"></i>
                    </div>
                    <div class="flex-1">
                        <h3 class="font-medium">${escapeHTML(this.selectedGroup.name)}</h3>
                        <p class="text-sm text-gray-500">${escapeHTML(this.selectedGroup.description) || this.__('groups.noDescription')}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-bold">${groupDevices.length}</p>
                        <p class="text-sm text-gray-500">${this.__('groups.device')}</p>
                    </div>
                </div>
            </div>

            <!-- Device Management -->
            <div class="flex items-center justify-between mb-4">
                <h4 class="font-medium">${this.__('groups.devicesInGroup')}</h4>
                <button id="add-devices-btn" class="btn btn-sm btn-outline">
                    <i class="ti ti-plus"></i>
                    ${this.__('groups.addDevice')}
                </button>
            </div>

            ${groupDevices.length === 0 ? `
                <div class="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                    <i class="ti ti-device-desktop text-3xl mb-2"></i>
                    <p>${this.__('groups.noDevices')}</p>
                    <button id="add-first-device-btn" class="btn btn-sm btn-primary mt-4">
                        <i class="ti ti-plus"></i>
                        ${this.__('groups.addDevice')}
                    </button>
                </div>
            ` : `
                <div class="device-grid">
                    ${groupDevices.map(device => `
                        <div class="device-card">
                            <div class="device-card-header">
                                <span class="status-dot ${device.status === 'online' ? 'status-online' : 'status-offline'}"></span>
                                <button onclick="window.deviceGroupsPage?.removeDevice('${device.id}')"
                                    class="btn btn-sm btn-ghost text-gray-400 hover:text-red-500">
                                    <i class="ti ti-x"></i>
                                </button>
                            </div>
                            <div class="device-card-body">
                                <i class="ti ti-${device.type === 'esl' ? 'tag' : 'device-tv'} text-2xl text-gray-400"></i>
                                <h5>${escapeHTML(device.name)}</h5>
                                <p class="text-xs text-gray-500">${escapeHTML(device.location) || '-'}</p>
                            </div>
                            <div class="device-card-footer">
                                <span class="badge badge-${device.type === 'esl' ? 'primary' : 'info'} badge-sm">
                                    ${device.type === 'esl' ? 'ESL' : 'TV'}
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        `;
    }

    renderDeviceSelector() {
        const groupDeviceIds = this.selectedGroup?.device_ids || [];
        const availableDevices = this.devices.filter(d => !groupDeviceIds.includes(d.id));

        if (!availableDevices.length) {
            return `
                <div class="text-center py-8 text-gray-500">
                    <p>${this.__('groups.noDevicesAvailable')}</p>
                </div>
            `;
        }

        return `
            <div class="device-selector-list">
                ${availableDevices.map(device => `
                    <label class="device-selector-item">
                        <input type="checkbox" value="${device.id}" class="device-checkbox">
                        <div class="flex items-center gap-3 flex-1">
                            <span class="status-dot ${device.status === 'online' ? 'status-online' : 'status-offline'}"></span>
                            <div>
                                <h5>${escapeHTML(device.name)}</h5>
                                <p class="text-xs text-gray-500">${escapeHTML(device.location) || '-'}</p>
                            </div>
                        </div>
                        <span class="badge badge-${device.type === 'esl' ? 'primary' : 'info'} badge-sm">
                            ${device.type === 'esl' ? 'ESL' : 'TV'}
                        </span>
                    </label>
                `).join('')}
            </div>
        `;
    }

    async init() {
        window.deviceGroupsPage = this;
        await Promise.all([
            this.loadGroups(),
            this.loadDevices()
        ]);
        this.bindEvents();
        this.addStyles();
    }

    async loadGroups() {
        try {
            const response = await this.app.api.get('/device-groups');
            this.groups = response.data || [];
            document.getElementById('groups-container').innerHTML = this.renderGroups();
            document.getElementById('group-count').textContent = this.groups.length;
        } catch (error) {
            Logger.error('Groups load error:', error);
            this.groups = [];
            document.getElementById('groups-container').innerHTML = this.renderGroups();
        }
    }

    async loadDevices() {
        try {
            const response = await this.app.api.get('/devices');
            this.devices = response.data || [];
        } catch (error) {
            Logger.error('Devices load error:', error);
            this.devices = [];
        }
    }

    bindEvents() {
        document.getElementById('create-group-btn')?.addEventListener('click', () => {
            this.showGroupModal();
        });

        document.getElementById('edit-group-btn')?.addEventListener('click', () => {
            if (this.selectedGroup) {
                this.showGroupModal(this.selectedGroup);
            }
        });

        document.getElementById('delete-group-btn')?.addEventListener('click', () => {
            this.deleteGroup();
        });

        document.getElementById('bulk-action-btn')?.addEventListener('click', () => {
            this.showBulkModal();
        });
    }

    selectGroup(groupId) {
        this.selectedGroup = this.groups.find(g => g.id === groupId);
        document.getElementById('groups-container').innerHTML = this.renderGroups();
        document.getElementById('group-details-container').innerHTML = this.renderGroupDetails();
        document.getElementById('group-title').textContent = this.selectedGroup?.name || this.__('groups.selectGroup');
        document.getElementById('group-actions').style.display = this.selectedGroup ? 'flex' : 'none';

        // Rebind events for new content
        document.getElementById('add-devices-btn')?.addEventListener('click', () => {
            this.showAddDevicesModal();
        });
        document.getElementById('add-first-device-btn')?.addEventListener('click', () => {
            this.showAddDevicesModal();
        });
    }

    showGroupModal(group = null) {
        const isEdit = !!group;
        const title = isEdit ? this.__('groups.editGroup') : this.__('groups.addGroup');

        const formContent = `
            <form id="group-form" class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${this.__('groups.form.fields.name')} *</label>
                    <input type="text" id="group-name" class="form-input"
                        placeholder="${this.__('groups.form.placeholders.name')}" value="${escapeHTML(group?.name || '')}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('groups.form.fields.description')}</label>
                    <textarea id="group-description" class="form-input" rows="2"
                        placeholder="${this.__('groups.form.placeholders.description')}">${escapeHTML(group?.description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('groups.form.fields.color')}</label>
                    <div class="color-picker">
                        <label class="color-option">
                            <input type="radio" name="color" value="#228be6" ${(!group?.color || group?.color === '#228be6') ? 'checked' : ''}>
                            <span style="background:#228be6"></span>
                        </label>
                        <label class="color-option">
                            <input type="radio" name="color" value="#40c057" ${group?.color === '#40c057' ? 'checked' : ''}>
                            <span style="background:#40c057"></span>
                        </label>
                        <label class="color-option">
                            <input type="radio" name="color" value="#fab005" ${group?.color === '#fab005' ? 'checked' : ''}>
                            <span style="background:#fab005"></span>
                        </label>
                        <label class="color-option">
                            <input type="radio" name="color" value="#fa5252" ${group?.color === '#fa5252' ? 'checked' : ''}>
                            <span style="background:#fa5252"></span>
                        </label>
                        <label class="color-option">
                            <input type="radio" name="color" value="#7950f2" ${group?.color === '#7950f2' ? 'checked' : ''}>
                            <span style="background:#7950f2"></span>
                        </label>
                        <label class="color-option">
                            <input type="radio" name="color" value="#868e96" ${group?.color === '#868e96' ? 'checked' : ''}>
                            <span style="background:#868e96"></span>
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('groups.form.fields.deviceType')}</label>
                    <select id="group-device-type" class="form-select">
                        <option value="">${this.__('groups.deviceTypes.all')}</option>
                        <option value="esl" ${group?.device_type === 'esl' ? 'selected' : ''}>${this.__('groups.deviceTypes.esl')}</option>
                        <option value="tv" ${group?.device_type === 'tv' ? 'selected' : ''}>${this.__('groups.deviceTypes.tv')}</option>
                    </select>
                </div>
                <input type="hidden" id="group-id" value="${group?.id || ''}">
            </form>
        `;

        Modal.show({
            title: title,
            icon: isEdit ? 'ti-folder-cog' : 'ti-folder-plus',
            content: formContent,
            size: 'md',
            confirmText: this.__('modal.save'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this.saveGroup();
            }
        });
    }

    async saveGroup() {
        const id = document.getElementById('group-id')?.value;
        const name = document.getElementById('group-name')?.value.trim();
        const description = document.getElementById('group-description')?.value.trim();
        const color = document.querySelector('input[name="color"]:checked')?.value || '#228be6';
        const deviceType = document.getElementById('group-device-type')?.value;

        if (!name) {
            Toast.error(this.__('groups.validation.nameRequired'));
            throw new Error('Validation failed');
        }

        const data = {
            name,
            description,
            color,
            device_type: deviceType || null
        };

        try {
            if (id) {
                await this.app.api.put(`/device-groups/${id}`, data);
                Toast.success(this.__('groups.toast.updated'));
            } else {
                await this.app.api.post('/device-groups', data);
                Toast.success(this.__('groups.toast.created'));
            }

            await this.loadGroups();
            if (this.selectedGroup) {
                this.selectGroup(this.selectedGroup.id);
            }
        } catch (error) {
            Toast.error(error.message || this.__('toast.saveFailed'));
            throw error;
        }
    }

    deleteGroup() {
        if (!this.selectedGroup) return;

        Modal.confirm({
            title: this.__('groups.deleteGroup'),
            message: this.__('groups.deleteConfirm'),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/device-groups/${this.selectedGroup.id}`);
                    Toast.success(this.__('groups.toast.deleted'));
                    this.selectedGroup = null;
                    await this.loadGroups();
                    document.getElementById('group-details-container').innerHTML = this.renderGroupDetails();
                    document.getElementById('group-title').textContent = this.__('groups.selectGroup');
                    document.getElementById('group-actions').style.display = 'none';
                } catch (error) {
                    Toast.error(this.__('toast.deleteFailed'));
                    throw error;
                }
            }
        });
    }

    showAddDevicesModal() {
        if (!this.selectedGroup) return;

        const content = `
            <div style="max-height: 400px; overflow-y: auto;">
                ${this.renderDeviceSelector()}
            </div>
        `;

        const modal = Modal.show({
            title: this.__('groups.addDevice'),
            icon: 'ti-device-desktop-plus',
            content: content,
            size: 'md',
            confirmText: this.__('modal.add'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                const checkboxes = modal.element.querySelectorAll('.device-checkbox:checked');
                const deviceIds = Array.from(checkboxes).map(cb => cb.value);

                if (deviceIds.length === 0) {
                    Toast.error(this.__('groups.selectDevice'));
                    throw new Error('Validation failed');
                }

                try {
                    const currentDeviceIds = this.selectedGroup.device_ids || [];
                    const newDeviceIds = [...new Set([...currentDeviceIds, ...deviceIds])];

                    await this.app.api.put(`/device-groups/${this.selectedGroup.id}`, {
                        device_ids: newDeviceIds
                    });

                    Toast.success(this.__('groups.devicesAdded', { count: deviceIds.length }));
                    await this.loadGroups();
                    this.selectedGroup = this.groups.find(g => g.id === this.selectedGroup.id);
                    document.getElementById('group-details-container').innerHTML = this.renderGroupDetails();
                    this.bindDetailsEvents();
                } catch (error) {
                    Toast.error(this.__('groups.toast.deviceAddFailed'));
                    throw error;
                }
            }
        });
    }

    bindDetailsEvents() {
        document.getElementById('add-devices-btn')?.addEventListener('click', () => {
            this.showAddDevicesModal();
        });
        document.getElementById('add-first-device-btn')?.addEventListener('click', () => {
            this.showAddDevicesModal();
        });
    }

    async removeDevice(deviceId) {
        if (!this.selectedGroup) return;

        Modal.confirm({
            title: this.__('groups.removeDevice'),
            message: this.__('groups.removeConfirm'),
            type: 'warning',
            confirmText: this.__('modal.confirm'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    const newDeviceIds = (this.selectedGroup.device_ids || []).filter(id => id !== deviceId);

                    await this.app.api.put(`/device-groups/${this.selectedGroup.id}`, {
                        device_ids: newDeviceIds
                    });

                    Toast.success(this.__('groups.toast.deviceRemoved'));
                    await this.loadGroups();
                    this.selectedGroup = this.groups.find(g => g.id === this.selectedGroup.id);
                    document.getElementById('group-details-container').innerHTML = this.renderGroupDetails();
                    this.bindDetailsEvents();
                } catch (error) {
                    Toast.error(this.__('groups.toast.deviceRemoveFailed'));
                    throw error;
                }
            }
        });
    }

    async showBulkModal() {
        if (!this.selectedGroup) return;

        // Load templates and playlists first
        let templates = [];
        let playlists = [];

        try {
            const [templatesRes, playlistsRes] = await Promise.all([
                this.app.api.get('/templates'),
                this.app.api.get('/playlists')
            ]);
            templates = templatesRes.data || [];
            playlists = playlistsRes.data || [];
        } catch (error) {
            Logger.error('Load error:', error);
        }

        const templateOptions = templates.map(t => `<option value="${t.id}">${escapeHTML(t.name)}</option>`).join('');
        const playlistOptions = playlists.map(p => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('');

        const formContent = `
            <div class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${this.__('groups.bulkAction.actionType')}</label>
                    <select id="bulk-action-type" class="form-select">
                        <option value="template">${this.__('groups.bulkAction.actions.sendTemplate')}</option>
                        <option value="playlist">${this.__('groups.bulkAction.actions.sendPlaylist')}</option>
                        <option value="refresh">${this.__('groups.bulkAction.actions.refresh')}</option>
                        <option value="restart">${this.__('groups.bulkAction.actions.restart')}</option>
                    </select>
                </div>
                <div class="form-group" id="template-select-group">
                    <label class="form-label">${this.__('groups.bulkAction.template')}</label>
                    <select id="bulk-template" class="form-select">
                        <option value="">${this.__('groups.bulkAction.selectTemplate')}</option>
                        ${templateOptions}
                    </select>
                </div>
                <div class="form-group" id="playlist-select-group" style="display:none;">
                    <label class="form-label">${this.__('groups.bulkAction.playlist')}</label>
                    <select id="bulk-playlist" class="form-select">
                        <option value="">${this.__('groups.bulkAction.selectPlaylist')}</option>
                        ${playlistOptions}
                    </select>
                </div>
                <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div class="flex gap-3">
                        <i class="ti ti-alert-triangle text-yellow-600"></i>
                        <div>
                            <p class="font-medium text-yellow-800 dark:text-yellow-200">${this.__('status.warning')}</p>
                            <p class="text-sm text-yellow-700 dark:text-yellow-300">
                                ${this.__('groups.bulkAction.warning')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modal = Modal.show({
            title: this.__('groups.bulkAction.title'),
            icon: 'ti-send',
            content: formContent,
            size: 'md',
            confirmText: this.__('groups.bulkAction.send'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this.executeBulkAction();
            }
        });

        // Handle action type change
        setTimeout(() => {
            modal.element.querySelector('#bulk-action-type')?.addEventListener('change', (e) => {
                const type = e.target.value;
                modal.element.querySelector('#template-select-group').style.display =
                    type === 'template' ? 'block' : 'none';
                modal.element.querySelector('#playlist-select-group').style.display =
                    type === 'playlist' ? 'block' : 'none';
            });
        }, 100);
    }

    async executeBulkAction() {
        const actionType = document.getElementById('bulk-action-type')?.value;
        const templateId = document.getElementById('bulk-template')?.value;
        const playlistId = document.getElementById('bulk-playlist')?.value;

        if (actionType === 'template' && !templateId) {
            Toast.error(this.__('groups.validation.selectTemplate'));
            throw new Error('Validation failed');
        }

        if (actionType === 'playlist' && !playlistId) {
            Toast.error(this.__('groups.validation.selectPlaylist'));
            throw new Error('Validation failed');
        }

        try {
            await this.app.api.post(`/device-groups/${this.selectedGroup.id}/bulk-action`, {
                action: actionType,
                template_id: templateId || null,
                playlist_id: playlistId || null
            });

            Toast.success(this.__('groups.toast.bulkSent'));
        } catch (error) {
            Toast.error(this.__('toast.saveFailed'));
            throw error;
        }
    }

    addStyles() {
        if (document.getElementById('device-groups-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'device-groups-styles';
        styles.textContent = `
            .groups-list {
                display: flex;
                flex-direction: column;
            }

            .group-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                transition: background 0.2s;
            }

            .group-item:hover {
                background: var(--bg-secondary);
            }

            .group-item.selected {
                background: rgba(34, 139, 230, 0.1);
            }

            .group-color {
                width: 8px;
                height: 40px;
                border-radius: 4px;
            }

            .group-info {
                flex: 1;
            }

            .group-info h4 {
                font-weight: 500;
                margin: 0;
            }

            .group-info p {
                font-size: 0.75rem;
                color: var(--text-muted);
                margin: 0;
            }

            .color-picker {
                display: flex;
                gap: 8px;
            }

            .color-option {
                cursor: pointer;
            }

            .color-option input {
                display: none;
            }

            .color-option span {
                display: block;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 3px solid transparent;
                transition: border-color 0.2s;
            }

            .color-option input:checked + span {
                border-color: var(--text-primary);
            }

            .device-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 12px;
            }

            .device-card {
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
                overflow: hidden;
                transition: all 0.2s;
            }

            .device-card:hover {
                border-color: var(--color-primary);
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }

            .device-card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px;
            }

            .device-card-body {
                padding: 16px;
                text-align: center;
            }

            .device-card-body h5 {
                font-size: 0.875rem;
                font-weight: 500;
                margin: 8px 0 4px;
            }

            .device-card-footer {
                padding: 8px;
                background: var(--bg-secondary);
                text-align: center;
            }

            .device-selector-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .device-selector-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
                cursor: pointer;
                transition: all 0.2s;
            }

            .device-selector-item:hover {
                border-color: var(--color-primary);
            }

            .device-selector-item:has(input:checked) {
                background: rgba(34, 139, 230, 0.1);
                border-color: var(--color-primary);
            }

            .device-checkbox {
                width: 18px;
                height: 18px;
            }
        `;
        document.head.appendChild(styles);
    }

    destroy() {
        window.deviceGroupsPage = null;
        this.app.i18n.clearPageTranslations();
    }
}

export default DeviceGroupsPage;
