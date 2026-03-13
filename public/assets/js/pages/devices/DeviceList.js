/**
 * Device List Page Component
 * Uses centralized DataTable component
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { MediaUtils } from '../../utils/MediaUtils.js';
import { ExportManager } from '../../utils/ExportManager.js';
import { escapeHTML } from '../../core/SecurityUtils.js';
import { DeviceRegistry } from '../../core/DeviceRegistry.js';
// Modular components
import { init as initBluetoothWizard } from './list/BluetoothWizard.js';
import { init as initNetworkScanner } from './list/NetworkScanner.js';
import { init as initDeviceControl } from './list/DeviceControl.js';
import { init as initApprovalFlow } from './list/ApprovalFlow.js';
import { init as initFirmwareUpdate } from './list/FirmwareUpdate.js';
import { init as initBulkActions } from './list/BulkActions.js';

export class DeviceListPage {
    constructor(app) {
        this.app = app;
        this.dataTable = null;
        this.stats = { online: 0, offline: 0, pending: 0, esl: 0, esl_rtos: 0, esl_android: 0, hanshow_esl: 0, android_tv: 0, tablet: 0, mobile: 0, web_display: 0 };
        this.currentApprovalFilter = 'all';
        this.currentFilters = {
            type: '',
            status: '',
            group_id: '',
            location: '',
            ip_address: ''
        };
        this.deviceGroups = [];
        this.branches = [];
        // Modular components (initialized in init())
        this.bluetoothWizard = null;
        this.networkScanner = null;
        this.deviceControl = null;
        this.approvalFlow = null;
        this.bulkActions = null;
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
                    <span class="breadcrumb-current">${this.__('title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon cyan">
                            <i class="ti ti-device-desktop"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('title')}</h1>
                            <p class="page-subtitle">${this.__('subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <a href="${window.OmnexConfig?.basePath || ''}/player/" target="_blank" class="btn btn-outline" title="${this.__('pwaPlayer.openPlayer')}">
                            <i class="ti ti-device-tv"></i>
                            ${this.__('pwaPlayer.title')}
                        </a>
                        <button id="bluetooth-setup-btn" class="btn btn-outline" title="${this.__('bluetooth.title')}">
                            <i class="ti ti-bluetooth"></i>
                            ${this.__('bluetooth.title')}
                        </button>
                        <button id="scan-network-btn" class="btn btn-outline">
                            <i class="ti ti-radar-2"></i>
                            ${this.__('scanNetwork')}
                        </button>
                        <button id="add-device-btn" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.__('addDevice')}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stats -->
            <div class="device-stats">
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon" style="background-color: rgba(16, 185, 129, 0.1); color: #10b981;">
                            <i class="ti ti-circle-check"></i>
                        </div>
                        <div class="circular-progress" id="online-progress" style="--percent: 0">
                            <svg viewBox="0 0 40 40" width="40" height="40">
                                <circle class="progress-bg" cx="20" cy="20" r="18" fill="transparent" stroke-width="4"></circle>
                                <circle class="progress-fill" cx="20" cy="20" r="18" fill="transparent" stroke="#10b981" stroke-width="4" stroke-linecap="round"></circle>
                            </svg>
                            <span class="progress-text" id="online-percent">0%</span>
                        </div>
                    </div>
                    <p class="analytics-card-label">${this.__('stats.online')}</p>
                    <p class="analytics-card-value" id="online-count">0</p>
                    <p class="analytics-card-footer highlight" style="color: #10b981;">
                        <i class="ti ti-wifi"></i>
                        ${this.__('stats.activeConnection')}
                    </p>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon" style="background-color: rgba(107, 114, 128, 0.1); color: #6b7280;">
                            <i class="ti ti-circle-x"></i>
                        </div>
                        <span class="analytics-trend down" id="offline-trend" style="display: none;">
                            <i class="ti ti-alert-circle"></i>
                        </span>
                    </div>
                    <p class="analytics-card-label">${this.__('stats.offline')}</p>
                    <p class="analytics-card-value" id="offline-count">0</p>
                    <p class="analytics-card-footer">${this.__('stats.waitingConnection')}</p>
                </div>
                <div class="analytics-card clickable" id="pending-stats-card" style="cursor: pointer;">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon" style="background-color: rgba(245, 158, 11, 0.1); color: #f59e0b;">
                            <i class="ti ti-clock"></i>
                        </div>
                        <span class="analytics-trend" id="pending-trend" style="background-color: rgba(245, 158, 11, 0.1); color: #f59e0b; display: none;">
                            <i class="ti ti-alert-triangle"></i>
                        </span>
                    </div>
                    <p class="analytics-card-label">${this.__('stats.pending')}</p>
                    <p class="analytics-card-value" id="pending-count">0</p>
                    <p class="analytics-card-footer" style="color: #f59e0b;">
                        <i class="ti ti-hourglass"></i>
                        ${this.__('stats.awaitingApproval')}
                    </p>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon indigo">
                            <i class="ti ti-device-tablet"></i>
                        </div>
                        <span class="analytics-trend up" id="esl-trend">
                            <i class="ti ti-tag"></i>
                            ESL
                        </span>
                    </div>
                    <p class="analytics-card-label">${this.__('stats.eslLabel')}</p>
                    <p class="analytics-card-value" id="esl-count">0</p>
                    <p class="analytics-card-footer">${this.__('stats.electronicShelfLabel')}</p>
                </div>
                <div class="analytics-card">
                    <div class="analytics-card-header">
                        <div class="analytics-card-icon" style="background-color: rgba(139, 92, 246, 0.1); color: #8b5cf6;">
                            <i class="ti ti-device-tv"></i>
                        </div>
                        <span class="analytics-trend" style="background-color: rgba(139, 92, 246, 0.1); color: #8b5cf6;">
                            <i class="ti ti-cast"></i>
                            TV
                        </span>
                    </div>
                    <p class="analytics-card-label">${this.__('stats.tvSignage')}</p>
                    <p class="analytics-card-value" id="tv-count">0</p>
                    <p class="analytics-card-footer">${this.__('stats.digitalSignage')}</p>
                </div>
            </div>

            <!-- Devices Table -->
            <div class="card card-table">
                <div id="devices-table"></div>
            </div>

            <!-- Device Preview Popup -->
            <div id="device-preview-popup" class="device-preview-popup">
                <img id="device-preview-image" src="" alt="Preview">
                <div id="device-preview-icon" class="device-preview-icon-fallback" style="display:none;">
                    <i class="ti ti-device-desktop"></i>
                </div>
                <div class="preview-popup-info">
                    <span id="device-preview-name" class="preview-popup-name"></span>
                    <span id="device-preview-status" class="preview-popup-status"></span>
                </div>
            </div>
        `;
    }

    async init() {
        await this.loadDeviceGroups();
        await this.loadBranches();
        this.initDataTable();
        this.bindEvents();
        this.loadPendingCount();

        // Initialize modular components
        this.bluetoothWizard = initBluetoothWizard({
            app: this.app,
            __: this.__.bind(this),
            deviceGroups: this.deviceGroups,
            onDeviceAdded: () => this.dataTable?.refresh(),
            refreshDevices: () => this.dataTable?.refresh()
        });

        this.networkScanner = initNetworkScanner({
            app: this.app,
            __: this.__.bind(this),
            deviceGroups: this.deviceGroups,
            onDeviceAdded: () => this.dataTable?.refresh(),
            refreshDevices: () => this.dataTable?.refresh()
        });

        this.deviceControl = initDeviceControl({
            app: this.app,
            __: this.__.bind(this),
            refreshDevices: () => this.dataTable?.refresh()
        });

        this.approvalFlow = initApprovalFlow({
            app: this.app,
            __: this.__.bind(this),
            deviceGroups: this.deviceGroups,
            refreshDevices: () => this.dataTable?.refresh(),
            loadPendingCount: () => this.loadPendingCount(),
            escapeHtml: (str) => escapeHTML(str)
        });

        this.firmwareUpdate = initFirmwareUpdate({
            app: this.app,
            __: this.__.bind(this),
            refreshDevices: () => this.dataTable?.refresh(),
            formatFileSize: (bytes) => this.formatFileSize(bytes)
        });

        this.bulkActions = initBulkActions({
            app: this.app,
            __: this.__.bind(this),
            refreshTable: () => this.dataTable?.refresh(),
            deviceGroups: this.deviceGroups,
            onFiltersChange: (filters) => {
                // Sync filters with DeviceListPage
                this.currentFilters = {
                    type: filters.type || '',
                    status: filters.status || '',
                    group_id: filters.group_id || '',
                    location: filters.location || '',
                    ip_address: filters.ip_address || ''
                };
                if (filters.approval_status !== undefined) {
                    this.currentApprovalFilter = filters.approval_status;
                }
            }
        });
    }

    async loadDeviceGroups() {
        try {
            // Ürün grupları (kategoriler) - ürünlerdeki group alanından
            const response = await this.app.api.get('/products/groups');
            this.deviceGroups = response.data || [];
        } catch (error) {
            Logger.error('Failed to load product groups:', error);
            this.deviceGroups = [];
        }
    }

    async loadBranches() {
        try {
            const response = await this.app.api.get('/branches?hierarchy=1');
            this.branches = response.data?.all || response.data || [];
        } catch (error) {
            Logger.error('Failed to load branches:', error);
            this.branches = [];
        }
    }

    async loadPendingCount() {
        try {
            const response = await this.app.api.get('/esl/pending?status=pending&include_unbound=1');
            const pendingDevices = response.data || [];
            this.stats.pending = pendingDevices.length;
            document.getElementById('pending-count').textContent = this.stats.pending;

            // Show warning trend if there are pending devices
            const pendingTrend = document.getElementById('pending-trend');
            if (pendingTrend) {
                pendingTrend.style.display = this.stats.pending > 0 ? 'inline-flex' : 'none';
            }
        } catch (error) {
            Logger.error('Failed to load pending devices:', error);
        }
    }

    getDeviceTypeIcon(type, model) {
        // DeviceRegistry uzerinden cozumle
        return DeviceRegistry.getIcon({ type, model });
    }

    getBranchTypeIcon(type) {
        const icons = {
            'region': 'map-2',
            'store': 'building-store',
            'warehouse': 'building-warehouse',
            'online': 'world'
        };
        return icons[type] || 'building-store';
    }

    getDeviceTypeBadge(type, model) {
        // DeviceRegistry uzerinden cozumle
        return DeviceRegistry.getBadge({ type, model });
    }

    getApprovalStatusBadge(status) {
        const config = {
            'pending': { label: this.__('approvalStatuses.pending'), class: 'badge-warning' },
            'approved': { label: this.__('approvalStatuses.approved'), class: 'badge-success' },
            'rejected': { label: this.__('approvalStatuses.rejected'), class: 'badge-danger' }
        };
        return config[status] || { label: status || 'approved', class: 'badge-success' };
    }

    initDataTable() {
        const container = document.getElementById('devices-table');
        if (!container) return;

        this.dataTable = new DataTable(container, {
            serverSide: true,
            fetchData: (params) => this.fetchDevices(params),
            actionsDropdown: true,
            columns: [
                {
                    key: 'preview',
                    label: this.__('columns.preview'),
                    sortable: false,
                    preview: true,
                    render: (value, row) => {
                        const previewUrl = this.getDevicePreviewUrl(row);
                        const hasPreview = !!previewUrl;

                        if (hasPreview) {
                            return `
                                <div class="device-table-thumb"
                                     data-device-id="${row.id}"
                                     data-preview-url="${previewUrl}"
                                     data-device-name="${this.escapeHtml(row.name)}"
                                     data-device-status="${row.status}"
                                     data-device-type="${row.type || ''}">
                                    <img src="${previewUrl}" alt="${this.escapeHtml(row.name)}"
                                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'; this.parentElement.dataset.previewUrl='';">
                                    <i class="ti ${this.getDeviceTypeIcon(row.type)}" style="display:none;"></i>
                                </div>
                            `;
                        }
                        return `
                            <div class="device-table-thumb no-preview"
                                 data-device-id="${row.id}"
                                 data-device-name="${this.escapeHtml(row.name)}"
                                 data-device-status="${row.status}"
                                 data-device-type="${row.type || ''}">
                                <i class="ti ${this.getDeviceTypeIcon(row.type)}"></i>
                            </div>
                        `;
                    }
                },
                {
                    key: 'name',
                    label: this.__('columns.name'),
                    title: true,
                    sortable: true,
                    render: (value, row) => `
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full ${row.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}"></span>
                            <a href="#/devices/${row.id}" class="font-medium hover:text-primary">${escapeHTML(value)}</a>
                        </div>
                    `
                },
                {
                    key: 'type',
                    label: this.__('columns.type'),
                    sortable: true,
                    render: (value, row) => {
                        const c = this.getDeviceTypeBadge(value, row.model);
                        return `<span class="badge ${c.class}">${c.label}</span>`;
                    }
                },
                {
                    key: 'approval_status',
                    label: this.__('columns.approvalStatus'),
                    sortable: true,
                    render: (value) => {
                        const c = this.getApprovalStatusBadge(value);
                        return `<span class="badge ${c.class}">${c.label}</span>`;
                    }
                },
                {
                    key: 'serial_number',
                    label: this.__('columns.serialNumber'),
                    sortable: true,
                    render: (value) => value ? escapeHTML(value) : '-'
                },
                {
                    key: 'ip_address',
                    label: this.__('columns.ipAddress'),
                    sortable: true,
                    render: (value) => {
                        if (!value) return '-';
                        // Normalize IPv6 loopback to localhost
                        const normalizedIp = value === '::1' || value === '::ffff:127.0.0.1' ? 'localhost' : value;
                        return escapeHTML(normalizedIp);
                    }
                },
                {
                    key: 'location',
                    label: this.__('columns.location'),
                    sortable: true,
                    render: (value) => value ? escapeHTML(value) : '-'
                },
                {
                    key: 'communication_mode',
                    label: this.__('columns.communicationMode') || 'Mode',
                    sortable: true,
                    render: (value) => {
                        const mode = value || 'http-server';
                        const modeConfig = {
                            'http-server': {
                                label: this.__('communicationModes.http-server') || 'HTTP-SERVER',
                                icon: 'ti-world',
                                class: 'badge-info'
                            },
                            'mqtt': {
                                label: this.__('communicationModes.mqtt') || 'MQTT',
                                icon: 'ti-broadcast',
                                class: 'badge-warning'
                            },
                            'http': {
                                label: this.__('communicationModes.http') || 'HTTP',
                                icon: 'ti-cloud',
                                class: 'badge-secondary'
                            }
                        };
                        const cfg = modeConfig[mode] || modeConfig['http-server'];
                        return `<span class="badge ${cfg.class}"><i class="ti ${cfg.icon}"></i> ${cfg.label}</span>`;
                    }
                },
                {
                    key: 'branch_name',
                    label: this.__('form.fields.branch'),
                    sortable: true,
                    render: (value, row) => {
                        if (!value) return '-';
                        const icon = row.branch_type ? this.getBranchTypeIcon(row.branch_type) : 'building-store';
                        return `<span class="branch-badge"><i class="ti ti-${icon}"></i> ${escapeHTML(value)}</span>`;
                    }
                },
                {
                    key: 'status',
                    label: this.__('columns.status'),
                    sortable: true,
                    render: (value, row) => {
                        // Status badge
                        const statusConfig = {
                            online: { label: this.__('statuses.online'), class: 'badge-success' },
                            offline: { label: this.__('statuses.offline'), class: 'badge-secondary' },
                            error: { label: this.__('statuses.error'), class: 'badge-danger' }
                        };
                        const config = statusConfig[value] || { label: value, class: 'badge-secondary' };

                        let html = `<span class="badge ${config.class}">${config.label}</span>`;

                        // ✅ Connection quality indicator (for signage/player devices)
                        if (row.connection_quality && ['android_tv', 'web_display', 'esl'].includes(row.type)) {
                            const qualityIcons = {
                                excellent: `<i class="ti ti-wifi" style="color: #40c057" title="${this.__('connectionQuality.excellent')}"></i>`,
                                good: `<i class="ti ti-wifi" style="color: #fab005" title="${this.__('connectionQuality.good')}"></i>`,
                                poor: `<i class="ti ti-wifi-off" style="color: #fa5252" title="${this.__('connectionQuality.poor')}"></i>`,
                                disconnected: `<i class="ti ti-wifi-off" style="color: #868e96" title="${this.__('connectionQuality.disconnected')}"></i>`
                            };
                            html += ' ' + (qualityIcons[row.connection_quality] || '');

                            // Seconds ago tooltip
                            if (row.seconds_since_last_seen !== undefined) {
                                const ago = this.formatDuration(row.seconds_since_last_seen);
                                html += ` <span class="text-muted text-sm" title="${this.__('stats.lastSeen')}: ${ago}">(${ago})</span>`;
                            }
                        }

                        // Battery level (Hanshow ESL etc.)
                        if (row.battery_level != null) {
                            const bLvl = parseInt(row.battery_level);
                            const bIcon = bLvl > 70 ? 'battery-4' : bLvl > 40 ? 'battery-3' : bLvl > 15 ? 'battery-2' : 'battery-1';
                            const bColor = bLvl > 70 ? '#40c057' : bLvl > 40 ? '#fab005' : bLvl > 15 ? '#fd7e14' : '#fa5252';
                            const bTitle = row.battery_voltage ? `${row.battery_voltage}V` : '';
                            html += `<div style="margin-top:2px"><i class="ti ti-${bIcon}" style="color:${bColor}" title="${bTitle}"></i> <span class="text-muted text-sm">${bLvl}%</span></div>`;
                        }

                        return html;
                    }
                },
                {
                    key: 'screen_size',
                    label: this.__('columns.screenSize'),
                    sortable: false,
                    render: (value, row) => {
                        if (row.screen_width && row.screen_height) {
                            return `<span class="text-muted">${row.screen_width}x${row.screen_height}</span>`;
                        }
                        return '-';
                    }
                },
                {
                    key: 'current_playlist',
                    label: this.__('columns.currentPlaylist'),
                    sortable: false,
                    render: (value, row) => {
                        // Sadece signage cihazları için göster
                        if (!['android_tv', 'web_display'].includes(row.type)) {
                            return '-';
                        }

                        if (!row.current_playlist_id) {
                            return '<span class="text-muted">-</span>';
                        }

                        const index = row.current_playlist_index !== null ? row.current_playlist_index : 0;
                        const total = row.playlist_total_items || 0;
                        const progress = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;

                        let html = `
                            <div class="playlist-info" style="display: flex; align-items: center; gap: 8px;">
                                <i class="ti ti-playlist" style="color: var(--color-primary)"></i>
                                <div style="flex: 1">
                                    <div style="font-size: 13px; font-weight: 500;">
                                        ${index + 1} / ${total}
                                    </div>
                                    <div class="progress-bar" style="width: 80px; height: 4px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden; margin-top: 2px;">
                                        <div style="width: ${progress}%; height: 100%; background: var(--color-primary); transition: width 0.3s;"></div>
                                    </div>
                                </div>
                            </div>
                        `;

                        // Last sync tooltip ekle
                        if (row.last_sync) {
                            const syncAgo = this.formatRelativeTime(row.last_sync);
                            html = `<div title="${this.__('stats.lastSync')}: ${syncAgo}">${html}</div>`;
                        }

                        return html;
                    }
                },
                {
                    key: 'last_activity',
                    label: this.__('columns.lastActivity'),
                    sortable: true,
                    render: (value) => value ? this.formatRelativeTime(value) : '-'
                }
            ],
            actions: [
                {
                    name: 'approve',
                    icon: 'ti-check',
                    label: this.__('actions.approve'),
                    class: 'btn-ghost text-success',
                    visible: (row) => row.approval_status === 'pending',
                    onClick: (row) => this.showApproveModal(row)
                },
                {
                    name: 'reject',
                    icon: 'ti-x',
                    label: this.__('actions.reject'),
                    class: 'btn-ghost text-danger',
                    visible: (row) => row.approval_status === 'pending',
                    onClick: (row) => this.rejectDevice(row)
                },
                {
                    name: 'copy-stream-url',
                    icon: 'ti-copy',
                    label: this.__('stream.copyUrl'),
                    class: 'btn-ghost text-purple',
                    visible: (row) => (row.model === 'stream_player' || Number(row.stream_mode) === 1) && row.stream_token,
                    onClick: (row) => this.copyStreamUrl(row)
                },
                {
                    name: 'download-stream-playlist',
                    icon: 'ti-download',
                    label: `${this.__('actions.download')} M3U`,
                    class: 'btn-ghost text-info',
                    visible: (row) => (row.model === 'stream_player' || Number(row.stream_mode) === 1) && row.stream_token,
                    onClick: (row) => this.downloadStreamPlaylist(row)
                },
                {
                    name: 'history',
                    icon: 'ti-history',
                    label: this.__('actions.history'),
                    onClick: (row) => this.showHistory(row)
                },
                {
                    name: 'view',
                    icon: 'ti-eye',
                    label: this.__('actions.view'),
                    onClick: (row) => window.location.hash = `#/devices/${row.id}`
                },
                {
                    name: 'assign-playlist',
                    icon: 'ti-playlist',
                    label: this.__('actions.assignPlaylist'),
                    class: 'btn-ghost text-primary',
                    visible: (row) => row.approval_status !== 'pending' && (row.type === 'tv' || row.original_type === 'android_tv' || row.original_type === 'web_display' || row.model === 'pwa_player'),
                    onClick: (row) => this.bulkActions?.showAssignPlaylistModal(row)
                },
                {
                    name: 'play',
                    icon: 'ti-player-play',
                    label: this.__('actions.startBroadcast'),
                    class: 'btn-ghost text-success',
                    visible: (row) => row.approval_status === 'approved' && row.status === 'online' && (row.type === 'tv' || row.original_type === 'android_tv' || row.original_type === 'web_display' || row.model === 'pwa_player'),
                    onClick: (row) => this.bulkActions?.sendDeviceCommand(row.id, 'start', row.name)
                },
                {
                    name: 'stop',
                    icon: 'ti-player-stop',
                    label: this.__('actions.stopBroadcast'),
                    class: 'btn-ghost text-danger',
                    visible: (row) => row.approval_status === 'approved' && row.status === 'online' && (row.type === 'tv' || row.original_type === 'android_tv' || row.original_type === 'web_display' || row.model === 'pwa_player'),
                    onClick: (row) => this.bulkActions?.sendDeviceCommand(row.id, 'stop', row.name)
                },
                {
                    name: 'refresh',
                    icon: 'ti-refresh',
                    label: this.__('actions.refreshDevice'),
                    class: 'btn-ghost text-info',
                    visible: (row) => row.approval_status === 'approved' && row.status === 'online',
                    onClick: (row) => this.bulkActions?.controlDevice(row, 'refresh')
                },
                {
                    name: 'reboot',
                    icon: 'ti-power',
                    label: this.__('actions.rebootDevice'),
                    class: 'btn-ghost text-warning',
                    visible: (row) => row.approval_status === 'approved' && row.status === 'online',
                    onClick: (row) => this.bulkActions?.controlDevice(row, 'reboot')
                },
                {
                    name: 'clear_memory',
                    icon: 'ti-trash-x',
                    label: this.__('actions.clearMemory'),
                    class: 'btn-ghost text-danger',
                    visible: (row) => row.approval_status === 'approved' && row.status === 'online' && (row.db_type === 'esl' || row.type === 'esl' || row.original_type === 'esl' || row.original_type === 'esl_android' || row.model === 'esl_android' || row.model === 'PavoDisplay' || row.model === 'hanshow_esl' || (row.manufacturer && row.manufacturer.includes('Hanshow'))),
                    onClick: (row) => this.bulkActions?.controlDevice(row, 'clear_memory')
                },
                {
                    name: 'ping',
                    icon: 'ti-wifi',
                    label: this.__('actions.pingDevice'),
                    class: 'btn-ghost text-primary',
                    visible: (row) => (row.ip_address && (row.db_type === 'esl' || row.type === 'esl' || row.original_type === 'esl' || row.original_type === 'esl_android' || row.model === 'esl_android' || row.model === 'PavoDisplay')) || row.model === 'hanshow_esl' || (row.manufacturer && row.manufacturer.includes('Hanshow')),
                    onClick: (row) => this.bulkActions?.controlDevice(row, 'ping')
                },
                {
                    name: 'led_flash',
                    icon: 'ti-bulb',
                    label: this.__('actions.ledFlash'),
                    class: 'btn-ghost text-success',
                    visible: (row) => row.approval_status === 'approved' && (row.model === 'hanshow_esl' || (row.manufacturer && row.manufacturer.includes('Hanshow'))),
                    onClick: (row) => this.bulkActions?.controlDevice(row, 'led_flash')
                },
                {
                    name: 'settings',
                    icon: 'ti-settings',
                    label: this.__('actions.settings'),
                    class: 'btn-ghost text-secondary',
                    visible: (row) => row.ip_address && (row.db_type === 'esl' || row.type === 'esl' || row.original_type === 'esl' || row.original_type === 'esl_android' || row.model === 'esl_android' || row.model === 'PavoDisplay'),
                    onClick: (row) => this.deviceControl?.show(row)
                },
                {
                    name: 'edit',
                    icon: 'ti-edit',
                    label: this.__('actions.edit'),
                    onClick: (row) => this.showDeviceModal(row)
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('actions.delete'),
                    class: 'btn-ghost text-danger',
                    onClick: (row) => this.delete(row)
                }
            ],
            toolbar: {
                show: true,
                exports: true,
                filters: true,
                customFilters: this.renderToolbarFilters(),
                onFilterClick: () => this.bulkActions?.showFilterModal()
            },
            exportFilename: this.__('exportFilename'),
            exportTitle: this.__('title'),
            searchPlaceholder: this.__('list.searchPlaceholder'),
            emptyText: this.__('list.emptyText'),
            emptyIcon: 'ti-device-tablet-off'
        });
    }

    renderToolbarFilters() {
        const branchOptions = this.branches.map(b =>
            `<option value="${b.id}">${this.escapeHtml(b.name)}</option>`
        ).join('');

        return `
            <div class="form-group" style="margin-bottom: 0; min-width: 150px;">
                <select id="branch-filter" class="form-select form-select-sm">
                    <option value="">${this.__('filters.allBranches')}</option>
                    ${branchOptions}
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0; min-width: 150px;">
                <select id="approval-filter" class="form-select form-select-sm">
                    <option value="all">${this.__('filters.allApproval')}</option>
                    <option value="pending">${this.__('approvalStatuses.pending')}</option>
                    <option value="approved">${this.__('approvalStatuses.approved')}</option>
                    <option value="rejected">${this.__('approvalStatuses.rejected')}</option>
                </select>
            </div>
        `;
    }

    renderApprovalFilter() {
        return `
            <div class="form-group" style="margin-bottom: 0; min-width: 150px;">
                <select id="approval-filter" class="form-select form-select-sm">
                    <option value="all">${this.__('filters.allApproval')}</option>
                    <option value="pending">${this.__('approvalStatuses.pending')}</option>
                    <option value="approved">${this.__('approvalStatuses.approved')}</option>
                    <option value="rejected">${this.__('approvalStatuses.rejected')}</option>
                </select>
            </div>
        `;
    }

    async fetchDevices(params) {
        try {
            const queryParams = new URLSearchParams({
                page: params.page,
                per_page: params.limit
            });

            if (params.search) queryParams.append('search', params.search);
            if (params.sort_by) queryParams.append('sort_by', params.sort_by);
            if (params.sort_dir) queryParams.append('sort_dir', params.sort_dir);

            // Apply approval status filter
            if (this.currentApprovalFilter && this.currentApprovalFilter !== 'all') {
                queryParams.append('approval_status', this.currentApprovalFilter);
            }

            // Apply filters from filter modal
            if (this.currentFilters.type) {
                queryParams.append('type', this.currentFilters.type);
            }
            if (this.currentFilters.status) {
                queryParams.append('status', this.currentFilters.status);
            }
            if (this.currentFilters.group_id) {
                queryParams.append('group_id', this.currentFilters.group_id);
            }
            if (this.currentFilters.branch_id) {
                queryParams.append('branch_id', this.currentFilters.branch_id);
            }
            // Location and IP can be added to search if provided
            if (this.currentFilters.location || this.currentFilters.ip_address) {
                const additionalSearch = [
                    this.currentFilters.location,
                    this.currentFilters.ip_address
                ].filter(Boolean).join(' ');

                // Combine with existing search if any
                const existingSearch = params.search || '';
                const combinedSearch = [existingSearch, additionalSearch].filter(Boolean).join(' ');
                if (combinedSearch) {
                    queryParams.set('search', combinedSearch);
                }
            }

            const response = await this.app.api.get(`/devices?${queryParams}`);
            const data = response.data || [];

            this.updateStatsFromData(data);

            return {
                data: data,
                total: response.meta?.total || data.length
            };
        } catch (error) {
            Logger.error('Devices fetch error:', error);
            return { data: [], total: 0 };
        }
    }

    updateStatsFromData(devices) {
        const total = devices.length || 1;

        // Count by status
        this.stats.online = devices.filter(d => d.status === 'online').length;
        this.stats.offline = devices.filter(d => d.status === 'offline').length;

        // Count all ESL types combined for the ESL card
        const eslTypes = ['esl', 'esl_rtos', 'esl_android', 'hanshow_esl'];
        const eslCount = devices.filter(d => eslTypes.includes(d.type)).length;

        // Count all TV/display types combined for the TV card
        const tvTypes = ['tv', 'android_tv', 'tablet', 'mobile', 'web_display'];
        const tvCount = devices.filter(d => tvTypes.includes(d.type)).length;

        const onlinePercent = Math.round((this.stats.online / total) * 100);

        document.getElementById('online-count').textContent = this.stats.online;
        document.getElementById('offline-count').textContent = this.stats.offline;
        document.getElementById('esl-count').textContent = eslCount;
        document.getElementById('tv-count').textContent = tvCount;

        // Update circular progress
        const progressEl = document.getElementById('online-progress');
        const percentEl = document.getElementById('online-percent');
        if (progressEl) progressEl.style.setProperty('--percent', onlinePercent);
        if (percentEl) percentEl.textContent = `${onlinePercent}%`;

        // Show offline warning if any
        const offlineTrend = document.getElementById('offline-trend');
        if (offlineTrend) {
            offlineTrend.style.display = this.stats.offline > 0 ? 'inline-flex' : 'none';
        }
    }

    bindEvents() {
        document.getElementById('add-device-btn')?.addEventListener('click', () => {
            this.showDeviceModal();
        });

        document.getElementById('scan-network-btn')?.addEventListener('click', () => {
            this.networkScanner?.show();
        });

        document.getElementById('bluetooth-setup-btn')?.addEventListener('click', () => {
            this.bluetoothWizard?.show();
        });

        // Pending stats card click - show pending sync requests modal
        document.getElementById('pending-stats-card')?.addEventListener('click', () => {
            this.approvalFlow?.show();
        });

        // Watch for filter changes after DataTable renders
        setTimeout(() => {
            document.getElementById('approval-filter')?.addEventListener('change', (e) => {
                this.currentApprovalFilter = e.target.value;
                this.dataTable?.refresh();
            });

            document.getElementById('branch-filter')?.addEventListener('change', (e) => {
                this.currentFilters.branch_id = e.target.value || null;
                this.dataTable?.refresh();
            });

            // Bind preview hover events after table renders
            this.bindPreviewEvents();
        }, 100);
    }

    /**
     * Bind hover events for device preview popups
     */
    bindPreviewEvents() {
        const table = document.getElementById('devices-table');
        const popup = document.getElementById('device-preview-popup');
        if (!table || !popup) return;

        // Remove existing listeners
        table.removeEventListener('mouseover', this.handlePreviewMouseOver);
        table.removeEventListener('mouseout', this.handlePreviewMouseOut);

        // Create bound handlers
        this.handlePreviewMouseOver = (e) => {
            const thumb = e.target.closest('.device-table-thumb');
            if (!thumb) return;

            const previewUrl = thumb.dataset.previewUrl;
            const deviceName = thumb.dataset.deviceName;
            const deviceStatus = thumb.dataset.deviceStatus;
            const deviceType = thumb.dataset.deviceType;

            const popupImg = document.getElementById('device-preview-image');
            const popupIcon = document.getElementById('device-preview-icon');
            const popupName = document.getElementById('device-preview-name');
            const popupStatus = document.getElementById('device-preview-status');

            const iconClass = this.getDeviceTypeIcon(deviceType);
            popupIcon.querySelector('i').className = `ti ${iconClass}`;

            if (previewUrl) {
                popupImg.src = previewUrl;
                popupImg.style.display = 'block';
                popupIcon.style.display = 'none';
                popupImg.onerror = () => {
                    popupImg.style.display = 'none';
                    popupIcon.style.display = 'flex';
                };
            } else {
                popupImg.style.display = 'none';
                popupIcon.style.display = 'flex';
            }

            popupName.textContent = deviceName;
            popupStatus.textContent = deviceStatus === 'online' ? this.__('statuses.online') : this.__('statuses.offline');
            popupStatus.className = `preview-popup-status ${deviceStatus}`;

            // Position popup
            const rect = thumb.getBoundingClientRect();
            const popupWidth = 280;
            const popupHeight = 320;

            let left = rect.right + 10;
            let top = rect.top - 20;

            // Adjust if goes off screen
            if (left + popupWidth > window.innerWidth) {
                left = rect.left - popupWidth - 10;
            }
            if (top + popupHeight > window.innerHeight) {
                top = window.innerHeight - popupHeight - 10;
            }
            if (top < 10) top = 10;

            popup.style.left = `${left}px`;
            popup.style.top = `${top}px`;
            popup.classList.add('visible');
        };

        this.handlePreviewMouseOut = (e) => {
            const thumb = e.target.closest('.device-table-thumb');
            if (!thumb) return;

            // Check if moving to popup itself
            const related = e.relatedTarget;
            if (related && (related.closest('.device-preview-popup') || related.closest('.device-table-thumb'))) {
                return;
            }

            popup.classList.remove('visible');
        };

        table.addEventListener('mouseover', this.handlePreviewMouseOver);
        table.addEventListener('mouseout', this.handlePreviewMouseOut);

        // Hide popup when mouse leaves it
        popup.addEventListener('mouseleave', () => {
            popup.classList.remove('visible');
        });
    }

    /**
     * Get device preview URL
     * Uses MediaUtils for cross-environment compatibility
     */
    getDevicePreviewUrl(row) {
        // If device has preview_url (already resolved by backend), use it
        if (row.preview_url) {
            return MediaUtils.getDisplayUrl(row.preview_url);
        }

        // If device has current_content (could be template path or rendered image)
        if (row.current_content) {
            // Skip raw UUIDs - they are media IDs, not file paths
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.current_content)) {
                return '';
            }
            // Skip JSON-like content
            if (row.current_content.startsWith('{') || row.current_content.startsWith('[')) {
                return '';
            }
            return MediaUtils.getDisplayUrl(row.current_content);
        }

        return '';
    }

    /**
     * Escape HTML to prevent XSS
     * Delegates to centralized SecurityUtils.escapeHTML
     */
    escapeHtml(text) {
        return escapeHTML(text);
    }

    formatRelativeTime(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return this.__('time.now');
        if (minutes < 60) return this.__('time.minutesAgo', { count: minutes });
        if (minutes < 1440) return this.__('time.hoursAgo', { count: Math.floor(minutes / 60) });
        return this.__('time.daysAgo', { count: Math.floor(minutes / 1440) });
    }

    /**
     * Format seconds to human-readable duration
     */
    formatDuration(seconds) {
        if (seconds < 60) return `${seconds}sn`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}dk`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}sa`;
        return `${Math.floor(seconds / 86400)}g`;
    }

    getStreamPlaylistUrl(device, options = {}) {
        const basePath = window.OmnexConfig?.basePath || '';
        const baseUrl = `${window.location.origin}${basePath}`;
        const token = device?.stream_token;
        if (!token) return '';

        const params = new URLSearchParams();
        if (options.download) params.set('download', '1');
        if (options.profile) params.set('profile', String(options.profile));
        if (options.label === false) params.set('label', '0');
        if (options.mode) params.set('mode', String(options.mode));
        const qs = params.toString();

        return `${baseUrl}/api/stream/${token}/playlist.m3u${qs ? `?${qs}` : ''}`;
    }

    extractStreamHeight(value) {
        const raw = String(value || '').trim();
        if (!raw) return null;

        const sizeMatch = raw.match(/(\d{3,4})\s*x\s*(\d{3,4})/i);
        if (sizeMatch) {
            return Math.max(Number(sizeMatch[1]), Number(sizeMatch[2]));
        }

        const pMatch = raw.match(/(\d{3,4})\s*p/i);
        if (pMatch) {
            return Number(pMatch[1]);
        }

        if (/^\d{3,4}$/.test(raw)) {
            return Number(raw);
        }

        return null;
    }

    resolveStreamProfile(device) {
        let profileData = null;

        if (device?.device_profile && typeof device.device_profile === 'object') {
            profileData = device.device_profile;
        } else if (typeof device?.device_profile === 'string') {
            try {
                profileData = JSON.parse(device.device_profile);
            } catch (_) {
                profileData = null;
            }
        }

        let height = null;
        if (profileData) {
            const keys = ['max_res', 'max_resolution', 'resolution', 'max_profile', 'max_height'];
            for (const key of keys) {
                height = this.extractStreamHeight(profileData[key]);
                if (height) break;
            }
        }

        if (!height) {
            const screenW = Number(device?.screen_width || 0);
            const screenH = Number(device?.screen_height || 0);
            height = Math.max(screenW, screenH);
        }

        if (!height || Number.isNaN(height)) return '720p';
        if (height <= 360) return '360p';
        if (height <= 540) return '540p';
        if (height <= 720) return '720p';
        return '1080p';
    }

    getStreamVariantUrl(device, profile = '720p') {
        const basePath = window.OmnexConfig?.basePath || '';
        const baseUrl = `${window.location.origin}${basePath}`;
        const token = device?.stream_token;
        if (!token) return '';
        return `${baseUrl}/api/stream/${token}/variant/${profile}/playlist.m3u8`;
    }

    async resolveDirectStreamUrl(device) {
        const fallbackProfile = this.resolveStreamProfile(device);
        const fallbackVariantUrl = this.getStreamVariantUrl(device, fallbackProfile);
        const resolverUrl = this.getStreamPlaylistUrl(device, { mode: 'redirect', label: false });

        if (!resolverUrl) {
            return fallbackVariantUrl;
        }

        try {
            const response = await fetch(resolverUrl, {
                method: 'GET',
                redirect: 'follow',
                cache: 'no-store'
            });

            const targetHeader = response.headers?.get('X-Stream-Target');
            const resolvedUrl = (response.url || '').trim();

            if (resolvedUrl && resolvedUrl.includes('/variant/') && resolvedUrl.endsWith('/playlist.m3u8')) {
                return resolvedUrl;
            }
            if (targetHeader && targetHeader.includes('/variant/') && targetHeader.endsWith('/playlist.m3u8')) {
                return targetHeader;
            }
        } catch (error) {
            Logger.warning('Stream resolver fallback used', error);
        }

        return fallbackVariantUrl;
    }

    async copyStreamUrl(device) {
        if (!device.stream_token) {
            Toast.error(this.__('stream.noToken'));
            return;
        }
        const streamUrl = await this.resolveDirectStreamUrl(device);
        navigator.clipboard.writeText(streamUrl).then(() => {
            Toast.success(this.__('stream.copied'));
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = streamUrl;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            Toast.success(this.__('stream.copied'));
        });
    }

    async downloadStreamPlaylist(device) {
        if (!device.stream_token) {
            Toast.error(this.__('stream.noToken'));
            return;
        }

        const directUrl = await this.resolveDirectStreamUrl(device);
        const streamTitleRaw = String(device?.name || 'Omnex Live')
            .replace(/[\r\n]+/g, ' ')
            .trim();
        const streamTitle = (streamTitleRaw || 'Omnex Live').replace(/"/g, '\'');
        const lines = [
            '#EXTM3U',
            `#EXTINF:-1 tvg-id="" tvg-name="${streamTitle}" group-title="Omnex",${streamTitle}`,
            '#EXTVLCOPT:no-video-title-show',
            '#EXTVLCOPT:input-title-format=',
            directUrl,
            ''
        ];
        const content = lines.join('\n');
        const blob = new Blob([content], { type: 'application/x-mpegURL;charset=utf-8' });
        const objectUrl = URL.createObjectURL(blob);
        const safeName = String(device?.name || 'omnex-stream')
            .toLowerCase()
            .replace(/[^a-z0-9-_]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `${safeName || 'omnex-stream'}.m3u`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);
    }

    showHistory(device) {
        Toast.info(this.__('historyFeature'));
    }

    showDeviceModal(device = null) {
        const isEdit = !!device;
        const basePath = window.OmnexConfig?.basePath || '';

        const groupOptions = this.deviceGroups.map(g =>
            `<option value="${g.id}" ${device?.group_id === g.id ? 'selected' : ''}>${escapeHTML(g.name)}</option>`
        ).join('');

        // Preview image URL - use resolved preview_url, not raw current_content (may be UUID)
        const previewUrl = device ? this.getDevicePreviewUrl(device) : '';
        const hasPreview = !!previewUrl;

        // Calculate preview container dimensions based on device screen size
        const previewDimensions = this.calculatePreviewDimensions(device?.screen_width, device?.screen_height);

        const formContent = `
            <form id="device-form" class="space-y-4">
                ${!isEdit ? `
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.syncCode')}</label>
                    <input type="text" id="device-sync-code" class="form-input" maxlength="6"
                        placeholder="${this.__('form.placeholders.syncCode')}">
                    <p class="form-hint">${this.__('form.hints.syncCode')}</p>
                </div>
                <hr style="margin: 1rem 0; border-color: var(--border-color);">
                ` : ''}

                <!-- Preview Image Upload Section -->
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.previewImage')}</label>
                    <div class="device-preview-upload-container" style="display: flex; gap: 1rem; align-items: flex-start;">
                        <div class="device-preview-thumbnail" id="device-preview-container" style="width: ${previewDimensions.width}px; height: ${previewDimensions.height}px; border: 2px dashed var(--border-color); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--bg-secondary); position: relative;">
                            ${hasPreview ? `
                                <img src="${this.getDisplayUrl(previewUrl)}" alt="Preview" id="device-preview-img" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.style.display='none'; document.getElementById('device-preview-placeholder')?.style && (document.getElementById('device-preview-placeholder').style.display='flex');">
                                <div id="device-preview-placeholder" style="display: none; text-align: center; color: var(--text-muted); flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%;">
                                    <i class="ti ti-photo" style="font-size: 32px;"></i>
                                    <p style="font-size: 11px; margin-top: 4px;">${this.__('noPreview')}</p>
                                </div>
                                <button type="button" id="remove-preview-btn" class="btn-icon-xs" style="position: absolute; top: 4px; right: 4px; background: rgba(250,82,82,0.9); color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none;">
                                    <i class="ti ti-x" style="font-size: 14px;"></i>
                                </button>
                            ` : `
                                <div id="device-preview-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--text-muted); width: 100%; height: 100%;">
                                    <i class="ti ti-photo" style="font-size: 32px;"></i>
                                    <p style="font-size: 11px; margin-top: 4px;">${this.__('noPreview')}</p>
                                </div>
                            `}
                        </div>
                        <div style="flex: 1;">
                            <label class="btn btn-sm btn-outline" style="display: inline-flex; cursor: pointer;">
                                <i class="ti ti-upload"></i>
                                <span>${this.__('form.fields.uploadPreview')}</span>
                                <input type="file" id="device-preview-upload" accept="image/*" hidden>
                            </label>
                            <p class="form-hint" style="margin-top: 0.5rem;">${this.__('form.hints.previewImage')}</p>
                            <input type="hidden" id="device-preview-url" value="${previewUrl}">
                            <input type="hidden" id="device-preview-changed" value="0">
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.name')} *</label>
                    <input type="text" id="device-name" class="form-input" required
                        value="${escapeHTML(device?.name || '')}" placeholder="${this.__('form.placeholders.name')}">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.type')} *</label>
                        <select id="device-type" class="form-select" required>
                            <option value="esl" ${device?.type === 'esl' ? 'selected' : ''}>${this.__('types.esl')}</option>
                            <option value="esl_rtos" ${device?.type === 'esl_rtos' ? 'selected' : ''}>${this.__('types.esl_rtos')}</option>
                            <option value="esl_android" ${device?.type === 'esl_android' ? 'selected' : ''}>${this.__('types.esl_android')}</option>
                            <option value="hanshow_esl" ${device?.type === 'hanshow_esl' || device?.model === 'hanshow_esl' ? 'selected' : ''}>${this.__('types.hanshow_esl')}</option>
                            <option value="android_tv" ${device?.type === 'android_tv' ? 'selected' : ''}>${this.__('types.android_tv')}</option>
                            <option value="tablet" ${device?.type === 'tablet' ? 'selected' : ''}>${this.__('types.tablet')}</option>
                            <option value="mobile" ${device?.type === 'mobile' ? 'selected' : ''}>${this.__('types.mobile')}</option>
                            <option value="web_display" ${device?.type === 'web_display' ? 'selected' : ''}>${this.__('types.web_display')}</option>
                            <option value="tv" ${device?.type === 'tv' ? 'selected' : ''}>${this.__('types.tv')}</option>
                            <option value="stream_player" ${device?.model === 'stream_player' ? 'selected' : ''}>${this.__('stream.modeStream')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.status')}</label>
                        <select id="device-status" class="form-select">
                            <option value="offline" ${device?.status !== 'online' ? 'selected' : ''}>${this.__('statuses.offline')}</option>
                            <option value="online" ${device?.status === 'online' ? 'selected' : ''}>${this.__('statuses.online')}</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.group')}</label>
                    <select id="device-group" class="form-select">
                        <option value="">${this.__('form.placeholders.selectGroup')}</option>
                        ${groupOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.branch')}</label>
                    <select id="device-branch" class="form-select">
                        <option value="">${this.__('form.placeholders.selectBranch')}</option>
                        ${this.branches.map(b => `
                            <option value="${b.id}" ${device?.branch_id === b.id ? 'selected' : ''}>
                                ${escapeHTML(b.name)} (${b.type === 'region' ? this.__('branches.region') : this.__('branches.branch')})
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.serialNumber')}</label>
                    <input type="text" id="device-serial" class="form-input"
                        value="${escapeHTML(device?.serial_number || '')}" placeholder="${this.__('form.placeholders.serialNumber')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.ipAddress')}</label>
                    <input type="text" id="device-ip" class="form-input"
                        value="${escapeHTML(device?.ip_address || '')}" placeholder="${this.__('form.placeholders.ipAddress')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.location')}</label>
                    <input type="text" id="device-location" class="form-input"
                        value="${escapeHTML(device?.location || '')}" placeholder="${this.__('form.placeholders.location')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.macAddress')}</label>
                    <input type="text" id="device-mac" class="form-input"
                        value="${escapeHTML(device?.mac_address || '')}" placeholder="${this.__('form.placeholders.macAddress')}">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.screenWidth')}</label>
                        <input type="number" id="device-screen-width" class="form-input"
                            value="${device?.screen_width || ''}" placeholder="${this.__('form.placeholders.screenWidth')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.screenHeight')}</label>
                        <input type="number" id="device-screen-height" class="form-input"
                            value="${device?.screen_height || ''}" placeholder="${this.__('form.placeholders.screenHeight')}">
                    </div>
                </div>
                <input type="hidden" id="device-id" value="${device?.id || ''}">
            </form>
        `;

        Modal.show({
            title: isEdit ? this.__('editDevice') : this.__('addDevice'),
            icon: 'ti-device-tablet',
            content: formContent,
            size: 'md',
            confirmText: isEdit ? this.__('modal.update') : this.__('modal.save'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this.saveDevice();
            }
        });

        // Bind preview upload events after modal is shown
        setTimeout(() => {
            this.bindPreviewUploadEvents();
        }, 100);
    }

    /**
     * Bind preview image upload events
     */
    bindPreviewUploadEvents() {
        const uploadInput = document.getElementById('device-preview-upload');
        const removeBtn = document.getElementById('remove-preview-btn');

        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handlePreviewImageSelect(file);
                }
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                this.removePreviewImage();
            });
        }
    }

    /**
     * Handle preview image selection
     */
    handlePreviewImageSelect(file) {
        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            Toast.error(this.__('validation.fileTooLarge'));
            return;
        }

        // Validate file type
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            Toast.error(this.__('validation.invalidFileType'));
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const container = document.getElementById('device-preview-container');
            if (container) {
                container.innerHTML = `
                    <img src="${e.target.result}" alt="Preview" id="device-preview-img" style="width: 100%; height: 100%; object-fit: contain;">
                    <button type="button" id="remove-preview-btn" class="btn-icon-xs" style="position: absolute; top: 4px; right: 4px; background: rgba(250,82,82,0.9); color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none;">
                        <i class="ti ti-x" style="font-size: 14px;"></i>
                    </button>
                `;
                // Re-bind remove button
                document.getElementById('remove-preview-btn')?.addEventListener('click', () => {
                    this.removePreviewImage();
                });
            }

            // Mark as changed and store the base64 data
            document.getElementById('device-preview-changed').value = '1';
            document.getElementById('device-preview-url').value = e.target.result;
        };
        reader.readAsDataURL(file);

        // Store the file for upload
        this._pendingPreviewFile = file;
    }

    /**
     * Remove preview image
     */
    removePreviewImage() {
        const container = document.getElementById('device-preview-container');
        if (container) {
            container.innerHTML = `
                <div id="device-preview-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--text-muted); width: 100%; height: 100%;">
                    <i class="ti ti-photo" style="font-size: 32px;"></i>
                    <p style="font-size: 11px; margin-top: 4px;">${this.__('noPreview')}</p>
                </div>
            `;
        }

        document.getElementById('device-preview-changed').value = '1';
        document.getElementById('device-preview-url').value = '';
        this._pendingPreviewFile = null;
    }

    /**
     * Calculate preview container dimensions based on device screen dimensions
     * Returns dimensions that maintain aspect ratio within a max container size
     */
    calculatePreviewDimensions(screenWidth, screenHeight) {
        const maxWidth = 140;
        const maxHeight = 180;
        const defaultWidth = 120;
        const defaultHeight = 160;

        if (!screenWidth || !screenHeight) {
            return { width: defaultWidth, height: defaultHeight };
        }

        const aspectRatio = screenWidth / screenHeight;

        let width, height;

        if (aspectRatio > 1) {
            // Horizontal (landscape)
            width = maxWidth;
            height = Math.round(width / aspectRatio);
            if (height > maxHeight) {
                height = maxHeight;
                width = Math.round(height * aspectRatio);
            }
        } else if (aspectRatio < 1) {
            // Vertical (portrait)
            height = maxHeight;
            width = Math.round(height * aspectRatio);
            if (width > maxWidth) {
                width = maxWidth;
                height = Math.round(width / aspectRatio);
            }
        } else {
            // Square
            width = Math.min(maxWidth, maxHeight);
            height = width;
        }

        // Ensure minimum dimensions
        width = Math.max(80, width);
        height = Math.max(80, height);

        return { width, height };
    }

    /**
     * Get display URL for preview images
     */
    getDisplayUrl(url) {
        if (!url) return '';
        const basePath = window.OmnexConfig?.basePath || '';

        // If it's a data URL (base64), return as is
        if (url.startsWith('data:')) {
            return url;
        }

        // If it's an absolute URL, return as is
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // If it's a relative path
        if (url.startsWith('/')) {
            return basePath + url;
        }

        // Otherwise, assume it's a storage path
        return `${basePath}/storage/${url}`;
    }

    isValidIpAddress(ip) {
        const value = String(ip || '').trim();
        // Allow localhost
        if (value === 'localhost') return true;
        // IPv4: 0-255.0-255.0-255.0-255
        const ipv4Match = value.match(/^(\d{1,3}\.){3}\d{1,3}$/);
        if (ipv4Match) {
            return value.split('.').every(part => {
                const octet = Number(part);
                return Number.isInteger(octet) && octet >= 0 && octet <= 255;
            });
        }
        // IPv6: ::1, fe80::1, full form, etc.
        const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]+|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;
        if (ipv6Regex.test(value)) return true;
        return false;
    }

    isEslFamilyType(type) {
        return ['esl', 'esl_rtos', 'esl_android', 'hanshow_esl'].includes(String(type || '').trim());
    }

    async findDeviceByIp(ipAddress, excludeDeviceId = null) {
        const ip = String(ipAddress || '').trim();
        if (!ip) return null;

        try {
            const response = await this.app.api.get('/devices', {
                search: ip,
                per_page: 100
            });
            const devices = Array.isArray(response?.data) ? response.data : [];

            return devices.find(device => {
                const sameIp = String(device?.ip_address || '').trim() === ip;
                const sameDevice = excludeDeviceId && String(device?.id) === String(excludeDeviceId);
                return sameIp && !sameDevice;
            }) || null;
        } catch (error) {
            Logger.warn('Device IP conflict check failed', error);
            return null;
        }
    }

    async saveDevice() {
        const id = document.getElementById('device-id')?.value;
        const syncCode = document.getElementById('device-sync-code')?.value?.trim();
        const name = document.getElementById('device-name')?.value?.trim();
        const type = document.getElementById('device-type')?.value;
        const status = document.getElementById('device-status')?.value;
        const group_id = document.getElementById('device-group')?.value || null;
        const branch_id = document.getElementById('device-branch')?.value || null;
        const serial_number = document.getElementById('device-serial')?.value?.trim();
        const ip_address = document.getElementById('device-ip')?.value?.trim();
        const location = document.getElementById('device-location')?.value?.trim();
        const mac_address = document.getElementById('device-mac')?.value?.trim();
        const screen_width = document.getElementById('device-screen-width')?.value ? parseInt(document.getElementById('device-screen-width').value) : null;
        const screen_height = document.getElementById('device-screen-height')?.value ? parseInt(document.getElementById('device-screen-height').value) : null;

        // Preview image handling
        const previewChanged = document.getElementById('device-preview-changed')?.value === '1';
        const previewFileInput = document.getElementById('device-preview-upload');
        const currentPreviewUrl = document.getElementById('device-preview-url')?.value;

        if (!name) {
            Toast.error(this.__('validation.nameRequired'));
            throw new Error('Validation failed');
        }

        if (ip_address && !this.isValidIpAddress(ip_address)) {
            Toast.error(this.__('messages.invalidIpFormat'));
            throw new Error('Validation failed');
        }

        try {
            if (ip_address && this.isEslFamilyType(type)) {
                const existingDevice = await this.findDeviceByIp(ip_address, id);
                if (existingDevice) {
                    const existingName = existingDevice.name || existingDevice.id || this.__('messages.unknownDevice');
                    const message = this.__('messages.ipAlreadyInUse', { name: existingName });
                    Toast.warning(message);
                    throw new Error(message);
                }
            }

            let deviceId = id;
            let previewUrl = currentPreviewUrl;

            // If sync code is provided (new device only), use the approve endpoint
            if (!id && syncCode && syncCode.length === 6) {
                const response = await this.app.api.post('/esl/approve', {
                    sync_code: syncCode,
                    name: name,
                    type: type,
                    group_id: group_id,
                    branch_id: branch_id,
                    location: location
                });
                deviceId = response.data?.device?.id;
                Toast.success(this.__('toast.approved'));
                this.loadPendingCount();
            } else {
                // Normal device create/update
                // Stream player uses android_tv type + stream_player model (SQLite CHECK constraint)
                let finalType = type;
                let model = null;
                let stream_mode = 0;
                if (type === 'stream_player') {
                    finalType = 'android_tv';
                    model = 'stream_player';
                    stream_mode = 1;
                }
                const data = { name, type: finalType, status, group_id, branch_id, serial_number, ip_address, location, mac_address, screen_width, screen_height };
                if (model) data.model = model;
                data.stream_mode = stream_mode;

                if (id) {
                    await this.app.api.put(`/devices/${id}`, data);
                    Toast.success(this.__('toast.updated'));
                } else {
                    const response = await this.app.api.post('/devices', data);
                    deviceId = response.data?.id;
                    Toast.success(this.__('toast.created'));
                }
            }

            // Handle preview image upload/delete if changed
            if (previewChanged && deviceId) {
                const hasNewFile = this._pendingPreviewFile != null;

                if (hasNewFile) {
                    // Upload new preview image
                    const formData = new FormData();
                    formData.append('file', this._pendingPreviewFile);
                    formData.append('device_id', deviceId);

                    try {
                        const uploadResponse = await this.app.api.upload(`/devices/${deviceId}/upload-preview`, formData);
                        if (uploadResponse.success) {
                            previewUrl = uploadResponse.data?.preview_url;
                            this._pendingPreviewFile = null; // Clear after successful upload
                        }
                    } catch (uploadError) {
                        console.warn('Preview upload failed:', uploadError);
                        Toast.warning(this.__('toast.previewUploadFailed'));
                    }
                } else if (!currentPreviewUrl || currentPreviewUrl === '') {
                    // Preview was removed, delete from server
                    try {
                        await this.app.api.delete(`/devices/${deviceId}/preview`);
                    } catch (deleteError) {
                        console.warn('Preview delete failed:', deleteError);
                    }
                }
            }

            this.dataTable?.refresh();
        } catch (error) {
            Toast.error(error.message || this.__('toast.saveFailed'));
            throw error;
        }
    }

    showApproveModal(device) {
        const groupOptions = this.deviceGroups.map(g =>
            `<option value="${g.id}">${escapeHTML(g.name)}</option>`
        ).join('');

        const formContent = `
            <form id="approve-form" class="space-y-4">
                <div class="alert alert-info">
                    <i class="ti ti-info-circle"></i>
                    <div>
                        <strong>${this.__('pendingDevices.deviceInfo')}</strong>
                        <p>${this.__('pendingDevices.syncCode')}: <code>${escapeHTML(device.sync_code || '-')}</code></p>
                        <p>${this.__('columns.ipAddress')}: ${escapeHTML(device.ip_address || '-')}</p>
                        <p>${this.__('pendingDevices.createdAt')}: ${device.created_at ? new Date(device.created_at).toLocaleString() : '-'}</p>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.name')} *</label>
                    <input type="text" id="approve-device-name" class="form-input" required
                        value="${escapeHTML(device.name || '')}" placeholder="${this.__('form.placeholders.name')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.group')}</label>
                    <select id="approve-device-group" class="form-select">
                        <option value="">${this.__('form.placeholders.selectGroup')}</option>
                        ${groupOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.location')}</label>
                    <input type="text" id="approve-device-location" class="form-input"
                        value="${escapeHTML(device.location || '')}" placeholder="${this.__('form.placeholders.location')}">
                </div>
                <input type="hidden" id="approve-device-id" value="${escapeHTML(device.id)}">
                <input type="hidden" id="approve-sync-code" value="${escapeHTML(device.sync_code || '')}">
            </form>
        `;

        Modal.show({
            title: this.__('actions.approve'),
            icon: 'ti-check',
            content: formContent,
            size: 'md',
            confirmText: this.__('actions.approve'),
            confirmClass: 'btn-success',
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                await this.approveDevice();
            }
        });
    }

    async approveDevice() {
        const id = document.getElementById('approve-device-id')?.value;
        const syncCode = document.getElementById('approve-sync-code')?.value;
        const name = document.getElementById('approve-device-name')?.value?.trim();
        const group_id = document.getElementById('approve-device-group')?.value || null;
        const location = document.getElementById('approve-device-location')?.value?.trim();

        if (!name) {
            Toast.error(this.__('validation.nameRequired'));
            throw new Error('Validation failed');
        }

        try {
            await this.app.api.post('/esl/approve', {
                device_id: id,
                sync_code: syncCode,
                name: name,
                group_id: group_id,
                location: location
            });
            Toast.success(this.__('toast.approved'));
            this.loadPendingCount();
            this.dataTable?.refresh();
        } catch (error) {
            Toast.error(error.message || this.__('toast.approveFailed'));
            throw error;
        }
    }

    async rejectDevice(device) {
        Modal.confirm({
            title: this.__('actions.reject'),
            message: this.__('rejectConfirm', { name: device.name || device.sync_code }),
            type: 'danger',
            confirmText: this.__('actions.reject'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.post('/esl/reject', {
                        device_id: device.id,
                        sync_code: device.sync_code
                    });
                    Toast.success(this.__('toast.rejected'));
                    this.loadPendingCount();
                    this.dataTable?.refresh();
                } catch (error) {
                    Toast.error(this.__('toast.rejectFailed'));
                    throw error;
                }
            }
        });
    }



    async delete(device) {
        if (!device || !device.id) {
            Toast.error(this.__('messages.invalidDeviceData'));
            console.error('Delete called with invalid device:', device);
            return;
        }

        Modal.confirm({
            title: this.__('deleteDevice'),
            message: this.__('deleteConfirm', { name: device.name }),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    const response = await this.app.api.delete(`/devices/${device.id}`);
                    Toast.success(this.__('toast.deleted'));
                    this.dataTable?.refresh();
                } catch (error) {
                    console.error('Device delete error:', error);
                    const errorMsg = error?.data?.message || error?.message || this.__('messages.deleteFailed2');
                    Toast.error(errorMsg);
                    throw error;
                }
            }
        });
    }





    /**
     * Dosya boyutunu okunabilir formata çevirir
     * @param {number} bytes - Bayt cinsinden boyut
     * @returns {string} Formatlanmış boyut (KB, MB, GB)
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    destroy() {
        if (this.dataTable) {
            this.dataTable.destroy();
            this.dataTable = null;
        }
        // Cleanup modular components
        if (this.bluetoothWizard) {
            this.bluetoothWizard.destroy();
            this.bluetoothWizard = null;
        }
        if (this.networkScanner) {
            this.networkScanner.destroy();
            this.networkScanner = null;
        }
        if (this.deviceControl) {
            this.deviceControl.destroy();
            this.deviceControl = null;
        }
        if (this.approvalFlow) {
            this.approvalFlow.destroy();
            this.approvalFlow = null;
        }
        if (this.firmwareUpdate) {
            this.firmwareUpdate.destroy();
            this.firmwareUpdate = null;
        }
        if (this.bulkActions) {
            this.bulkActions.destroy();
            this.bulkActions = null;
        }
        this.app.i18n.clearPageTranslations();
    }
}

export default DeviceListPage;
