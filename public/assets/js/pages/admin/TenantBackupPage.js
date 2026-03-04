/**
 * TenantBackupPage — Firma Yedekleri Admin Sayfası
 * SuperAdmin: Ayarlar + Firma listesi + Yedek geçmişi + İçe aktarma
 * Admin: Kendi firmasının yedekleri
 *
 * Fixes (v2):
 * - Double-click on action icons: DataTable created once, reused with setData()
 * - New company summary: Added product/device/template counts
 * - Download filename: Includes company name (backend fix)
 * - Restore modal: Supports both overwrite and new company modes
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class TenantBackupPage {
    constructor(app) {
        this.app = app;
        this.companyTable = null;
        this.historyTable = null;
        this.settings = {};
        this.companies = [];
        this.isSuperAdmin = false;
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('backup');
    }

    render() {
        const user = this.app.state.get('user');
        this.isSuperAdmin = user?.role === 'SuperAdmin';

        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.dashboard') || 'Panel'}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon teal">
                            <i class="ti ti-database-export"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('title')}</h1>
                            <p class="page-subtitle">${this.__('subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="btn-import" class="btn btn-outline">
                            <i class="ti ti-upload"></i> ${this.__('actions.import')}
                        </button>
                    </div>
                </div>
            </div>

            ${this.isSuperAdmin ? this.renderSettingsCard() : ''}

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">${this.__('list.company_name')}</h3>
                </div>
                <div class="card-body">
                    <div id="company-table-container"></div>
                </div>
            </div>
        `;
    }

    renderSettingsCard() {
        return `
            <div class="card collapsible-card" id="settings-card">
                <div class="card-header clickable" id="settings-toggle">
                    <h3 class="card-title"><i class="ti ti-settings"></i> ${this.__('settings.title')}</h3>
                    <i class="ti ti-chevron-down collapse-icon"></i>
                </div>
                <div class="card-body" id="settings-body" style="display:none;">
                    <div class="form-grid cols-2-1">
                        <div class="form-group">
                            <label class="form-label">${this.__('settings.enabled')}</label>
                            <label class="toggle-switch">
                                <input type="checkbox" id="setting-enabled">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('settings.cycle')}</label>
                            <select id="setting-cycle" class="form-input">
                                <option value="daily">${this.__('settings.cycle_daily')}</option>
                                <option value="weekly">${this.__('settings.cycle_weekly')}</option>
                                <option value="monthly">${this.__('settings.cycle_monthly')}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('settings.retention')}</label>
                            <input type="number" id="setting-retention" class="form-input" min="1" max="100" value="7">
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('settings.include_media')}</label>
                            <label class="toggle-switch">
                                <input type="checkbox" id="setting-media">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('settings.last_run')}</label>
                            <span id="setting-last-run" class="form-static-text">-</span>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button id="btn-save-settings" class="btn btn-primary">
                            <i class="ti ti-check"></i> ${this.__('settings.save')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async init() {
        window._backupPage = this;
        this.bindEvents();
        await this.loadData();
    }

    bindEvents() {
        // Settings collapse toggle
        document.getElementById('settings-toggle')?.addEventListener('click', () => {
            const body = document.getElementById('settings-body');
            const icon = document.querySelector('#settings-toggle .collapse-icon');
            if (body) {
                const hidden = body.style.display === 'none';
                body.style.display = hidden ? 'block' : 'none';
                if (icon) icon.className = `ti ti-chevron-${hidden ? 'up' : 'down'} collapse-icon`;
            }
        });

        // Save settings
        document.getElementById('btn-save-settings')?.addEventListener('click', () => this.saveSettings());

        // Import button
        document.getElementById('btn-import')?.addEventListener('click', () => this.showImportModal());
    }

    async loadData() {
        try {
            if (this.isSuperAdmin) {
                await this.loadSettings();
            }
            await this.loadCompanyList();
        } catch (e) {
            Logger.error('TenantBackupPage: loadData failed', e);
            Toast.error(this.__('actions.backup_now') + ' - Error');
        }
    }

    async loadSettings() {
        try {
            const res = await this.app.api.get('/tenant-backup/settings');
            if (res.success) {
                this.settings = res.data;
                this.applySettingsToForm();
            }
        } catch (e) {
            Logger.warning('Failed to load backup settings', e);
        }
    }

    applySettingsToForm() {
        const s = this.settings;
        const el = (id) => document.getElementById(id);

        if (el('setting-enabled')) el('setting-enabled').checked = s.enabled || false;
        if (el('setting-cycle')) el('setting-cycle').value = s.cycle || 'daily';
        if (el('setting-retention')) el('setting-retention').value = s.retention_count || 7;
        if (el('setting-media')) el('setting-media').checked = s.include_media_default || false;
        if (el('setting-last-run')) {
            el('setting-last-run').textContent = s.last_cron_run
                ? new Date(s.last_cron_run).toLocaleString()
                : this.__('settings.never_run');
        }
    }

    async saveSettings() {
        const data = {
            enabled: document.getElementById('setting-enabled')?.checked || false,
            cycle: document.getElementById('setting-cycle')?.value || 'daily',
            retention_count: parseInt(document.getElementById('setting-retention')?.value) || 7,
            include_media_default: document.getElementById('setting-media')?.checked || false,
        };

        try {
            const res = await this.app.api.put('/tenant-backup/settings', data);
            if (res.success) {
                Toast.success(this.__('settings.saved'));
            }
        } catch (e) {
            Toast.error(e.message || 'Error');
        }
    }

    async loadCompanyList() {
        try {
            const res = await this.app.api.get('/tenant-backup/list');
            if (!res.success) return;

            const data = res.data;

            if (data.mode === 'summary') {
                this.companies = data.companies || [];
                this.renderCompanyTable();
            } else {
                // Admin mode: show backup list directly
                this.renderBackupList(data.items || []);
            }
        } catch (e) {
            Logger.error('Failed to load backup list', e);
        }
    }

    /**
     * Render or update the company summary table.
     * FIX: Create DataTable only ONCE to prevent duplicate event listeners (double-click bug).
     * Subsequent calls only update data via setData().
     */
    renderCompanyTable() {
        if (this.companyTable) {
            // DataTable already exists — just update data (no new event listeners)
            this.companyTable.setData(this.companies);
            return;
        }

        this.companyTable = new DataTable({
            container: '#company-table-container',
            rowKey: 'company_id',
            columns: [
                { key: 'company_name', label: this.__('list.company_name'), sortable: true },
                {
                    key: 'product_count', label: this.__('list.products') || 'Ürünler', sortable: true,
                    render: (val) => `<span class="badge badge-blue">${parseInt(val) || 0}</span>`
                },
                {
                    key: 'device_count', label: this.__('list.devices') || 'Cihazlar', sortable: true,
                    render: (val) => `<span class="badge badge-cyan">${parseInt(val) || 0}</span>`
                },
                {
                    key: 'template_count', label: this.__('list.templates') || 'Şablonlar', sortable: true,
                    render: (val) => `<span class="badge badge-purple">${parseInt(val) || 0}</span>`
                },
                {
                    key: 'last_backup_at', label: this.__('list.last_backup'), sortable: true,
                    render: (val) => val ? new Date(val).toLocaleString() : `<span class="text-muted">${this.__('list.never')}</span>`
                },
                {
                    key: 'backup_count', label: this.__('list.backup_count'), sortable: true,
                    render: (val) => {
                        const n = parseInt(val) || 0;
                        return n > 0 ? `<span class="badge badge-blue">${n}</span>` : `<span class="text-muted">0</span>`;
                    }
                },
                {
                    key: 'total_size', label: this.__('list.total_size'), sortable: true,
                    render: (val) => {
                        const bytes = parseInt(val) || 0;
                        return bytes > 0 ? this.formatSize(bytes) : `<span class="text-muted">—</span>`;
                    }
                },
                {
                    key: 'last_status', label: this.__('list.status'),
                    render: (val) => this.renderStatusBadge(val)
                },
            ],
            actions: [
                {
                    name: 'backup',
                    icon: 'ti-database-export',
                    label: this.__('actions.backup_now'),
                    onClick: (row) => this.startBackup(row.company_id),
                },
                {
                    name: 'history',
                    icon: 'ti-history',
                    label: this.__('actions.history'),
                    onClick: (row) => this.showHistory(row.company_id, row.company_name),
                },
                {
                    name: 'download',
                    icon: 'ti-download',
                    label: this.__('actions.download_latest'),
                    onClick: (row) => this.downloadLatest(row.company_id),
                },
            ],
            searchable: true,
            pagination: true,
            pageSize: 20,
        });

        this.companyTable.setData(this.companies);
    }

    /**
     * Render or update the backup list (Admin mode).
     * Same pattern: create DataTable once, reuse setData().
     */
    renderBackupList(items) {
        if (this.historyTable) {
            this.historyTable.setData(items);
            return;
        }

        this.historyTable = new DataTable({
            container: '#company-table-container',
            columns: [
                {
                    key: 'created_at', label: this.__('history.date'), sortable: true,
                    render: (val) => val ? new Date(val).toLocaleString() : '-'
                },
                {
                    key: 'file_size', label: this.__('history.size'), sortable: true,
                    render: (val) => this.formatSize(val)
                },
                {
                    key: 'backup_type', label: this.__('history.type'),
                    render: (val) => val === 'scheduled' ? this.__('history.scheduled') : this.__('history.manual')
                },
                {
                    key: 'media_included', label: this.__('history.media'),
                    render: (val) => val ? this.__('history.yes') : this.__('history.no')
                },
                {
                    key: 'status', label: this.__('history.status'),
                    render: (val) => this.renderStatusBadge(val)
                },
            ],
            actions: [
                {
                    name: 'download',
                    icon: 'ti-download',
                    label: this.__('actions.download'),
                    onClick: (row) => this.downloadBackup(row.id),
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('actions.delete'),
                    class: 'text-red-500',
                    onClick: (row) => this.deleteBackup(row.id),
                },
            ],
            pagination: true,
            pageSize: 20,
        });

        this.historyTable.setData(items);
    }

    // ==================== Actions ====================

    async startBackup(companyId) {
        try {
            const res = await this.app.api.post('/tenant-backup/export', {
                company_id: companyId,
                include_media: false,
            });

            if (res.success) {
                Toast.success(this.__('export.completed'));
                await this.loadCompanyList();
            } else {
                Toast.error(res.message || this.__('export.failed'));
            }
        } catch (e) {
            if (e.status === 409) {
                Toast.warning(this.__('export.already_running'));
            } else {
                Toast.error(e.message || this.__('export.failed'));
            }
        }
    }

    async showHistory(companyId, companyName) {
        try {
            const res = await this.app.api.get(`/tenant-backup/list?company_id=${companyId}&limit=50`);
            if (!res.success) return;

            const items = res.data.items || [];

            const rows = items.map(item => `
                <tr>
                    <td>${item.created_at ? new Date(item.created_at).toLocaleString() : '-'}</td>
                    <td>${this.formatSize(item.file_size)}</td>
                    <td>${item.backup_type === 'scheduled' ? this.__('history.scheduled') : this.__('history.manual')}</td>
                    <td>${item.media_included ? this.__('history.yes') : this.__('history.no')}</td>
                    <td>${this.renderStatusBadge(item.status)}</td>
                    <td>
                        ${item.status === 'completed' ? `
                            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); window._backupPage.downloadBackup('${item.id}')">
                                <i class="ti ti-download"></i>
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); window._backupPage.restoreBackup('${item.id}', '${companyId}', '${escapeHTML(companyName)}')">
                                <i class="ti ti-restore"></i>
                            </button>
                            <button class="btn btn-sm btn-outline text-red-500" onclick="event.stopPropagation(); window._backupPage.deleteBackup('${item.id}')">
                                <i class="ti ti-trash"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `).join('');

            Modal.show({
                title: `${this.__('history.title')} — ${escapeHTML(companyName)}`,
                icon: 'ti-history',
                size: 'lg',
                content: items.length ? `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>${this.__('history.date')}</th>
                                <th>${this.__('history.size')}</th>
                                <th>${this.__('history.type')}</th>
                                <th>${this.__('history.media')}</th>
                                <th>${this.__('history.status')}</th>
                                <th>${this.__('list.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                ` : `<p class="text-muted text-center">${this.__('list.no_backups')}</p>`,
                showCancel: false,
                confirmText: this.__('actions.backup_now'),
                onConfirm: () => this.startBackup(companyId),
            });
        } catch (e) {
            Toast.error(e.message || 'Error');
        }
    }

    async downloadBackup(backupId) {
        try {
            const basePath = window.OmnexConfig?.basePath || '';
            const token = localStorage.getItem('omnex_token');
            const url = `${basePath}/api/tenant-backup/download/${backupId}`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Download failed');

            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="?([^"]+)"?/);
            const filename = match ? match[1] : `backup_${backupId}.tar.gz`;

            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (e) {
            Toast.error(e.message || 'Download failed');
        }
    }

    async downloadLatest(companyId) {
        try {
            const res = await this.app.api.get(`/tenant-backup/list?company_id=${companyId}&limit=1`);
            if (res.success && res.data.items?.length) {
                const latest = res.data.items[0];
                if (latest.status === 'completed') {
                    await this.downloadBackup(latest.id);
                } else {
                    Toast.warning(this.__('list.no_backups'));
                }
            } else {
                Toast.warning(this.__('list.no_backups'));
            }
        } catch (e) {
            Toast.error(e.message || 'Error');
        }
    }

    /**
     * Restore a backup — supports both overwrite and new company modes.
     * FIX: Previously only supported overwrite to source company. Now shows
     * mode selection and supports restoring to a different company or as new company.
     */
    async restoreBackup(backupId, sourceCompanyId, sourceCompanyName) {
        // Build company options for overwrite target (exclude source)
        const otherCompanyOptions = this.companies
            .map(c => `<option value="${c.company_id}" ${c.company_id === sourceCompanyId ? 'selected' : ''}>${escapeHTML(c.company_name)}</option>`)
            .join('');

        Modal.show({
            title: this.__('restore_confirm.title') || 'Geri Yükleme',
            icon: 'ti-restore',
            size: 'md',
            content: `
                <div class="alert alert-warning mb-3">
                    <i class="ti ti-alert-triangle"></i>
                    <span>${this.__('restore_confirm.warning') || 'Bu işlem hedef firmanın TÜM verilerini silerek yedeğin verileriyle değiştirecektir!'}</span>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('restore_confirm.source') || 'Kaynak Yedek'}</label>
                    <div class="form-static-text"><strong>${escapeHTML(sourceCompanyName)}</strong></div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('restore_confirm.mode') || 'Geri Yükleme Modu'}</label>
                    <select id="restore-mode" class="form-input">
                        <option value="overwrite">${this.__('restore_confirm.mode_overwrite') || 'Mevcut Firmaya Geri Yükle'}</option>
                        <option value="new_company">${this.__('restore_confirm.mode_new') || 'Yeni Firma Olarak İçe Aktar'}</option>
                    </select>
                </div>
                <div id="restore-overwrite-fields">
                    <div class="form-group">
                        <label class="form-label">${this.__('restore_confirm.target_company') || 'Hedef Firma'}</label>
                        <select id="restore-target-company" class="form-input">
                            ${otherCompanyOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('restore_confirm.type_name') || 'Onay için hedef firma adını yazın'}</label>
                        <input type="text" id="confirm-company-name" class="form-input" placeholder="">
                    </div>
                </div>
                <div id="restore-new-fields" style="display:none;">
                    <div class="form-group">
                        <label class="form-label">${this.__('import_modal.new_company_name') || 'Yeni Firma Adı'}</label>
                        <input type="text" id="restore-new-company-name" class="form-input" placeholder="${this.__('import_modal.new_company_name') || 'Yeni Firma Adı'}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('import_modal.include_media') || 'Medya Dosyaları'}</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="restore-media" checked>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            `,
            confirmText: this.__('restore_confirm.confirm') || 'Geri Yükle',
            cancelText: this.__('restore_confirm.cancel') || 'İptal',
            type: 'danger',
            onConfirm: async () => {
                const mode = document.getElementById('restore-mode')?.value || 'overwrite';
                const includeMedia = document.getElementById('restore-media')?.checked ? '1' : '0';

                if (mode === 'overwrite') {
                    const targetCompanyId = document.getElementById('restore-target-company')?.value;
                    const targetCompanyName = this.companies.find(c => c.company_id === targetCompanyId)?.company_name || '';
                    const typed = document.getElementById('confirm-company-name')?.value?.trim();

                    if (!typed || typed !== targetCompanyName) {
                        Toast.error(this.__('restore_confirm.name_mismatch') || 'Firma adı eşleşmiyor!');
                        return;
                    }

                    await this._executeRestore(backupId, 'overwrite', targetCompanyId, null, includeMedia);
                } else {
                    const newName = document.getElementById('restore-new-company-name')?.value?.trim();
                    if (!newName) {
                        Toast.error(this.__('restore_confirm.name_required') || 'Firma adı gerekli');
                        return;
                    }

                    await this._executeRestore(backupId, 'new_company', null, newName, includeMedia);
                }
            },
        });

        // Bind mode change and target company change events after Modal renders
        requestAnimationFrame(() => {
            const modeSelect = document.getElementById('restore-mode');
            const targetSelect = document.getElementById('restore-target-company');
            const confirmInput = document.getElementById('confirm-company-name');

            if (modeSelect) {
                modeSelect.addEventListener('change', (e) => {
                    const isNew = e.target.value === 'new_company';
                    const overwriteFields = document.getElementById('restore-overwrite-fields');
                    const newFields = document.getElementById('restore-new-fields');
                    if (overwriteFields) overwriteFields.style.display = isNew ? 'none' : 'block';
                    if (newFields) newFields.style.display = isNew ? 'block' : 'none';
                });
            }

            // Update confirm placeholder when target company changes
            if (targetSelect && confirmInput) {
                const updatePlaceholder = () => {
                    const selectedOpt = targetSelect.options[targetSelect.selectedIndex];
                    confirmInput.placeholder = selectedOpt?.textContent || '';
                    confirmInput.value = ''; // Reset when target changes
                };
                updatePlaceholder();
                targetSelect.addEventListener('change', updatePlaceholder);
            }
        });
    }

    /**
     * Execute restore: download backup file, then upload as import
     */
    async _executeRestore(backupId, mode, targetCompanyId, newCompanyName, includeMedia) {
        Toast.info(this.__('restore_confirm.started') || 'Geri yükleme başlatılıyor...');
        try {
            const basePath = window.OmnexConfig?.basePath || '';
            const downloadUrl = `${basePath}/api/tenant-backup/download/${backupId}`;
            const token = localStorage.getItem('omnex_token');

            const downloadRes = await fetch(downloadUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!downloadRes.ok) throw new Error('Download failed');

            const blob = await downloadRes.blob();
            const formData = new FormData();
            formData.append('file', blob, 'restore.tar.gz');
            formData.append('mode', mode);
            formData.append('include_media', includeMedia);

            if (mode === 'new_company') {
                formData.append('company_name', newCompanyName);
            } else {
                formData.append('company_id', targetCompanyId);
            }

            const importRes = await this.app.api.upload('/tenant-backup/import', formData);
            if (importRes.success) {
                const totalRows = importRes.data?.total_rows || 0;
                Toast.success(`${this.__('import_modal.completed') || 'İçe aktarma tamamlandı'} (${totalRows} kayıt)`);
                await this.loadCompanyList();
            } else {
                Toast.error(importRes.message || this.__('import_modal.failed'));
            }
        } catch (e) {
            Toast.error(e.message || this.__('import_modal.failed'));
        }
    }

    async deleteBackup(backupId) {
        Modal.confirm({
            title: this.__('delete_confirm.title'),
            message: this.__('delete_confirm.message'),
            type: 'danger',
            onConfirm: async () => {
                try {
                    const res = await this.app.api.delete(`/tenant-backup/${backupId}`);
                    if (res.success) {
                        Toast.success(this.__('actions.delete') + ' OK');
                        await this.loadCompanyList();
                    }
                } catch (e) {
                    Toast.error(e.message || 'Error');
                }
            },
        });
    }

    // ==================== Import Modal (Fixed: bind after DOM render) ====================

    showImportModal() {
        const companyOptions = this.companies.map(c =>
            `<option value="${c.company_id}">${escapeHTML(c.company_name)}</option>`
        ).join('');

        Modal.show({
            title: this.__('import_modal.title'),
            icon: 'ti-upload',
            size: 'md',
            content: `
                <div class="form-group">
                    <label class="form-label">${this.__('import_modal.file')}</label>
                    <input type="file" id="import-file" class="form-input" accept=".tar.gz,.zip">
                    <small class="form-hint">${this.__('import_modal.file_hint')}</small>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('import_modal.mode')}</label>
                    <select id="import-mode" class="form-input">
                        <option value="overwrite">${this.__('import_modal.mode_overwrite')}</option>
                        <option value="new_company">${this.__('import_modal.mode_new')}</option>
                    </select>
                </div>
                <div id="import-overwrite-fields">
                    <div class="form-group">
                        <label class="form-label">${this.__('import_modal.target_company')}</label>
                        <select id="import-company" class="form-input">
                            ${companyOptions}
                        </select>
                    </div>
                </div>
                <div id="import-new-fields" style="display:none;">
                    <div class="form-group">
                        <label class="form-label">${this.__('import_modal.new_company_name')}</label>
                        <input type="text" id="import-company-name" class="form-input" placeholder="${this.__('import_modal.new_company_name')}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('import_modal.include_media')}</label>
                    <label class="toggle-switch">
                        <input type="checkbox" id="import-media" checked>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            `,
            confirmText: this.__('import_modal.start'),
            onConfirm: () => this.executeImport(),
        });

        // Bind mode change event after Modal renders (Modal doesn't support onOpen)
        requestAnimationFrame(() => {
            const modeSelect = document.getElementById('import-mode');
            if (modeSelect) {
                modeSelect.addEventListener('change', (e) => {
                    const isNew = e.target.value === 'new_company';
                    const overwriteFields = document.getElementById('import-overwrite-fields');
                    const newFields = document.getElementById('import-new-fields');
                    if (overwriteFields) overwriteFields.style.display = isNew ? 'none' : 'block';
                    if (newFields) newFields.style.display = isNew ? 'block' : 'none';
                });
            }
        });
    }

    async executeImport() {
        const fileInput = document.getElementById('import-file');
        const mode = document.getElementById('import-mode')?.value || 'overwrite';
        const includeMedia = document.getElementById('import-media')?.checked ? '1' : '0';

        if (!fileInput?.files?.length) {
            Toast.error('Dosya seçin');
            return;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('mode', mode);
        formData.append('include_media', includeMedia);

        if (mode === 'new_company') {
            const name = document.getElementById('import-company-name')?.value?.trim();
            if (!name) {
                Toast.error('Firma adı gerekli');
                return;
            }
            formData.append('company_name', name);
        } else {
            const companyId = document.getElementById('import-company')?.value;
            if (!companyId) {
                Toast.error('Hedef firma seçin');
                return;
            }
            formData.append('company_id', companyId);
        }

        try {
            Toast.info(this.__('import_modal.started'));
            const res = await this.app.api.upload('/tenant-backup/import', formData);
            if (res.success) {
                const totalRows = res.data?.total_rows || 0;
                Toast.success(`${this.__('import_modal.completed')} (${totalRows} kayıt)`);
                await this.loadCompanyList();
            } else {
                Toast.error(res.message || this.__('import_modal.failed'));
            }
        } catch (e) {
            Toast.error(e.message || this.__('import_modal.failed'));
        }
    }

    // ==================== Utilities ====================

    renderStatusBadge(status) {
        if (!status) {
            return `<span class="text-muted">—</span>`;
        }
        const map = {
            completed: { class: 'badge-green', key: 'status.completed' },
            running:   { class: 'badge-blue',  key: 'status.running' },
            pending:   { class: 'badge-gray',  key: 'status.pending' },
            failed:    { class: 'badge-red',   key: 'status.failed' },
        };
        const info = map[status] || { class: 'badge-gray', key: 'status.pending' };
        return `<span class="badge ${info.class}">${this.__(info.key)}</span>`;
    }

    formatSize(bytes) {
        bytes = parseInt(bytes) || 0;
        if (bytes <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    }

    destroy() {
        if (window._backupPage === this) {
            delete window._backupPage;
        }
        this.companyTable = null;
        this.historyTable = null;
        this.app.i18n.clearPageTranslations();
    }
}

export default TenantBackupPage;
