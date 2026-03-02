/**
 * Api - HTTP Client
 *
 * @package OmnexDisplayHub
 */

import { Logger } from './Logger.js';

export class Api {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.token = null;
        this.refreshToken = null;
        this.refreshPromise = null;
        this.csrfToken = null;

        // Load tokens from storage
        this.loadTokens();
    }

    /**
     * Load tokens from localStorage
     */
    loadTokens() {
        const config = window.OmnexConfig?.storageKeys || {};
        this.token = localStorage.getItem(config.token || 'omnex_token');
        this.refreshToken = localStorage.getItem(config.refreshToken || 'omnex_refresh_token');
    }

    /**
     * Save tokens to localStorage
     */
    saveTokens(token, refreshToken) {
        const config = window.OmnexConfig?.storageKeys || {};
        this.token = token;
        this.refreshToken = refreshToken;

        if (token) {
            localStorage.setItem(config.token || 'omnex_token', token);
        } else {
            localStorage.removeItem(config.token || 'omnex_token');
        }

        if (refreshToken) {
            localStorage.setItem(config.refreshToken || 'omnex_refresh_token', refreshToken);
        } else {
            localStorage.removeItem(config.refreshToken || 'omnex_refresh_token');
        }
    }

    /**
     * Clear tokens
     */
    clearTokens() {
        this.saveTokens(null, null);
    }

    /**
     * Get CSRF token from server
     */
    async getCsrfToken() {
        if (!this.csrfToken) {
            try {
                const resp = await fetch(`${this.baseUrl}/csrf-token`, {
                    credentials: 'include'
                });
                const data = await resp.json();
                this.csrfToken = data.token;
            } catch (e) {
                // Silently fail - CSRF may not be required in dev
            }
        }
        return this.csrfToken;
    }

    /**
     * Get active company ID from localStorage
     * This is used for SuperAdmin to specify which company context they're working in
     */
    getActiveCompanyId() {
        return localStorage.getItem('omnex_active_company') || null;
    }

    /**
     * Get active branch ID from localStorage
     * This is used to specify which branch context the user is working in
     */
    getActiveBranchId() {
        return localStorage.getItem('omnex_active_branch') || null;
    }

    /**
     * Make HTTP request
     */
    async request(method, endpoint, data = null, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
        };

        // Add auth token
        if (this.token && !options.noAuth) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        // Add active company ID for SuperAdmin context
        const activeCompanyId = this.getActiveCompanyId();
        if (activeCompanyId) {
            headers['X-Active-Company'] = activeCompanyId;
        }

        // Add active branch ID for branch context
        const activeBranchId = this.getActiveBranchId();
        if (activeBranchId) {
            headers['X-Active-Branch'] = activeBranchId;
        }

        // Add CSRF token for state-changing requests
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
            const csrfToken = await this.getCsrfToken();
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }
        }

        const config = {
            method,
            headers,
            credentials: 'include' // Allow CORS with credentials for mobile devices
        };

        // Add body for non-GET requests
        if (data && method !== 'GET') {
            if (data instanceof FormData) {
                delete headers['Content-Type'];
                config.body = data;
            } else {
                config.body = JSON.stringify(data);
            }
        }

        // Add query params for GET
        if (data && method === 'GET') {
            const params = new URLSearchParams(data);
            const separator = url.includes('?') ? '&' : '?';
            config.url = `${url}${separator}${params}`;
        }

        try {
            Logger.debug(`API Request: ${method} ${config.url || url}`);
            const response = await fetch(config.url || url, config);
            Logger.debug(`API Response: ${response.status} ${response.statusText}`);

            // Handle 401 - try refresh token
            if (response.status === 401 && !options.noRefresh && !options.noAuth) {
                if (this.refreshToken) {
                    Logger.debug('API: Token expired, trying to refresh...', { endpoint });
                    const refreshed = await this.tryRefreshToken();
                    if (refreshed) {
                        // Reload token after refresh (ensure we use the new token)
                        this.loadTokens();
                        Logger.debug('API: Token refreshed, retrying request...', { endpoint, newToken: this.token?.substring(0, 20) + '...' });
                        return this.request(method, endpoint, data, { ...options, noRefresh: true });
                    }
                } else {
                    // No refresh token available - session fully expired
                    Logger.debug('API: No refresh token, session expired');
                    this.clearTokens();
                    this.handleSessionExpired();
                }
            }

            // Parse response
            const contentType = response.headers.get('content-type');
            let result;

            if (contentType?.includes('application/json')) {
                // Safely parse JSON - handle empty or malformed responses
                const text = await response.text();
                if (!text || text.trim() === '') {
                    result = {};
                } else {
                    try {
                        result = JSON.parse(text);
                    } catch (parseError) {
                        Logger.error('API: JSON parse error for', endpoint, parseError.message);
                        result = { success: false, message: 'Invalid server response' };
                    }
                }
            } else {
                // Some production proxies return JSON payload with wrong content-type.
                // Try JSON parse first, then fallback to plain text.
                const text = await response.text();
                if (!text || text.trim() === '') {
                    result = {};
                } else {
                    try {
                        result = JSON.parse(text);
                    } catch {
                        result = text;
                    }
                }
            }

            // Handle errors
            if (!response.ok) {
                Logger.error('API Error Response:', JSON.stringify(result, null, 2));

                // Rate limit hatası kontrolü (429)
                if (response.status === 429) {
                    const retryAfter = result.retry_after || 300; // Varsayılan 5 dakika
                    const minutes = Math.ceil(retryAfter / 60);
                    this.handleRateLimitError(minutes, retryAfter);
                    const error = new Error(result.message || 'Too many requests');
                    error.status = response.status;
                    error.data = result;
                    error.isRateLimitError = true;
                    error.retryAfter = retryAfter;
                    throw error;
                }

                // Lisans hatası kontrolü
                if (response.status === 403 && result.license_error) {
                    this.handleLicenseError(result);
                    const __ = window.__ || ((k) => k);
                    const error = new Error(result.message || __('license.error.title'));
                    error.status = response.status;
                    error.data = result;
                    error.isLicenseError = true;
                    throw error;
                }

                const error = new Error(result.message || 'Request failed');
                error.status = response.status;
                error.data = result;
                throw error;
            }

            // Lisans uyarısı kontrolü (header'dan)
            const licenseWarning = response.headers.get('X-License-Warning');
            if (licenseWarning && !this._licenseWarningShown) {
                this._licenseWarningShown = true;
                this.showLicenseWarning(licenseWarning);
                // 1 saat sonra tekrar gösterebilir
                setTimeout(() => { this._licenseWarningShown = false; }, 60 * 60 * 1000);
            }

            return result;

        } catch (error) {
            // Network error
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                Logger.error('API: Network error - Failed to fetch', error);
                const __ = window.__ || ((k) => k);
                error.message = __('messages.networkErrorDetail');
                error.offline = true;
            } else {
                Logger.error('API: Request error', error);
            }

            throw error;
        }
    }

    /**
     * Try to refresh access token
     */
    async tryRefreshToken() {
        // Prevent multiple simultaneous refresh requests
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = (async () => {
            try {
                const response = await this.request('POST', '/auth/refresh-token', {
                    refresh_token: this.refreshToken
                }, { noAuth: true, noRefresh: true });

                if (response.success && response.data) {
                    this.saveTokens(
                        response.data.access_token,
                        response.data.refresh_token
                    );
                    return true;
                }
            } catch (e) {
                Logger.error('Token refresh failed:', e);
            }

            // Clear tokens on failure
            this.clearTokens();

            // Show session expired notification and redirect to login
            this.handleSessionExpired();

            return false;
        })();

        const result = await this.refreshPromise;
        this.refreshPromise = null;
        return result;
    }

    /**
     * Handle session expired - show toast and redirect to login
     */
    handleSessionExpired() {
        // Prevent multiple session expired notifications
        if (this._sessionExpiredHandled) return;
        this._sessionExpiredHandled = true;

        const { Toast } = window.OmnexComponents || {};
        const __ = window.__ || ((k) => k);

        const message = __('auth.sessionExpired');
        const title = __('auth.sessionExpiredTitle');

        if (Toast) {
            Toast.show({
                type: 'warning',
                title: title,
                message: message,
                duration: 5000
            });
        }

        // Clear user data from localStorage
        const userKey = window.OmnexConfig?.storageKeys?.user || 'omnex_user';
        localStorage.removeItem(userKey);

        // Redirect to login after a short delay so user can see the toast
        setTimeout(() => {
            this._sessionExpiredHandled = false;
            window.location.hash = '#/login';
        }, 1000);
    }

    // Convenience methods

    get(endpoint, params = null, options = {}) {
        return this.request('GET', endpoint, params, options);
    }

    post(endpoint, data = null, options = {}) {
        return this.request('POST', endpoint, data, options);
    }

    put(endpoint, data = null, options = {}) {
        return this.request('PUT', endpoint, data, options);
    }

    patch(endpoint, data = null, options = {}) {
        return this.request('PATCH', endpoint, data, options);
    }

    delete(endpoint, data = null, options = {}) {
        return this.request('DELETE', endpoint, data, options);
    }

    /**
     * Upload file(s)
     */
    async upload(endpoint, files, data = {}, options = {}) {
        let formData;

        // If already FormData, use it directly
        if (files instanceof FormData) {
            formData = files;
            // Add additional data if provided
            for (const [key, value] of Object.entries(data)) {
                formData.append(key, value);
            }
        } else {
            formData = new FormData();

            // Add files
            if (files instanceof FileList || Array.isArray(files)) {
                for (let i = 0; i < files.length; i++) {
                    formData.append('files[]', files[i]);
                }
            } else if (files instanceof File) {
                formData.append('file', files);
            }

            // Add additional data
            for (const [key, value] of Object.entries(data)) {
                formData.append(key, value);
            }
        }

        return this.request('POST', endpoint, formData, options);
    }

    /**
     * Download file
     */
    async download(endpoint, filename, params = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;

        const response = await fetch(fullUrl, {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (!response.ok) {
            throw new Error('Download failed');
        }

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(downloadUrl);
    }

    /**
     * Rate limit (429) hatası için toast göster
     */
    handleRateLimitError(minutes, seconds) {
        const { Toast } = window.OmnexComponents || {};
        const __ = window.__ || ((k) => k);

        const title = __('errors.rateLimit.title');
        const message = __('errors.rateLimit.message', { minutes });

        if (Toast) {
            Toast.warning(message, {
                title: title,
                duration: 8000,
                icon: 'ti-clock-pause'
            });
        } else {
            // Toast yoksa alert kullan
            alert(`${title}\n\n${message}`);
        }
    }

    /**
     * Lisans hatası modal göster
     */
    handleLicenseError(result) {
        const { Modal } = window.OmnexComponents || {};
        const __ = window.__ || ((k) => k);

        // Hata koduna göre ikon ve başlık
        let icon = 'ti-license-off';
        let title = __('license.error.title');
        let iconColor = '#fa5252';

        switch (result.code) {
            case 'LICENSE_EXPIRED':
                icon = 'ti-clock-off';
                title = __('license.error.expired');
                break;
            case 'LICENSE_CANCELLED':
                icon = 'ti-ban';
                title = __('license.error.cancelled');
                break;
            case 'LICENSE_SUSPENDED':
                icon = 'ti-lock';
                title = __('license.error.suspended');
                break;
            case 'LICENSE_NOT_FOUND':
                icon = 'ti-file-off';
                title = __('license.error.notFound');
                break;
        }

        // Mesaj içeriği - i18n ile çevir, backend message fallback
        let messageText;
        switch (result.code) {
            case 'LICENSE_NOT_FOUND':
                messageText = __('license.messages.notFound');
                break;
            case 'LICENSE_EXPIRED':
                messageText = result.license_info?.days_overdue
                    ? __('license.messages.expiredDaysAgo', { days: result.license_info.days_overdue })
                    : __('license.messages.expired');
                break;
            case 'LICENSE_CANCELLED':
                messageText = __('license.messages.cancelled');
                break;
            case 'LICENSE_SUSPENDED':
                messageText = __('license.messages.suspended');
                break;
            default:
                messageText = result.message || __('license.messages.invalid');
                break;
        }

        let content = `<div style="text-align: center; padding: 1rem;">`;
        content += `<div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(250, 82, 82, 0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">`;
        content += `<i class="${icon}" style="font-size: 40px; color: ${iconColor};"></i>`;
        content += `</div>`;
        content += `<p style="font-size: 1.1rem; margin-bottom: 1rem;">${messageText}</p>`;

        if (result.license_info) {
            content += `<div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; text-align: left; margin-bottom: 1rem;">`;
            content += `<p><strong>${__('license.type')}:</strong> ${result.license_info.type}</p>`;
            if (result.license_info.expired_at) {
                content += `<p><strong>${__('license.expiredAt')}:</strong> ${result.license_info.expired_at}</p>`;
            }
            if (result.license_info.days_overdue) {
                content += `<p><strong>${__('license.daysOverdue')}:</strong> ${result.license_info.days_overdue} ${__('common.days')}</p>`;
            }
            content += `</div>`;
        }

        if (result.can_renew) {
            content += `<p style="color: var(--color-success);">`;
            content += `<i class="ti ti-arrow-right"></i> ${__('license.canRenew')}`;
            content += `</p>`;
        } else if (result.contact_admin) {
            content += `<p style="color: var(--color-warning);">`;
            content += `<i class="ti ti-alert-circle"></i> ${__('license.contactAdmin')}`;
            content += `</p>`;
        }

        content += `</div>`;

        // Modal göster
        if (Modal) {
            Modal.show({
                title: title,
                content: content,
                size: 'md',
                closable: false,
                closeOnBackdrop: false,
                closeOnEscape: false,
                showCancel: false,
                confirmText: result.can_renew
                    ? __('license.renewButton')
                    : __('common.ok'),
                confirmClass: result.can_renew ? 'btn-success' : 'btn-primary',
                onConfirm: () => {
                    if (result.redirect_url) {
                        window.location.hash = result.redirect_url;
                    }
                }
            });
        } else {
            // Modal yoksa alert kullan
            alert(`${title}\n\n${messageText}`);
            if (result.redirect_url) {
                window.location.hash = result.redirect_url;
            }
        }
    }

    /**
     * Lisans uyarısı (süre dolmak üzere)
     */
    showLicenseWarning(daysLeft) {
        const { Toast } = window.OmnexComponents || {};
        const __ = window.__ || ((k) => k);

        if (Toast) {
            const days = parseInt(daysLeft, 10);
            const message = isNaN(days)
                ? daysLeft
                : __('license.warning.expiringSoon', { days });

            Toast.warning(
                message,
                {
                    duration: 10000,
                    action: {
                        text: __('license.warning.renew'),
                        onClick: () => {
                            window.location.hash = '#/admin/licenses';
                        }
                    }
                }
            );
        }
    }
}

export default Api;
