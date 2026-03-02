/**
 * SignageDeviceTree Component
 * Hierarchical tree-table view for signage devices
 * Company > Region > Branch > Device
 */

import { Logger } from '../core/Logger.js';
import { Toast } from './Toast.js';
import { Modal } from './Modal.js';
import { escapeHTML } from '../core/SecurityUtils.js';
import { MediaUtils } from '../utils/MediaUtils.js';

export class SignageDeviceTree {
    constructor(app, container) {
        this.app = app;
        this.container = container;
        this.data = null;
        this.expandedNodes = new Set();
        this.refreshTimer = null;
        this.refreshInterval = 60000; // 60 seconds
        this.currentFilter = { search: '', status: '' };
        this._searchDebounceTimer = null;
        this._loadExpandState();
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    // ========== Expand State Persistence ==========

    _loadExpandState() {
        try {
            const stored = localStorage.getItem('omnex_signage_tree_expanded');
            if (stored) {
                const arr = JSON.parse(stored);
                this.expandedNodes = new Set(arr);
            }
        } catch (e) {
            this.expandedNodes = new Set();
        }
    }

    _saveExpandState() {
        try {
            localStorage.setItem('omnex_signage_tree_expanded', JSON.stringify([...this.expandedNodes]));
        } catch (e) {
            // quota exceeded or similar
        }
    }

    // ========== Initialization ==========

    async init() {
        this._renderLoading();
        await this.loadData();
        this.renderTree();
        this.bindEvents();
        this.startAutoRefresh();
    }

    _renderLoading() {
        const el = document.querySelector(this.container);
        if (el) {
            el.innerHTML = `
                <div class="signage-tree-loading">
                    <i class="ti ti-loader-2 spin"></i>
                    <span>${this.__('deviceTree.loading')}</span>
                </div>
            `;
        }
    }

    // ========== Data Loading ==========

    async loadData() {
        try {
            const params = new URLSearchParams();
            if (this.currentFilter.search) params.set('search', this.currentFilter.search);
            if (this.currentFilter.status) params.set('status', this.currentFilter.status);

            const qs = params.toString();
            const url = '/signage/devices-tree' + (qs ? '?' + qs : '');
            const response = await this.app.api.get(url);
            this.data = response.data || { summary: { total: 0, online: 0, offline: 0, warning: 0 }, tree: [] };
        } catch (error) {
            Logger.error('SignageDeviceTree load error:', error);
            this.data = { summary: { total: 0, online: 0, offline: 0, warning: 0 }, tree: [] };
        }
    }

    // ========== Rendering ==========

    renderTree() {
        const el = document.querySelector(this.container);
        if (!el) return;

        const { summary, tree } = this.data;

        let html = '';

        // Summary bar
        html += this._renderSummary(summary);

        // Filter bar
        html += this._renderFilters();

        // Tree table or empty state
        if (tree.length === 0 && summary.total === 0) {
            html += this._renderEmpty();
        } else {
            html += this._renderTable(tree);
        }

        el.innerHTML = html;

        // Re-bind dynamic events after render
        this._bindDynamicEvents();
    }

    _renderSummary(summary) {
        return `
            <div class="signage-tree-summary">
                <div class="sdt-stat sdt-stat-total">
                    <i class="ti ti-devices"></i>
                    <span>${this.__('deviceTree.summary.total')}: <strong>${summary.total}</strong></span>
                </div>
                <div class="sdt-stat sdt-stat-online">
                    <i class="ti ti-circle-filled"></i>
                    <span>${this.__('deviceTree.summary.online')}: <strong>${summary.online}</strong></span>
                </div>
                <div class="sdt-stat sdt-stat-offline">
                    <i class="ti ti-circle-filled"></i>
                    <span>${this.__('deviceTree.summary.offline')}: <strong>${summary.offline}</strong></span>
                </div>
                <div class="sdt-stat sdt-stat-warning">
                    <i class="ti ti-alert-triangle"></i>
                    <span>${this.__('deviceTree.summary.warning')}: <strong>${summary.warning}</strong></span>
                </div>
            </div>
        `;
    }

    _renderFilters() {
        return `
            <div class="signage-tree-filters">
                <div class="sdt-filter-left">
                    <div class="sdt-search-wrap">
                        <i class="ti ti-search"></i>
                        <input type="text" id="sdt-search" class="form-input form-input-sm"
                            placeholder="${this.__('deviceTree.filter.search')}"
                            value="${escapeHTML(this.currentFilter.search)}">
                    </div>
                    <select id="sdt-status-filter" class="form-select form-select-sm">
                        <option value="" ${!this.currentFilter.status ? 'selected' : ''}>${this.__('deviceTree.filter.all')}</option>
                        <option value="online" ${this.currentFilter.status === 'online' ? 'selected' : ''}>${this.__('deviceTree.filter.online')}</option>
                        <option value="offline" ${this.currentFilter.status === 'offline' ? 'selected' : ''}>${this.__('deviceTree.filter.offline')}</option>
                        <option value="warning" ${this.currentFilter.status === 'warning' ? 'selected' : ''}>${this.__('deviceTree.filter.warning')}</option>
                    </select>
                </div>
                <div class="sdt-filter-right">
                    <button id="sdt-expand-all" class="btn btn-outline btn-sm">
                        <i class="ti ti-arrows-maximize"></i> ${this.__('deviceTree.expandAll')}
                    </button>
                    <button id="sdt-collapse-all" class="btn btn-outline btn-sm">
                        <i class="ti ti-arrows-minimize"></i> ${this.__('deviceTree.collapseAll')}
                    </button>
                </div>
            </div>
        `;
    }

    _renderEmpty() {
        return `
            <div class="signage-tree-empty">
                <i class="ti ti-device-tv-off"></i>
                <p>${this.__('deviceTree.empty')}</p>
                <span>${this.__('deviceTree.emptyHint')}</span>
            </div>
        `;
    }

    _renderTable(tree) {
        let rows = '';
        for (const node of tree) {
            rows += this._renderNode(node, 0, null);
        }

        return `
            <div class="signage-tree-table-wrap">
                <table class="signage-tree-table">
                    <thead>
                        <tr>
                            <th class="sdt-col-name">${this.__('deviceTree.columns.name')}</th>
                            <th class="sdt-col-status">${this.__('deviceTree.columns.status')}</th>
                            <th class="sdt-col-playlist">${this.__('deviceTree.columns.playlist')}</th>
                            <th class="sdt-col-lastseen">${this.__('deviceTree.columns.lastSeen')}</th>
                            <th class="sdt-col-actions">${this.__('deviceTree.columns.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    _renderNode(node, level, parentId) {
        if (node.type === 'device') {
            return this._renderDeviceRow(node, level, parentId);
        }

        const isExpanded = this.expandedNodes.has(node.id);
        const hasChildren = node.children && node.children.length > 0;
        const display = level === 0 ? '' : (parentId && this.expandedNodes.has(parentId) ? '' : 'style="display:none"');

        const typeIcons = {
            'company': 'ti-building',
            'region': 'ti-map-pin',
            'branch': 'ti-home',
            'unassigned': 'ti-help-circle'
        };

        const icon = typeIcons[node.type] || 'ti-folder';
        const indentPx = level * 24;
        const nodeName = node.name === '__unassigned__' ? this.__('deviceTree.node.unassigned') : escapeHTML(node.name);
        const stats = node.stats || { total: 0, online: 0, offline: 0, warning: 0 };
        const toggleIcon = hasChildren ? (isExpanded ? 'ti-chevron-down' : 'ti-chevron-right') : 'ti-point';

        let html = `
            <tr class="sdt-row sdt-row-${node.type}" data-node-id="${node.id}" data-node-type="${node.type}" data-parent="${parentId || ''}" data-level="${level}" ${display}>
                <td class="sdt-col-name">
                    <div class="sdt-name-inner" style="padding-left: ${indentPx}px;">
                        ${hasChildren ? `<span class="sdt-toggle ${isExpanded ? 'expanded' : ''}" data-toggle-id="${node.id}"><i class="ti ${toggleIcon}"></i></span>` : `<span class="sdt-toggle-placeholder"></span>`}
                        <i class="ti ${icon} sdt-node-icon sdt-icon-${node.type}"></i>
                        <span class="sdt-node-name">${nodeName}</span>
                        ${node.code ? `<span class="sdt-node-code">${escapeHTML(node.code)}</span>` : ''}
                        <span class="badge badge-secondary sdt-node-count">${this.__('deviceTree.node.devices', { count: stats.total })}</span>
                    </div>
                </td>
                <td class="sdt-col-status">
                    <div class="sdt-status-badges">
                        ${stats.online > 0 ? `<span class="badge badge-success badge-sm">${stats.online}</span>` : ''}
                        ${stats.offline > 0 ? `<span class="badge badge-danger badge-sm">${stats.offline}</span>` : ''}
                        ${stats.warning > 0 ? `<span class="badge badge-warning badge-sm">${stats.warning}</span>` : ''}
                    </div>
                </td>
                <td class="sdt-col-playlist">-</td>
                <td class="sdt-col-lastseen">-</td>
                <td class="sdt-col-actions">
                    <div class="sdt-actions">
                        <button class="sdt-action-btn" data-cascade-cmd="start" data-cascade-node="${node.id}" data-cascade-type="${node.type}" title="${this.__('deviceTree.commands.startAll')}"><i class="ti ti-player-play"></i></button>
                        <button class="sdt-action-btn" data-cascade-cmd="stop" data-cascade-node="${node.id}" data-cascade-type="${node.type}" title="${this.__('deviceTree.commands.stopAll')}"><i class="ti ti-player-stop"></i></button>
                        <button class="sdt-action-btn" data-cascade-cmd="refresh" data-cascade-node="${node.id}" data-cascade-type="${node.type}" title="${this.__('deviceTree.commands.refreshAll')}"><i class="ti ti-refresh"></i></button>
                    </div>
                </td>
            </tr>
        `;

        // Render children
        if (hasChildren) {
            for (const child of node.children) {
                html += this._renderNode(child, level + 1, node.id);
            }
        }

        return html;
    }

    _renderDeviceRow(device, level, parentId) {
        const display = parentId && this.expandedNodes.has(parentId) ? '' : 'style="display:none"';
        const indentPx = level * 24;

        // Thumbnail
        const previewUrl = device.preview_url ? MediaUtils.getDisplayUrl(device.preview_url) : '';

        // Playlist info
        let playlistHtml = `<span class="text-muted">${this.__('deviceTree.noPlaylist')}</span>`;
        if (device.playlist) {
            const idx = (device.playlist.current_index || 0) + 1;
            const total = device.playlist.total_items || 0;
            const progress = total > 0 ? `${idx}/${total}` : '';
            const orientation = device.playlist.orientation || 'landscape';
            const isPortrait = orientation === 'portrait';
            const dimensions = isPortrait ? '1080x1920' : '1920x1080';
            const orientIcon = isPortrait ? 'ti-device-mobile' : 'ti-device-desktop';
            const orientLabel = isPortrait ? this.__('playlists.orientations.portrait') : this.__('playlists.orientations.landscape');

            playlistHtml = `<div class="sdt-playlist-info">
                <div class="sdt-playlist-top">
                    <span class="sdt-playlist-name">${escapeHTML(device.playlist.name)}</span>
                    ${progress ? `<strong class="sdt-playlist-progress">${progress}</strong>` : ''}
                </div>
                <div class="sdt-playlist-orient">
                    <i class="ti ${orientIcon}"></i>
                    <span>${dimensions}</span>
                </div>
            </div>`;
        }

        // Last seen
        const lastSeenText = this._formatRelativeTime(device.last_seen);

        // Status dot class
        const statusClass = device.status === 'online' ? 'sdt-status-online' : (device.status === 'warning' ? 'sdt-status-warning' : 'sdt-status-offline');

        return `
            <tr class="sdt-row sdt-row-device" data-node-id="${device.id}" data-node-type="device" data-parent="${parentId || ''}" data-level="${level}" ${display}>
                <td class="sdt-col-name">
                    <div class="sdt-name-inner" style="padding-left: ${indentPx}px;">
                        <span class="sdt-toggle-placeholder"></span>
                        <div class="sdt-device-thumb" data-device-id="${device.id}">
                            ${previewUrl
                                ? `<img src="${previewUrl}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<i class=\\'ti ti-device-tv\\'></i>'">`
                                : `<i class="ti ti-device-tv"></i>`
                            }
                            ${previewUrl ? `<div class="sdt-device-popup"><img src="${previewUrl}" alt="" loading="lazy"></div>` : ''}
                        </div>
                        <div class="sdt-device-info">
                            <span class="sdt-device-name">${escapeHTML(device.name)}</span>
                            <div class="sdt-device-meta">
                                ${device.device_type ? `<span class="sdt-device-type-badge">${this._getDeviceTypeLabel(device.device_type)}</span>` : ''}
                                ${device.ip_address ? `<span class="sdt-device-ip">${escapeHTML(device.ip_address)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="sdt-col-status">
                    <span class="sdt-status-dot ${statusClass}"></span>
                </td>
                <td class="sdt-col-playlist">${playlistHtml}</td>
                <td class="sdt-col-lastseen">${lastSeenText}</td>
                <td class="sdt-col-actions">
                    <div class="sdt-actions">
                        <button class="sdt-action-btn sdt-act-start" data-device-cmd="start" data-device-id="${device.id}" title="${this.__('deviceTree.commands.start')}"><i class="ti ti-player-play"></i></button>
                        <button class="sdt-action-btn sdt-act-stop" data-device-cmd="stop" data-device-id="${device.id}" title="${this.__('deviceTree.commands.stop')}"><i class="ti ti-player-stop"></i></button>
                        <button class="sdt-action-btn sdt-act-refresh" data-device-cmd="refresh" data-device-id="${device.id}" title="${this.__('deviceTree.commands.refresh')}"><i class="ti ti-refresh"></i></button>
                        <button class="sdt-action-btn sdt-act-reboot" data-device-cmd="reboot" data-device-id="${device.id}" title="${this.__('deviceTree.commands.reboot')}"><i class="ti ti-power"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }

    // ========== Event Binding ==========

    bindEvents() {
        // These are for the static header buttons (expand/collapse all in card-header)
        const expandAllBtn = document.getElementById('tree-expand-all');
        const collapseAllBtn = document.getElementById('tree-collapse-all');

        if (expandAllBtn) expandAllBtn.addEventListener('click', () => this.expandAll());
        if (collapseAllBtn) collapseAllBtn.addEventListener('click', () => this.collapseAll());
    }

    _bindDynamicEvents() {
        const el = document.querySelector(this.container);
        if (!el) return;

        // Toggle expand/collapse
        el.querySelectorAll('.sdt-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const nodeId = toggle.dataset.toggleId;
                this.toggleNode(nodeId);
            });
        });

        // Expand/collapse all (filter bar buttons)
        el.querySelector('#sdt-expand-all')?.addEventListener('click', () => this.expandAll());
        el.querySelector('#sdt-collapse-all')?.addEventListener('click', () => this.collapseAll());

        // Search
        el.querySelector('#sdt-search')?.addEventListener('input', (e) => {
            clearTimeout(this._searchDebounceTimer);
            this._searchDebounceTimer = setTimeout(() => {
                this.currentFilter.search = e.target.value.trim();
                this.loadData().then(() => this.renderTree());
            }, 300);
        });

        // Status filter
        el.querySelector('#sdt-status-filter')?.addEventListener('change', (e) => {
            this.currentFilter.status = e.target.value;
            this.loadData().then(() => this.renderTree());
        });

        // Device commands
        el.querySelectorAll('[data-device-cmd]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const deviceId = btn.dataset.deviceId;
                const command = btn.dataset.deviceCmd;
                this.sendDeviceCommand(deviceId, command);
            });
        });

        // Cascade commands
        el.querySelectorAll('[data-cascade-cmd]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const nodeId = btn.dataset.cascadeNode;
                const nodeType = btn.dataset.cascadeType;
                const command = btn.dataset.cascadeCmd;
                this.sendCascadeCommand(nodeId, nodeType, command);
            });
        });
    }

    // ========== Toggle ==========

    toggleNode(nodeId) {
        const el = document.querySelector(this.container);
        if (!el) return;

        const isExpanded = this.expandedNodes.has(nodeId);

        if (isExpanded) {
            this.expandedNodes.delete(nodeId);
            // Hide immediate children
            this._setChildrenVisibility(el, nodeId, false);
        } else {
            this.expandedNodes.add(nodeId);
            // Show immediate children
            this._setChildrenVisibility(el, nodeId, true);
        }

        // Update toggle icon
        const toggle = el.querySelector(`.sdt-toggle[data-toggle-id="${nodeId}"]`);
        if (toggle) {
            const icon = toggle.querySelector('i');
            if (isExpanded) {
                toggle.classList.remove('expanded');
                icon.className = 'ti ti-chevron-right';
            } else {
                toggle.classList.add('expanded');
                icon.className = 'ti ti-chevron-down';
            }
        }

        this._saveExpandState();
    }

    _setChildrenVisibility(el, parentId, visible) {
        const rows = el.querySelectorAll(`tr[data-parent="${parentId}"]`);
        rows.forEach(row => {
            row.style.display = visible ? '' : 'none';

            // If hiding, also recursively hide grandchildren
            if (!visible) {
                const childId = row.dataset.nodeId;
                if (childId) {
                    this.expandedNodes.delete(childId);
                    const childToggle = row.querySelector('.sdt-toggle');
                    if (childToggle) {
                        childToggle.classList.remove('expanded');
                        const icon = childToggle.querySelector('i');
                        if (icon) icon.className = 'ti ti-chevron-right';
                    }
                    this._setChildrenVisibility(el, childId, false);
                }
            }

            // If showing and this child was previously expanded, show its children too
            if (visible) {
                const childId = row.dataset.nodeId;
                if (childId && this.expandedNodes.has(childId)) {
                    this._setChildrenVisibility(el, childId, true);
                }
            }
        });
    }

    expandAll() {
        const el = document.querySelector(this.container);
        if (!el) return;

        el.querySelectorAll('.sdt-toggle').forEach(toggle => {
            const nodeId = toggle.dataset.toggleId;
            this.expandedNodes.add(nodeId);
            toggle.classList.add('expanded');
            const icon = toggle.querySelector('i');
            if (icon) icon.className = 'ti ti-chevron-down';
        });

        el.querySelectorAll('.sdt-row').forEach(row => {
            row.style.display = '';
        });

        this._saveExpandState();
    }

    collapseAll() {
        const el = document.querySelector(this.container);
        if (!el) return;

        this.expandedNodes.clear();

        el.querySelectorAll('.sdt-toggle').forEach(toggle => {
            toggle.classList.remove('expanded');
            const icon = toggle.querySelector('i');
            if (icon) icon.className = 'ti ti-chevron-right';
        });

        // Hide all rows except top-level (level 0)
        el.querySelectorAll('.sdt-row').forEach(row => {
            const level = parseInt(row.dataset.level) || 0;
            if (level > 0) {
                row.style.display = 'none';
            }
        });

        this._saveExpandState();
    }

    // ========== Commands ==========

    async sendDeviceCommand(deviceId, command) {
        // Map command to specific toast key
        const toastKeys = {
            'start': 'deviceTree.toast.started',
            'stop': 'deviceTree.toast.stopped',
            'refresh': 'deviceTree.toast.refreshed',
            'reboot': 'deviceTree.toast.rebooted'
        };

        // Find device name from tree data
        const device = this._findNode(this.data.tree, deviceId);
        const deviceName = device ? device.name : deviceId;

        try {
            const response = await this.app.api.post(`/devices/${deviceId}/send-command`, { command });
            if (response.success) {
                const toastKey = toastKeys[command] || 'deviceTree.toast.started';
                Toast.success(this.__(toastKey, { device: deviceName }));
            } else {
                Toast.error(this.__('deviceTree.toast.failed', { device: deviceName }));
            }
        } catch (error) {
            Logger.error('Device command error:', error);
            Toast.error(this.__('deviceTree.toast.failed', { device: deviceName }));
        }
    }

    async sendCascadeCommand(nodeId, nodeType, command) {
        // Find the node in tree data
        const node = this._findNode(this.data.tree, nodeId);
        if (!node) return;

        const deviceIds = this._getDevicesUnder(node);
        if (deviceIds.length === 0) {
            Toast.warning(this.__('deviceTree.empty'));
            return;
        }

        const commandLabels = {
            'start': this.__('deviceTree.commands.start'),
            'stop': this.__('deviceTree.commands.stop'),
            'refresh': this.__('deviceTree.commands.refresh')
        };
        const label = commandLabels[command] || command;

        Modal.confirm({
            title: label,
            message: this.__('deviceTree.commands.confirmCascade', { count: deviceIds.length, command: label }),
            type: 'warning',
            confirmText: this.__('playlists.commands.send'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this._executeBatchCommands(deviceIds, command, label);
            }
        });
    }

    async _executeBatchCommands(deviceIds, command, label) {
        const batchSize = 10;
        let success = 0;
        let failed = 0;

        for (let i = 0; i < deviceIds.length; i += batchSize) {
            const batch = deviceIds.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map(id => this.app.api.post(`/devices/${id}/send-command`, { command }))
            );

            results.forEach(r => {
                if (r.status === 'fulfilled' && r.value?.success) {
                    success++;
                } else {
                    failed++;
                }
            });
        }

        // Show detailed result
        const nodeName = this._findNode(this.data.tree, deviceIds[0])?.name || '';
        let msg = `${label} — ${this.__('deviceTree.commands.resultSuccess', { success })}`;
        if (failed > 0) {
            msg += ', ' + this.__('deviceTree.commands.resultFailed', { failed });
        }
        msg += ` (${this.__('deviceTree.node.devices', { count: deviceIds.length })})`;

        if (failed === 0) {
            Toast.success(msg);
        } else if (success > 0) {
            Toast.warning(msg);
        } else {
            Toast.error(msg);
        }
    }

    _findNode(nodes, nodeId) {
        for (const node of nodes) {
            if (node.id === nodeId) return node;
            if (node.children) {
                const found = this._findNode(node.children, nodeId);
                if (found) return found;
            }
        }
        return null;
    }

    _getDevicesUnder(node) {
        const ids = [];
        if (node.type === 'device') {
            ids.push(node.id);
        } else if (node.children) {
            for (const child of node.children) {
                ids.push(...this._getDevicesUnder(child));
            }
        }
        return ids;
    }

    // ========== Auto Refresh ==========

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshTimer = setInterval(async () => {
            await this.loadData();
            this.renderTree();
        }, this.refreshInterval);
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    // ========== Utilities ==========

    _formatRelativeTime(dateStr) {
        if (!dateStr) return this.__('deviceTree.time.never');

        const now = new Date();
        const then = new Date(dateStr);
        const diffMs = now - then;
        const diffSec = Math.floor(diffMs / 1000);

        if (diffSec < 10) return this.__('deviceTree.time.justNow');
        if (diffSec < 60) return this.__('deviceTree.time.secondsAgo', { n: diffSec });

        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return this.__('deviceTree.time.minutesAgo', { n: diffMin });

        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return this.__('deviceTree.time.hoursAgo', { n: diffHour });

        const diffDay = Math.floor(diffHour / 24);
        return this.__('deviceTree.time.daysAgo', { n: diffDay });
    }

    _getDeviceTypeLabel(deviceType) {
        // Try i18n key first, fallback to formatted type name
        const key = `deviceTree.deviceTypes.${deviceType}`;
        const translated = this.__(key);
        if (translated !== key) return escapeHTML(translated);

        // Fallback: format the raw type
        const fallbackLabels = {
            'android_tv': 'APK Player',
            'web_display': 'Web Player',
            'pwa_player': 'PWA Player',
            'stream_player': 'Stream Player',
            'tablet': 'Tablet',
            'streaming': 'Stream',
            'esl_android': 'ESL Android'
        };
        return escapeHTML(fallbackLabels[deviceType] || deviceType);
    }

    // ========== Cleanup ==========

    destroy() {
        this.stopAutoRefresh();
        clearTimeout(this._searchDebounceTimer);
        this.data = null;
    }
}

export default SignageDeviceTree;
