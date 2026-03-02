/**
 * Omnex Player - API Client
 * Handles all communication with the Omnex API
 *
 * @version 1.0.0
 */

import { storage } from './storage.js';

class PlayerApi {
    constructor() {
        this.baseUrl = this.detectBaseUrl();
        this.token = null;
        this.deviceId = null;
    }

    /**
     * Detect API base URL dynamically
     */
    detectBaseUrl() {
        const origin = window.location.origin;
        const pathname = window.location.pathname;

        // Find the position of 'player' in the path
        const playerIndex = pathname.indexOf('/player');

        if (playerIndex > 0) {
            // Get everything before /player (e.g., /market-etiket-sistemi)
            const basePath = pathname.substring(0, playerIndex);
            return `${origin}${basePath}/api`;
        }

        // Fallback: try to extract from path parts
        const pathParts = pathname.split('/').filter(p => p && p !== 'player' && p !== 'index.html');
        if (pathParts.length > 0) {
            return `${origin}/${pathParts[0]}/api`;
        }

        return `${origin}/api`;
    }

    /**
     * Initialize API with stored credentials
     */
    async init() {
        const deviceConfig = await storage.getDeviceConfig();
        if (deviceConfig) {
            this.token = deviceConfig.token;
            this.deviceId = deviceConfig.deviceId;
        }
        return !!this.token;
    }

    /**
     * Set device token
     */
    setToken(token, deviceId) {
        this.token = token;
        this.deviceId = deviceId;
    }

    /**
     * Clear credentials
     */
    clearCredentials() {
        this.token = null;
        this.deviceId = null;
    }

    /**
     * Extract optional tenant context from player URL.
     * Supported params: companyId, company_id, cid, companySlug, company_slug
     */
    getTenantContext() {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const companyId =
                params.get('companyId') ||
                params.get('company_id') ||
                params.get('cid') ||
                null;
            const companySlug =
                params.get('companySlug') ||
                params.get('company_slug') ||
                null;

            const context = {};
            if (companyId) context.companyId = companyId;
            if (companySlug) context.companySlug = companySlug;
            return context;
        } catch (_) {
            return {};
        }
    }

    /**
     * Handle 401 Unauthorized - device deleted or token invalid
     * Clear storage and reload to trigger re-registration
     */
    async handleUnauthorized() {
        try {
            // Clear device config from storage
            await storage.clearDeviceConfig();
        } catch (e) {
            // Ignore storage errors
        }

        // Reload page to trigger registration flow
        window.location.reload();
    }

    /**
     * Build request headers
     */
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (includeAuth && this.token) {
            headers['X-DEVICE-TOKEN'] = this.token;
            headers['Authorization'] = `Device ${this.token}`;
        }

        return headers;
    }

    /**
     * Make HTTP request
     */
    async request(method, endpoint, data = null, includeAuth = true) {
        const url = `${this.baseUrl}${endpoint}`;

        const options = {
            method,
            headers: this.getHeaders(includeAuth),
            credentials: 'include'
        };

        if (method === 'GET') {
            options.cache = 'no-store';
        }

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            const contentType = response.headers.get('content-type');

            let responseData;
            if (contentType && contentType.includes('application/json')) {
                // Safely parse JSON - handle empty or malformed responses
                const text = await response.text();
                if (!text || text.trim() === '') {
                    responseData = {};
                } else {
                    try {
                        responseData = JSON.parse(text);
                    } catch (parseError) {
                        console.error('API: JSON parse error for', endpoint, parseError.message);
                        responseData = { success: false, message: 'Invalid server response' };
                    }
                }
            } else {
                responseData = await response.text();
            }

            if (!response.ok) {
                // Handle 401 Unauthorized - device token invalid or device deleted
                if (response.status === 401 && includeAuth) {
                    // Clear credentials and trigger re-registration
                    this.clearCredentials();
                    await this.handleUnauthorized();
                }

                throw {
                    status: response.status,
                    statusText: response.statusText,
                    data: responseData
                };
            }

            return responseData;
        } catch (error) {
            if (error.status) {
                throw error;
            }

            // Network error
            throw {
                status: 0,
                statusText: 'Network Error',
                message: error.message,
                offline: !navigator.onLine
            };
        }
    }

    // ==================== Registration ====================

    /**
     * Register device and get sync code
     * POST /api/player/register
     */
    async register(deviceInfo) {
        const tenantContext = this.getTenantContext();
        return this.request(
            'POST',
            '/player/register',
            { ...deviceInfo, ...tenantContext },
            false
        );
    }

    /**
     * Verify sync code and get token
     * GET /api/player/verify?syncCode=XXXXXX
     */
    async verify(syncCode) {
        const tenantContext = this.getTenantContext();
        const deviceConfig = await storage.getDeviceConfig();
        const fingerprint = deviceConfig?.fingerprint || null;

        const params = new URLSearchParams();
        params.set('syncCode', String(syncCode));

        if (fingerprint) {
            params.set('fingerprint', fingerprint);
        }
        if (tenantContext.companyId) {
            params.set('companyId', tenantContext.companyId);
        }
        if (tenantContext.companySlug) {
            params.set('companySlug', tenantContext.companySlug);
        }

        return this.request('GET', `/player/verify?${params.toString()}`, null, false);
    }

    // ==================== Player Operations ====================

    /**
     * Initialize player and get config
     * GET /api/player/init
     */
    async init_player() {
        return this.request('GET', '/player/init');
    }

    /**
     * Sync content updates
     * GET /api/player/sync?since=TIMESTAMP
     */
    async sync(since = null) {
        let endpoint = '/player/sync';
        if (since) {
            endpoint += `?since=${encodeURIComponent(since)}`;
        }
        return this.request('GET', endpoint);
    }

    /**
     * Send heartbeat
     * POST /api/player/heartbeat
     */
    async heartbeat(status) {
        return this.request('POST', '/player/heartbeat', status);
    }

    /**
     * Get pending commands
     * GET /api/player/commands
     */
    async getCommands() {
        return this.request('GET', '/player/commands');
    }

    /**
     * Acknowledge command completion
     * POST /api/player/command-ack
     */
    async acknowledgeCommand(commandId, result = null) {
        return this.request('POST', '/player/command-ack', {
            command_id: commandId,
            status: 'completed',
            result
        });
    }

    // ==================== Content ====================

    /**
     * Get playlist content
     * GET /api/playlists/:id
     */
    async getPlaylist(playlistId) {
        return this.request('GET', `/playlists/${playlistId}`);
    }

    /**
     * Get template details
     * GET /api/templates/:id
     */
    async getTemplate(templateId) {
        return this.request('GET', `/templates/${templateId}`);
    }

    /**
     * Get media file URL
     */
    getMediaUrl(path) {
        if (!path) return null;

        // Data URI (base64 images) - return as-is
        if (path.startsWith('data:')) {
            return path;
        }

        let url;

        // Already a full URL
        if (path.startsWith('http://') || path.startsWith('https://')) {
            url = path;
        }
        // Relative path
        else if (path.startsWith('/')) {
            url = `${window.location.origin}${path}`;
        }
        // Storage path
        else {
            url = `${this.baseUrl.replace('/api', '')}/storage/${path}`;
        }

        // Enforce HTTPS on production (prevent Mixed Content errors)
        if (window.location.protocol === 'https:' && url && url.startsWith('http://')) {
            url = url.replace('http://', 'https://');
        }

        return url;
    }

    // ==================== Utility ====================

    /**
     * Check if online
     */
    isOnline() {
        return navigator.onLine;
    }

    /**
     * Ping server
     */
    async ping() {
        try {
            const start = Date.now();
            await this.request('GET', '/player/init');
            return Date.now() - start;
        } catch (e) {
            return -1;
        }
    }
}

// Export singleton
export const api = new PlayerApi();
export default api;
