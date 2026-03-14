/**
 * Playlist List Page Component
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { MediaUtils } from '../../utils/MediaUtils.js';
import { escapeHTML } from '../../core/SecurityUtils.js';
import { SignageDeviceTree } from '../../components/SignageDeviceTree.js';

export class PlaylistListPage {
    constructor(app) {
        this.app = app;
        this.playlists = [];
        this.templates = [];
        this.dataTable = null;
        this.deviceTree = null;
        this._commandDedupWindowMs = 1200;
        this._lastCommandTriggerMap = new Map();
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    getUniqueAssignedDevices(devices = []) {
        const uniqueDevices = [];
        const seenDeviceIds = new Set();

        for (const device of (Array.isArray(devices) ? devices : [])) {
            const rawDeviceId = device?.device_id;
            if (rawDeviceId === null || typeof rawDeviceId === 'undefined') {
                continue;
            }

            const deviceId = String(rawDeviceId);
            if (!deviceId || seenDeviceIds.has(deviceId)) {
                continue;
            }

            seenDeviceIds.add(deviceId);
            uniqueDevices.push(device);
        }

        return uniqueDevices;
    }

    isDuplicatePlaylistCommandTrigger(playlistId, command) {
        const key = `${playlistId || 'unknown'}:${command || 'unknown'}`;
        const now = Date.now();
        const lastTriggeredAt = this._lastCommandTriggerMap.get(key) || 0;

        if (now - lastTriggeredAt < this._commandDedupWindowMs) {
            Logger.log('[PlaylistList] Duplicate command trigger skipped:', key);
            return true;
        }

        this._lastCommandTriggerMap.set(key, now);

        if (this._lastCommandTriggerMap.size > 250) {
            const cutoff = now - (this._commandDedupWindowMs * 5);
            for (const [mapKey, mapTime] of this._lastCommandTriggerMap.entries()) {
                if (mapTime < cutoff) {
                    this._lastCommandTriggerMap.delete(mapKey);
                }
            }
        }

        return false;
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">></span>
                    <span class="breadcrumb-current">${this.__('playlists.title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon orange">
                            <i class="ti ti-playlist"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('playlists.title')}</h1>
                            <p class="page-subtitle">${this.__('playlists.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="new-playlist-btn" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.__('playlists.addPlaylist')}
                        </button>
                    </div>
                </div>
            </div>

            <div class="card card-table">
                <div class="card-body">
                    <div id="playlist-table-container"></div>
                </div>
            </div>

            <div class="card mt-4" id="signage-device-tree-section">
                <div class="card-header">
                    <div class="card-header-left">
                        <h3 class="card-title">
                            <i class="ti ti-hierarchy-2"></i>
                            ${this.__('deviceTree.title')}
                        </h3>
                        <p class="card-subtitle">${this.__('deviceTree.subtitle')}</p>
                    </div>
                    <div class="card-header-right">
                        <button id="tree-expand-all" class="btn btn-outline btn-sm">
                            <i class="ti ti-arrows-maximize"></i> ${this.__('deviceTree.expandAll')}
                        </button>
                        <button id="tree-collapse-all" class="btn btn-outline btn-sm">
                            <i class="ti ti-arrows-minimize"></i> ${this.__('deviceTree.collapseAll')}
                        </button>
                    </div>
                </div>
                <div class="card-body" id="signage-device-tree-container">
                </div>
            </div>
        `;
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('signage');
    }

    async init() {
        window.playlistPage = this;
        await this.loadTemplates();
        this.initDataTable();
        await this.loadPlaylists();
        this.bindEvents();

        // Initialize device tree
        this.deviceTree = new SignageDeviceTree(this.app, '#signage-device-tree-container');
        await this.deviceTree.init();
    }

    async loadTemplates() {
        try {
            const response = await this.app.api.get('/templates');
            this.templates = response.data || [];
        } catch (error) {
            Logger.error('Templates load error:', error);
            this.templates = [];
        }
    }

    initDataTable() {
        this.dataTable = new DataTable({
            container: '#playlist-table-container',
            columns: [
                {
                    key: 'name',
                    label: this.__('playlists.form.fields.name'),
                    sortable: true,
                    render: (val, row) => `
                        <div class="flex items-center gap-2">
                            <span class="font-medium">${escapeHTML(val)}</span>
                            ${row.items_count ? `<span class="text-xs text-muted">(${row.items_count} ${this.__('playlists.itemCount')})</span>` : ''}
                        </div>
                    `
                },
                {
                    key: 'orientation',
                    label: this.__('playlists.form.fields.orientation'),
                    sortable: true,
                    render: (val) => {
                        const orientations = {
                            'landscape': { label: this.__('playlists.orientations.landscape'), class: 'badge-info' },
                            'portrait': { label: this.__('playlists.orientations.portrait'), class: 'badge-warning' }
                        };
                        const o = orientations[val] || orientations['landscape'];
                        return `<span class="badge ${o.class}">${o.label}</span>`;
                    }
                },
                {
                    key: 'layout_type',
                    label: this.__('playlists.form.fields.layoutType'),
                    sortable: true,
                    render: (val) => {
                        const layouts = {
                            'full': { label: this.__('playlists.layouts.full'), class: 'badge-primary' },
                            'grid-2': { label: this.__('playlists.layouts.grid2'), class: 'badge-success' },
                            'grid-3': { label: this.__('playlists.layouts.grid3'), class: 'badge-success' },
                            'grid-4': { label: this.__('playlists.layouts.grid4'), class: 'badge-success' },
                            'hybrid': { label: this.__('playlists.layouts.hybrid'), class: 'badge-warning' }
                        };
                        const l = layouts[val] || layouts['full'];
                        return `<span class="badge ${l.class}">${l.label}</span>`;
                    }
                },
                {
                    key: 'status',
                    label: this.__('status.title'),
                    sortable: true,
                    render: (val) => {
                        const statuses = {
                            'active': { label: this.__('status.active'), class: 'badge-success' },
                            'draft': { label: this.__('status.draft'), class: 'badge-secondary' },
                            'archived': { label: this.__('status.archived'), class: 'badge-warning' }
                        };
                        const s = statuses[val] || statuses['draft'];
                        return `<span class="badge ${s.class}">${s.label}</span>`;
                    }
                },
                {
                    key: 'assigned_device_count',
                    label: this.__('playlists.columns.assignedDevice'),
                    sortable: true,
                    render: (val, row) => {
                        const count = row.assigned_device_count || 0;

                        if (count === 0) {
                            return `<span class="text-muted">-</span>`;
                        }

                        if (count === 1) {
                            // Tek cihaz - direkt isim göster
                            return `
                                <div class="flex items-center gap-1">
                                    <i class="ti ti-device-tv text-primary"></i>
                                    <span>${escapeHTML(row.assigned_device_name || '')}</span>
                                    ${row.assigned_device_ip ? `<span class="text-xs text-muted">(${escapeHTML(row.assigned_device_ip)})</span>` : ''}
                                </div>
                            `;
                        }

                        // Çoklu cihaz - badge ile göster, tıklanınca modal
                        return `
                            <button type="button" class="device-count-badge" data-playlist-id="${row.id}" onclick="window.playlistPage?.showAssignedDevicesModal('${row.id}')">
                                <i class="ti ti-devices"></i>
                                <span>${this.__('playlists.columns.devicesCount', { count: count })}</span>
                            </button>
                        `;
                    }
                }
            ],
            actions: [
                {
                    name: 'play',
                    icon: 'ti-player-play',
                    label: this.__('playlists.actions.startBroadcast'),
                    class: 'btn-ghost text-success',
                    visible: (row) => row.assigned_device_count >= 1,
                    onClick: (row) => this.sendPlaylistCommand(row, 'start')
                },
                {
                    name: 'stop',
                    icon: 'ti-player-stop',
                    label: this.__('playlists.actions.stopBroadcast'),
                    class: 'btn-ghost text-danger',
                    visible: (row) => row.assigned_device_count >= 1,
                    onClick: (row) => this.sendPlaylistCommand(row, 'stop')
                },
                {
                    name: 'refresh',
                    icon: 'ti-refresh',
                    label: this.__('playlists.actions.refreshDevice'),
                    class: 'btn-ghost text-info',
                    visible: (row) => row.assigned_device_count >= 1,
                    onClick: (row) => this.sendPlaylistCommand(row, 'refresh')
                },
                {
                    name: 'edit',
                    icon: 'ti-edit',
                    label: this.__('actions.edit'),
                    onClick: (row) => this.edit(row.id)
                },
                {
                    name: 'view',
                    icon: 'ti-eye',
                    label: this.__('actions.view'),
                    onClick: (row) => this.view(row.id)
                },
                {
                    name: 'assign',
                    icon: 'ti-device-tv',
                    label: this.__('playlists.assignToDevice'),
                    class: 'btn-ghost text-primary',
                    onClick: (row) => this.showAssignToDeviceModal(row)
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('actions.delete'),
                    class: 'btn-ghost text-danger',
                    onClick: (row) => this.delete(row.id)
                }
            ],
            pagination: true,
            pageSize: 20,
            searchable: true,
            emptyText: this.__('playlists.empty')
        });
    }

    getTemplatePreviewUrl(preview) {
        if (!preview) return '';

        // If preview is base64 data URI, return as-is
        if (preview.startsWith('data:image')) {
            return preview;
        }

        // If preview is raw base64 (no data URI prefix), skip it to avoid 414 errors
        if (preview.length > 500 || /^[A-Za-z0-9+/=]+$/.test(preview)) {
            return '';
        }

        // Use MediaUtils for cross-environment compatibility
        return MediaUtils.getDisplayUrl(preview);
    }

    async loadPlaylists() {
        try {
            this.dataTable.setLoading(true);
            const response = await this.app.api.get('/playlists');
            this.playlists = response.data || [];
            this.dataTable.setData(this.playlists);
        } catch (error) {
            Logger.error('Playlist load error:', error);
            this.dataTable.setData([]);
        }
    }

    bindEvents() {
        document.getElementById('new-playlist-btn')?.addEventListener('click', () => {
            // Go to detail page for full playlist editor with media selection
            window.location.hash = '#/signage/playlists/new';
        });
    }

    showPlaylistModal(playlist = null) {
        const isEdit = !!playlist;
        const title = isEdit ? this.__('playlists.editPlaylist') : this.__('playlists.addPlaylist');

        const templateOptions = this.templates.map(t =>
            `<option value="${t.id}" ${playlist?.template_id === t.id ? 'selected' : ''}>${escapeHTML(t.name)}</option>`
        ).join('');

        const content = `
            <form id="playlist-form" class="space-y-4">
                <div class="form-group">
                    <label class="form-label form-label-required">${this.__('playlists.form.fields.name')}</label>
                    <input type="text" id="playlist-name" class="form-input"
                        value="${escapeHTML(playlist?.name || '')}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('playlists.form.fields.description')}</label>
                    <textarea id="playlist-description" class="form-input" rows="2">${escapeHTML(playlist?.description || '')}</textarea>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('playlists.form.fields.orientation')}</label>
                        <select id="playlist-orientation" class="form-select">
                            <option value="landscape" ${playlist?.orientation === 'landscape' || !playlist ? 'selected' : ''}>${this.__('playlists.orientations.landscape')}</option>
                            <option value="portrait" ${playlist?.orientation === 'portrait' ? 'selected' : ''}>${this.__('playlists.orientations.portrait')}</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">${this.__('playlists.form.fields.layoutType')}</label>
                        <select id="playlist-layout" class="form-select">
                            <option value="full" ${playlist?.layout_type === 'full' || !playlist ? 'selected' : ''}>${this.__('playlists.layouts.full')}</option>
                            <option value="grid-2" ${playlist?.layout_type === 'grid-2' ? 'selected' : ''}>${this.__('playlists.layouts.grid2')}</option>
                            <option value="grid-3" ${playlist?.layout_type === 'grid-3' ? 'selected' : ''}>${this.__('playlists.layouts.grid3')}</option>
                            <option value="grid-4" ${playlist?.layout_type === 'grid-4' ? 'selected' : ''}>${this.__('playlists.layouts.grid4')}</option>
                            <option value="hybrid" ${playlist?.layout_type === 'hybrid' ? 'selected' : ''}>${this.__('playlists.layouts.hybrid')}</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('playlists.form.fields.template')}</label>
                    <select id="playlist-template" class="form-select">
                        <option value="">${this.__('playlists.form.selectTemplate')}</option>
                        ${templateOptions}
                    </select>
                    <div id="template-preview-container" class="mt-2"></div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('playlists.form.fields.duration')}</label>
                        <input type="number" id="playlist-duration" class="form-input"
                            value="${playlist?.default_duration || 10}" min="1" max="300">
                        <p class="form-hint">${this.__('playlists.form.durationHint')}</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">${this.__('status.title')}</label>
                        <select id="playlist-status" class="form-select">
                            <option value="draft" ${playlist?.status === 'draft' || !playlist ? 'selected' : ''}>${this.__('status.draft')}</option>
                            <option value="active" ${playlist?.status === 'active' ? 'selected' : ''}>${this.__('status.active')}</option>
                            <option value="archived" ${playlist?.status === 'archived' ? 'selected' : ''}>${this.__('status.archived')}</option>
                        </select>
                    </div>
                </div>
            </form>
        `;

        Modal.show({
            title,
            icon: isEdit ? 'ti-edit' : 'ti-plus',
            content,
            size: 'lg',
            confirmText: this.__('actions.save'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                await this.savePlaylist(playlist?.id);
            }
        });

        // Setup template preview listener after modal opens
        setTimeout(() => {
            const templateSelect = document.getElementById('playlist-template');
            if (templateSelect) {
                templateSelect.addEventListener('change', (e) => {
                    this.updateTemplatePreview(e.target.value);
                });
                // Show initial preview if template is selected
                if (playlist?.template_id) {
                    this.updateTemplatePreview(playlist.template_id);
                }
            }
        }, 100);
    }

    updateTemplatePreview(templateId) {
        const container = document.getElementById('template-preview-container');
        if (!container) return;

        if (!templateId) {
            container.innerHTML = '';
            return;
        }

        const template = this.templates.find(t => t.id === templateId);
        if (!template) {
            container.innerHTML = '';
            return;
        }

        const previewUrl = template.preview_image ? this.getTemplatePreviewUrl(template.preview_image) : '';

        container.innerHTML = `
            <div class="template-preview-card">
                ${previewUrl ? `
                    <img src="${previewUrl}" alt="${escapeHTML(template.name)}" class="template-preview-image">
                ` : `
                    <div class="template-preview-placeholder">
                        <i class="ti ti-photo-off"></i>
                        <span>${this.__('playlists.form.noPreview')}</span>
                    </div>
                `}
                <div class="template-preview-info">
                    <span class="template-preview-name">${escapeHTML(template.name)}</span>
                    ${template.width && template.height ? `<span class="template-preview-size">${template.width}x${template.height}</span>` : ''}
                </div>
            </div>
        `;
    }

    async savePlaylist(id = null) {
        const name = document.getElementById('playlist-name')?.value.trim();
        const description = document.getElementById('playlist-description')?.value.trim();
        const orientation = document.getElementById('playlist-orientation')?.value;
        const layoutType = document.getElementById('playlist-layout')?.value;
        const templateId = document.getElementById('playlist-template')?.value;
        const duration = parseInt(document.getElementById('playlist-duration')?.value) || 10;
        const status = document.getElementById('playlist-status')?.value;

        if (!name) {
            const nameInput = document.getElementById('playlist-name');
            if (nameInput) nameInput.classList.add('error');
            Toast.error(this.__('validation.requiredField', { field: this.__('playlists.form.fields.name') }));
            throw new Error('Name required');
        }

        const data = {
            name,
            description,
            orientation,
            layout_type: layoutType,
            template_id: templateId || null,
            default_duration: duration,
            status
        };

        try {
            if (id) {
                await this.app.api.put(`/playlists/${id}`, data);
                Toast.success(this.__('playlists.toast.updated'));
            } else {
                await this.app.api.post('/playlists', data);
                Toast.success(this.__('playlists.toast.created'));
            }
            await this.loadPlaylists();
        } catch (error) {
            Logger.error('Save error:', error);
            Toast.error(this.__('messages.saveFailed') + ': ' + (error.message || ''));
            throw error;
        }
    }

    edit(id) {
        // Go to detail page for full editor with media management
        window.location.hash = `#/signage/playlists/${id}`;
    }

    view(id) {
        window.location.hash = `#/signage/playlists/${id}`;
    }

    async showAssignToDeviceModal(playlist) {
        // Load all devices then filter for signage types
        let devices = [];
        try {
            const response = await this.app.api.get('/devices');
            const allDevices = response.data || [];

            // Filter for signage-compatible devices (tv is mapped from android_tv/web_display in API)
            devices = allDevices.filter(d =>
                d.type === 'android_tv' || d.type === 'web_display' ||
                d.type === 'panel' || d.type === 'tv' || d.model === 'pwa_player'
            );
        } catch (error) {
            Logger.error('Devices load error:', error);
            devices = [];
        }

        // Get translations with safe fallbacks
        const tr = {
            selectDevices: this.__('playlists.form.selectDevices'),
            selectedDevices: this.__('playlists.form.selectedDevices'),
            assignToMultiple: this.__('playlists.form.assignToMultiple'),
            noDevices: this.__('playlists.form.noDevices'),
            willBeAssigned: this.__('playlists.form.willBeAssigned'),
            assignToDevice: this.__('playlists.assignToDevice'),
            selectDeviceRequired: this.__('playlists.form.selectDeviceRequired'),
            assigned: this.__('playlists.toast.assigned')
        };

        // Use Turkish fallbacks if translation key is returned (not translated)
        const getText = (key, fallback) => {
            const val = tr[key];
            return (val && !val.includes('.')) ? val : fallback;
        };

        // Get currently assigned device IDs
        const assignedIds = new Set((playlist.assigned_devices || []).map(d => d.device_id));
        const assignedCount = assignedIds.size;

        const content = `
            <div class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${getText('selectDevices')}</label>
                    <p class="form-hint mb-2">${getText('assignToMultiple')}</p>
                    <div class="device-checkbox-list" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.5rem;">
                        ${devices.length > 0 ? devices.map(d => `
                            <label class="device-checkbox-item" style="display: flex; align-items: center; padding: 0.75rem; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.15s;">
                                <input type="checkbox" class="device-checkbox" value="${d.id}"
                                    ${assignedIds.has(d.id) ? 'checked' : ''}
                                    style="width: 18px; height: 18px; margin-right: 12px;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 500;">${escapeHTML(d.name)}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">
                                        ${escapeHTML(d.ip_address || '')} ${d.type ? '• ' + escapeHTML(d.type) : ''}
                                    </div>
                                </div>
                                <span class="badge ${d.status === 'online' ? 'badge-success' : 'badge-secondary'}" style="font-size: 0.65rem;">
                                    ${d.status === 'online' ? this.__('status.online') : this.__('status.offline')}
                                </span>
                            </label>
                        `).join('') : `
                            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                                <i class="ti ti-device-tv-off" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                                <p>${getText('noDevices')}</p>
                            </div>
                        `}
                    </div>
                    <div id="selected-count" class="text-sm text-muted mt-2">
                        ${getText('selectedDevices')}: <span id="device-count">${assignedCount}</span>
                    </div>
                </div>
                ${assignedCount > 0 ? `
                    <div class="bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg p-3 text-sm">
                        <i class="ti ti-check mr-2"></i>
                        ${assignedCount === 1
                            ? this.__('playlists.form.currentlyAssigned', { device: escapeHTML(playlist.assigned_device_name || this.__('playlists.form.aDevice')) })
                            : this.__('playlists.form.currentlyAssignedCount', { count: assignedCount })
                        }
                    </div>
                ` : ''}
                <div class="bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg p-3 text-sm">
                    <i class="ti ti-info-circle mr-2"></i>
                    <strong>${escapeHTML(playlist.name)}</strong> ${getText('willBeAssigned')}
                </div>
            </div>
        `;

        Modal.show({
            title: getText('assignToDevice'),
            icon: 'ti-device-tv',
            content,
            size: 'md',
            confirmText: this.__('actions.assign'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const checkboxes = document.querySelectorAll('.device-checkbox:checked');
                const deviceIds = Array.from(checkboxes).map(cb => cb.value);

                if (deviceIds.length === 0) {
                    const confirmed = await this.confirmModal({
                        title: this.__('modal.confirm'),
                        message: getText('confirmUnassign'),
                        type: 'warning',
                        confirmText: this.__('modal.yes'),
                        cancelText: this.__('modal.no')
                    });
                    if (!confirmed) {
                        throw new Error('Unassign cancelled');
                    }
                }

                try {
                    let successCount = 0;

                    // Replace assignments for this playlist (bulk)
                    const result = await this.app.api.post(`/playlists/${playlist.id}/assign-devices`, {
                        device_ids: deviceIds
                    });

                    successCount = result.data?.assigned_count ?? deviceIds.length;
                    if (successCount > 0) {
                        Toast.success(this.__('playlists.toast.assignedCount', { count: successCount }));
                    }

                    // Refresh playlist list to show updated assignment
                    await this.loadPlaylists();
                } catch (error) {
                    Logger.error('Assign error:', error);
                    Toast.error(error.message || this.__('messages.saveFailed'));
                    throw error;
                }
            }
        });

        // Add checkbox count update listener after modal opens
        setTimeout(() => {
            const checkboxes = document.querySelectorAll('.device-checkbox');
            const countEl = document.getElementById('device-count');
            const updateCount = () => {
                const checked = document.querySelectorAll('.device-checkbox:checked').length;
                if (countEl) countEl.textContent = checked;
            };

            checkboxes.forEach(cb => {
                cb.addEventListener('change', updateCount);
            });

            // Add hover effect to checkbox items
            const items = document.querySelectorAll('.device-checkbox-item');
            items.forEach(item => {
                item.addEventListener('mouseenter', () => {
                    item.style.background = 'var(--bg-hover)';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.background = '';
                });
            });

            updateCount();
        }, 100);
    }

    /**
     * Send command to device
     */
    async sendDeviceCommand(deviceId, command, deviceName = '') {
        const commandLabels = {
            'start': { label: this.__('playlists.commands.start'), icon: 'ti-player-play', color: 'success' },
            'stop': { label: this.__('playlists.commands.stop'), icon: 'ti-player-stop', color: 'danger' },
            'refresh': { label: this.__('playlists.commands.refresh'), icon: 'ti-refresh', color: 'info' },
            'reboot': { label: this.__('playlists.commands.reboot'), icon: 'ti-power', color: 'warning' }
        };

        const cmd = commandLabels[command] || { label: command, icon: 'ti-send', color: 'primary' };
        const device = deviceName || this.__('playlists.commands.device');

        Modal.confirm({
            title: cmd.label + '?',
            message: this.__('playlists.commands.confirmMessage', { device: escapeHTML(device), command: cmd.label.toLowerCase() }),
            type: cmd.color,
            confirmText: this.__('playlists.commands.send'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    const response = await this.app.api.post(`/devices/${deviceId}/send-command`, {
                        command: command
                    });

                    if (response.success) {
                        Toast.success(this.__('playlists.commands.sent', { device: device }));
                    } else {
                        Toast.error(response.message || this.__('playlists.commands.failed'));
                    }
                } catch (error) {
                    Logger.error('Command send error:', error);
                    Toast.error(this.__('playlists.commands.failed') + ': ' + (error.message || this.__('messages.unknownError')));
                    throw error;
                }
            }
        });
    }

    async sendPlaylistCommand(playlist, command) {
        const playlistId = playlist?.id || 'unknown';
        if (this.isDuplicatePlaylistCommandTrigger(playlistId, command)) {
            return;
        }

        const devices = this.getUniqueAssignedDevices(playlist?.assigned_devices || []);
        if (!devices.length) {
            Toast.error(this.__('playlists.form.noDevices'));
            return;
        }

        if (devices.length === 1) {
            return this.sendDeviceCommand(devices[0].device_id, command, devices[0].device_name);
        }

        const commandLabels = {
            'start': { label: this.__('playlists.commands.start'), icon: 'ti-player-play', color: 'success' },
            'stop': { label: this.__('playlists.commands.stop'), icon: 'ti-player-stop', color: 'danger' },
            'refresh': { label: this.__('playlists.commands.refresh'), icon: 'ti-refresh', color: 'info' },
            'reboot': { label: this.__('playlists.commands.reboot'), icon: 'ti-power', color: 'warning' }
        };

        const cmd = commandLabels[command] || { label: command, icon: 'ti-send', color: 'primary' };

        const content = `
            <div class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${this.__('playlists.form.selectDevices')}</label>
                    <p class="form-hint mb-2">${this.__('playlists.form.assignToMultiple')}</p>
                    <div class="device-checkbox-list" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.5rem;">
                        ${devices.map(d => `
                            <label class="device-checkbox-item" style="display: flex; align-items: center; padding: 0.75rem; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.15s;">
                                <input type="checkbox" class="device-command-checkbox" value="${d.device_id}" checked
                                    style="width: 18px; height: 18px; margin-right: 12px;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 500;">${escapeHTML(d.device_name)}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">
                                        ${escapeHTML(d.ip_address || '')}
                                    </div>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                    <div class="text-sm text-muted mt-2">
                        ${this.__('playlists.form.selectedDevices')}: <span id="command-device-count">${devices.length}</span>
                    </div>
                </div>
            </div>
        `;

        Modal.show({
            title: cmd.label,
            icon: cmd.icon,
            content,
            size: 'md',
            confirmText: this.__('playlists.commands.send'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                const selected = Array.from(document.querySelectorAll('.device-command-checkbox:checked')).map(cb => cb.value);
                if (!selected.length) {
                    Toast.error(this.__('playlists.form.selectDeviceRequired'));
                    throw new Error('Device required');
                }

                await this.sendCommandToDevices(selected, command);
            }
        });

        setTimeout(() => {
            const countEl = document.getElementById('command-device-count');
            document.querySelectorAll('.device-command-checkbox').forEach(cb => {
                cb.addEventListener('change', () => {
                    const count = document.querySelectorAll('.device-command-checkbox:checked').length;
                    if (countEl) countEl.textContent = String(count);
                });
            });
        }, 0);
    }

    async sendCommandToDevices(deviceIds, command) {
        let success = 0;
        let failed = 0;

        const uniqueDeviceIds = Array.from(new Set(
            (Array.isArray(deviceIds) ? deviceIds : [])
                .map(deviceId => String(deviceId || ''))
                .filter(Boolean)
        ));

        for (const deviceId of uniqueDeviceIds) {
            try {
                await this.app.api.post(`/devices/${deviceId}/send-command`, { command });
                success++;
            } catch (error) {
                failed++;
            }
        }

        if (success > 0) {
            Toast.success(this.__('playlists.commands.sentCount', { count: success }));
        }
        if (failed > 0) {
            Toast.warning(this.__('playlists.commands.failedCount', { count: failed }));
        }
    }

    confirmModal({ title, message, type = 'warning', confirmText, cancelText }) {
        return new Promise(resolve => {
            Modal.confirm({
                title,
                message,
                type,
                confirmText,
                cancelText,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false)
            });
        });
    }

    /**
     * Show modal with all assigned devices for a playlist
     */
    showAssignedDevicesModal(playlistId) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (!playlist) return;

        const devices = this.getUniqueAssignedDevices(playlist.assigned_devices || []);
        const title = this.__('playlists.modal.assignedDevices', { name: playlist.name });

        const content = `
            <div class="assigned-devices-list">
                ${devices.length > 0 ? devices.map(d => `
                    <div class="assigned-device-item">
                        <div class="device-info">
                            <i class="ti ti-device-tv text-primary"></i>
                            <div>
                                <span class="device-name">${escapeHTML(d.device_name)}</span>
                                ${d.ip_address ? `<span class="device-ip">${escapeHTML(d.ip_address)}</span>` : ''}
                            </div>
                        </div>
                        <button type="button" class="btn btn-ghost btn-sm text-danger remove-assigned-device" data-device-id="${d.device_id}">
                            <i class="ti ti-x"></i>
                            ${this.__('playlists.modal.removeDevice')}
                        </button>
                    </div>
                `).join('') : `
                    <div class="no-devices">
                        <i class="ti ti-device-tv-off"></i>
                        <span>${this.__('playlists.modal.noDevices')}</span>
                    </div>
                `}
            </div>
        `;

        Modal.show({
            title,
            icon: 'ti-devices',
            content,
            size: 'sm',
            showConfirm: false,
            cancelText: this.__('modal.close')
        });

        setTimeout(() => {
            document.querySelectorAll('.remove-assigned-device').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const deviceId = btn.dataset.deviceId;
                    if (!deviceId) return;

                    const confirmed = await this.confirmModal({
                        title: this.__('modal.confirm'),
                        message: this.__('playlists.modal.removeConfirm'),
                        type: 'warning',
                        confirmText: this.__('modal.yes'),
                        cancelText: this.__('modal.no')
                    });
                    if (!confirmed) return;

                    try {
                        const remainingIds = devices
                            .filter(d => d.device_id !== deviceId)
                            .map(d => d.device_id);

                        await this.app.api.post(`/playlists/${playlist.id}/assign-devices`, {
                            device_ids: remainingIds
                        });

                        Toast.success(this.__('playlists.modal.removed'));
                        await this.loadPlaylists();

                        document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
                        document.body.classList.remove('modal-open');
                        this.showAssignedDevicesModal(playlistId);
                    } catch (error) {
                        Logger.error('Remove assigned device error:', error);
                        Toast.error(this.__('messages.saveFailed') + ': ' + (error.message || ''));
                    }
                });
            });
        }, 0);
    }

    async delete(id) {
        Modal.confirm({
            title: this.__('playlists.deletePlaylist'),
            message: this.__('playlists.deleteConfirm'),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/playlists/${id}`);
                    Toast.success(this.__('playlists.toast.deleted'));
                    await this.loadPlaylists();
                } catch (error) {
                    Toast.error(this.__('messages.deleteFailed') + ': ' + (error.message || ''));
                    throw error;
                }
            }
        });
    }

    destroy() {
        window.playlistPage = null;
        if (this.dataTable) {
            this.dataTable.destroy();
        }
        if (this.deviceTree) {
            this.deviceTree.destroy();
            this.deviceTree = null;
        }
        this.app.i18n.clearPageTranslations();
    }
}

export default PlaylistListPage;
