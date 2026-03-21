/**
 * Device Detail Page Component
 * Displays comprehensive device information, preview, status, and controls
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { MediaUtils } from '../../utils/MediaUtils.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class DeviceDetailPage {
    constructor(app) {
        this.app = app;
        this.deviceId = null;
        this.device = null;
        this.deviceInfo = null; // Storage and hardware info
        this.assignedProducts = [];
        this.assignedPlaylist = null;
        this.activityLogs = [];
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/devices">${this.__('title')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('detail')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon cyan">
                            <i class="ti ti-device-desktop"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('detail')}</h1>
                            <p class="page-subtitle">${this.__('detailPage.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <a href="#/devices" class="btn btn-outline">
                            <i class="ti ti-arrow-left"></i>
                            ${this.__('actions.back')}
                        </a>
                        <button id="edit-btn" class="btn btn-primary">
                            <i class="ti ti-edit"></i>
                            ${this.__('actions.edit')}
                        </button>
                        <button id="refresh-btn" class="btn btn-outline" title="${this.__('actions.refreshStatus')}">
                            <i class="ti ti-refresh"></i>
                        </button>
                        <button id="delete-btn" class="btn btn-outline-danger" title="${this.__('actions.delete')}">
                            <i class="ti ti-trash"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div id="device-container">
                ${this.renderLoading()}
            </div>
        `;
    }

    renderLoading() {
        return `
            <div class="flex items-center justify-center py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        `;
    }

    renderDevice() {
        if (!this.device) {
            return `
                <div class="chart-card">
                    <div class="chart-card-body text-center py-12 text-gray-500">
                        <i class="ti ti-device-desktop-off text-4xl mb-2"></i>
                        <p>${this.__('detailPage.deviceNotFound')}</p>
                    </div>
                </div>
            `;
        }

        const d = this.device;
        const screenInfo = d.screen_width && d.screen_height ? `${d.screen_width} × ${d.screen_height}` : (d.resolution || '');

        return `
            <!-- Hero Section -->
            <div class="dd-hero">
                ${this.renderHeroImage(d)}
                <div class="dd-hero-info">
                    <div class="dd-hero-top">
                        <h2 class="dd-hero-name">${escapeHTML(d.name)}</h2>
                        <div class="dd-hero-badges">
                            <span class="badge ${this.getTypeBadgeClass(d.type)}">
                                <i class="ti ${this.getDeviceTypeIcon(d.type)} mr-1"></i>
                                ${this.getDeviceTypeName(d.type)}
                            </span>
                            <span class="badge ${d.status === 'online' ? 'badge-success' : 'badge-secondary'}">
                                <i class="ti ${d.status === 'online' ? 'ti-wifi' : 'ti-wifi-off'} mr-1"></i>
                                ${d.status === 'online' ? this.__('statuses.online') : this.__('statuses.offline')}
                            </span>
                            ${this.isStreamDevice(d) ? `<span class="badge badge-stream"><i class="ti ti-broadcast mr-1"></i>Stream</span>` : ''}
                            ${d.group_name ? `<span class="badge badge-outline">${escapeHTML(d.group_name)}</span>` : ''}
                            ${d.approval_status ? `<span class="badge ${this.getApprovalBadgeClass(d.approval_status)}">${this.__('approvalStatuses.' + d.approval_status) || d.approval_status}</span>` : ''}
                        </div>
                    </div>
                    <div class="dd-hero-meta">
                        ${d.serial_number || d.device_id ? `<span class="dd-hero-meta-item"><i class="ti ti-hash"></i> ${escapeHTML(d.serial_number || d.device_id)}</span>` : ''}
                        ${d.ip_address ? `<span class="dd-hero-meta-item"><i class="ti ti-network"></i> ${escapeHTML(this.normalizeLoopbackIp(d.ip_address))}</span>` : ''}
                        ${d.mac_address ? `<span class="dd-hero-meta-item"><i class="ti ti-antenna-bars-5"></i> ${escapeHTML(d.mac_address)}</span>` : ''}
                        ${d.location ? `<span class="dd-hero-meta-item"><i class="ti ti-map-pin"></i> ${escapeHTML(d.location)}</span>` : ''}
                    </div>
                    <div class="dd-hero-status-row">
                        ${screenInfo ? `<span class="dd-hero-meta-item"><i class="ti ti-dimensions"></i> ${screenInfo}</span>` : ''}
                        ${d.firmware_version ? `<span class="dd-hero-meta-item"><i class="ti ti-cpu"></i> ${escapeHTML(d.firmware_version)}</span>` : ''}
                        <span class="dd-hero-meta-item"><i class="ti ti-clock"></i> ${this.formatRelativeTime(d.last_activity || d.last_seen || d.updated_at)}</span>
                    </div>
                </div>
            </div>

            <!-- Tab Navigation -->
            <div class="settings-tabs dd-tabs">
                <button class="settings-tab active" data-dd-tab="general">
                    <i class="ti ti-info-circle"></i>
                    ${this.__('detailPage.tabs.general')}
                </button>
                <button class="settings-tab" data-dd-tab="content">
                    <i class="ti ti-eye"></i>
                    ${this.__('detailPage.tabs.content')}
                </button>
                <button class="settings-tab" data-dd-tab="status">
                    <i class="ti ti-activity"></i>
                    ${this.__('detailPage.tabs.status')}
                </button>
                <button class="settings-tab" data-dd-tab="record">
                    <i class="ti ti-file-info"></i>
                    ${this.__('detailPage.tabs.record')}
                </button>
                ${d?.model === 'priceview' ? `
                <button class="settings-tab" data-dd-tab="priceview">
                    <i class="ti ti-tag"></i>
                    ${this.__('detailPage.tabs.priceview')}
                </button>
                ` : ''}
            </div>

            <!-- Tab 1: General -->
            <div class="settings-tab-content active" id="dd-tab-general">
                <div class="dd-tab-grid dd-general-layout">
                    <!-- Left: Device Info -->
                    <div>
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title"><i class="ti ti-info-circle"></i> ${this.__('detailPage.deviceInfo')}</h2>
                            </div>
                            <div class="chart-card-body">
                                <div class="dd-prop-grid">
                                    <div class="dd-prop-item">
                                        <span class="dd-prop-label">${this.__('form.fields.name')}</span>
                                        <span class="dd-prop-value">${escapeHTML(d.name)}</span>
                                    </div>
                                    <div class="dd-prop-item">
                                        <span class="dd-prop-label">${this.__('columns.type')}</span>
                                        <span class="dd-prop-value"><span class="badge ${this.getTypeBadgeClass(d.type)}"><i class="ti ${this.getDeviceTypeIcon(d.type)} mr-1"></i>${this.getDeviceTypeName(d.type)}</span></span>
                                    </div>
                                    ${d.serial_number || d.device_id ? `
                                        <div class="dd-prop-item">
                                            <span class="dd-prop-label">${this.__('columns.serialNumber')}</span>
                                            <span class="dd-prop-value font-mono">${escapeHTML(d.serial_number || d.device_id)}</span>
                                        </div>
                                    ` : ''}
                                    ${d.mac_address ? `
                                        <div class="dd-prop-item">
                                            <span class="dd-prop-label">${this.__('form.fields.macAddress')}</span>
                                            <span class="dd-prop-value font-mono">${escapeHTML(d.mac_address)}</span>
                                        </div>
                                    ` : ''}
                                    ${d.ip_address ? `
                                        <div class="dd-prop-item">
                                            <span class="dd-prop-label">${this.__('columns.ipAddress')}</span>
                                            <span class="dd-prop-value font-mono">${escapeHTML(this.normalizeLoopbackIp(d.ip_address))}</span>
                                        </div>
                                    ` : ''}
                                    ${d.location ? `
                                        <div class="dd-prop-item">
                                            <span class="dd-prop-label">${this.__('columns.location')}</span>
                                            <span class="dd-prop-value">${escapeHTML(d.location)}</span>
                                        </div>
                                    ` : ''}
                                    ${d.model ? `
                                        <div class="dd-prop-item">
                                            <span class="dd-prop-label">${this.__('detailPage.model')}</span>
                                            <span class="dd-prop-value">${escapeHTML(d.model)}</span>
                                        </div>
                                    ` : ''}
                                    ${d.firmware_version ? `
                                        <div class="dd-prop-item">
                                            <span class="dd-prop-label">${this.__('detailPage.firmware')}</span>
                                            <span class="dd-prop-value">${escapeHTML(d.firmware_version)}</span>
                                        </div>
                                    ` : ''}
                                    ${screenInfo ? `
                                        <div class="dd-prop-item">
                                            <span class="dd-prop-label">${this.__('form.fields.screenResolution')}</span>
                                            <span class="dd-prop-value">${screenInfo}</span>
                                        </div>
                                    ` : ''}
                                    ${d.group_name ? `
                                        <div class="dd-prop-item">
                                            <span class="dd-prop-label">${this.__('detailPage.group')}</span>
                                            <span class="dd-prop-value"><span class="badge badge-outline">${escapeHTML(d.group_name)}</span></span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Technical Details & Sync Info -->
                    <div>
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title"><i class="ti ti-cpu"></i> ${this.__('detailPage.technicalDetails')}</h2>
                            </div>
                            <div class="chart-card-body">
                                ${d.os_info || d.browser_info || d.fingerprint || d.manufacturer || d.timezone ? `
                                    <div class="dd-prop-grid">
                                        ${d.manufacturer ? `
                                            <div class="dd-prop-item">
                                                <span class="dd-prop-label">${this.__('detailPage.manufacturer')}</span>
                                                <span class="dd-prop-value">${escapeHTML(d.manufacturer)}</span>
                                            </div>
                                        ` : ''}
                                        ${d.os_info ? `
                                            <div class="dd-prop-item">
                                                <span class="dd-prop-label">${this.__('columns.osInfo')}</span>
                                                <span class="dd-prop-value text-xs">${escapeHTML(d.os_info)}</span>
                                            </div>
                                        ` : ''}
                                        ${d.browser_info ? `
                                            <div class="dd-prop-item">
                                                <span class="dd-prop-label">${this.__('columns.browserInfo')}</span>
                                                <span class="dd-prop-value text-xs">${escapeHTML(d.browser_info)}</span>
                                            </div>
                                        ` : ''}
                                        ${d.fingerprint ? `
                                            <div class="dd-prop-item">
                                                <span class="dd-prop-label">${this.__('columns.fingerprint')}</span>
                                                <span class="dd-prop-value font-mono text-xs">${escapeHTML(d.fingerprint?.substring(0, 16))}...</span>
                                            </div>
                                        ` : ''}
                                        ${d.timezone ? `
                                            <div class="dd-prop-item">
                                                <span class="dd-prop-label">${this.__('form.fields.timezone')}</span>
                                                <span class="dd-prop-value">${escapeHTML(d.timezone)}</span>
                                            </div>
                                        ` : ''}
                                        <!-- Storage info placeholder (will be populated via API) -->
                                        <div id="device-storage-info"></div>
                                    </div>
                                ` : `
                                    <div class="dd-prop-grid">
                                        <!-- Storage info placeholder for devices without other technical info -->
                                        <div id="device-storage-info"></div>
                                    </div>
                                    <div class="text-center py-4 text-gray-400" id="no-tech-info-placeholder">
                                        <i class="ti ti-info-circle text-2xl mb-1"></i>
                                        <p class="text-sm">${this.__('detailPage.noTechnicalInfo')}</p>
                                    </div>
                                `}
                            </div>
                        </div>

                        ${this.isStreamDevice(d) ? this.renderStreamModeCard(d) : ''}

                        ${d.sync_code || d.approval_status ? `
                            <div class="chart-card" style="margin-top: var(--space-4);">
                                <div class="chart-card-header">
                                    <h2 class="chart-card-title"><i class="ti ti-link"></i> ${this.__('detailPage.syncInfo')}</h2>
                                </div>
                                <div class="chart-card-body">
                                    <div class="dd-prop-grid">
                                        ${d.sync_code ? `
                                            <div class="dd-prop-item">
                                                <span class="dd-prop-label">${this.__('columns.syncCode')}</span>
                                                <span class="dd-prop-value font-mono font-bold text-primary-600">${escapeHTML(d.sync_code)}</span>
                                            </div>
                                        ` : ''}
                                        ${d.approval_status ? `
                                            <div class="dd-prop-item">
                                                <span class="dd-prop-label">${this.__('columns.approvalStatus')}</span>
                                                <span class="dd-prop-value"><span class="badge ${this.getApprovalBadgeClass(d.approval_status)}">${this.__('approvalStatuses.' + d.approval_status) || d.approval_status}</span></span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Tab 2: Content -->
            <div class="settings-tab-content" id="dd-tab-content">
                <div class="dd-tab-grid dd-content-layout">
                    <!-- Render Preview -->
                    <div class="chart-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title"><i class="ti ti-eye"></i> ${this.__('detailPage.lastContentUpdate')}</h2>
                        </div>
                        <div class="chart-card-body">
                            ${this.renderDeviceRenderPreview()}
                        </div>
                    </div>
                    <!-- Assigned Products / Playlist -->
                    <div>
                        ${this.isSignageDevice(d) ? this.renderAssignedPlaylistCard() : this.renderAssignedProductsCard()}
                    </div>
                    <!-- Assigned Template -->
                    <div>
                        ${this.renderAssignedTemplateCard()}
                    </div>
                </div>
            </div>

            <!-- Tab 3: Status & Actions -->
            <div class="settings-tab-content" id="dd-tab-status">
                <div class="dd-tab-grid dd-status-layout">
                    <!-- Connection Status -->
                    <div>
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title"><i class="ti ti-wifi"></i> ${this.__('detailPage.connectionStatus')}</h2>
                            </div>
                            <div class="chart-card-body">
                                <div class="dd-connection-indicator ${d.status === 'online' ? 'online' : 'offline'}">
                                    <div class="dd-connection-icon">
                                        <i class="ti ${d.status === 'online' ? 'ti-wifi' : 'ti-wifi-off'}"></i>
                                    </div>
                                    <span class="dd-connection-text">${d.status === 'online' ? this.__('statuses.online') : this.__('statuses.offline')}</span>
                                </div>
                                <div class="dd-prop-grid" style="margin-top: var(--space-4);">
                                    <div class="dd-prop-item">
                                        <span class="dd-prop-label">${this.__('columns.lastActivity')}</span>
                                        <span class="dd-prop-value text-xs">${this.formatRelativeTime(d.last_activity || d.last_seen || d.updated_at)}</span>
                                    </div>
                                    ${d.last_heartbeat ? `
                                        <div class="dd-prop-item">
                                            <span class="dd-prop-label">${this.__('columns.lastHeartbeat')}</span>
                                            <span class="dd-prop-value text-xs">${this.formatRelativeTime(d.last_heartbeat)}</span>
                                        </div>
                                    ` : ''}
                                    ${d.battery_level !== undefined && d.battery_level !== null ? `
                                        <div class="dd-prop-item">
                                            <span class="dd-prop-label">${this.__('detailPage.battery')}</span>
                                            <span class="dd-prop-value">
                                                <div class="dd-battery-bar">
                                                    <div class="dd-battery-fill ${d.battery_level > 50 ? 'green' : d.battery_level > 20 ? 'yellow' : 'red'}" style="width: ${d.battery_level}%"></div>
                                                </div>
                                                <span class="dd-battery-text">${d.battery_level}%</span>
                                            </span>
                                        </div>
                                    ` : ''}
                                    ${d.signal_strength !== undefined && d.signal_strength !== null ? `
                                        <div class="dd-prop-item">
                                            <span class="dd-prop-label">${this.__('detailPage.signal')}</span>
                                            <span class="dd-prop-value">${d.signal_strength} dBm</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Recent Activities -->
                    <div>
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title"><i class="ti ti-history"></i> ${this.__('detailPage.recentActivities')}</h2>
                            </div>
                            <div class="chart-card-body dd-activity-body">
                                ${this.renderActivityLogs()}
                            </div>
                        </div>
                    </div>

                    <!-- Quick Actions -->
                    <div>
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title"><i class="ti ti-bolt"></i> ${this.__('detailPage.quickActions')}</h2>
                            </div>
                            <div class="chart-card-body dd-actions-grid">
                                <button id="action-refresh" class="dd-action-btn" ${d.status !== 'online' ? 'disabled' : ''}>
                                    <i class="ti ti-refresh"></i>
                                    <span>${this.__('detailPage.actions.refreshScreen')}</span>
                                </button>
                                <button id="action-send-test" class="dd-action-btn" ${d.status !== 'online' ? 'disabled' : ''}>
                                    <i class="ti ti-send"></i>
                                    <span>${this.__('detailPage.actions.sendTest')}</span>
                                </button>
                                <button id="action-reboot" class="dd-action-btn warning" ${d.status !== 'online' ? 'disabled' : ''}>
                                    <i class="ti ti-power"></i>
                                    <span>${this.__('detailPage.actions.reboot')}</span>
                                </button>
                                <button id="action-firmware" class="dd-action-btn">
                                    <i class="ti ti-download"></i>
                                    <span>${this.__('detailPage.actions.firmwareUpdate')}</span>
                                </button>
                                <button id="action-assign" class="dd-action-btn primary">
                                    <i class="ti ti-package"></i>
                                    <span>${this.__('detailPage.actions.assignProduct')}</span>
                                </button>
                                ${this.isSignageDevice(d) ? `
                                    <button id="action-assign-playlist" class="dd-action-btn">
                                        <i class="ti ti-playlist"></i>
                                        <span>${this.__('detailPage.actions.assignPlaylist')}</span>
                                    </button>
                                ` : ''}
                                <button id="action-delete" class="dd-action-btn danger">
                                    <i class="ti ti-trash"></i>
                                    <span>${this.__('detailPage.actions.deleteDevice')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab 4: Record Info -->
            <div class="settings-tab-content" id="dd-tab-record">
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h2 class="chart-card-title"><i class="ti ti-file-info"></i> ${this.__('detailPage.recordInfo')}</h2>
                    </div>
                    <div class="chart-card-body">
                        <div class="dd-prop-grid">
                            <div class="dd-prop-item">
                                <span class="dd-prop-label">${this.__('detailPage.createdAt')}</span>
                                <span class="dd-prop-value">${this.formatDateTime(d.created_at)}</span>
                            </div>
                            <div class="dd-prop-item">
                                <span class="dd-prop-label">${this.__('detailPage.updatedAt')}</span>
                                <span class="dd-prop-value">${this.formatDateTime(d.updated_at)}</span>
                            </div>
                            <div class="dd-prop-item">
                                <span class="dd-prop-label">ID</span>
                                <span class="dd-prop-value font-mono text-xs text-gray-400">${d.id}</span>
                            </div>
                            ${d.company_name ? `
                                <div class="dd-prop-item">
                                    <span class="dd-prop-label">${this.__('detailPage.company')}</span>
                                    <span class="dd-prop-value">${escapeHTML(d.company_name)}</span>
                                </div>
                            ` : ''}
                            ${d.branch_name ? `
                                <div class="dd-prop-item">
                                    <span class="dd-prop-label">${this.__('detailPage.branch')}</span>
                                    <span class="dd-prop-value">${escapeHTML(d.branch_name)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>

            ${d?.model === 'priceview' ? `
            <!-- Tab 5: PriceView Settings -->
            <div class="settings-tab-content" id="dd-tab-priceview">
                <div class="dd-tab-grid dd-general-layout">
                    <!-- Left column -->
                    <div>
                        <!-- Sync Status -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title"><i class="ti ti-refresh"></i> ${this.__('priceview.syncStatus')}</h2>
                            </div>
                            <div class="chart-card-body">
                                <div class="dd-prop-grid">
                                    <div class="dd-prop-item">
                                        <span class="dd-prop-label">${this.__('priceview.lastSync')}</span>
                                        <span class="dd-prop-value" id="pv-last-sync">-</span>
                                    </div>
                                    <div class="dd-prop-item">
                                        <span class="dd-prop-label">${this.__('priceview.productCount')}</span>
                                        <span class="dd-prop-value" id="pv-product-count">-</span>
                                    </div>
                                </div>
                                <div style="margin-top: 1rem;">
                                    <button class="btn btn-primary btn-sm" id="pv-sync-now-btn">
                                        <i class="ti ti-refresh"></i> ${this.__('priceview.syncNow')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Display Settings -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title"><i class="ti ti-eye"></i> ${this.__('priceview.displaySettings')}</h2>
                            </div>
                            <div class="chart-card-body">
                                <div class="form-group">
                                    <label class="form-label">${this.__('priceview.overlayTimeout')}</label>
                                    <input type="number" class="form-input" id="pv-overlay-timeout" min="1" max="120" value="10">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('priceview.fontSize')}</label>
                                    <input type="number" class="form-input" id="pv-font-size" min="0.5" max="3" step="0.1" value="1">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('priceview.displayTemplate')}</label>
                                    <select class="form-select" id="pv-display-template-override">
                                        <option value="">${this.__('priceview.deviceTemplateDefault')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right column -->
                    <div>
                        <!-- Print Settings -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title"><i class="ti ti-printer"></i> ${this.__('priceview.printSettings')}</h2>
                            </div>
                            <div class="chart-card-body">
                                <div class="form-group">
                                    <label class="form-label">${this.__('priceview.printEnabled')}</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="pv-print-enabled">
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('priceview.defaultTemplate')}</label>
                                    <select class="form-select" id="pv-default-template">
                                        <option value="">${this.__('priceview.selectTemplate')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Signage Settings -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title"><i class="ti ti-broadcast"></i> ${this.__('priceview.signageEnabled')}</h2>
                            </div>
                            <div class="chart-card-body">
                                <div class="form-group">
                                    <label class="form-label">${this.__('priceview.signageEnabled')}</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="pv-signage-enabled">
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <!-- Save -->
                        <div style="margin-top: 1rem; text-align: right;">
                            <button class="btn btn-primary" id="pv-save-settings-btn">
                                <i class="ti ti-device-floppy"></i> ${this.__('actions.save')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}

            <!-- Bottom Mini Cards -->
            <div class="dd-bottom-cards">
                <div class="dd-mini-card">
                    <div class="dd-mini-icon ${d.status === 'online' ? 'green' : 'gray'}">
                        <i class="ti ${d.status === 'online' ? 'ti-wifi' : 'ti-wifi-off'}"></i>
                    </div>
                    <div class="dd-mini-info">
                        <span class="dd-mini-label">${this.__('detailPage.connectionStatus')}</span>
                        <span class="dd-mini-value ${d.status === 'online' ? 'text-green' : ''}">${d.status === 'online' ? this.__('statuses.online') : this.__('statuses.offline')}</span>
                    </div>
                </div>
                <div class="dd-mini-card">
                    <div class="dd-mini-icon cyan">
                        <i class="ti ti-dimensions"></i>
                    </div>
                    <div class="dd-mini-info">
                        <span class="dd-mini-label">${this.__('form.fields.screenResolution')}</span>
                        <span class="dd-mini-value">${screenInfo || '-'}</span>
                    </div>
                </div>
                <div class="dd-mini-card">
                    <div class="dd-mini-icon ${this.getHeroIconClass(d.type)}">
                        <i class="ti ${this.getDeviceTypeIcon(d.type)}"></i>
                    </div>
                    <div class="dd-mini-info">
                        <span class="dd-mini-label">${this.__('columns.type')}</span>
                        <span class="dd-mini-value">${this.getDeviceTypeName(d.type)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderHeroImage(d) {
        // Prefer device-specific preview image; fallback to icon if missing
        const imageUrl = this.getDeviceCustomPreviewUrl(d);
        const iconClass = this.getHeroIconClass(d.type);
        const iconName = this.getDeviceTypeIcon(d.type);

        if (imageUrl) {
            return `
                <div class="dd-hero-image">
                    <img src="${imageUrl}" alt="${escapeHTML(d.name)}"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="dd-hero-icon ${iconClass}" style="display:none;">
                        <i class="ti ${iconName}"></i>
                    </div>
                </div>
            `;
        }

        return `
            <div class="dd-hero-icon ${iconClass}">
                <i class="ti ${iconName}"></i>
            </div>
        `;
    }

    getHeroIconClass(type, model) {
        if (model === 'priceview') return 'amber';
        if (model === 'stream_player') return 'purple';
        if (type === 'esl' || type === 'esl_rtos' || type === 'esl_android') return 'blue';
        if (type === 'tv' || type === 'android_tv' || type === 'panel') return 'purple';
        if (type === 'web_display') return 'cyan';
        return 'gray';
    }

    renderDevicePreview() {
        const d = this.device;
        const previewUrl = this.getDevicePreviewUrl(d);

        if (previewUrl) {
            return `
                <div class="device-preview-container">
                    <div class="device-preview-frame ${d.type === 'esl' || d.type === 'esl_android' ? 'esl-frame' : 'tv-frame'}">
                        <img src="${previewUrl}" alt="${escapeHTML(d.name)}"
                             class="device-preview-image"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="device-preview-placeholder" style="display: none;">
                            <i class="ti ti-photo-off text-3xl text-gray-400"></i>
                            <p class="text-sm text-gray-500 mt-2">${this.__('detailPage.imageLoadError')}</p>
                        </div>
                    </div>
                    <div class="device-preview-info mt-3">
                        <p class="text-xs text-gray-500">${this.__('detailPage.lastContentUpdate')}</p>
                        <p class="text-sm font-medium">${this.formatRelativeTime(d.last_sync || d.updated_at)}</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="device-preview-container">
                <div class="device-preview-frame empty ${d.type === 'esl' || d.type === 'esl_android' ? 'esl-frame' : 'tv-frame'}">
                    <div class="device-preview-placeholder">
                        <i class="ti ${this.getDeviceTypeIcon(d.type)} text-4xl text-gray-400"></i>
                        <p class="text-sm text-gray-500 mt-2">${this.__('detailPage.noContentAssigned')}</p>
                        <button class="btn btn-sm btn-primary mt-3" id="btn-assign-content">
                            <i class="ti ti-plus"></i>
                            ${this.__('detailPage.assignContent')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderDeviceRenderPreview() {
        const d = this.device;
        const playlist = this.assignedPlaylist;

        if (this.isSignageDevice(d) && playlist?.items?.length) {
            return this.renderPlaylistPreview(playlist);
        }

        // Canlı HTML önizleme: şablon + ürün atanmışsa iframe ile göster
        const templateId = d.current_template_id || d.assigned_template?.id;
        const productId = this.assignedProducts?.[0]?.id || this.getProductIdFromContent(d);

        if (templateId && productId) {
            const basePath = this.app?.config?.basePath || '';
            const previewUrl = `${basePath}/api/templates/${templateId}/preview-html?product_id=${productId}`;
            const frameClass = d.type === 'esl' || d.type === 'esl_android' ? 'esl-frame' : 'tv-frame';

            return `
                <div class="device-preview-container">
                    <div class="device-preview-frame ${frameClass}" style="position:relative;overflow:hidden">
                        <iframe src="${previewUrl}"
                                style="width:100%;height:100%;border:none;pointer-events:none;position:absolute;left:0;top:0"
                                loading="lazy" sandbox="allow-scripts"></iframe>
                    </div>
                    <div class="device-preview-info mt-3">
                        <div class="flex items-center gap-2">
                            <span class="badge badge-success"><i class="ti ti-live-photo mr-1"></i>${this.__('detailPage.livePreview')}</span>
                            <p class="text-xs text-gray-500">${this.__('detailPage.livePreviewHint')}</p>
                        </div>
                        <div class="flex gap-2 mt-2">
                            <button class="btn btn-sm btn-outline" onclick="window.open('${previewUrl}', '_blank')">
                                <i class="ti ti-external-link"></i> ${this.__('detailPage.fullscreenPreview')}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        // Fallback: statik render görseli
        const renderUrl = d.render_image_url || d.assigned_template?.render_image || d.content_preview_url || this.getDevicePreviewUrl(d);

        if (renderUrl) {
            return `
                <div class="device-preview-container">
                    <div class="device-preview-frame ${d.type === 'esl' || d.type === 'esl_android' ? 'esl-frame' : 'tv-frame'}">
                        <img src="${renderUrl}" alt="${escapeHTML(d.name)}"
                             class="device-preview-image"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="device-preview-placeholder" style="display: none;">
                            <i class="ti ti-photo-off text-3xl text-gray-400"></i>
                            <p class="text-sm text-gray-500 mt-2">${this.__('detailPage.imageLoadError')}</p>
                        </div>
                    </div>
                    <div class="device-preview-info mt-3">
                        <p class="text-xs text-gray-500">${this.__('detailPage.lastContentUpdate')}</p>
                        <p class="text-sm font-medium">${this.formatRelativeTime(d.last_sync || d.updated_at)}</p>
                        ${d.render_image_url ? `<span class="badge badge-info mt-1"><i class="ti ti-photo-check mr-1"></i>${this.__('detailPage.deviceSpecificRender')}</span>` : ''}
                    </div>
                </div>
            `;
        }

        return `
            <div class="device-preview-container">
                <div class="device-preview-frame empty ${d.type === 'esl' || d.type === 'esl_android' ? 'esl-frame' : 'tv-frame'}">
                    <div class="device-preview-placeholder">
                        <i class="ti ${this.getDeviceTypeIcon(d.type)} text-4xl text-gray-400"></i>
                        <p class="text-sm text-gray-500 mt-2">${this.__('detailPage.noContentAssigned')}</p>
                        <button class="btn btn-sm btn-primary mt-3" id="btn-assign-content">
                            <i class="ti ti-plus"></i>
                            ${this.__('detailPage.assignContent')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * current_content JSON'dan product_id çıkar
     */
    getProductIdFromContent(device) {
        if (!device.current_content) return null;
        try {
            const content = typeof device.current_content === 'string'
                ? JSON.parse(device.current_content)
                : device.current_content;
            return content?.product_id || null;
        } catch { return null; }
    }

    renderAssignedTemplateCard() {
        const template = this.device?.assigned_template;
        const playlistSummary = this.isSignageDevice(this.device) ? this.renderPlaylistSummary() : '';

        return `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title">
                        <i class="ti ti-layout"></i>
                        ${this.__('detailPage.assignedTemplate')}
                    </h2>
                    ${template ? `<span class="badge badge-info">${escapeHTML(template.type || 'label')}</span>` : ''}
                </div>
                <div class="chart-card-body">
                    ${template ? this.renderTemplateInfo(template) : this.renderNoTemplateAssigned()}
                    ${playlistSummary}
                </div>
            </div>
        `;
    }

    renderTemplateInfo(template) {
        const templatePreviewUrl = template.preview_image || template.render_image || this.device?.render_image_url || this.device?.content_preview_url;
        return `
            <div class="dd-template-info">
                ${templatePreviewUrl ? `
                    <div class="dd-template-preview">
                        <img src="${templatePreviewUrl}" alt="${escapeHTML(template.name)}"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="dd-template-preview-fallback" style="display: none;">
                            <i class="ti ti-layout text-2xl text-gray-400"></i>
                        </div>
                    </div>
                ` : ''}
                <div class="dd-prop-grid">
                    <div class="dd-prop-item">
                        <span class="dd-prop-label">${this.__('detailPage.templateName')}</span>
                        <span class="dd-prop-value font-semibold">${escapeHTML(template.name)}</span>
                    </div>
                    ${template.target_device_type ? `
                        <div class="dd-prop-item">
                            <span class="dd-prop-label">${this.__('detailPage.targetDevice')}</span>
                            <span class="dd-prop-value">${escapeHTML(template.target_device_type)}</span>
                        </div>
                    ` : ''}
                    ${template.grid_layout ? `
                        <div class="dd-prop-item">
                            <span class="dd-prop-label">${this.__('detailPage.gridLayout')}</span>
                            <span class="dd-prop-value">${escapeHTML(template.grid_layout)}</span>
                        </div>
                    ` : ''}
                    ${template.assigned_at ? `
                        <div class="dd-prop-item">
                            <span class="dd-prop-label">${this.__('detailPage.assignedAt')}</span>
                            <span class="dd-prop-value text-xs">${this.formatDateTime(template.assigned_at)}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="flex gap-2 mt-4 pt-4 border-t">
                    <a href="#/templates/editor?id=${template.id}" class="btn btn-sm btn-outline flex-1">
                        <i class="ti ti-edit"></i>
                        ${this.__('detailPage.editTemplate')}
                    </a>
                    <a href="#/templates" class="btn btn-sm btn-ghost flex-1">
                        <i class="ti ti-list"></i>
                        ${this.__('detailPage.allTemplates')}
                    </a>
                </div>
            </div>
        `;
    }

    renderPlaylistSummary() {
        const playlist = this.assignedPlaylist;
        if (!playlist) return '';

        return `
            <div class="dd-playlist-summary">
                <div class="dd-playlist-summary-header">
                    <i class="ti ti-playlist"></i>
                    <span class="font-medium">${this.__('detailPage.assignedPlaylist')}</span>
                </div>
                <div class="dd-playlist-summary-body">
                    <span class="dd-playlist-summary-name">${escapeHTML(playlist.name)}</span>
                    <span class="dd-playlist-summary-count">${playlist.items?.length || 0} ${this.__('detailPage.contentCount')}</span>
                </div>
                <a class="btn btn-sm btn-outline mt-2" href="#/signage/playlists/${playlist.id}">
                    <i class="ti ti-eye"></i>
                    ${this.__('detailPage.view')}
                </a>
            </div>
        `;
    }

    renderPlaylistPreview(playlist) {
        const items = playlist.items || [];
        const media = playlist.media || [];
        const mediaMap = {};
        media.forEach(m => { mediaMap[m.id] = m; });

        const firstItem = items[0];
        const firstMedia = firstItem ? mediaMap[firstItem.media_id] : null;
        const firstUrl = firstMedia?.url || firstMedia?.filename;

        return `
            <div class="dd-playlist-preview">
                <div class="dd-playlist-player">
                    ${firstMedia ? `
                        ${firstMedia.type === 'video' ? `
                            <video src="${this.getDisplayUrl(firstUrl)}" controls muted></video>
                        ` : `
                            <img src="${this.getDisplayUrl(firstUrl)}" alt="${escapeHTML(firstMedia.name)}"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="device-preview-placeholder" style="display:none;">
                                <i class="ti ti-photo-off text-3xl text-gray-400"></i>
                                <p class="text-sm text-gray-500 mt-2">${this.__('detailPage.imageLoadError')}</p>
                            </div>
                        `}
                    ` : `
                        <div class="device-preview-placeholder">
                            <i class="ti ti-photo-off text-3xl text-gray-400"></i>
                            <p class="text-sm text-gray-500 mt-2">${this.__('detailPage.playlistEmpty')}</p>
                        </div>
                    `}
                </div>
                <div class="device-preview-info mt-3">
                    <p class="text-xs text-gray-500">${this.__('detailPage.lastContentUpdate')}</p>
                    <p class="text-sm font-medium">${this.formatRelativeTime(this.device?.last_sync || this.device?.updated_at)}</p>
                    <span class="badge badge-info mt-1"><i class="ti ti-playlist mr-1"></i>${this.__('detailPage.playlistPreview')}</span>
                </div>
                <div class="dd-playlist-thumbs">
                    ${items.map((item, idx) => {
                        const m = mediaMap[item.media_id];
                        const url = m?.url || m?.filename;
                        return `
                            <div class="dd-playlist-thumb" title="${m ? escapeHTML(m.name) : this.__('detailPage.unknownMedia')}">
                                ${m ? (m.type === 'video'
                                    ? `<i class="ti ti-video"></i>`
                                    : `<img src="${this.getDisplayUrl(url)}" alt="${escapeHTML(m.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                       <i class="ti ti-photo" style="display:none;"></i>`)
                                    : `<i class="ti ti-photo-off"></i>`}
                                <span class="dd-playlist-index">#${idx + 1}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    renderNoTemplateAssigned() {
        return `
            <div class="text-center py-6 text-gray-500">
                <i class="ti ti-layout-off text-3xl mb-2"></i>
                <p>${this.__('detailPage.noTemplateAssigned')}</p>
            </div>
        `;
    }

    isSignageDevice(device) {
        const signageTypes = ['android_tv', 'web_display', 'panel', 'tv'];
        return (signageTypes.includes(device?.type) || device?.model === 'pwa_player' || device?.model === 'priceview') && device?.model !== 'stream_player';
    }

    isStreamDevice(device) {
        return device?.model === 'stream_player' || device?.stream_mode === 1 || device?.stream_mode === '1';
    }

    renderStreamModeCard(d) {
        const basePath = window.OmnexConfig?.basePath || '';
        const baseUrl = `${window.location.origin}${basePath}`;
        const streamUrl = d.stream_token ? `${baseUrl}/api/stream/${d.stream_token}/playlist.m3u` : '';
        const streamDownloadUrl = d.stream_token ? `${baseUrl}/api/stream/${d.stream_token}/playlist.m3u?download=1&label=0` : '';

        // Stream status calculation
        let streamStatus = 'offline';
        let streamStatusLabel = this.__('stream.status.offline');
        let streamStatusClass = 'stream-status-offline';
        if (d.last_stream_request_at) {
            const lastReq = new Date(d.last_stream_request_at);
            const diffSec = (Date.now() - lastReq.getTime()) / 1000;
            if (diffSec < 60) {
                streamStatus = 'online';
                streamStatusLabel = this.__('stream.status.online');
                streamStatusClass = 'stream-status-online';
            } else if (diffSec < 300) {
                streamStatus = 'weak';
                streamStatusLabel = this.__('stream.status.weak');
                streamStatusClass = 'stream-status-weak';
            }
        }

        // Device profile
        const profile = d.device_profile ? (typeof d.device_profile === 'string' ? JSON.parse(d.device_profile) : d.device_profile) : null;
        const maxRes = profile?.max_res || '720p';

        return `
            <div class="chart-card stream-mode-card" style="margin-top: var(--space-4);">
                <div class="chart-card-header">
                    <h2 class="chart-card-title"><i class="ti ti-broadcast"></i> ${this.__('stream.title')}</h2>
                    <span class="badge badge-stream">${this.__('stream.enabled')}</span>
                </div>
                <div class="chart-card-body">
                    <!-- Stream Status -->
                    <div class="stream-status-indicator ${streamStatusClass}">
                        <div class="stream-status-dot"></div>
                        <span class="stream-status-text">${streamStatusLabel}</span>
                    </div>

                    ${streamUrl ? `
                        <!-- Stream URL -->
                        <div class="stream-url-box">
                            <label class="form-label" style="margin-bottom: 0.25rem; font-size: 0.75rem;">${this.__('stream.url')}</label>
                            <div class="stream-url-row">
                                <input type="text" class="form-input form-input-sm" value="${streamUrl}" readonly id="stream-url-input" style="font-size: 0.75rem; font-family: monospace;">
                                <button class="btn btn-sm btn-outline" id="copy-stream-url-btn" title="${this.__('stream.copyUrl')}">
                                    <i class="ti ti-copy"></i>
                                </button>
                                <a class="btn btn-sm btn-outline" id="download-stream-playlist-btn" href="${streamDownloadUrl}" target="_blank" rel="noopener" title="${this.__('actions.download')} M3U">
                                    <i class="ti ti-download"></i>
                                </a>
                            </div>
                        </div>
                    ` : `
                        <div class="text-center py-3 text-gray-500">
                            <i class="ti ti-alert-circle text-xl mb-1"></i>
                            <p class="text-xs">${this.__('stream.noToken')}</p>
                        </div>
                    `}

                    <!-- Stream Info -->
                    <div class="dd-prop-grid" style="margin-top: var(--space-3);">
                        <div class="dd-prop-item">
                            <span class="dd-prop-label">${this.__('stream.profile')}</span>
                            <span class="dd-prop-value">${maxRes}</span>
                        </div>
                        ${d.last_stream_request_at ? `
                            <div class="dd-prop-item">
                                <span class="dd-prop-label">${this.__('stream.lastFetch')}</span>
                                <span class="dd-prop-value text-xs">${this.formatRelativeTime(d.last_stream_request_at)}</span>
                            </div>
                        ` : ''}
                    </div>

                    <!-- VLC Instructions -->
                    <div class="stream-vlc-hint">
                        <i class="ti ti-info-circle"></i>
                        <span>${this.__('stream.vlcHint')}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderAssignedProductsCard() {
        return `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title">
                        <i class="ti ti-package"></i>
                        ${this.__('detailPage.assignedProducts')}
                    </h2>
                    <span class="badge badge-secondary">${this.assignedProducts.length}</span>
                </div>
                <div class="chart-card-body">
                    ${this.renderAssignedProducts()}
                </div>
            </div>
        `;
    }

    renderAssignedPlaylistCard() {
        const playlist = this.assignedPlaylist;
        const itemCount = playlist?.items?.length || 0;

        return `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h2 class="chart-card-title">
                        <i class="ti ti-playlist"></i>
                        ${this.__('detailPage.assignedPlaylist')}
                    </h2>
                    ${playlist ? `<span class="badge badge-success">${itemCount} ${this.__('detailPage.contentCount')}</span>` : ''}
                </div>
                <div class="chart-card-body">
                    ${playlist ? this.renderAssignedPlaylistContent(playlist) : this.renderNoPlaylistAssigned()}
                </div>
            </div>
        `;
    }

    renderNoPlaylistAssigned() {
        return `
            <div class="text-center py-6 text-gray-500">
                <i class="ti ti-playlist-off text-3xl mb-2"></i>
                <p>${this.__('detailPage.noPlaylistAssigned')}</p>
                <button class="btn btn-sm btn-outline mt-3" id="btn-assign-playlist">
                    <i class="ti ti-plus"></i>
                    ${this.__('detailPage.assignPlaylist')}
                </button>
            </div>
        `;
    }

    renderAssignedPlaylistContent(playlist) {
        const items = playlist.items || [];
        const media = playlist.media || [];

        // Create a map of media by ID for quick lookup
        const mediaMap = {};
        media.forEach(m => { mediaMap[m.id] = m; });

        return `
            <div class="assigned-playlist-info mb-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="font-semibold text-lg">${escapeHTML(playlist.name)}</h4>
                        ${playlist.description ? `<p class="text-sm text-gray-500">${escapeHTML(playlist.description)}</p>` : ''}
                    </div>
                    <div class="flex gap-2">
                        <span class="badge badge-info">${playlist.orientation || 'landscape'}</span>
                        <span class="badge badge-secondary">${playlist.layout_type || 'full'}</span>
                    </div>
                </div>
                <p class="text-xs text-gray-400 mt-2">
                    <i class="ti ti-clock mr-1"></i>
                    ${this.__('detailPage.assignedAt')}: ${this.formatDateTime(playlist.assigned_at)}
                </p>
            </div>

            ${items.length === 0 ? `
                <div class="text-center py-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 rounded-lg">
                    <i class="ti ti-alert-triangle text-2xl mb-2"></i>
                    <p class="text-sm">${this.__('detailPage.playlistEmpty')}</p>
                    <a href="#/signage/playlists/${playlist.id}" class="btn btn-sm btn-warning mt-2">
                        <i class="ti ti-edit"></i>
                        ${this.__('detailPage.editPlaylist')}
                    </a>
                </div>
            ` : `
                <div class="space-y-2">
                    ${items.map((item, idx) => {
                        const m = mediaMap[item.media_id];
                        return `
                            <div class="assigned-product-item">
                                <div class="assigned-product-thumb">
                                    ${m ? `
                                        ${m.type === 'video' ?
                                            `<i class="ti ti-video"></i>` :
                                            `<img src="${this.getDisplayUrl(m.url || m.filename)}" alt="${escapeHTML(m.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                             <i class="ti ti-photo" style="display:none;"></i>`
                                        }
                                    ` : `<i class="ti ti-photo-off"></i>`}
                                </div>
                                <div class="assigned-product-info">
                                    <p class="assigned-product-name">${m ? escapeHTML(m.name) : this.__('detailPage.unknownMedia')}</p>
                                    <p class="assigned-product-sku">${item.duration || playlist.default_duration || 10} ${this.__('detailPage.seconds')}</p>
                                </div>
                                <span class="badge badge-secondary">#${idx + 1}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}

            <div class="flex gap-2 mt-4 pt-4 border-t">
                <button class="btn btn-sm btn-outline flex-1" id="btn-change-playlist">
                    <i class="ti ti-refresh"></i>
                    ${this.__('detailPage.change')}
                </button>
                <a href="#/signage/playlists/${playlist.id}" class="btn btn-sm btn-primary flex-1">
                    <i class="ti ti-eye"></i>
                    ${this.__('detailPage.view')}
                </a>
            </div>
        `;
    }

    formatDateTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    renderAssignedProducts() {
        if (!this.assignedProducts.length) {
            return `
                <div class="text-center py-6 text-gray-500">
                    <i class="ti ti-package-off text-3xl mb-2"></i>
                    <p>${this.__('detailPage.noProductAssigned')}</p>
                    <button class="btn btn-sm btn-outline mt-3" id="btn-assign-product">
                        <i class="ti ti-plus"></i>
                        ${this.__('detailPage.assignProduct')}
                    </button>
                </div>
            `;
        }

        return `
            <div class="space-y-2">
                ${this.assignedProducts.map(p => `
                    <div class="assigned-product-item">
                        <div class="assigned-product-thumb">
                            ${p.image_url ?
                                `<img src="${this.getDisplayUrl(p.image_url)}" alt="${escapeHTML(p.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                 <i class="ti ti-package" style="display:none;"></i>` :
                                `<i class="ti ti-package"></i>`
                            }
                        </div>
                        <div class="assigned-product-info">
                            <p class="assigned-product-name">${escapeHTML(p.name)}</p>
                            <p class="assigned-product-sku">${escapeHTML(p.sku)}</p>
                        </div>
                        <div class="assigned-product-price">
                            ${this.formatPrice(p.current_price)}
                        </div>
                        <button class="btn btn-icon btn-sm btn-ghost btn-remove-product" data-product-id="${p.id}" title="${this.__('detailPage.remove')}">
                            <i class="ti ti-x text-red-500"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderActivityLogs() {
        if (!this.activityLogs.length) {
            return `
                <div class="text-center py-6 text-gray-500">
                    <i class="ti ti-history text-3xl mb-2"></i>
                    <p>${this.__('detailPage.noActivityLog')}</p>
                </div>
            `;
        }

        return `
            <div class="activity-log-list">
                ${this.activityLogs.slice(0, 10).map(log => `
                    <div class="activity-log-item">
                        <div class="activity-log-dot ${this.getLogDotClass(log.level || log.type)}"></div>
                        <div class="activity-log-content">
                            <p class="activity-log-message">${escapeHTML(this.getActivityMessage(log))}</p>
                            <p class="activity-log-time">${this.formatRelativeTime(log.created_at)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    getActivityMessage(log) {
        if (!log) return this.__('detailPage.noActivityLog');
        if (log.message) return log.message;

        const action = log.action || log.type || this.__('detailPage.activityUnknown');
        const actionLabel = this.translateActivityAction(action);
        const statusLabel = log.status ? this.translateActivityStatus(log.status) : '';
        const contentTypeLabel = log.content_type ? this.translateActivityContentType(log.content_type) : '';
        const contentId = log.content_id ? String(log.content_id) : '';
        const content = contentTypeLabel ? `${contentTypeLabel}${contentId ? ':' + contentId : ''}` : '';
        const parts = [action, content].filter(Boolean);
        const message = `${actionLabel}${content ? ' - ' + content : ''}`;
        return statusLabel ? `${message} (${statusLabel})` : message;
    }

    translateActivityAction(action) {
        const key = `detailPage.activityActions.${action}`;
        const translated = this.__(key);
        return translated === key ? action : translated;
    }

    translateActivityStatus(status) {
        const key = `detailPage.activityStatuses.${status}`;
        const translated = this.__(key);
        return translated === key ? status : translated;
    }

    translateActivityContentType(type) {
        const key = `detailPage.activityContentTypes.${type}`;
        const translated = this.__(key);
        return translated === key ? type : translated;
    }

    // Helper methods
    getDevicePreviewUrl(device) {
        if (!device) return null;

        const content = device.current_content;
        let previewUrl = device.preview_url;

        // current_content can be JSON string, base64 data, UUID (media ID), or a file path
        // Only use it as a preview URL if it looks like a valid file path
        if (content && typeof content === 'string') {
            // Skip JSON objects
            if (content.startsWith('{') || content.startsWith('[')) {
                // Not a URL - it's JSON data
            }
            // Skip raw UUIDs (media IDs, not file paths)
            else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(content)) {
                // Not a URL - it's a media UUID
            }
            // Skip base64 data (too long or contains base64 chars without path separators)
            else if (content.length > 500 || /^[A-Za-z0-9+/=]+$/.test(content)) {
                // Not a URL - it's base64 data
            }
            // Looks like a file path
            else {
                previewUrl = content;
            }
        }

        if (!previewUrl) return null;
        return this.getDisplayUrl(previewUrl);
    }

    getDeviceCustomPreviewUrl(device) {
        if (!device) return null;
        const preview = device.preview_image_url || device.preview_url || device.content_preview_url || null;
        if (!preview) return null;
        return this.getDisplayUrl(preview);
    }

    getDisplayUrl(url) {
        return MediaUtils.getDisplayUrl(url);
    }

    getDeviceTypeIcon(type) {
        const icons = {
            'esl': 'ti-tag',
            'esl_rtos': 'ti-tag',
            'esl_android': 'ti-device-tablet',
            'android_tv': 'ti-device-tv',
            'tv': 'ti-device-tv',
            'tablet': 'ti-device-tablet',
            'mobile': 'ti-device-mobile',
            'panel': 'ti-layout-board',
            'web_display': 'ti-browser'
        };
        return icons[type] || 'ti-device-desktop';
    }

    getDeviceTypeName(type) {
        return this.__('types.' + type) || type;
    }

    getTypeBadgeClass(type) {
        if (type === 'esl' || type === 'esl_rtos' || type === 'esl_android') {
            return 'badge-info';
        }
        if (type === 'tv' || type === 'android_tv' || type === 'panel') {
            return 'badge-purple';
        }
        return 'badge-secondary';
    }

    getApprovalBadgeClass(status) {
        const classes = {
            'pending': 'badge-warning',
            'approved': 'badge-success',
            'rejected': 'badge-danger'
        };
        return classes[status] || 'badge-secondary';
    }

    getLogDotClass(level) {
        const classes = {
            'error': 'error',
            'warning': 'warning',
            'success': 'success',
            'info': 'info'
        };
        return classes[level] || '';
    }

    formatPrice(price) {
        return this.app.i18n.formatPrice(price);
    }

    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleString('tr-TR');
        } catch {
            return dateStr;
        }
    }

    formatRelativeTime(dateStr) {
        if (!dateStr) return '-';

        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return this.__('time.now');
            if (diffMins < 60) return this.__('time.minutesAgo', { count: diffMins });
            if (diffHours < 24) return this.__('time.hoursAgo', { count: diffHours });
            if (diffDays < 7) return this.__('time.daysAgo', { count: diffDays });

            return date.toLocaleDateString('tr-TR');
        } catch {
            return dateStr;
        }
    }

    normalizeLoopbackIp(value) {
        const ip = String(value || '').trim();
        if (!ip) return '';
        if (ip === '::1' || ip === '::ffff:127.0.0.1') return 'localhost';
        return ip;
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('devices');
    }

    async init() {
        window.deviceDetailPage = this;

        // Get device ID from URL
        const hash = window.location.hash;
        const match = hash.match(/\/devices\/([^\/]+)$/);
        if (match) {
            this.deviceId = match[1];
        }

        await this.loadDevice();
        this.bindEvents();
    }

    async loadDevice() {
        if (!this.deviceId) return;

        try {
            const response = await this.app.api.get(`/devices/${this.deviceId}`);
            this.device = response.data;

            // Get assigned playlist from device response (for signage devices)
            this.assignedPlaylist = this.device.assigned_playlist || null;
            Logger.log('Assigned playlist:', this.assignedPlaylist);

            // Load assigned products if available (for ESL devices)
            try {
                const productsResponse = await this.app.api.get(`/devices/${this.deviceId}/products`);
                this.assignedProducts = productsResponse.data || [];
            } catch (e) {
                this.assignedProducts = [];
            }

            // Load activity logs if available
            try {
                const logsResponse = await this.app.api.get(`/devices/${this.deviceId}/logs`);
                this.activityLogs = logsResponse.data?.logs || logsResponse.data || [];
            } catch (e) {
                this.activityLogs = this.device.recent_logs || [];
            }

            document.getElementById('device-container').innerHTML = this.renderDevice();
            this.bindTabEvents();
            this.bindActionEvents();

            // Load device hardware info for PavoDisplay ESL and MQTT devices (async, non-blocking)
            if ((this.isPavoDisplayDevice(this.device) || this.device.mqtt_client_id) && this.device.status === 'online') {
                this.loadDeviceInfo();
            }
        } catch (error) {
            Logger.error('Device load error:', error);
            document.getElementById('device-container').innerHTML = this.renderDevice();
        }
    }

    bindEvents() {
        document.getElementById('edit-btn')?.addEventListener('click', () => {
            this.showEditModal();
        });

        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            this.loadDevice();
            Toast.info(this.__('toast.statusRefreshed'));
        });

        document.getElementById('delete-btn')?.addEventListener('click', () => {
            this.deleteDevice();
        });
    }

    bindTabEvents() {
        document.querySelectorAll('[data-dd-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active from all tabs and contents
                document.querySelectorAll('[data-dd-tab]').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
                // Activate clicked tab and its content
                tab.classList.add('active');
                const targetId = 'dd-tab-' + tab.dataset.ddTab;
                document.getElementById(targetId)?.classList.add('active');
            });
        });
    }

    bindActionEvents() {
        // Quick action buttons
        document.getElementById('action-refresh')?.addEventListener('click', () => this.sendCommand('refresh'));
        document.getElementById('action-send-test')?.addEventListener('click', () => this.sendTestContent());
        document.getElementById('action-reboot')?.addEventListener('click', () => this.sendCommand('reboot'));
        document.getElementById('action-firmware')?.addEventListener('click', () => this.showFirmwareModal());
        document.getElementById('action-assign')?.addEventListener('click', () => this.showAssignProductModal());
        document.getElementById('action-assign-playlist')?.addEventListener('click', () => this.showAssignPlaylistModal());
        document.getElementById('action-delete')?.addEventListener('click', () => this.deleteDevice());

        // Stream URL copy button
        document.getElementById('copy-stream-url-btn')?.addEventListener('click', () => {
            const urlInput = document.getElementById('stream-url-input');
            if (urlInput) {
                navigator.clipboard.writeText(urlInput.value).then(() => {
                    Toast.success(this.__('stream.copied'));
                }).catch(() => {
                    urlInput.select();
                    document.execCommand('copy');
                    Toast.success(this.__('stream.copied'));
                });
            }
        });

        // Product/Playlist assign buttons (no-content state)
        document.getElementById('btn-assign-content')?.addEventListener('click', () => this.showAssignProductModal());
        document.getElementById('btn-assign-product')?.addEventListener('click', () => this.showAssignProductModal());
        document.getElementById('btn-assign-playlist')?.addEventListener('click', () => this.showAssignPlaylistModal());
        document.getElementById('btn-change-playlist')?.addEventListener('click', () => this.showAssignPlaylistModal());

        // Remove product buttons (use event delegation for dynamic elements)
        document.querySelectorAll('.btn-remove-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.currentTarget.dataset.productId;
                if (productId) {
                    this.removeProduct(productId);
                }
            });
        });

        // PriceView tab events
        if (this.device?.model === 'priceview') {
            this.loadPriceViewSettings();

            document.getElementById('pv-sync-now-btn')?.addEventListener('click', () => this.priceviewSyncNow());
            document.getElementById('pv-save-settings-btn')?.addEventListener('click', () => this.savePriceViewSettings());
        }
    }

    /**
     * Load PriceView settings from company settings
     */
    async loadPriceViewSettings() {
        try {
            const response = await this.app.api.get('/settings?scope=company');
            const data = response.data?.data || response.data || {};
            const deviceSettingsResponse = await this.app.api.get(`/devices/${this.deviceId}/priceview-settings`);
            const deviceSettings = deviceSettingsResponse.data?.data || deviceSettingsResponse.data || {};

            const pvOverlayTimeout = document.getElementById('pv-overlay-timeout');
            const pvFontSize = document.getElementById('pv-font-size');
            const pvPrintEnabled = document.getElementById('pv-print-enabled');
            const pvSignageEnabled = document.getElementById('pv-signage-enabled');
            const pvDefaultTemplate = document.getElementById('pv-default-template');
            const pvDisplayTemplateOverride = document.getElementById('pv-display-template-override');
            const pvLastSync = document.getElementById('pv-last-sync');
            const pvProductCount = document.getElementById('pv-product-count');

            if (pvOverlayTimeout) pvOverlayTimeout.value = data.priceview_overlay_timeout || 10;
            if (pvFontSize) pvFontSize.value = data.priceview_font_size || 1;
            if (pvPrintEnabled) pvPrintEnabled.checked = !!data.priceview_print_enabled;
            if (pvSignageEnabled) pvSignageEnabled.checked = !!data.priceview_signage_enabled;
            if (pvLastSync) pvLastSync.textContent = data.priceview_last_sync ? this.formatDateTime(data.priceview_last_sync) : '-';
            if (pvProductCount) pvProductCount.textContent = data.priceview_product_count ?? '-';

            // Load templates for template selector
            try {
                const tplResponse = await this.app.api.get('/templates?device_types=priceview');
                const templates = tplResponse.data?.data || tplResponse.data || [];
                if (pvDefaultTemplate && Array.isArray(templates) && templates.length) {
                    pvDefaultTemplate.innerHTML = `<option value="">${this.__('priceview.selectTemplate')}</option>`;
                    templates.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.id;
                        opt.textContent = t.name;
                        if (data.priceview_default_template === t.id) opt.selected = true;
                        pvDefaultTemplate.appendChild(opt);
                    });
                }
            } catch (e) {
                Logger.warn('Could not load priceview templates:', e);
            }

            // Load display template override presets
            if (pvDisplayTemplateOverride) {
                const presets = Array.isArray(deviceSettings.display_template_presets)
                    ? deviceSettings.display_template_presets
                    : [];
                pvDisplayTemplateOverride.innerHTML = '';

                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = this.__('priceview.deviceTemplateDefault');
                pvDisplayTemplateOverride.appendChild(defaultOption);

                presets.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.name;
                    opt.textContent = p.label || p.name;
                    if ((deviceSettings.device_display_template_override || '') === p.name) {
                        opt.selected = true;
                    }
                    pvDisplayTemplateOverride.appendChild(opt);
                });
            }
        } catch (error) {
            Logger.error('PriceView settings load error:', error);
        }
    }

    /**
     * Save PriceView settings to company settings
     */
    async savePriceViewSettings() {
        try {
            const settingsPayload = {
                priceview_overlay_timeout: parseInt(document.getElementById('pv-overlay-timeout')?.value) || 10,
                priceview_font_size: parseFloat(document.getElementById('pv-font-size')?.value) || 1,
                priceview_print_enabled: !!document.getElementById('pv-print-enabled')?.checked,
                priceview_signage_enabled: !!document.getElementById('pv-signage-enabled')?.checked,
                priceview_default_template: document.getElementById('pv-default-template')?.value || null
            };

            const currentSettingsRes = await this.app.api.get('/settings?scope=company');
            const currentSettings = currentSettingsRes.data?.data || currentSettingsRes.data || {};
            await this.app.api.put('/settings?scope=company', { ...currentSettings, ...settingsPayload });
            await this.app.api.put(`/devices/${this.deviceId}/priceview-settings`, {
                display_template_override: document.getElementById('pv-display-template-override')?.value || null
            });
            Toast.success(this.__('priceview.saved'));
        } catch (error) {
            Logger.error('PriceView settings save error:', error);
            Toast.error(error.message || this.__('toast.saveFailed'));
        }
    }

    /**
     * Trigger PriceView sync
     */
    async priceviewSyncNow() {
        // Sync runs on-device via WorkManager. This button refreshes status info.
        try {
            const btn = document.getElementById('pv-sync-now-btn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="ti ti-loader animate-spin"></i> G\u00FCncelleniyor...';
            }
            await this.loadPriceViewSettings();
            Toast.success('Durum g\u00FCncellendi');
        } catch (error) {
            Logger.error('PriceView status refresh error:', error);
            Toast.error(error.message || 'G\u00FCncelleme ba\u015Far\u0131s\u0131z');
        } finally {
            const btn = document.getElementById('pv-sync-now-btn');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="ti ti-refresh"></i> Durumu G\u00FCncelle';
            }
        }
    }

    mapResyncErrorMessage(error) {
        const message = String(error?.message || '');

        if (error?.status === 409 && /already exists/i.test(message)) {
            return this.__('messages.deviceAlreadyRegisteredDetailed', {
                name: this.device?.name || this.__('messages.unknownDevice')
            });
        }

        return message || this.__('toast.approveFailed');
    }

    async relinkDeviceWithSyncCode(syncCode, payload = {}) {
        try {
            await this.app.api.post('/esl/approve', {
                sync_code: syncCode,
                target_device_id: this.deviceId,
                name: payload.name,
                type: payload.type,
                group_id: payload.group_id,
                location: payload.location
            });
            Toast.success(this.__('toast.resynced'));
        } catch (error) {
            Toast.error(this.mapResyncErrorMessage(error));
            throw error;
        }
    }

    async sendCommand(command) {
        Modal.confirm({
            title: this.__('detailPage.sendCommand'),
            message: this.__('detailPage.sendCommandConfirm', { command }),
            type: 'warning',
            confirmText: this.__('actions.send'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                try {
                    // PavoDisplay ESL ve MQTT cihazları /control endpoint kullanır
                    // PWA Player cihazları /command endpoint kullanır
                    const isPavo = this.isPavoDisplayDevice(this.device) || this.device?.mqtt_client_id;
                    let response;

                    if (isPavo) {
                        response = await this.app.api.post(`/devices/${this.deviceId}/control`, { action: command });
                    } else {
                        response = await this.app.api.post(`/devices/${this.deviceId}/command`, { command });
                    }

                    if (response?.success && response?.data?.success !== false) {
                        Toast.success(response?.data?.message || this.__('toast.commandSent'));
                    } else {
                        const data = response?.data || response || {};
                        if (data.not_supported) {
                            Toast.warning(data.message || this.__('toast.commandNotSupported'), { duration: 5000 });
                            if (data.bluetooth_command) {
                                Logger.info('Bluetooth command:', data.bluetooth_command);
                            }
                            if (data.mqtt_command) {
                                Logger.info('MQTT command:', data.mqtt_command);
                            }
                        } else {
                            Toast.error(data.message || this.__('toast.commandFailed'));
                        }
                    }
                } catch (error) {
                    const errorData = error.data || {};
                    if (errorData.not_supported) {
                        Toast.warning(errorData.message || this.__('toast.commandNotSupported'), { duration: 5000 });
                    } else {
                        Toast.error(errorData.message || error.message || this.__('toast.commandFailed'));
                    }
                }
            }
        });
    }

    async sendTestContent() {
        if (!this.device || this.device.status !== 'online') {
            Toast.warning(this.__('toast.deviceOffline') || 'Cihaz çevrimdışı');
            return;
        }
        Toast.info(this.__('toast.sendingTestContent') || 'Test içeriği gönderiliyor...');
        try {
            const isPavo = this.isPavoDisplayDevice(this.device) || this.device?.mqtt_client_id;
            if (isPavo) {
                // PavoDisplay: ping ile bağlantı testi
                const response = await this.app.api.post(`/devices/${this.deviceId}/control`, { action: 'ping' });
                if (response?.success && response?.data?.success !== false) {
                    Toast.success(response?.data?.message || this.__('toast.testSuccess'));
                } else {
                    Toast.error(response?.data?.message || this.__('toast.testFailed'));
                }
            } else {
                // PWA Player
                await this.app.api.post(`/devices/${this.deviceId}/command`, { command: 'test' });
                Toast.success(this.__('toast.testSuccess'));
            }
        } catch (error) {
            Toast.error(error?.data?.message || error.message || this.__('toast.testFailed'));
        }
    }

    showFirmwareModal() {
        Modal.alert({
            title: this.__('firmwareUpdate'),
            message: this.__('featureComingSoon'),
            type: 'info'
        });
    }

    async showAssignPlaylistModal() {
        let playlists = [];
        try {
            const response = await this.app.api.get('/playlists?status=active');
            playlists = response.data || [];
        } catch (error) {
            Logger.error('Playlists load error:', error);
            // Try without filter
            try {
                const response = await this.app.api.get('/playlists');
                playlists = response.data || [];
            } catch (e) {
                playlists = [];
            }
        }

        const formContent = `
            <div class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${this.__('selectPlaylist')}</label>
                    <select id="assign-playlist" class="form-select">
                        <option value="">${this.__('selectPlaylistPlaceholder')}</option>
                        ${playlists.map(p => `
                            <option value="${p.id}">${escapeHTML(p.name)} ${p.items_count ? '(' + p.items_count + ' ' + this.__('items') + ')' : ''}</option>
                        `).join('')}
                    </select>
                </div>
                ${playlists.length === 0 ? `
                    <div class="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 rounded-lg p-3 text-sm">
                        <i class="ti ti-alert-triangle mr-2"></i>
                        ${this.__('noPlaylistsAvailable')}
                    </div>
                ` : ''}
                <div class="bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg p-3 text-sm">
                    <i class="ti ti-info-circle mr-2"></i>
                    ${this.__('detailPage.playlistWillBeAssigned', { device: escapeHTML(this.device?.name) })}
                </div>
            </div>
        `;

        Modal.show({
            title: this.__('assignPlaylist'),
            icon: 'ti-playlist',
            content: formContent,
            size: 'md',
            confirmText: this.__('actions.assign'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const playlistId = document.getElementById('assign-playlist')?.value;

                if (!playlistId) {
                    Toast.error(this.__('pleaseSelectPlaylist'));
                    throw new Error('Validation failed');
                }

                try {
                    const result = await this.app.api.post(`/devices/${this.deviceId}/assign-playlist`, {
                        playlist_id: playlistId
                    });
                    Toast.success(this.__('toast.playlistAssigned'));

                    // Show warning if playlist is empty
                    if (result.data?.warning) {
                        setTimeout(() => {
                            Toast.warning(result.data.warning);
                        }, 500);
                    }

                    await this.loadDevice();
                } catch (error) {
                    Toast.error(error.message || this.__('messages.error'));
                    throw error;
                }
            }
        });
    }

    async showAssignProductModal() {
        let products = [];
        try {
            const response = await this.app.api.get('/products?status=active&limit=500');
            // Ensure products is always an array - API returns { products: [...], pagination: {...} }
            products = Array.isArray(response.data?.products) ? response.data.products :
                       (Array.isArray(response.data?.data) ? response.data.data :
                       (Array.isArray(response.data) ? response.data : []));
        } catch (error) {
            Logger.error('Products load error:', error);
            products = [];
        }

        // Store products for filtering
        this._assignModalProducts = products;
        this._selectedProductId = null;

        const formContent = `
            <div class="space-y-4">
                <!-- Search Input -->
                <div class="form-group">
                    <label class="form-label">${this.__('detailPage.searchProduct')}</label>
                    <div class="search-input-wrapper" style="position: relative;">
                        <i class="ti ti-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                        <input type="text" id="product-search-input" class="form-input"
                               placeholder="${this.__('detailPage.searchProductPlaceholder')}"
                               style="padding-left: 40px;">
                    </div>
                </div>

                <!-- Product List -->
                <div class="form-group">
                    <label class="form-label">${this.__('detailPage.selectProduct')}</label>
                    <div id="product-list-container" class="product-list-container" style="max-height: 280px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
                        ${this._renderProductList(products)}
                    </div>
                    <div id="selected-product-info" class="selected-product-info" style="margin-top: 8px; padding: 8px 12px; background: var(--bg-secondary); border-radius: 6px; display: none;">
                        <span class="text-muted">${this.__('detailPage.selectedProduct')}:</span>
                        <strong id="selected-product-name"></strong>
                    </div>
                </div>

                <!-- Template Selection -->
                <div class="form-group">
                    <label class="form-label">${this.__('detailPage.selectTemplate')}</label>
                    <select id="assign-template" class="form-select">
                        <option value="">${this.__('detailPage.defaultTemplate')}</option>
                    </select>
                </div>

                ${products.length === 0 ? `
                    <div class="alert alert-warning" style="display: flex; align-items: center; gap: 8px; padding: 12px; background: rgba(250, 176, 5, 0.1); border: 1px solid rgba(250, 176, 5, 0.3); border-radius: 8px; color: #b7791f;">
                        <i class="ti ti-alert-triangle"></i>
                        <span>${this.__('detailPage.noAvailableProducts')}</span>
                    </div>
                ` : ''}
            </div>
        `;

        Modal.show({
            title: this.__('detailPage.assignProduct'),
            icon: 'ti-package',
            content: formContent,
            size: 'md',
            confirmText: this.__('actions.assign'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                if (!this._selectedProductId) {
                    Toast.error(this.__('pleaseSelectProduct'));
                    throw new Error('Validation failed');
                }

                const templateId = document.getElementById('assign-template')?.value;

                try {
                    await this.app.api.post(`/devices/${this.deviceId}/products`, {
                        product_id: this._selectedProductId,
                        template_id: templateId || null
                    });
                    Toast.success(this.__('toast.productAssigned'));
                    await this.loadDevice();
                } catch (error) {
                    Toast.error(error.message || this.__('messages.error'));
                    throw error;
                }
            }
        });

        // Bind search and selection events
        setTimeout(() => {
            this._bindProductSearchEvents();
            this.loadTemplatesForAssign();
        }, 100);
    }

    _renderProductList(products) {
        if (!products || products.length === 0) {
            return `<div class="text-center text-muted" style="padding: 24px;">${this.__('detailPage.noProductsFound')}</div>`;
        }

        return products.map(p => `
            <div class="product-list-item" data-product-id="${p.id}" data-product-name="${escapeHTML(p.name)}" data-product-sku="${escapeHTML(p.sku || '')}"
                 style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--border-color); transition: background 0.15s;">
                <div class="product-select-indicator" style="width: 20px; height: 20px; border: 2px solid var(--border-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="ti ti-check" style="font-size: 12px; color: white; display: none;"></i>
                </div>
                <div class="product-info" style="flex: 1; min-width: 0;">
                    <div class="product-name" style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(p.name)}</div>
                    <div class="product-meta" style="font-size: 0.85em; color: var(--text-muted);">
                        <span class="product-sku">${escapeHTML(p.sku || '-')}</span>
                        ${p.barcode ? `<span style="margin-left: 8px; opacity: 0.7;">• ${escapeHTML(p.barcode)}</span>` : ''}
                    </div>
                </div>
                <div class="product-price" style="font-weight: 600; color: var(--color-primary); white-space: nowrap;">
                    ${p.current_price ? `₺${parseFloat(p.current_price).toFixed(2)}` : '-'}
                </div>
            </div>
        `).join('');
    }

    _bindProductSearchEvents() {
        const searchInput = document.getElementById('product-search-input');
        const listContainer = document.getElementById('product-list-container');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                const filteredProducts = this._assignModalProducts.filter(p => {
                    const name = (p.name || '').toLowerCase();
                    const sku = (p.sku || '').toLowerCase();
                    const barcode = (p.barcode || '').toLowerCase();
                    return name.includes(query) || sku.includes(query) || barcode.includes(query);
                });
                listContainer.innerHTML = this._renderProductList(filteredProducts);
                this._bindProductItemClickEvents();

                // Re-select if previously selected product is still in filtered list
                if (this._selectedProductId) {
                    const selectedItem = listContainer.querySelector(`[data-product-id="${this._selectedProductId}"]`);
                    if (selectedItem) {
                        this._selectProductItem(selectedItem);
                    }
                }
            });
        }

        this._bindProductItemClickEvents();
    }

    _bindProductItemClickEvents() {
        const listContainer = document.getElementById('product-list-container');
        if (!listContainer) return;

        listContainer.querySelectorAll('.product-list-item').forEach(item => {
            item.addEventListener('click', () => {
                this._selectProductItem(item);
            });

            // Hover effect
            item.addEventListener('mouseenter', () => {
                item.style.background = 'var(--bg-secondary)';
            });
            item.addEventListener('mouseleave', () => {
                if (!item.classList.contains('selected')) {
                    item.style.background = '';
                }
            });
        });
    }

    _selectProductItem(item) {
        const listContainer = document.getElementById('product-list-container');
        const selectedInfo = document.getElementById('selected-product-info');
        const selectedName = document.getElementById('selected-product-name');

        // Deselect all
        listContainer.querySelectorAll('.product-list-item').forEach(el => {
            el.classList.remove('selected');
            el.style.background = '';
            const indicator = el.querySelector('.product-select-indicator');
            if (indicator) {
                indicator.style.background = '';
                indicator.style.borderColor = 'var(--border-color)';
                indicator.querySelector('i').style.display = 'none';
            }
        });

        // Select clicked
        item.classList.add('selected');
        item.style.background = 'rgba(34, 139, 230, 0.1)';
        const indicator = item.querySelector('.product-select-indicator');
        if (indicator) {
            indicator.style.background = 'var(--color-primary)';
            indicator.style.borderColor = 'var(--color-primary)';
            indicator.querySelector('i').style.display = 'block';
        }

        // Store selected product
        this._selectedProductId = item.dataset.productId;

        // Show selected info
        if (selectedInfo && selectedName) {
            selectedName.textContent = `${item.dataset.productName} (${item.dataset.productSku})`;
            selectedInfo.style.display = 'block';
        }
    }

    async loadTemplatesForAssign() {
        try {
            const type = this.device?.type === 'esl' || this.device?.type === 'esl_android' ? 'esl' : 'signage';
            const response = await this.app.api.get(`/templates?type=${type}`);
            const templates = response.data || [];
            const select = document.getElementById('assign-template');
            if (select) {
                templates.forEach(t => {
                    const option = document.createElement('option');
                    option.value = t.id;
                    option.textContent = t.name;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            Logger.error('Templates load error:', error);
        }
    }

    async removeProduct(productId) {
        Modal.confirm({
            title: this.__('removeProduct'),
            message: this.__('removeProductConfirm'),
            type: 'warning',
            confirmText: this.__('actions.remove'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/devices/${this.deviceId}/products/${productId}`);
                    Toast.success(this.__('toast.productRemoved'));
                    await this.loadDevice();
                } catch (error) {
                    Toast.error(error.message || this.__('messages.error'));
                    throw error;
                }
            }
        });
    }

    async showEditModal() {
        // Ürün gruplarını (kategoriler) yükle
        let groups = [];
        try {
            const response = await this.app.api.get('/products/groups');
            groups = response.data || [];
        } catch (e) {
            groups = [];
        }

        // Şubeleri yükle
        let branches = [];
        try {
            const response = await this.app.api.get('/branches?hierarchy=1');
            branches = response.data?.all || response.data || [];
        } catch (e) {
            branches = [];
        }

        const d = this.device;

        // Calculate preview container dimensions based on device screen size
        const previewDimensions = this.calculatePreviewDimensions(d.screen_width, d.screen_height);

        // Preview image URL
        const previewUrl = this.getDeviceCustomPreviewUrl(d) || '';
        const hasPreview = !!previewUrl;

        const formContent = `
            <div class="space-y-4">
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
                    <input type="text" id="edit-name" class="form-input" value="${escapeHTML(d.name)}" required>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.type')}</label>
                        <select id="edit-type" class="form-select">
                            <option value="esl" ${d.type === 'esl' ? 'selected' : ''}>${this.__('types.esl')}</option>
                            <option value="esl_rtos" ${d.type === 'esl_rtos' ? 'selected' : ''}>${this.__('types.esl_rtos')}</option>
                            <option value="esl_android" ${d.type === 'esl_android' ? 'selected' : ''}>${this.__('types.esl_android')}</option>
                            <option value="hanshow_esl" ${d.type === 'hanshow_esl' || d.model === 'hanshow_esl' ? 'selected' : ''}>${this.__('types.hanshow_esl')}</option>
                            <option value="android_tv" ${(d.type === 'android_tv' || d.type === 'tv') && d.model !== 'priceview' && d.model !== 'stream_player' ? 'selected' : ''}>${this.__('types.android_tv')}</option>
                            <option value="tablet" ${d.type === 'tablet' ? 'selected' : ''}>${this.__('types.tablet')}</option>
                            <option value="mobile" ${d.type === 'mobile' ? 'selected' : ''}>${this.__('types.mobile')}</option>
                            <option value="web_display" ${d.type === 'web_display' ? 'selected' : ''}>${this.__('types.web_display')}</option>
                            <option value="tv" ${d.type === 'tv' ? 'selected' : ''}>${this.__('types.tv')}</option>
                            <option value="panel" ${d.type === 'panel' ? 'selected' : ''}>${this.__('types.panel')}</option>
                            <option value="priceview" ${d.model === 'priceview' ? 'selected' : ''}>${this.__('types.priceview')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.status')}</label>
                        <select id="edit-status" class="form-select">
                            <option value="offline" ${d.status !== 'online' ? 'selected' : ''}>${this.__('statuses.offline')}</option>
                            <option value="online" ${d.status === 'online' ? 'selected' : ''}>${this.__('statuses.online')}</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.group')}</label>
                    <select id="edit-group" class="form-select">
                        <option value="">${this.__('form.placeholders.selectGroup')}</option>
                        ${groups.map(g => `
                            <option value="${g.id}" ${g.id === d.group_id ? 'selected' : ''}>${escapeHTML(g.name)}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.branch')}</label>
                    <select id="edit-branch" class="form-select">
                        <option value="">${this.__('form.placeholders.selectBranch')}</option>
                        ${branches.map(b => `
                            <option value="${b.id}" ${b.id === d.branch_id ? 'selected' : ''}>
                                ${escapeHTML(b.name)} (${b.type === 'region' ? this.__('branches.region') : this.__('branches.branch')})
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.serialNumber')}</label>
                    <input type="text" id="edit-serial" class="form-input" value="${escapeHTML(d.serial_number || '')}" placeholder="${this.__('form.placeholders.serialNumber')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.resyncCode')}</label>
                    <input type="text" id="edit-resync-code" class="form-input" maxlength="6" placeholder="${this.__('form.placeholders.syncCode')}">
                    <p class="form-hint">${this.__('form.hints.resyncCodeOptional')}</p>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.ipAddress')}</label>
                    <input type="text" id="edit-ip" class="form-input" value="${escapeHTML(this.normalizeLoopbackIp(d.ip_address || ''))}" placeholder="${this.__('form.placeholders.ipAddress')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.location')}</label>
                    <input type="text" id="edit-location" class="form-input" value="${escapeHTML(d.location || d.model || '')}" placeholder="${this.__('form.placeholders.location')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.macAddress')}</label>
                    <input type="text" id="edit-mac" class="form-input" value="${escapeHTML(d.mac_address || '')}" placeholder="${this.__('form.placeholders.macAddress')}">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.screenWidth')}</label>
                        <input type="number" id="edit-screen-width" class="form-input" value="${d.screen_width || ''}" placeholder="${this.__('form.placeholders.screenWidth')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.screenHeight')}</label>
                        <input type="number" id="edit-screen-height" class="form-input" value="${d.screen_height || ''}" placeholder="${this.__('form.placeholders.screenHeight')}">
                    </div>
                </div>
            </div>
        `;

        Modal.show({
            title: this.__('editDevice'),
            icon: 'ti-edit',
            content: formContent,
            size: 'md',
            confirmText: this.__('modal.update'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                const name = document.getElementById('edit-name')?.value?.trim();
                const resyncCode = document.getElementById('edit-resync-code')?.value?.trim();
                if (!name) {
                    Toast.error(this.__('validation.nameRequired'));
                    throw new Error('Validation failed');
                }
                if (resyncCode && !/^\d{6}$/.test(resyncCode)) {
                    Toast.error(this.__('toast.syncCodeInvalid'));
                    throw new Error('Validation failed');
                }

                const screen_width = document.getElementById('edit-screen-width')?.value ? parseInt(document.getElementById('edit-screen-width').value) : null;
                const screen_height = document.getElementById('edit-screen-height')?.value ? parseInt(document.getElementById('edit-screen-height').value) : null;

                const data = {
                    name,
                    type: document.getElementById('edit-type')?.value,
                    status: document.getElementById('edit-status')?.value,
                    location: document.getElementById('edit-location')?.value,
                    group_id: document.getElementById('edit-group')?.value || null,
                    branch_id: document.getElementById('edit-branch')?.value || null,
                    serial_number: document.getElementById('edit-serial')?.value?.trim(),
                    ip_address: this.normalizeLoopbackIp(document.getElementById('edit-ip')?.value?.trim()),
                    mac_address: document.getElementById('edit-mac')?.value?.trim(),
                    screen_width,
                    screen_height
                };

                // Preview image handling
                const previewChanged = document.getElementById('device-preview-changed')?.value === '1';
                const currentPreviewUrl = document.getElementById('device-preview-url')?.value;

                try {
                    if (resyncCode) {
                        await this.relinkDeviceWithSyncCode(resyncCode, {
                            name,
                            type: data.type,
                            group_id: data.group_id,
                            location: data.location
                        });
                    }

                    await this.app.api.put(`/devices/${this.deviceId}`, data);

                    // Handle preview image upload/delete if changed
                    if (previewChanged) {
                        const hasNewFile = this._pendingPreviewFile != null;

                        if (hasNewFile) {
                            // Upload new preview image
                            const formData = new FormData();
                            formData.append('file', this._pendingPreviewFile);
                            formData.append('device_id', this.deviceId);

                            try {
                                await this.app.api.upload(`/devices/${this.deviceId}/upload-preview`, formData);
                                this._pendingPreviewFile = null;
                            } catch (uploadError) {
                                console.warn('Preview upload failed:', uploadError);
                                Toast.warning(this.__('toast.previewUploadFailed'));
                            }
                        } else if (!currentPreviewUrl || currentPreviewUrl === '') {
                            // Preview was removed, delete from server
                            try {
                                await this.app.api.delete(`/devices/${this.deviceId}/preview`);
                            } catch (deleteError) {
                                console.warn('Preview delete failed:', deleteError);
                            }
                        }
                    }

                    Toast.success(this.__('toast.updated'));
                    await this.loadDevice();
                } catch (error) {
                    Toast.error(error.message || this.__('toast.saveFailed'));
                    throw error;
                }
            }
        });

        // Bind preview upload events after modal is shown
        setTimeout(() => {
            this.bindPreviewUploadEvents();
        }, 100);
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

    async deleteDevice() {
        Modal.confirm({
            title: this.__('deleteDevice'),
            message: this.__('deleteConfirm', { name: this.device?.name || '' }),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/devices/${this.deviceId}`);
                    Toast.success(this.__('toast.deleted'));
                    window.location.hash = '#/devices';
                } catch (error) {
                    Toast.error(error.message || this.__('toast.deleteFailed'));
                    throw error;
                }
            }
        });
    }

    /**
     * Check if device is PavoDisplay ESL
     */
    isPavoDisplayDevice(device) {
        return device.type === 'esl' || device.model === 'esl_android' || device.model === 'PavoDisplay';
    }

    /**
     * Load device hardware info (storage, memory, etc.)
     */
    async loadDeviceInfo() {
        if (!this.device) return;
        if ((this.device.status || '').toLowerCase() !== 'online') return;
        // PavoDisplay HTTP-SERVER cihazları IP gerektirir, MQTT cihazlar IP'siz de çalışabilir
        if (!this.device.ip_address && !this.device.mqtt_client_id) return;

        try {
            const response = await this.app.api.post(`/devices/${this.deviceId}/control`, {
                action: 'device_info'
            });

            // API yanıtı: { success: true, data: { success: true, device_info: {...} } }
            const deviceInfo = response?.data?.device_info || response?.device_info;
            if (response.success && deviceInfo) {
                this.deviceInfo = deviceInfo;

                // Update storage display
                this.updateStorageDisplay();
            }
        } catch (error) {
            Logger.warn('Failed to load device info:', error);
            // Non-critical error, don't show to user
        }
    }

    /**
     * Update storage display in UI
     */
    updateStorageDisplay() {
        const container = document.getElementById('device-storage-info');
        if (!container || !this.deviceInfo) return;

        const info = this.deviceInfo;
        const usedSpace = info.used_space || 0;
        const totalStorage = info.total_storage || 0;
        const freeSpace = info.free_space || 0;
        const usagePercent = info.usage_percent || 0;

        if (totalStorage > 0) {
            container.innerHTML = `
                <div class="dd-prop-item">
                    <span class="dd-prop-label">${this.__('detailPage.storage')}</span>
                    <span class="dd-prop-value">
                        <div class="storage-info-compact">
                            <div class="storage-bar">
                                <div class="storage-used" style="width: ${usagePercent}%"></div>
                            </div>
                            <div class="storage-text">
                                ${this.formatBytes(usedSpace)} / ${this.formatBytes(totalStorage)}
                                <span class="text-muted">(${usagePercent}%)</span>
                            </div>
                        </div>
                    </span>
                </div>
            `;
        } else if (freeSpace > 0) {
            container.innerHTML = `
                <div class="dd-prop-item">
                    <span class="dd-prop-label">${this.__('detailPage.storage')}</span>
                    <span class="dd-prop-value">${this.formatBytes(freeSpace)} ${this.__('detailPage.freeSpace') || 'boş'}</span>
                </div>
            `;
        }
    }

    /**
     * Format bytes to human readable string
     */
    formatBytes(bytes) {
        if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    destroy() {
        window.deviceDetailPage = null;
        this.app.i18n.clearPageTranslations();
    }
}

export default DeviceDetailPage;
