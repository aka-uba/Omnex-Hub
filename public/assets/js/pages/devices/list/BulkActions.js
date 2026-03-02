/**
 * BulkActions Module
 * Toplu işlemler, playlist atama, filtreler ve cihaz komutlarını yönetir
 *
 * @module list/BulkActions
 * @requires Modal, Toast, Logger
 */

import { Modal } from '../../../components/Modal.js';
import { Toast } from '../../../components/Toast.js';
import { Logger } from '../../../core/Logger.js';

/**
 * BulkActions sınıfı
 * Cihaz listesi toplu işlemlerini yönetir
 */
class BulkActions {
    /**
     * @param {Object} context - Modül bağlamı
     * @param {Object} context.app - Ana uygulama instance
     * @param {Function} context.__ - i18n çeviri fonksiyonu
     * @param {Function} context.refreshTable - Tablo yenileme fonksiyonu
     * @param {Array} context.deviceGroups - Cihaz grupları listesi
     * @param {Function} context.onFiltersChange - Filtre değişikliği callback'i
     */
    constructor(context) {
        this.app = context.app;
        this.__ = context.__;
        this.refreshTable = context.refreshTable;
        this.deviceGroups = context.deviceGroups || [];
        this.onFiltersChange = context.onFiltersChange;

        // State
        this.currentFilters = {};
        this.currentApprovalFilter = '';
    }

    /**
     * Cihaz gruplarını güncelle
     * @param {Array} groups - Yeni grup listesi
     */
    setDeviceGroups(groups) {
        this.deviceGroups = groups || [];
    }

    /**
     * Mevcut filtreleri al
     * @returns {Object} Mevcut filtreler
     */
    getFilters() {
        return {
            ...this.currentFilters,
            approval_status: this.currentApprovalFilter
        };
    }

    // =========================================================================
    // PLAYLIST ATAMA
    // =========================================================================

    /**
     * Playlist atama modalını göster
     * @param {Object} device - Hedef cihaz
     */
    async showAssignPlaylistModal(device) {
        // Playlist'leri yükle
        let playlists = [];
        try {
            const response = await this.app.api.get('/playlists?status=active');
            playlists = response.data || [];
        } catch (error) {
            Logger.error('Failed to load playlists:', error);
            Toast.error(this.__('bulkActions.playlistLoadFailed'));
            return;
        }

        // Mevcut atamayı al
        let currentPlaylistId = null;
        try {
            const assignmentResponse = await this.app.api.get(`/devices/${device.id}`);
            currentPlaylistId = assignmentResponse.data?.assigned_playlist_id;
        } catch (e) {
            // Ignore
        }

        const playlistOptions = playlists.map(p => `
            <option value="${p.id}" ${currentPlaylistId === p.id ? 'selected' : ''}>
                ${p.name} ${p.items_count ? `(${p.items_count} ${this.__('detailPage.contentCount')})` : ''}
            </option>
        `).join('');

        const content = `
            <div class="space-y-4">
                <div class="alert alert-info">
                    <i class="ti ti-info-circle"></i>
                    <div>
                        <strong>${device.name}</strong>
                        <p class="text-sm text-muted">${device.type === 'android_tv' ? this.__('bulkActions.pwaPlayerTv') : device.type}</p>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('actions.assignPlaylist')}</label>
                    <select id="assign-playlist-select" class="form-select">
                        <option value="">${this.__('bulkActions.selectPlaylist')}</option>
                        ${playlistOptions}
                    </select>
                    <p class="form-hint">${this.__('bulkActions.playlistWillAutoPlay')}</p>
                </div>
                ${playlists.length === 0 ? `
                    <div class="alert alert-warning">
                        <i class="ti ti-alert-triangle"></i>
                        <span>${this.__('bulkActions.noActivePlaylistFound')}</span>
                        <a href="#/signage/playlists" class="btn btn-sm btn-outline ml-2">${this.__('bulkActions.createPlaylist')}</a>
                    </div>
                ` : ''}
            </div>
        `;

        Modal.show({
            title: this.__('actions.assignPlaylist'),
            icon: 'ti-playlist',
            content: content,
            size: 'md',
            confirmText: this.__('actions.assign'),
            cancelText: this.__('modal.cancel'),
            showConfirm: playlists.length > 0,
            onConfirm: async () => {
                const playlistId = document.getElementById('assign-playlist-select')?.value;
                if (!playlistId) {
                    Toast.warning(this.__('bulkActions.pleaseSelectPlaylist'));
                    throw new Error('No playlist selected');
                }
                await this.assignPlaylist(device.id, playlistId);
            }
        });
    }

    /**
     * Cihaza playlist ata
     * @param {string} deviceId - Cihaz ID
     * @param {string} playlistId - Playlist ID
     */
    async assignPlaylist(deviceId, playlistId) {
        try {
            await this.app.api.post(`/devices/${deviceId}/assign-playlist`, {
                playlist_id: playlistId
            });
            Toast.success(this.__('toast.playlistAssigned'));
            this.refreshTable?.();
        } catch (error) {
            Logger.error('Failed to assign playlist:', error);
            Toast.error(error.message || this.__('toast.assignFailed'));
            throw error;
        }
    }

    // =========================================================================
    // CİHAZ KOMUTLARI
    // =========================================================================

    /**
     * Cihaza komut gönder (start, stop, refresh, reboot)
     * @param {string} deviceId - Cihaz ID
     * @param {string} command - Komut adı
     * @param {string} deviceName - Cihaz adı (görüntüleme için)
     */
    async sendDeviceCommand(deviceId, command, deviceName = '') {
        const commandLabels = {
            'start': { label: this.__('bulkActions.commands.startBroadcast'), icon: 'ti-player-play', color: 'success' },
            'stop': { label: this.__('bulkActions.commands.stopBroadcast'), icon: 'ti-player-stop', color: 'danger' },
            'refresh': { label: this.__('bulkActions.commands.refreshDevice'), icon: 'ti-refresh', color: 'info' },
            'reboot': { label: this.__('bulkActions.commands.rebootDevice'), icon: 'ti-power', color: 'warning' }
        };

        const cmd = commandLabels[command] || { label: command, icon: 'ti-send', color: 'primary' };

        Modal.confirm({
            title: cmd.label + '?',
            message: `"${deviceName || this.__('bulkActions.device')}" ${this.__('bulkActions.commandWillBeSent', { command: cmd.label.toLowerCase() })}`,
            type: cmd.color,
            confirmText: this.__('modal.send'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    const response = await this.app.api.post(`/devices/${deviceId}/send-command`, {
                        command: command
                    });

                    if (response.success) {
                        Toast.success(this.__('toast.commandSent'));
                    } else {
                        Toast.error(response.message || this.__('toast.commandFailed'));
                    }
                } catch (error) {
                    Logger.error('Command send error:', error);
                    Toast.error(this.__('toast.commandFailed') + ': ' + (error.message || this.__('bulkActions.unknownError')));
                    throw error;
                }
            }
        });
    }

    /**
     * Direkt cihaz kontrolü (ESL/PavoDisplay: refresh, reboot, clear_memory, ping, led_flash)
     * @param {Object} device - Cihaz objesi
     * @param {string} action - Aksiyon adı
     */
    async controlDevice(device, action) {
        const actionLabels = {
            'refresh': { label: this.__('actions.refreshDevice'), icon: 'ti-refresh', color: 'info' },
            'reboot': { label: this.__('actions.rebootDevice'), icon: 'ti-power', color: 'warning' },
            'clear_memory': { label: this.__('actions.clearMemory'), icon: 'ti-trash-x', color: 'danger' },
            'ping': { label: this.__('actions.pingDevice'), icon: 'ti-wifi', color: 'primary' },
            'led_flash': { label: this.__('actions.ledFlash'), icon: 'ti-bulb', color: 'success' }
        };

        const act = actionLabels[action] || { label: action, icon: 'ti-send', color: 'primary' };

        // Ping ve LED flash için onay gerektirmeden çalıştır (test aksiyonları)
        if (action === 'ping' || action === 'led_flash') {
            try {
                const isLedFlash = action === 'led_flash';
                Toast.info(isLedFlash
                    ? this.__('toast.sendingLedFlash')
                    : this.__('toast.pinging'));

                const response = await this.app.api.post(`/devices/${device.id}/control`, { action });

                if (response.success && response.data?.success) {
                    if (isLedFlash) {
                        Toast.success(response.data.message || this.__('toast.ledFlashSent'));
                    } else {
                        const responseTime = response.data.response_time ? ` (${response.data.response_time}ms)` : '';
                        Toast.success(this.__('toast.deviceOnline') + responseTime);
                    }
                    this.refreshTable?.();
                } else {
                    Toast.warning(response.data?.message || (isLedFlash
                        ? this.__('toast.ledFlashFailed')
                        : this.__('toast.deviceOffline')));
                    this.refreshTable?.();
                }
            } catch (error) {
                Logger.error(`${action} error:`, error);
                Toast.error(action === 'led_flash'
                    ? this.__('toast.ledFlashFailed')
                    : this.__('toast.pingFailed'));
            }
            return;
        }

        Modal.confirm({
            title: act.label + '?',
            message: `"${device.name || this.__('bulkActions.device')}" ${this.__('bulkActions.actionWillBePerformed', { action: act.label.toLowerCase() })}`,
            type: act.color,
            confirmText: this.__('modal.confirm'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    const response = await this.app.api.post(`/devices/${device.id}/control`, { action });

                    if (response.success && response.data?.success) {
                        Toast.success(response.data.message || this.__('toast.actionSuccess'));
                        this.refreshTable?.();
                    } else {
                        Toast.error(response.data?.message || response.message || this.__('toast.actionFailed'));
                    }
                } catch (error) {
                    Logger.error('Device control error:', error);
                    Toast.error(this.__('toast.actionFailed') + ': ' + (error.message || this.__('bulkActions.unknownError')));
                    throw error;
                }
            }
        });
    }

    // =========================================================================
    // FİLTRELER
    // =========================================================================

    /**
     * Gelişmiş filtre modalını göster
     */
    showFilterModal() {
        const typeOptions = [
            { value: '', label: this.__('filters.allTypes') },
            { value: 'esl', label: this.__('types.esl') },
            { value: 'esl_android', label: this.__('types.esl_android') },
            { value: 'esl_rtos', label: this.__('types.esl_rtos') },
            { value: 'hanshow_esl', label: this.__('types.hanshow_esl') },
            { value: 'tv', label: this.__('types.tv') },
            { value: 'android_tv', label: this.__('types.android_tv') },
            { value: 'web_display', label: this.__('types.web_display') },
            { value: 'panel', label: this.__('types.panel') }
        ];

        const statusOptions = [
            { value: '', label: this.__('filters.allStatuses') },
            { value: 'online', label: this.__('statuses.online') },
            { value: 'offline', label: this.__('statuses.offline') }
        ];

        const approvalOptions = [
            { value: '', label: this.__('filters.allApproval') },
            { value: 'pending', label: this.__('approvalStatuses.pending') },
            { value: 'approved', label: this.__('approvalStatuses.approved') },
            { value: 'rejected', label: this.__('approvalStatuses.rejected') }
        ];

        const groupOptions = [
            { value: '', label: this.__('filters.allGroups') },
            ...this.deviceGroups.map(g => ({ value: g.id, label: g.name }))
        ];

        const content = `
            <form id="filter-form" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('columns.type')}</label>
                        <select id="filter-type" class="form-select">
                            ${typeOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('columns.status')}</label>
                        <select id="filter-status" class="form-select">
                            ${statusOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('columns.approvalStatus')}</label>
                        <select id="filter-approval" class="form-select">
                            ${approvalOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('columns.group')}</label>
                        <select id="filter-group" class="form-select">
                            ${groupOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('columns.location')}</label>
                    <input type="text" id="filter-location" class="form-input" placeholder="${this.__('filters.locationPlaceholder')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('columns.ipAddress')}</label>
                    <input type="text" id="filter-ip" class="form-input" placeholder="${this.__('filters.ipPlaceholder')}">
                </div>
            </form>
        `;

        Modal.show({
            title: this.__('filters.advancedFilters'),
            icon: 'ti-filter',
            content: content,
            size: 'md',
            confirmText: this.__('filters.apply'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                const filters = {
                    type: document.getElementById('filter-type')?.value || '',
                    status: document.getElementById('filter-status')?.value || '',
                    approval_status: document.getElementById('filter-approval')?.value || '',
                    group_id: document.getElementById('filter-group')?.value || '',
                    location: document.getElementById('filter-location')?.value || '',
                    ip_address: document.getElementById('filter-ip')?.value || ''
                };

                // Filtreleri uygula
                this.applyFilters(filters);
            }
        });
    }

    /**
     * Filtreleri uygula
     * @param {Object} filters - Filtre değerleri
     */
    applyFilters(filters) {
        // Filtreleri state'e kaydet
        this.currentFilters = {
            type: filters.type || '',
            status: filters.status || '',
            group_id: filters.group_id || '',
            location: filters.location || '',
            ip_address: filters.ip_address || ''
        };

        // Onay durumu ayrı handle et (dropdown da var)
        if (filters.approval_status) {
            this.currentApprovalFilter = filters.approval_status;
            // Dropdown'u da güncelle
            const approvalSelect = document.getElementById('approval-filter');
            if (approvalSelect) approvalSelect.value = filters.approval_status;
        }

        // Ana sayfadaki filtreleri senkronize et
        this.onFiltersChange?.({
            ...this.currentFilters,
            approval_status: this.currentApprovalFilter
        });

        // Tabloyu yenile
        this.refreshTable?.();

        Toast.success(this.__('filters.applied'));
    }

    /**
     * Filtreleri sıfırla
     */
    clearFilters() {
        this.currentFilters = {};
        this.currentApprovalFilter = '';

        // Ana sayfadaki filtreleri senkronize et
        this.onFiltersChange?.({
            type: '',
            status: '',
            group_id: '',
            location: '',
            ip_address: '',
            approval_status: ''
        });

        this.refreshTable?.();
        Toast.info(this.__('filters.cleared'));
    }

    // =========================================================================
    // TOPLU İŞLEMLER
    // =========================================================================

    /**
     * Progress modal göster
     * @private
     * @param {string} title - Modal başlığı
     * @param {number} total - Toplam işlem sayısı
     * @returns {Object} Modal kontrol objesi
     */
    _showProgressModal(title, total) {
        const modalContent = `
            <div class="bulk-progress-container">
                <div class="bulk-progress-header">
                    <div class="bulk-progress-icon">
                        <i class="ti ti-loader-2 spin"></i>
                    </div>
                    <div class="bulk-progress-info">
                        <span class="bulk-progress-status">${this.__('progress.preparing')}</span>
                        <span class="bulk-progress-count">0 / ${total}</span>
                    </div>
                </div>
                <div class="bulk-progress-bar-wrapper">
                    <div class="bulk-progress-bar" style="width: 0%"></div>
                </div>
                <div class="bulk-progress-details">
                    <div class="bulk-progress-stat success">
                        <i class="ti ti-circle-check"></i>
                        <span class="stat-count">0</span>
                        <span class="stat-label">${this.__('progress.success')}</span>
                    </div>
                    <div class="bulk-progress-stat failed">
                        <i class="ti ti-circle-x"></i>
                        <span class="stat-count">0</span>
                        <span class="stat-label">${this.__('progress.failed')}</span>
                    </div>
                    <div class="bulk-progress-stat pending">
                        <i class="ti ti-clock"></i>
                        <span class="stat-count">${total}</span>
                        <span class="stat-label">${this.__('progress.pending')}</span>
                    </div>
                </div>
                <div class="bulk-progress-log">
                    <div class="bulk-progress-log-items"></div>
                </div>
            </div>
        `;

        const modal = Modal.show({
            title: title,
            icon: 'ti-send',
            content: modalContent,
            size: 'md',
            closable: false,
            showConfirm: false,
            showCancel: false
        });

        return {
            modal,
            update: (current, success, failed, status, logItem = null) => {
                const percent = Math.round((current / total) * 100);
                const pending = total - current;

                // Progress bar
                const bar = document.querySelector('.bulk-progress-bar');
                if (bar) bar.style.width = `${percent}%`;

                // Count
                const countEl = document.querySelector('.bulk-progress-count');
                if (countEl) countEl.textContent = `${current} / ${total}`;

                // Status
                const statusEl = document.querySelector('.bulk-progress-status');
                if (statusEl) statusEl.textContent = status;

                // Stats
                const successStat = document.querySelector('.bulk-progress-stat.success .stat-count');
                const failedStat = document.querySelector('.bulk-progress-stat.failed .stat-count');
                const pendingStat = document.querySelector('.bulk-progress-stat.pending .stat-count');
                if (successStat) successStat.textContent = success;
                if (failedStat) failedStat.textContent = failed;
                if (pendingStat) pendingStat.textContent = pending;

                // Log item
                if (logItem) {
                    const logContainer = document.querySelector('.bulk-progress-log-items');
                    if (logContainer) {
                        const logEl = document.createElement('div');
                        logEl.className = `bulk-progress-log-item ${logItem.success ? 'success' : 'error'}`;
                        logEl.innerHTML = `
                            <i class="ti ${logItem.success ? 'ti-check' : 'ti-x'}"></i>
                            <span class="log-device">${logItem.deviceName}</span>
                            <span class="log-message">${logItem.message}</span>
                        `;
                        logContainer.appendChild(logEl);
                        logContainer.scrollTop = logContainer.scrollHeight;
                    }
                }
            },
            complete: (success, failed) => {
                // Icon değiştir
                const iconEl = document.querySelector('.bulk-progress-icon i');
                if (iconEl) {
                    iconEl.className = failed > 0 && success === 0
                        ? 'ti ti-circle-x text-danger'
                        : failed > 0
                            ? 'ti ti-alert-triangle text-warning'
                            : 'ti ti-circle-check text-success';
                }

                // Status güncelle
                const statusEl = document.querySelector('.bulk-progress-status');
                if (statusEl) {
                    statusEl.textContent = this.__('progress.completed');
                }

                // Kapat butonu ekle
                const container = document.querySelector('.bulk-progress-container');
                if (container) {
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'btn btn-primary btn-block mt-4';
                    closeBtn.innerHTML = `<i class="ti ti-check"></i> ${this.__('modal.close')}`;
                    closeBtn.onclick = () => Modal.close(modal.id);
                    container.appendChild(closeBtn);
                }
            }
        };
    }

    /**
     * Seçili cihazlara toplu komut gönder
     * @param {Array} selectedDevices - Seçili cihaz listesi
     * @param {string} command - Gönderilecek komut
     */
    async sendBulkCommand(selectedDevices, command) {
        if (!selectedDevices || selectedDevices.length === 0) {
            Toast.warning(this.__('bulkActions.pleaseSelectDevice'));
            return;
        }

        const commandLabels = {
            'start': this.__('commands.start'),
            'stop': this.__('commands.stop'),
            'refresh': this.__('commands.refresh'),
            'reboot': this.__('commands.reboot')
        };

        const label = commandLabels[command] || command;

        Modal.confirm({
            title: this.__('bulk.confirmTitle'),
            message: this.__('bulkActions.bulkCommandConfirm', { count: selectedDevices.length, command: label }),
            type: 'warning',
            confirmText: this.__('modal.send'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                // Progress modal göster
                const progress = this._showProgressModal(
                    this.__('bulk.sendingCommand', { command: label }),
                    selectedDevices.length
                );

                let successCount = 0;
                let failCount = 0;
                let current = 0;

                for (const device of selectedDevices) {
                    current++;
                    const deviceName = device.name || device.id.substring(0, 8);

                    progress.update(
                        current - 1,
                        successCount,
                        failCount,
                        this.__('progress.sendingTo', { device: deviceName })
                    );

                    try {
                        const response = await this.app.api.post(`/devices/${device.id}/send-command`, {
                            command: command
                        });

                        if (response.success) {
                            successCount++;
                            progress.update(current, successCount, failCount,
                                this.__('progress.sendingTo', { device: deviceName }),
                                { deviceName, success: true, message: this.__('progress.sent') }
                            );
                        } else {
                            failCount++;
                            progress.update(current, successCount, failCount,
                                this.__('progress.sendingTo', { device: deviceName }),
                                { deviceName, success: false, message: response.message || this.__('progress.sendFailed') }
                            );
                        }
                    } catch (error) {
                        failCount++;
                        Logger.error(`Bulk command error for device ${device.id}:`, error);
                        progress.update(current, successCount, failCount,
                            this.__('progress.sendingTo', { device: deviceName }),
                            { deviceName, success: false, message: error.message || this.__('progress.error') }
                        );
                    }

                    // Her işlem arasında kısa bekleme (UI güncellemesi için)
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Tamamlandı
                progress.complete(successCount, failCount);

                if (successCount > 0) {
                    Toast.success(this.__('bulk.success', { count: successCount }));
                }
                if (failCount > 0) {
                    Toast.warning(this.__('bulk.failed', { count: failCount }));
                }

                this.refreshTable?.();
            }
        });
    }

    /**
     * Seçili cihazlara toplu playlist ata
     * @param {Array} selectedDevices - Seçili cihaz listesi
     */
    async showBulkAssignPlaylistModal(selectedDevices) {
        if (!selectedDevices || selectedDevices.length === 0) {
            Toast.warning(this.__('bulkActions.pleaseSelectDevice'));
            return;
        }

        // Playlist'leri yükle
        let playlists = [];
        try {
            const response = await this.app.api.get('/playlists?status=active');
            playlists = response.data || [];
        } catch (error) {
            Logger.error('Failed to load playlists:', error);
            Toast.error(this.__('bulkActions.playlistLoadFailed'));
            return;
        }

        const playlistOptions = playlists.map(p => `
            <option value="${p.id}">
                ${p.name} ${p.items_count ? `(${p.items_count} ${this.__('detailPage.contentCount')})` : ''}
            </option>
        `).join('');

        const content = `
            <div class="space-y-4">
                <div class="alert alert-info">
                    <i class="ti ti-info-circle"></i>
                    <span>${this.__('bulkActions.playlistWillBeAssignedToDevices', { count: selectedDevices.length })}</span>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('actions.assignPlaylist')}</label>
                    <select id="bulk-assign-playlist-select" class="form-select">
                        <option value="">${this.__('bulkActions.selectPlaylist')}</option>
                        ${playlistOptions}
                    </select>
                </div>
                ${playlists.length === 0 ? `
                    <div class="alert alert-warning">
                        <i class="ti ti-alert-triangle"></i>
                        <span>${this.__('bulkActions.noActivePlaylistFound')}</span>
                    </div>
                ` : ''}
            </div>
        `;

        Modal.show({
            title: this.__('bulk.assignPlaylist'),
            icon: 'ti-playlist',
            content: content,
            size: 'md',
            confirmText: this.__('actions.assign'),
            cancelText: this.__('modal.cancel'),
            showConfirm: playlists.length > 0,
            onConfirm: async () => {
                const playlistId = document.getElementById('bulk-assign-playlist-select')?.value;
                if (!playlistId) {
                    Toast.warning(this.__('bulkActions.pleaseSelectPlaylist'));
                    throw new Error('No playlist selected');
                }

                // Seçilen playlist adını al
                const playlistSelect = document.getElementById('bulk-assign-playlist-select');
                const playlistName = playlistSelect?.options[playlistSelect.selectedIndex]?.text || 'Playlist';

                // Progress modal göster
                const progress = this._showProgressModal(
                    this.__('bulk.assigningPlaylist', { playlist: playlistName }),
                    selectedDevices.length
                );

                let successCount = 0;
                let failCount = 0;
                let current = 0;

                for (const device of selectedDevices) {
                    current++;
                    const deviceName = device.name || device.id.substring(0, 8);

                    progress.update(
                        current - 1,
                        successCount,
                        failCount,
                        this.__('progress.assigningTo', { device: deviceName })
                    );

                    try {
                        await this.app.api.post(`/devices/${device.id}/assign-playlist`, {
                            playlist_id: playlistId
                        });
                        successCount++;
                        progress.update(current, successCount, failCount,
                            this.__('progress.assigningTo', { device: deviceName }),
                            { deviceName, success: true, message: this.__('progress.assigned') }
                        );
                    } catch (error) {
                        failCount++;
                        Logger.error(`Bulk playlist assign error for device ${device.id}:`, error);
                        progress.update(current, successCount, failCount,
                            this.__('progress.assigningTo', { device: deviceName }),
                            { deviceName, success: false, message: error.message || this.__('progress.assignFailed') }
                        );
                    }

                    // Her işlem arasında kısa bekleme
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Tamamlandı
                progress.complete(successCount, failCount);

                if (successCount > 0) {
                    Toast.success(this.__('bulk.playlistAssigned', { count: successCount }));
                }
                if (failCount > 0) {
                    Toast.warning(this.__('bulk.playlistFailed', { count: failCount }));
                }

                this.refreshTable?.();
            }
        });
    }

    /**
     * Kaynakları temizle
     */
    destroy() {
        this.currentFilters = {};
        this.currentApprovalFilter = '';
        this.deviceGroups = [];
    }
}

/**
 * Modül başlatma fonksiyonu
 * @param {Object} context - Modül bağlamı
 * @returns {BulkActions} Modül instance
 */
export function init(context) {
    return new BulkActions(context);
}

export default BulkActions;
