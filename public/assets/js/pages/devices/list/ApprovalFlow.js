/**
 * ApprovalFlow Module
 * Bekleyen cihaz onay/red işlemleri
 *
 * DeviceList.js'den ayrıldı - Faz 3, Adım 3.4
 * Tarih: 2026-01-25
 */

import { Modal } from '../../../components/Modal.js';
import { Toast } from '../../../components/Toast.js';
import { Logger } from '../../../core/Logger.js';

/**
 * ApprovalFlow - Bekleyen cihaz kayıt işlemleri
 */
class ApprovalFlow {
    constructor(context) {
        this.app = context.app;
        this.__ = context.__;
        this.deviceGroups = context.deviceGroups || [];
        this.refreshDevices = context.refreshDevices;
        this.loadPendingCount = context.loadPendingCount;
        this.escapeHtml = context.escapeHtml;

        this._pendingRequestsCache = [];
        this._playlistsCache = null;
    }

    /**
     * Show pending sync requests modal
     */
    async show() {
        try {
            const response = await this.app.api.get('/esl/pending?status=pending&include_unbound=1');
            const pendingRequests = response.data || [];

            if (pendingRequests.length === 0) {
                Modal.alert({
                    title: this.__('pendingDevices.title'),
                    message: this.__('pendingDevices.noDevices'),
                    type: 'info'
                });
                return;
            }

            const groupOptions = this.deviceGroups.map(g =>
                `<option value="${g.id}">${g.name}</option>`
            ).join('');

            const tableRows = pendingRequests.map(req => {
                // Build detailed display name
                let displayName = req.displayName || '';
                if (!displayName) {
                    if (req.brand && req.model) {
                        displayName = `${req.brand} ${req.model}`;
                    } else if (req.model) {
                        displayName = req.model;
                    } else if (req.browser) {
                        displayName = req.browser;
                    } else {
                        displayName = req.serialNumber || 'Bilinmeyen';
                    }
                }

                // Build device info subtitle
                let deviceSubtitle = '';
                const deviceTypeLabel = req.detailedDeviceType || (req.deviceType === 'pwa_player' ? 'PWA' : 'ESL');
                const osInfo = req.os ? (req.osVersion ? `${req.os} ${req.osVersion}` : req.os) : '';

                if (req.detailedDeviceType) {
                    // Capitalize first letter
                    const typeLabel = req.detailedDeviceType.charAt(0).toUpperCase() + req.detailedDeviceType.slice(1);
                    deviceSubtitle = typeLabel;
                    if (osInfo) deviceSubtitle += ` • ${osInfo}`;
                } else {
                    deviceSubtitle = deviceTypeLabel;
                    if (osInfo) deviceSubtitle += ` • ${osInfo}`;
                }

                // Screen info
                let screenInfo = '-';
                if (req.screenWidth && req.screenHeight) {
                    screenInfo = `${req.screenWidth}x${req.screenHeight}`;
                    if (req.screenDiagonal) {
                        screenInfo += ` (${req.screenDiagonal}")`;
                    }
                } else if (req.resolution || req.screenResolution) {
                    screenInfo = req.resolution || req.screenResolution;
                }

                const ipAddress = req.ipAddress || '-';
                const syncCode = req.syncCode || '-';
                const createdAt = req.createdAt ? new Date(req.createdAt).toLocaleString('tr-TR') : '-';
                const isExpired = req.isExpired;
                const statusBadge = isExpired
                    ? `<span class="badge badge-danger">${this.__('status.expired')}</span>`
                    : `<span class="badge badge-warning">${this.__('status.pending')}</span>`;

                // Device type icon
                let deviceIcon = 'ti-device-mobile';
                if (req.detailedDeviceType === 'tablet') deviceIcon = 'ti-device-tablet';
                else if (req.detailedDeviceType === 'tv') deviceIcon = 'ti-device-tv';
                else if (req.detailedDeviceType === 'desktop') deviceIcon = 'ti-device-desktop';
                else if (req.deviceType === 'esl') deviceIcon = 'ti-tag';

                return `
                    <tr data-request-id="${req.id}" data-sync-code="${syncCode}" ${isExpired ? 'class="text-muted"' : ''}>
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                <i class="${deviceIcon} text-muted" style="font-size: 1.25rem;"></i>
                                <div class="d-flex flex-column">
                                    <strong>${this.escapeHtml(displayName)}</strong>
                                    <small class="text-muted">${this.escapeHtml(deviceSubtitle)}</small>
                                </div>
                            </div>
                        </td>
                        <td><code>${syncCode}</code></td>
                        <td>${screenInfo}</td>
                        <td>${ipAddress}</td>
                        <td>${statusBadge}</td>
                        <td><small>${createdAt}</small></td>
                        <td>
                            ${!isExpired ? `
                                <button type="button" class="btn btn-sm btn-success approve-request-btn" data-id="${req.id}" data-sync="${syncCode}">
                                    <i class="ti ti-check"></i>
                                </button>
                                <button type="button" class="btn btn-sm btn-danger reject-request-btn" data-id="${req.id}" data-sync="${syncCode}">
                                    <i class="ti ti-x"></i>
                                </button>
                            ` : `
                                <button type="button" class="btn btn-sm btn-outline delete-request-btn" data-id="${req.id}">
                                    <i class="ti ti-trash"></i>
                                </button>
                            `}
                        </td>
                    </tr>
                `;
            }).join('');

            const content = `
                <div class="pending-devices-modal-content">
                    <div class="table-responsive" style="max-height: 400px; overflow-y: auto; overflow-x: auto;">
                        <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>${this.__('pendingDevices.device')}</th>
                                <th>${this.__('pendingDevices.syncCode')}</th>
                                <th>${this.__('columns.resolution')}</th>
                                <th>${this.__('columns.ipAddress')}</th>
                                <th>${this.__('columns.status')}</th>
                                <th>${this.__('pendingDevices.createdAt')}</th>
                                <th>${this.__('columns.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                        </table>
                    </div>
                </div>
            `;

            const modal = Modal.show({
                title: this.__('pendingDevices.title'),
                icon: 'ti-device-mobile-question',
                content: content,
                size: 'xl',
                showConfirm: false,
                cancelText: this.__('modal.close')
            });

            // Store pending requests for later use
            this._pendingRequestsCache = pendingRequests;

            // Bind approve buttons
            setTimeout(() => {
                document.querySelectorAll('.approve-request-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const syncCode = btn.dataset.sync;
                        const requestId = btn.dataset.id;
                        // Find the request data
                        const requestData = this._pendingRequestsCache?.find(r => r.id === requestId) || {};
                        await this._showApproveModal(requestId, syncCode, modal, requestData);
                    });
                });

                document.querySelectorAll('.reject-request-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const syncCode = btn.dataset.sync;
                        const requestId = btn.dataset.id;
                        await this._rejectRequest(requestId, syncCode, modal);
                    });
                });

                document.querySelectorAll('.delete-request-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const requestId = btn.dataset.id;
                        await this._deleteRequest(requestId, modal);
                    });
                });
            }, 100);

        } catch (error) {
            Logger.error('Failed to load pending requests:', error);
            Toast.error(this.__('toast.loadFailed'));
        }
    }

    /**
     * Show approve modal for sync request
     */
    async _showApproveModal(requestId, syncCode, parentModal, requestData = {}) {
        if (!Array.isArray(this._playlistsCache)) {
            try {
                const playlistResponse = await this.app.api.get('/playlists');
                const playlists = Array.isArray(playlistResponse?.data) ? playlistResponse.data : [];
                this._playlistsCache = playlists
                    .filter(playlist => playlist && playlist.id)
                    .map(playlist => ({
                        id: playlist.id,
                        name: playlist.name || 'Playlist',
                        items_count: Number.parseInt(playlist.items_count, 10) || 0
                    }));
            } catch (error) {
                Logger.warn('Failed to load playlists for approval modal:', error);
                this._playlistsCache = [];
            }
        }

        const groupOptions = this.deviceGroups.map(g =>
            `<option value="${g.id}">${g.name}</option>`
        ).join('');

        const playlistOptions = (this._playlistsCache || []).map(playlist =>
            `<option value="${playlist.id}">${this.escapeHtml(playlist.name)} (${playlist.items_count})</option>`
        ).join('');

        // Auto-detect device type from request data
        let autoSelectedType = 'android_tv'; // Default
        const detailedType = (requestData.detailedDeviceType || '').toLowerCase();
        const os = (requestData.os || '').toLowerCase();
        const browser = (requestData.browser || '').toLowerCase();

        if (detailedType === 'mobile' || detailedType === 'phone' || detailedType === 'smartphone') {
            autoSelectedType = 'mobile';
        } else if (detailedType === 'tablet') {
            autoSelectedType = 'tablet';
        } else if (detailedType === 'tv' || os.includes('android tv') || os.includes('google tv')) {
            if (os.includes('google tv')) {
                autoSelectedType = 'google_tv';
            } else {
                autoSelectedType = 'android_tv';
            }
        } else if (detailedType === 'desktop' || browser.includes('chrome') || browser.includes('firefox') || browser.includes('edge')) {
            // If it's a desktop browser on Windows/Mac/Linux
            if (os.includes('windows') || os.includes('mac') || os.includes('linux')) {
                autoSelectedType = 'pc_browser';
            } else {
                autoSelectedType = 'android_tv';
            }
        } else if (requestData.deviceType === 'esl') {
            autoSelectedType = 'esl';
        }

        // Get screen resolution
        let screenResolution = '';
        if (requestData.screenWidth && requestData.screenHeight) {
            screenResolution = `${requestData.screenWidth}x${requestData.screenHeight}`;
        } else if (requestData.resolution) {
            screenResolution = requestData.resolution;
        }

        // Build default device name from request data
        let defaultDeviceName = '';
        if (requestData.displayName) {
            // Use displayName if already generated by backend
            defaultDeviceName = requestData.displayName;

            // If displayName is browser/os format, enhance with os version and device type
            if (defaultDeviceName.includes('/') && !requestData.brand) {
                const osVersion = requestData.osVersion || '';
                const detailedType = requestData.detailedDeviceType || '';

                // Add device type if available (e.g., "Mobile", "Tablet", "TV")
                if (detailedType && !defaultDeviceName.toLowerCase().includes(detailedType.toLowerCase())) {
                    const typeLabel = detailedType.charAt(0).toUpperCase() + detailedType.slice(1);
                    defaultDeviceName = defaultDeviceName.replace(' / ', ` / ${typeLabel} • `);
                }

                // Add OS version if available
                if (osVersion && !defaultDeviceName.includes(osVersion)) {
                    defaultDeviceName += ` ${osVersion}`;
                }
            }
        } else {
            // Build from browser and os info as fallback
            const browserName = requestData.browser || '';
            const osName = requestData.os || '';
            const osVersion = requestData.osVersion || '';
            const detailedType = requestData.detailedDeviceType || '';

            const parts = [];
            if (browserName) parts.push(browserName);

            if (osName) {
                let osDisplay = osName;
                if (detailedType) {
                    const typeLabel = detailedType.charAt(0).toUpperCase() + detailedType.slice(1);
                    osDisplay = `${typeLabel} • ${osName}`;
                }
                if (osVersion) osDisplay += ' ' + osVersion;
                parts.push(osDisplay);
            }

            if (parts.length > 0) {
                defaultDeviceName = parts.join(' / ');
            }
        }

        // Type options with auto-selection
        const typeOptions = [
            { value: 'android_tv', label: this.__('types.android_tv') },
            { value: 'google_tv', label: this.__('types.google_tv') },
            { value: 'tablet', label: this.__('types.tablet') },
            { value: 'mobile', label: this.__('types.mobile') },
            { value: 'pc_browser', label: this.__('types.pc_browser') },
            { value: 'tv', label: this.__('types.tv') },
            { value: 'esl', label: this.__('types.esl') }
        ].map(opt => `<option value="${opt.value}" ${opt.value === autoSelectedType ? 'selected' : ''}>${opt.label}</option>`).join('');

        const formContent = `
            <form id="approve-request-form" class="space-y-4">
                <div class="alert alert-info">
                    <i class="ti ti-info-circle"></i>
                    <span>${this.__('pendingDevices.syncCode')}: <code>${syncCode}</code></span>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.name')} *</label>
                    <input type="text" id="approve-req-name" class="form-input" required
                        value="${defaultDeviceName}"
                        placeholder="${this.__('form.placeholders.name')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.type')} *</label>
                    <select id="approve-req-type" class="form-select">
                        ${typeOptions}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('columns.resolution')}</label>
                        <input type="text" id="approve-req-resolution" class="form-input"
                            value="${screenResolution}" placeholder="${this.__('form.placeholders.resolution')}" readonly>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.fields.ipAddress')}</label>
                        <input type="text" id="approve-req-ip" class="form-input"
                            value="${requestData.ipAddress || ''}" placeholder="${this.__('form.placeholders.ipAddress')}" readonly>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.group')}</label>
                    <select id="approve-req-group" class="form-select">
                        <option value="">${this.__('form.placeholders.selectGroup')}</option>
                        ${groupOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('assignPlaylist')} (${this.__('form.optional')})</label>
                    <select id="approve-req-playlist" class="form-select">
                        <option value="">${this.__('selectPlaylistPlaceholder')}</option>
                        ${playlistOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.fields.location')}</label>
                    <input type="text" id="approve-req-location" class="form-input"
                        placeholder="${this.__('form.placeholders.location')}">
                </div>
                <input type="hidden" id="approve-req-id" value="${requestId}">
                <input type="hidden" id="approve-req-sync" value="${syncCode}">
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
                const name = document.getElementById('approve-req-name')?.value?.trim();
                const type = document.getElementById('approve-req-type')?.value;
                const group_id = document.getElementById('approve-req-group')?.value || null;
                const playlist_id = document.getElementById('approve-req-playlist')?.value || null;
                const location = document.getElementById('approve-req-location')?.value?.trim();

                if (!name) {
                    Toast.error(this.__('validation.nameRequired'));
                    throw new Error('Validation failed');
                }

                try {
                    const response = await this.app.api.post('/esl/approve', {
                        request_id: requestId,
                        sync_code: syncCode,
                        name: name,
                        type: type,
                        group_id: group_id,
                        playlist_id: playlist_id,
                        location: location
                    });
                    const warning = typeof response?.data?.warning === 'string' ? response.data.warning : '';
                    if (warning) {
                        Toast.warning(warning);
                    }
                    Toast.success(this.__('toast.approved'));
                    if (this.loadPendingCount) this.loadPendingCount();
                    if (this.refreshDevices) this.refreshDevices();

                    // Close parent modal and refresh
                    if (parentModal) {
                        Modal.close(parentModal.id);
                    }
                } catch (error) {
                    Toast.error(error.message || this.__('toast.approveFailed'));
                    throw error;
                }
            }
        });
    }

    /**
     * Reject sync request
     */
    async _rejectRequest(requestId, syncCode, parentModal) {
        Modal.confirm({
            title: this.__('actions.reject'),
            message: this.__('pendingDevices.rejectConfirm'),
            type: 'danger',
            confirmText: this.__('actions.reject'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.post('/esl/reject', {
                        request_id: requestId,
                        sync_code: syncCode
                    });
                    Toast.success(this.__('toast.rejected'));
                    if (this.loadPendingCount) this.loadPendingCount();

                    // Close parent modal and refresh
                    if (parentModal) {
                        Modal.close(parentModal.id);
                        this.show(); // Reopen with fresh data
                    }
                } catch (error) {
                    Toast.error(error.message || this.__('toast.rejectFailed'));
                    throw error;
                }
            }
        });
    }

    /**
     * Delete expired sync request
     */
    async _deleteRequest(requestId, parentModal) {
        Modal.confirm({
            title: this.__('modal.delete'),
            message: this.__('pendingDevices.deleteConfirm'),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/esl/pending/${requestId}`);
                    Toast.success(this.__('toast.deleted'));
                    if (this.loadPendingCount) this.loadPendingCount();

                    // Refresh modal
                    if (parentModal) {
                        Modal.close(parentModal.id);
                        this.show();
                    }
                } catch (error) {
                    Toast.error(error.message || this.__('toast.deleteFailed'));
                    throw error;
                }
            }
        });
    }

    /**
     * Cleanup
     */
    destroy() {
        this._pendingRequestsCache = [];
        this._playlistsCache = null;
    }
}

/**
 * Initialize ApprovalFlow module
 * @param {Object} context - { app, __, deviceGroups, refreshDevices, loadPendingCount, escapeHtml }
 * @returns {ApprovalFlow}
 */
export function init(context) {
    return new ApprovalFlow(context);
}

export default ApprovalFlow;
