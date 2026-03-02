/**
 * Gateway Settings Page
 * Local Gateway yönetimi
 */

import { Modal } from '../../components/Modal.js';
import { Toast } from '../../components/Toast.js';

export class GatewaySettings {
    constructor(app) {
        this.app = app;
        this.gateways = [];
        this.runtimeSettings = this.getDefaultRuntimeSettings();
        this.settingsScope = 'company';
        this.gatewayEnabled = true; // Varsayılan aktif
        this.defaultImageGateways = []; // Gateway listesi (varsayılan görseller için)
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('settings');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/settings">${this.__('breadcrumb.settings')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('gateway.title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon">
                            <i class="ti ti-network"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('gateway.title')}</h1>
                            <p class="page-subtitle">${this.__('gateway.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="btn-create-gateway" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.__('gateway.newGateway')}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Gateway Aktif/Pasif Toggle Kartı -->
            <div class="card mb-4" id="gateway-toggle-card">
                <div class="card-body">
                    <div class="gateway-toggle-wrapper">
                        <div class="gateway-toggle-info">
                            <div class="gateway-toggle-icon">
                                <i class="ti ti-power"></i>
                            </div>
                            <div class="gateway-toggle-text">
                                <h3>${this.__('gateway.systemTitle')}</h3>
                                <p class="text-muted">
                                    ${this.__('gateway.systemDescription')}
                                </p>
                            </div>
                        </div>
                        <div class="gateway-toggle-control">
                            <label class="toggle-switch">
                                <input type="checkbox" id="gateway-enabled-toggle">
                                <span class="toggle-slider"></span>
                            </label>
                            <span id="gateway-status-text" class="gateway-status-badge">${this.__('gateway.statusActive')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Varsayılan Görsel Kartı -->
            <div class="card mb-4" id="runtime-settings-card">
                <div class="card-body">
                    <div class="runtime-settings-header">
                        <div class="runtime-settings-info">
                            <div class="runtime-settings-icon">
                                <i class="ti ti-adjustments"></i>
                            </div>
                            <div class="runtime-settings-text">
                                <h3>${this.__('gateway.runtime.title')}</h3>
                                <p class="text-muted">
                                    ${this.__('gateway.runtime.description')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="runtime-settings-grid">
                        <div class="form-group">
                            <label class="form-label">${this.__('gateway.runtime.retryBaseDelay')}</label>
                            <input type="number" id="retry-base-delay-seconds" class="form-input" min="1" step="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('gateway.runtime.retryMaxDelay')}</label>
                            <input type="number" id="retry-max-delay-seconds" class="form-input" min="1" step="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('gateway.runtime.retryMultiplier')}</label>
                            <input type="number" id="retry-backoff-multiplier" class="form-input" min="1" step="0.1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('gateway.runtime.heartbeatTimeout')}</label>
                            <input type="number" id="gateway-heartbeat-timeout-seconds" class="form-input" min="30" step="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('gateway.runtime.commandTimeout')}</label>
                            <input type="number" id="gateway-command-timeout-seconds" class="form-input" min="5" step="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('gateway.runtime.pollInterval')}</label>
                            <input type="number" id="gateway-poll-interval-ms" class="form-input" min="100" step="50">
                        </div>
                    </div>

                    <p id="runtime-settings-scope-info" class="runtime-settings-note text-muted"></p>

                    <div class="runtime-settings-actions">
                        <button id="btn-save-runtime-settings" class="btn btn-primary">
                            <i class="ti ti-device-floppy"></i>
                            ${this.__('actions.save')}
                        </button>
                    </div>
                </div>
            </div>

            <div class="card mb-4" id="default-image-card" style="display:none;">
                <div class="card-body">
                    <div class="default-image-wrapper">
                        <div class="default-image-info">
                            <div class="default-image-icon">
                                <i class="ti ti-photo"></i>
                            </div>
                            <div class="default-image-text">
                                <h3>${this.__('gateway.defaultImage.title')}</h3>
                                <p class="text-muted">
                                    ${this.__('gateway.defaultImage.description')}
                                </p>
                            </div>
                        </div>
                        <div class="default-image-actions">
                            <button id="btn-upload-default-image" class="btn btn-outline">
                                <i class="ti ti-upload"></i>
                                ${this.__('gateway.defaultImage.upload')}
                            </button>
                        </div>
                    </div>

                    <div class="default-image-preview mt-3" id="default-image-preview">
                        <!-- Mevcut varsayılan görseller burada gösterilecek -->
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-body">
                    <div id="gateways-loading" class="text-center py-4">
                        <div class="spinner"></div>
                        <p class="mt-2 text-muted">${this.__('messages.loading')}</p>
                    </div>
                    <div id="gateways-container" style="display:none;"></div>
                </div>
            </div>
        `;
    }

    async init() {
        document.getElementById('default-image-card')?.remove();
        this.bindEvents();
        await this.loadGatewaySettings();
        await this.loadGateways();
    }

    bindEvents() {
        document.getElementById('btn-create-gateway')?.addEventListener('click', () => {
            this.showCreateModal();
        });

        // Gateway toggle event
        document.getElementById('gateway-enabled-toggle')?.addEventListener('change', (e) => {
            this.toggleGatewayEnabled(e.target.checked);
        });

        // Varsayılan görsel yükleme butonu
        document.getElementById('btn-save-runtime-settings')?.addEventListener('click', () => {
            this.saveRuntimeSettings();
        });

    }

    getDefaultRuntimeSettings() {
        return {
            render_retry_base_delay_seconds: 5,
            render_retry_max_delay_seconds: 300,
            render_retry_backoff_multiplier: 2.0,
            gateway_heartbeat_timeout_seconds: 120,
            gateway_command_timeout_seconds: 20,
            gateway_poll_interval_ms: 500
        };
    }

    normalizeRuntimeSettings(settings = {}) {
        const defaults = this.getDefaultRuntimeSettings();
        const toInt = (value, fallback) => {
            const parsed = parseInt(value, 10);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const toFloat = (value, fallback) => {
            const parsed = parseFloat(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };

        const normalized = {
            render_retry_base_delay_seconds: Math.max(
                1,
                toInt(settings.render_retry_base_delay_seconds ?? settings.retry_base_delay_seconds, defaults.render_retry_base_delay_seconds)
            ),
            render_retry_max_delay_seconds: Math.max(
                1,
                toInt(settings.render_retry_max_delay_seconds ?? settings.retry_max_delay_seconds, defaults.render_retry_max_delay_seconds)
            ),
            render_retry_backoff_multiplier: Math.max(
                1,
                toFloat(settings.render_retry_backoff_multiplier ?? settings.retry_backoff_multiplier, defaults.render_retry_backoff_multiplier)
            ),
            gateway_heartbeat_timeout_seconds: Math.max(
                30,
                toInt(settings.gateway_heartbeat_timeout_seconds, defaults.gateway_heartbeat_timeout_seconds)
            ),
            gateway_command_timeout_seconds: Math.max(
                5,
                toInt(settings.gateway_command_timeout_seconds, defaults.gateway_command_timeout_seconds)
            ),
            gateway_poll_interval_ms: Math.max(
                100,
                toInt(settings.gateway_poll_interval_ms, defaults.gateway_poll_interval_ms)
            )
        };

        normalized.render_retry_max_delay_seconds = Math.max(
            normalized.render_retry_base_delay_seconds,
            normalized.render_retry_max_delay_seconds
        );

        return normalized;
    }

    readRuntimeSettingsForm() {
        const readNumber = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            const value = el.value?.trim();
            if (value === '') return null;
            return Number(value);
        };

        return {
            render_retry_base_delay_seconds: readNumber('retry-base-delay-seconds'),
            render_retry_max_delay_seconds: readNumber('retry-max-delay-seconds'),
            render_retry_backoff_multiplier: readNumber('retry-backoff-multiplier'),
            gateway_heartbeat_timeout_seconds: readNumber('gateway-heartbeat-timeout-seconds'),
            gateway_command_timeout_seconds: readNumber('gateway-command-timeout-seconds'),
            gateway_poll_interval_ms: readNumber('gateway-poll-interval-ms')
        };
    }

    updateRuntimeSettingsForm() {
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = value;
            }
        };

        setValue('retry-base-delay-seconds', this.runtimeSettings.render_retry_base_delay_seconds);
        setValue('retry-max-delay-seconds', this.runtimeSettings.render_retry_max_delay_seconds);
        setValue('retry-backoff-multiplier', this.runtimeSettings.render_retry_backoff_multiplier);
        setValue('gateway-heartbeat-timeout-seconds', this.runtimeSettings.gateway_heartbeat_timeout_seconds);
        setValue('gateway-command-timeout-seconds', this.runtimeSettings.gateway_command_timeout_seconds);
        setValue('gateway-poll-interval-ms', this.runtimeSettings.gateway_poll_interval_ms);
    }

    updateRuntimeScopeInfo(scope) {
        const info = document.getElementById('runtime-settings-scope-info');
        if (!info) return;

        if (scope === 'company') {
            info.textContent = this.__('gateway.runtime.scopeCompany');
            info.classList.remove('warning');
            return;
        }

        info.textContent = this.__('gateway.runtime.scopeUser');
        info.classList.add('warning');
    }

    async getSettingsWithScope(preferredScope = 'company') {
        const scopes = preferredScope === 'company' ? ['company', 'user'] : ['user'];
        let lastError = null;

        for (const scope of scopes) {
            try {
                const endpoint = scope === 'company' ? '/settings?scope=company' : '/settings';
                const response = await this.app.api.get(endpoint);
                return {
                    scope,
                    settings: response.data || {}
                };
            } catch (error) {
                const isAuthError = error?.status === 401 || error?.status === 403;
                if (scope === 'company' && isAuthError) {
                    lastError = error;
                    continue;
                }
                throw error;
            }
        }

        throw lastError || new Error('Ayarlar yuklenemedi');
    }

    async saveSettingsPatch(patch, preferredScope = 'company') {
        const scopes = preferredScope === 'company' ? ['company', 'user'] : ['user'];
        let lastError = null;

        for (const scope of scopes) {
            try {
                const endpoint = scope === 'company' ? '/settings?scope=company' : '/settings';
                const current = await this.app.api.get(endpoint);
                const merged = { ...(current.data || {}), ...patch };
                await this.app.api.put(endpoint, merged);
                return {
                    scope,
                    settings: merged
                };
            } catch (error) {
                const isAuthError = error?.status === 401 || error?.status === 403;
                if (scope === 'company' && isAuthError) {
                    lastError = error;
                    continue;
                }
                throw error;
            }
        }

        throw lastError || new Error('Ayarlar kaydedilemedi');
    }

    async loadGatewaySettings() {
        try {
            const result = await this.getSettingsWithScope('company');
            this.settingsScope = result.scope;
            this.gatewayEnabled = result.settings?.gateway_enabled !== false;
            this.runtimeSettings = this.normalizeRuntimeSettings(result.settings || {});

            // Toggle'ı güncelle
            const toggle = document.getElementById('gateway-enabled-toggle');

            if (toggle) {
                toggle.checked = this.gatewayEnabled;
            }

            this.updateToggleUI();
            this.updateRuntimeSettingsForm();
            this.updateRuntimeScopeInfo(this.settingsScope);
        } catch (error) {
            console.error('Gateway ayarları yüklenemedi:', error);
        }
    }

    async toggleGatewayEnabled(enabled) {
        try {
            const result = await this.saveSettingsPatch({ gateway_enabled: enabled }, 'company');

            this.gatewayEnabled = enabled;
            this.settingsScope = result.scope;
            this.updateToggleUI();
            this.updateRuntimeScopeInfo(this.settingsScope);

            Toast.success(enabled ? this.__('gateway.toast.enabled') : this.__('gateway.toast.disabled'));
            if (result.scope !== 'company') {
                Toast.warning(this.__('gateway.toast.savedUserLevel'));
            }
        } catch (error) {
            console.error('Gateway settings save error:', error);
            Toast.error(this.__('gateway.toast.saveFailed'));

            // Toggle'ı eski haline getir
            const toggle = document.getElementById('gateway-enabled-toggle');
            if (toggle) {
                toggle.checked = !enabled;
            }
        }
    }

    async saveRuntimeSettings() {
        const saveButton = document.getElementById('btn-save-runtime-settings');
        const originalContent = saveButton?.innerHTML;

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = `<i class="ti ti-loader-2"></i> ${this.__('actions.saving')}`;
        }

        try {
            const formValues = this.readRuntimeSettingsForm();
            const normalized = this.normalizeRuntimeSettings(formValues);

            const patch = {
                render_retry_base_delay_seconds: normalized.render_retry_base_delay_seconds,
                render_retry_max_delay_seconds: normalized.render_retry_max_delay_seconds,
                render_retry_backoff_multiplier: normalized.render_retry_backoff_multiplier,
                gateway_heartbeat_timeout_seconds: normalized.gateway_heartbeat_timeout_seconds,
                gateway_command_timeout_seconds: normalized.gateway_command_timeout_seconds,
                gateway_poll_interval_ms: normalized.gateway_poll_interval_ms
            };

            const result = await this.saveSettingsPatch(patch, 'company');

            this.runtimeSettings = normalized;
            this.settingsScope = result.scope;
            this.updateRuntimeSettingsForm();
            this.updateRuntimeScopeInfo(this.settingsScope);

            if (result.scope === 'company') {
                Toast.success(this.__('gateway.toast.runtimeSavedCompany'));
            } else {
                Toast.warning(this.__('gateway.toast.runtimeSavedUser'));
            }
        } catch (error) {
            console.error('Runtime settings save error:', error);
            Toast.error(`${this.__('gateway.toast.runtimeSaveFailed')}: ${error.message || this.__('messages.unknownError')}`);
        } finally {
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = originalContent;
            }
        }
    }

    updateToggleUI() {
        const statusText = document.getElementById('gateway-status-text');
        const toggleCard = document.getElementById('gateway-toggle-card');
        const gatewaysCard = document.querySelector('#gateways-container')?.closest('.card');

        if (statusText) {
            statusText.textContent = this.gatewayEnabled ? this.__('gateway.statusActive') : this.__('gateway.statusInactive');
            statusText.className = `gateway-status-badge ${this.gatewayEnabled ? 'active' : 'inactive'}`;
        }

        // Pasifken gateway listesini soluklaştır
        if (gatewaysCard) {
            gatewaysCard.style.opacity = this.gatewayEnabled ? '1' : '0.5';
            gatewaysCard.style.pointerEvents = this.gatewayEnabled ? 'auto' : 'none';
        }
    }

    async loadGateways() {
        try {
            const response = await this.app.api.get('/gateways');
            this.gateways = response.data || [];
            this.renderGateways();
        } catch (error) {
            console.error('Gateway load error:', error);
            Toast.error(this.__('gateway.toast.loadFailed'));
        }
    }

    renderGateways() {
        document.getElementById('gateways-loading').style.display = 'none';
        const container = document.getElementById('gateways-container');
        container.style.display = 'block';

        if (this.gateways.length === 0) {
            container.innerHTML = `
                <div class="empty-state text-center py-5">
                    <i class="ti ti-network-off" style="font-size: 4rem; color: var(--text-muted);"></i>
                    <h3 class="mt-3">${this.__('gateway.empty.title')}</h3>
                    <p class="text-muted">${this.__('gateway.empty.description')}</p>
                    <button class="btn btn-primary mt-3" onclick="document.getElementById('btn-create-gateway').click()">
                        <i class="ti ti-plus"></i>
                        ${this.__('gateway.empty.createFirst')}
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="gateway-grid">
                ${this.gateways.map(gw => this.renderGatewayCard(gw)).join('')}
            </div>
        `;

        // Kart event'leri
        container.querySelectorAll('.gateway-card').forEach(card => {
            const id = card.dataset.id;

            card.querySelector('.btn-view-details')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showDetailsModal(id);
            });

            card.querySelector('.btn-copy-credentials')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showCredentialsModal(id);
            });

            card.querySelector('.btn-delete')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteGateway(id);
            });
        });
    }

    renderGatewayCard(gateway) {
        const statusClass = gateway.status === 'online' ? 'success' :
                           gateway.status === 'error' ? 'danger' : 'warning';
        const statusText = gateway.status === 'online' ? this.__('gateway.status.online') :
                          gateway.status === 'error' ? this.__('gateway.status.error') : this.__('gateway.status.offline');

        const lastSeen = gateway.last_heartbeat ?
            this.formatRelativeTime(gateway.last_heartbeat) : this.__('gateway.neverConnected');

        return `
            <div class="gateway-card card" data-id="${gateway.id}">
                <div class="card-body">
                    <div class="gateway-header">
                        <div class="gateway-icon">
                            <i class="ti ti-server"></i>
                        </div>
                        <div class="gateway-status">
                            <span class="badge badge-${statusClass}">${statusText}</span>
                        </div>
                    </div>

                    <h3 class="gateway-name">${this.escapeHtml(gateway.name)}</h3>

                    ${gateway.description ? `<p class="gateway-desc text-muted">${this.escapeHtml(gateway.description)}</p>` : ''}

                    <div class="gateway-meta">
                        <div class="meta-item">
                            <i class="ti ti-clock"></i>
                            <span>${this.__('gateway.lastSeen')}: ${lastSeen}</span>
                        </div>
                        ${gateway.local_ip ? `
                        <div class="meta-item">
                            <i class="ti ti-network"></i>
                            <span>Local IP: ${gateway.local_ip}</span>
                        </div>
                        ` : ''}
                        <div class="meta-item">
                            <i class="ti ti-devices"></i>
                            <span>${this.__('gateway.devices')}: ${gateway.device_count || 0}</span>
                        </div>
                        <div class="meta-item">
                            <i class="ti ti-list-check"></i>
                            <span>${this.__('gateway.pendingCommands')}: ${gateway.pending_commands || 0}</span>
                        </div>
                    </div>

                    <div class="gateway-actions">
                        <button class="btn btn-sm btn-outline btn-view-details">
                            <i class="ti ti-eye"></i>
                            ${this.__('gateway.details')}
                        </button>
                        <button class="btn btn-sm btn-outline btn-copy-credentials">
                            <i class="ti ti-key"></i>
                            ${this.__('gateway.credentials')}
                        </button>
                        <button class="btn btn-sm btn-ghost text-danger btn-delete">
                            <i class="ti ti-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    showCreateModal() {

        Modal.show({
            title: this.__('gateway.createTitle'),
            icon: 'ti-server-bolt',
            size: 'md',
            content: `
                <form id="create-gateway-form">
                    <div class="form-group">
                        <label class="form-label">${this.__('gateway.form.name')} *</label>
                        <input type="text" name="name" class="form-input" required
                               placeholder="${this.__('gateway.form.namePlaceholder')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('gateway.form.description')}</label>
                        <textarea name="description" class="form-input" rows="2"
                                  placeholder="${this.__('gateway.form.descriptionPlaceholder')}"></textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">${this.__('gateway.form.pollingInterval')}</label>
                            <input type="number" name="polling_interval" class="form-input"
                                   value="5" min="1" max="60">
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('gateway.form.commandTimeout')}</label>
                            <input type="number" name="command_timeout" class="form-input"
                                   value="30" min="5" max="300">
                        </div>
                    </div>
                </form>
            `,
            confirmText: this.__('actions.create'),
            onConfirm: async () => {
                const form = document.getElementById('create-gateway-form');
                const formData = new FormData(form);

                const data = {
                    name: formData.get('name'),
                    description: formData.get('description'),
                    polling_interval: parseInt(formData.get('polling_interval')) || 5,
                    command_timeout: parseInt(formData.get('command_timeout')) || 30
                };

                if (!data.name) {
                    Toast.error(this.__('gateway.toast.nameRequired'));
                    throw new Error('Validation failed');
                }

                try {
                    const response = await this.app.api.post('/gateways', data);
                    Toast.success(this.__('gateway.toast.created'));

                    // Kimlik bilgilerini göster
                    setTimeout(() => {
                        this.showNewCredentialsModal(response.data);
                    }, 300);

                    await this.loadGateways();
                } catch (error) {
                    Toast.error(this.__('gateway.toast.createFailed', { error: error.message || this.__('messages.unknownError') }));
                    throw error;
                }
            }
        });
    }

    showNewCredentialsModal(gateway) {

        Modal.show({
            title: this.__('gateway.credentialsTitle'),
            icon: 'ti-key',
            size: 'md',
            content: `
                <div class="alert alert-warning mb-3">
                    <i class="ti ti-alert-triangle"></i>
                    <strong>${this.__('actions.important')}:</strong> ${this.__('gateway.credentialsWarning')}
                </div>

                <div class="credentials-box">
                    <div class="credential-item">
                        <label>Gateway ID</label>
                        <div class="credential-value">
                            <code>${gateway.id}</code>
                            <button class="btn btn-sm btn-ghost" onclick="navigator.clipboard.writeText('${gateway.id}')">
                                <i class="ti ti-copy"></i>
                            </button>
                        </div>
                    </div>

                    <div class="credential-item">
                        <label>API Key</label>
                        <div class="credential-value">
                            <code>${gateway.api_key}</code>
                            <button class="btn btn-sm btn-ghost" onclick="navigator.clipboard.writeText('${gateway.api_key}')">
                                <i class="ti ti-copy"></i>
                            </button>
                        </div>
                    </div>

                    <div class="credential-item">
                        <label>API Secret</label>
                        <div class="credential-value">
                            <code class="text-danger">${gateway.api_secret}</code>
                            <button class="btn btn-sm btn-ghost" onclick="navigator.clipboard.writeText('${gateway.api_secret}')">
                                <i class="ti ti-copy"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="mt-4">
                    <h4>Local Gateway Config:</h4>
                    <pre class="config-preview">${JSON.stringify({
                        server_url: window.location.origin + (window.OmnexConfig?.basePath || ''),
                        gateway_id: gateway.id,
                        gateway_name: gateway.name,
                        api_key: gateway.api_key,
                        api_secret: gateway.api_secret,
                        polling_interval: 5,
                        command_timeout: 30,
                        log_level: "info"
                    }, null, 2)}</pre>
                    <button class="btn btn-sm btn-outline mt-2" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent); window.Toast?.success('${this.__('gateway.toast.configCopied')}')">
                        <i class="ti ti-copy"></i>
                        ${this.__('gateway.copyConfig')}
                    </button>
                </div>
            `,
            showCancel: false,
            confirmText: this.__('actions.ok')
        });
    }

    showCredentialsModal(gatewayId) {
        const gateway = this.gateways.find(g => g.id === gatewayId);
        if (!gateway) return;

        Modal.show({
            title: this.__('gateway.credentialsTitle'),
            icon: 'ti-key',
            size: 'md',
            content: `
                <div class="alert alert-info mb-3">
                    <i class="ti ti-info-circle"></i>
                    ${this.__('gateway.credentialsSecretHidden')}
                </div>

                <div class="credentials-box">
                    <div class="credential-item">
                        <label>Gateway ID</label>
                        <div class="credential-value">
                            <code>${gateway.id}</code>
                            <button class="btn btn-sm btn-ghost" onclick="navigator.clipboard.writeText('${gateway.id}')">
                                <i class="ti ti-copy"></i>
                            </button>
                        </div>
                    </div>

                    <div class="credential-item">
                        <label>API Key</label>
                        <div class="credential-value">
                            <code>${gateway.api_key || 'N/A'}</code>
                            ${gateway.api_key ? `
                            <button class="btn btn-sm btn-ghost" onclick="navigator.clipboard.writeText('${gateway.api_key}')">
                                <i class="ti ti-copy"></i>
                            </button>
                            ` : ''}
                        </div>
                    </div>

                    <div class="credential-item">
                        <label>API Secret</label>
                        <div class="credential-value">
                            <code>••••••••••••••••</code>
                            <span class="text-muted text-sm">(${this.__('gateway.hidden')})</span>
                        </div>
                    </div>
                </div>
            `,
            showCancel: false,
            confirmText: this.__('actions.ok')
        });
    }

    async showDetailsModal(gatewayId) {
        try {
            const response = await this.app.api.get(`/gateways/${gatewayId}`);
            const gateway = response.data;

            Modal.show({
                title: gateway.name,
                icon: 'ti-server',
                size: 'lg',
                content: `
                    <div class="gateway-details">
                        <div class="detail-section">
                            <h4>${this.__('gateway.statusInfo')}</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <label>${this.__('gateway.statusLabel')}</label>
                                    <span class="badge badge-${gateway.status === 'online' ? 'success' : 'warning'}">
                                        ${gateway.status === 'online' ? this.__('gateway.status.online') : this.__('gateway.status.offline')}
                                    </span>
                                </div>
                                <div class="detail-item">
                                    <label>${this.__('gateway.lastHeartbeat')}</label>
                                    <span>${gateway.last_heartbeat || this.__('gateway.never')}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Local IP</label>
                                    <span>${gateway.local_ip || 'N/A'}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Public IP</label>
                                    <span>${gateway.public_ip || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        <div class="detail-section">
                            <h4>${this.__('gateway.connectedDevices')} (${gateway.devices?.length || 0})</h4>
                            ${gateway.devices?.length ? `
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>${this.__('gateway.device')}</th>
                                            <th>Local IP</th>
                                            <th>${this.__('gateway.statusLabel')}</th>
                                            <th>${this.__('gateway.lastSeen')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${gateway.devices.map(d => `
                                            <tr>
                                                <td>${this.escapeHtml(d.device_name || d.device_id)}</td>
                                                <td>${d.local_ip || 'N/A'}</td>
                                                <td><span class="badge badge-${d.status === 'active' ? 'success' : 'warning'}">${d.status}</span></td>
                                                <td>${d.last_seen ? this.formatRelativeTime(d.last_seen) : 'N/A'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            ` : `<p class="text-muted">${this.__('gateway.noDevices')}</p>`}
                        </div>
                    </div>
                `,
                showCancel: false,
                confirmText: this.__('actions.close')
            });
        } catch (error) {
            Toast.error(this.__('gateway.toast.detailsFailed'));
        }
    }

    async deleteGateway(gatewayId) {
        const gateway = this.gateways.find(g => g.id === gatewayId);
        if (!gateway) return;

        Modal.confirm({
            title: this.__('gateway.deleteTitle'),
            message: this.__('gateway.deleteConfirm', { name: gateway.name }),
            type: 'danger',
            confirmText: this.__('actions.delete'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/gateways/${gatewayId}`);
                    Toast.success(this.__('gateway.toast.deleted'));
                    await this.loadGateways();
                } catch (error) {
                    Toast.error(this.__('gateway.toast.deleteFailed'));
                    throw error;
                }
            }
        });
    }

    formatRelativeTime(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return this.__('time.justNow');
        if (diff < 3600) return this.__('time.minutesAgo', { count: Math.floor(diff / 60) });
        if (diff < 86400) return this.__('time.hoursAgo', { count: Math.floor(diff / 3600) });
        return this.__('time.daysAgo', { count: Math.floor(diff / 86400) });
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==================== VARSAYILAN GÖRSEL YÖNETİMİ ====================

    async loadDefaultImages() {
        try {
            const response = await this.app.api.get('/settings/default-images');
            const data = response.data || {};
            this.defaultImageGateways = data.gateways || [];
            this.renderDefaultImages(data.images || []);
        } catch (error) {
            console.error('Default images load error:', error);
            this.defaultImageGateways = [];
            this.renderDefaultImages([]);
        }
    }

    renderDefaultImages(images) {
        const container = document.getElementById('default-image-preview');
        if (!container) return;

        if (images.length === 0) {
            container.innerHTML = `
                <div class="default-images-empty">
                    <i class="ti ti-photo-off"></i>
                    <p class="text-muted">${this.__('gateway.defaultImage.empty')}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="default-images-grid">
                ${images.map(img => `
                    <div class="default-image-item" data-filename="${this.escapeHtml(img.filename)}" data-gateway-id="${img.gateway_id || ''}">
                        <div class="default-image-thumb">
                            <img src="${img.url}" alt="${this.escapeHtml(img.name)}">
                        </div>
                        <div class="default-image-meta">
                            <span class="default-image-name">${this.escapeHtml(img.name)}</span>
                            <span class="default-image-gateway">
                                <i class="ti ti-router"></i>
                                ${this.escapeHtml(img.gateway_name || this.__('gateway.defaultImage.general'))}
                            </span>
                            <span class="default-image-size">${img.dimensions || ''}</span>
                        </div>
                        <button class="btn btn-sm btn-ghost text-danger btn-delete-default-image" title="${this.__('actions.delete')}">
                            <i class="ti ti-trash"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;

        // Silme butonları
        container.querySelectorAll('.btn-delete-default-image').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.default-image-item');
                const filename = item?.dataset.filename;
                const gatewayId = item?.dataset.gatewayId;
                if (filename) {
                    this.deleteDefaultImage(filename, gatewayId);
                }
            });
        });
    }

    showDefaultImageUploadModal() {
        // Gateway seçenekleri
        const gatewayOptions = (this.defaultImageGateways || []).map(gw =>
            `<option value="${gw.id}">${this.escapeHtml(gw.name)}</option>`
        ).join('');

        if (!gatewayOptions) {
            Toast.warning(this.__('gateway.defaultImage.noGateways'));
            return;
        }

        Modal.show({
            title: this.__('gateway.defaultImage.uploadTitle'),
            icon: 'ti-photo-up',
            size: 'md',
            content: `
                <div class="alert alert-info mb-3">
                    <i class="ti ti-info-circle"></i>
                    ${this.__('gateway.defaultImage.uploadInfo')}
                </div>

                <form id="default-image-form">
                    <div class="form-group">
                        <label class="form-label">${this.__('gateway.defaultImage.gateway')} *</label>
                        <select name="gateway_id" class="form-select" required>
                            <option value="">${this.__('gateway.defaultImage.selectGateway')}</option>
                            ${gatewayOptions}
                        </select>
                        <p class="form-hint">${this.__('gateway.defaultImage.gatewayHint')}</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">${this.__('gateway.defaultImage.imageType')} *</label>
                        <select name="image_type" class="form-select" required>
                            <option value="default">${this.__('gateway.defaultImage.types.default')}</option>
                            <option value="portrait">${this.__('gateway.defaultImage.types.portrait')}</option>
                            <option value="landscape">${this.__('gateway.defaultImage.types.landscape')}</option>
                            <option value="800x1280">800x1280 (10.1" Dikey)</option>
                            <option value="1280x800">1280x800 (10.1" Yatay)</option>
                            <option value="400x300">400x300 (4.2")</option>
                            <option value="296x128">296x128 (2.9")</option>
                        </select>
                        <p class="form-hint">${this.__('gateway.defaultImage.typeHint')}</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">${this.__('gateway.defaultImage.file')} *</label>
                        <div class="file-upload-zone" id="default-image-upload-zone">
                            <input type="file" name="image" accept="image/jpeg,image/png" id="default-image-input" style="display:none;">
                            <div class="file-upload-content">
                                <i class="ti ti-cloud-upload"></i>
                                <p>${this.__('gateway.defaultImage.dropzone')}</p>
                                <span class="text-muted">${this.__('gateway.defaultImage.formats')}</span>
                            </div>
                            <div class="file-upload-preview" id="default-image-file-preview" style="display:none;">
                                <img id="default-image-file-img" src="" alt="">
                                <span id="default-image-file-name"></span>
                            </div>
                        </div>
                    </div>
                </form>
            `,
            confirmText: this.__('actions.upload'),
            onConfirm: async () => {
                const form = document.getElementById('default-image-form');
                const fileInput = document.getElementById('default-image-input');
                const gatewayId = form.querySelector('[name="gateway_id"]').value;
                const imageType = form.querySelector('[name="image_type"]').value;

                if (!gatewayId) {
                    Toast.error(this.__('gateway.defaultImage.selectGateway'));
                    throw new Error('No gateway selected');
                }

                if (!fileInput.files.length) {
                    Toast.error(this.__('gateway.defaultImage.selectFile'));
                    throw new Error('No file selected');
                }

                const formData = new FormData();
                formData.append('image', fileInput.files[0]);
                formData.append('image_type', imageType);
                formData.append('gateway_id', gatewayId);

                try {
                    await this.app.api.upload('/settings/default-images', formData);
                    Toast.success(this.__('gateway.defaultImage.uploaded'));
                    await this.loadDefaultImages();
                } catch (error) {
                    Toast.error(this.__('gateway.defaultImage.uploadFailed', { error: error.message }));
                    throw error;
                }
            }
        });

        // File input ve drag-drop event'leri
        setTimeout(() => {
            const zone = document.getElementById('default-image-upload-zone');
            const input = document.getElementById('default-image-input');
            const preview = document.getElementById('default-image-file-preview');
            const content = zone?.querySelector('.file-upload-content');
            const img = document.getElementById('default-image-file-img');
            const fileName = document.getElementById('default-image-file-name');

            if (!zone || !input) return;

            // Click to select
            zone.addEventListener('click', () => input.click());

            // File selected
            input.addEventListener('change', () => {
                if (input.files.length) {
                    const file = input.files[0];
                    fileName.textContent = file.name;

                    // Preview image
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        img.src = e.target.result;
                        content.style.display = 'none';
                        preview.style.display = 'flex';
                    };
                    reader.readAsDataURL(file);
                }
            });

            // Drag & drop
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });

            zone.addEventListener('dragleave', () => {
                zone.classList.remove('drag-over');
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');

                if (e.dataTransfer.files.length) {
                    input.files = e.dataTransfer.files;
                    input.dispatchEvent(new Event('change'));
                }
            });
        }, 100);
    }

    async deleteDefaultImage(filename, gatewayId) {
        Modal.confirm({
            title: this.__('gateway.defaultImage.deleteTitle'),
            message: this.__('gateway.defaultImage.deleteConfirm'),
            type: 'danger',
            confirmText: this.__('actions.delete'),
            onConfirm: async () => {
                try {
                    let url = `/settings/default-images/${encodeURIComponent(filename)}`;
                    if (gatewayId) {
                        url += `?gateway_id=${gatewayId}`;
                    }
                    await this.app.api.delete(url);
                    Toast.success(this.__('gateway.defaultImage.deleted'));
                    await this.loadDefaultImages();
                } catch (error) {
                    Toast.error(this.__('gateway.defaultImage.deleteFailed'));
                    throw error;
                }
            }
        });
    }

    destroy() {
        // Cleanup
    }
}

export default GatewaySettings;
