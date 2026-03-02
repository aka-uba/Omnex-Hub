/**
 * Omnex Player - Storage Manager
 * Handles IndexedDB and localStorage for persistent data
 *
 * @version 1.0.0
 */

const DB_NAME = 'omnex-player';
const DB_VERSION = 1;

class PlayerStorage {
    constructor() {
        this.db = null;
        this.ready = false;
    }

    /**
     * Initialize IndexedDB
     */
    async init() {
        // Don't initialize in iframes
        if (window !== window.top) {
            this.ready = true;
            return false;
        }

        // Prevent re-initialization
        if (this.ready) {
            return !!this.db;
        }

        return new Promise((resolve, reject) => {
            let request;

            try {
                // indexedDB.open can throw SecurityError in sandboxed iframes
                request = indexedDB.open(DB_NAME, DB_VERSION);
            } catch (error) {
                this.ready = true;
                resolve(false);
                return;
            }

            request.onerror = () => {
                // Fallback to localStorage
                this.ready = true;
                resolve(false);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.ready = true;
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Config store - device settings, tokens
                if (!db.objectStoreNames.contains('config')) {
                    db.createObjectStore('config', { keyPath: 'key' });
                }

                // Content store - cached playlists, templates
                if (!db.objectStoreNames.contains('content')) {
                    const contentStore = db.createObjectStore('content', { keyPath: 'id' });
                    contentStore.createIndex('type', 'type', { unique: false });
                    contentStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                // Media store - cached media metadata
                if (!db.objectStoreNames.contains('media')) {
                    const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
                    mediaStore.createIndex('url', 'url', { unique: false });
                    mediaStore.createIndex('cached', 'cached', { unique: false });
                }

                // Logs store - playback logs
                if (!db.objectStoreNames.contains('logs')) {
                    const logsStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
                    logsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    logsStore.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    // ==================== Generic Operations ====================

    /**
     * Get item from store
     */
    async get(storeName, key) {
        if (!this.db) {
            return this.getLocal(`${storeName}_${key}`);
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    resolve(this.getLocal(`${storeName}_${key}`));
                };
            } catch (error) {
                resolve(this.getLocal(`${storeName}_${key}`));
            }
        });
    }

    /**
     * Put item in store
     */
    async put(storeName, data) {
        if (!this.db) {
            this.setLocal(`${storeName}_${data.key || data.id}`, data);
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(data);

                request.onsuccess = () => resolve(true);
                request.onerror = () => {
                    this.setLocal(`${storeName}_${data.key || data.id}`, data);
                    resolve(false);
                };
            } catch (error) {
                this.setLocal(`${storeName}_${data.key || data.id}`, data);
                resolve(false);
            }
        });
    }

    /**
     * Delete item from store
     */
    async delete(storeName, key) {
        if (!this.db) {
            localStorage.removeItem(`${DB_NAME}_${storeName}_${key}`);
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(key);

                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            } catch (error) {
                resolve(false);
            }
        });
    }

    /**
     * Get all items from store
     */
    async getAll(storeName) {
        if (!this.db) {
            return [];
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            } catch (error) {
                resolve([]);
            }
        });
    }

    /**
     * Clear store
     */
    async clear(storeName) {
        if (!this.db) {
            // Clear localStorage items with prefix
            const prefix = `${DB_NAME}_${storeName}_`;
            Object.keys(localStorage)
                .filter(key => key.startsWith(prefix))
                .forEach(key => localStorage.removeItem(key));
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            } catch (error) {
                resolve(false);
            }
        });
    }

    // ==================== LocalStorage Fallback ====================

    getLocal(key) {
        try {
            const data = localStorage.getItem(`${DB_NAME}_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    setLocal(key, value) {
        try {
            localStorage.setItem(`${DB_NAME}_${key}`, JSON.stringify(value));
        } catch (error) {
            // localStorage quota exceeded or not available
        }
    }

    // ==================== Device Config ====================

    /**
     * Save device configuration
     * IMPORTANT: On iOS, saves to BOTH IndexedDB and localStorage
     * to share credentials between Safari browser and PWA
     */
    async saveDeviceConfig(config) {
        // Save to IndexedDB
        await this.put('config', {
            key: 'device',
            ...config,
            updatedAt: new Date().toISOString()
        });

        // iOS PWA Fix: Also save critical data to localStorage for sharing
        this.saveDeviceConfigToLocalStorage(config);
    }

    /**
     * Get device configuration
     * Checks both IndexedDB and localStorage (iOS PWA fix)
     */
    async getDeviceConfig() {
        // First try IndexedDB
        const indexedDbConfig = await this.get('config', 'device');
        if (indexedDbConfig && indexedDbConfig.token) {
            return indexedDbConfig;
        }

        // iOS PWA Fix: Check localStorage as fallback
        const localStorageConfig = this.getDeviceConfigFromLocalStorage();
        if (localStorageConfig && localStorageConfig.token) {
            // Sync back to IndexedDB for future use
            await this.put('config', {
                key: 'device',
                ...localStorageConfig,
                updatedAt: new Date().toISOString()
            });
            return localStorageConfig;
        }

        return indexedDbConfig;
    }

    /**
     * Clear device configuration
     */
    async clearDeviceConfig() {
        await this.delete('config', 'device');
        // Also clear from localStorage
        this.clearDeviceConfigFromLocalStorage();
    }

    /**
     * Save device config to localStorage (for iOS PWA sharing)
     */
    saveDeviceConfigToLocalStorage(config) {
        try {
            if (config.token) {
                localStorage.setItem('omnex_device_token', config.token);
            }
            if (config.deviceId) {
                localStorage.setItem('omnex_device_id', config.deviceId);
            }
            if (config.fingerprint) {
                localStorage.setItem('omnex_device_fingerprint', config.fingerprint);
            }
            if (config.syncCode) {
                localStorage.setItem('omnex_device_sync_code', config.syncCode);
            }
        } catch (e) {
            // localStorage not available
        }
    }

    /**
     * Get device config from localStorage (iOS PWA fallback)
     */
    getDeviceConfigFromLocalStorage() {
        try {
            const token = localStorage.getItem('omnex_device_token');
            const deviceId = localStorage.getItem('omnex_device_id');
            const fingerprint = localStorage.getItem('omnex_device_fingerprint');

            if (token && deviceId) {
                return {
                    key: 'device',
                    token,
                    deviceId,
                    fingerprint,
                    fromLocalStorage: true
                };
            }
        } catch (e) {
            // localStorage not available
        }
        return null;
    }

    /**
     * Clear device config from localStorage
     */
    clearDeviceConfigFromLocalStorage() {
        try {
            localStorage.removeItem('omnex_device_token');
            localStorage.removeItem('omnex_device_id');
            localStorage.removeItem('omnex_device_sync_code');
            // Note: We DON'T remove fingerprint - it should persist
        } catch (e) {
            // localStorage not available
        }
    }

    // ==================== Fingerprint ====================

    /**
     * Generate device fingerprint
     * IMPORTANT: On iOS, Safari and PWA use different storage contexts.
     * We store fingerprint in BOTH IndexedDB and localStorage to share between contexts.
     * On first run, we check localStorage for existing fingerprint to maintain device identity.
     */
    async generateFingerprint() {
        // iOS PWA Fix: First check if we already have a fingerprint stored
        // This ensures browser and PWA share the same device identity
        const storedFingerprint = this.getStoredFingerprint();
        if (storedFingerprint) {
            return storedFingerprint;
        }

        const components = [];

        // Screen info
        components.push(screen.width);
        components.push(screen.height);
        components.push(screen.colorDepth);
        components.push(screen.pixelDepth);

        // Timezone
        components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

        // Language
        components.push(navigator.language);

        // Platform
        components.push(navigator.platform);

        // User agent hash - EXCLUDE PWA-specific parts for consistency
        const ua = navigator.userAgent
            .replace(/; wv\)/g, ')') // Remove webview indicator
            .replace(/ Safari\/[\d.]+/g, '') // Normalize Safari version
            .replace(/ Mobile\/[\w]+/g, ''); // Normalize mobile build
        components.push(this.hashString(ua));

        // Canvas fingerprint
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Omnex Player Fingerprint', 2, 2);
            components.push(this.hashString(canvas.toDataURL()));
        } catch (e) {
            components.push('canvas-unavailable');
        }

        // WebGL info
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
                    components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
                }
            }
        } catch (e) {
            components.push('webgl-unavailable');
        }

        // Generate hash
        const fingerprint = await this.sha256(components.join('|||'));
        const result = fingerprint.substring(0, 32).toUpperCase();

        // Store fingerprint in localStorage for sharing between browser and PWA
        this.storeFingerprint(result);

        return result;
    }

    /**
     * Get stored fingerprint from localStorage (shared between browser and PWA)
     */
    getStoredFingerprint() {
        try {
            // Check localStorage first (shared storage)
            const stored = localStorage.getItem('omnex_device_fingerprint');
            if (stored && stored.length === 32) {
                return stored;
            }
        } catch (e) {
            // localStorage not available
        }
        return null;
    }

    /**
     * Store fingerprint in localStorage for sharing between browser and PWA
     */
    storeFingerprint(fingerprint) {
        try {
            localStorage.setItem('omnex_device_fingerprint', fingerprint);
        } catch (e) {
            // localStorage not available or quota exceeded
        }
    }

    /**
     * Simple string hash
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    /**
     * SHA-256 hash (with fallback for non-HTTPS)
     */
    async sha256(message) {
        // crypto.subtle is only available in secure contexts (HTTPS)
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            try {
                const msgBuffer = new TextEncoder().encode(message);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) {
                // crypto.subtle not available, use fallback
            }
        }

        // Fallback: Simple hash for HTTP (development)
        return this.simpleHash(message);
    }

    /**
     * Simple hash fallback for non-secure contexts
     * Generates a proper 32-character hex fingerprint
     */
    simpleHash(str) {
        // Use multiple hash rounds to create a longer, more unique fingerprint
        const hashes = [];

        // Generate 4 different hashes with different seeds
        const seeds = [5381, 52711, 31337, 98765];

        for (const seed of seeds) {
            let hash = seed;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) + hash) ^ char;
                hash = hash & 0xFFFFFFFF; // Keep it 32-bit
            }
            // Convert to unsigned and then to 8-char hex
            hashes.push((hash >>> 0).toString(16).padStart(8, '0'));
        }

        // Combine all 4 hashes (4 x 8 = 32 characters)
        return hashes.join('').toUpperCase();
    }

    // ==================== Content Cache ====================

    /**
     * Save playlist
     */
    async savePlaylist(playlist) {
        await this.put('content', {
            id: `playlist_${playlist.id}`,
            type: 'playlist',
            data: playlist,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Get playlist
     */
    async getPlaylist(playlistId) {
        const result = await this.get('content', `playlist_${playlistId}`);
        return result ? result.data : null;
    }

    /**
     * Save template
     */
    async saveTemplate(template) {
        await this.put('content', {
            id: `template_${template.id}`,
            type: 'template',
            data: template,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Get template
     */
    async getTemplate(templateId) {
        const result = await this.get('content', `template_${templateId}`);
        return result ? result.data : null;
    }

    // ==================== Media Cache ====================

    /**
     * Register cached media
     */
    async registerMedia(mediaInfo) {
        await this.put('media', {
            id: mediaInfo.id || mediaInfo.url,
            url: mediaInfo.url,
            type: mediaInfo.type,
            size: mediaInfo.size,
            cached: true,
            cachedAt: new Date().toISOString()
        });
    }

    /**
     * Check if media is cached
     */
    async isMediaCached(url) {
        const result = await this.get('media', url);
        return result ? result.cached : false;
    }

    /**
     * Get all cached media
     */
    async getCachedMedia() {
        return this.getAll('media');
    }

    // ==================== Logs ====================

    /**
     * Add log entry
     */
    async log(type, message, data = null) {
        await this.put('logs', {
            id: Date.now(),
            type,
            message,
            data,
            timestamp: new Date().toISOString()
        });

        // Keep only last 1000 logs
        await this.trimLogs(1000);
    }

    /**
     * Trim old logs
     */
    async trimLogs(maxCount) {
        const logs = await this.getAll('logs');
        if (logs.length > maxCount) {
            const toDelete = logs
                .sort((a, b) => a.id - b.id)
                .slice(0, logs.length - maxCount);

            for (const log of toDelete) {
                await this.delete('logs', log.id);
            }
        }
    }

    /**
     * Get recent logs
     */
    async getLogs(count = 100) {
        const logs = await this.getAll('logs');
        return logs
            .sort((a, b) => b.id - a.id)
            .slice(0, count);
    }

    // ==================== Cleanup ====================

    /**
     * Clear all data
     */
    async clearAll() {
        await this.clear('config');
        await this.clear('content');
        await this.clear('media');
        await this.clear('logs');
    }

    /**
     * Get storage usage estimate
     */
    async getStorageUsage() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage,
                quota: estimate.quota,
                percent: Math.round((estimate.usage / estimate.quota) * 100)
            };
        }
        return null;
    }
}

// Export singleton
export const storage = new PlayerStorage();
export default storage;
