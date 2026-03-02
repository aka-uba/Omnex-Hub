/**
 * CacheManager - Client-side cache management utility
 *
 * Provides methods to clear browser and service worker caches.
 * In development mode, shows a cache clear button in the UI.
 *
 * @package OmnexDisplayHub
 */

import { Logger } from './Logger.js';

export class CacheManager {
    constructor() {
        this.isDevelopment = window.OmnexConfig?.isDevelopment || this.detectDevelopment();
        this.buildVersion = window.OmnexConfig?.appVersion || '1.0.0';

        // Check version on init
        this.checkVersion();

        // Listen for SW reload messages
        if (navigator.serviceWorker) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.action === 'reload') {
                    Logger.log('[CacheManager] SW requested reload');
                    window.location.reload(true);
                }
            });
        }
    }

    /**
     * Detect if running in development mode
     */
    detectDevelopment() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' ||
               hostname === '127.0.0.1' ||
               hostname.startsWith('192.168.') ||
               hostname.startsWith('10.') ||
               hostname.endsWith('.local');
    }

    /**
     * Check if version has changed and clear cache if needed
     * Note: In development mode, we don't auto-clear to avoid disrupting auth
     */
    checkVersion() {
        const storedVersion = localStorage.getItem('omnex_cache_version');

        if (storedVersion && storedVersion !== this.buildVersion) {
            Logger.log('[CacheManager] Version changed:', storedVersion, '->', this.buildVersion);
            // Only log in development, don't auto-clear (causes auth issues)
            if (!this.isDevelopment) {
                this.clearAll().then(() => {
                    localStorage.setItem('omnex_cache_version', this.buildVersion);
                });
            } else {
                // Just update version without clearing
                localStorage.setItem('omnex_cache_version', this.buildVersion);
            }
        } else {
            localStorage.setItem('omnex_cache_version', this.buildVersion);
        }
    }

    /**
     * Clear all caches (browser and SW)
     */
    async clearAll() {
        const results = {
            caches: 0,
            localStorage: false,
            sessionStorage: false
        };

        // Clear Service Worker caches
        if ('caches' in window) {
            try {
                const names = await caches.keys();
                await Promise.all(names.map(name => caches.delete(name)));
                results.caches = names.length;
                Logger.log(`[CacheManager] Cleared ${names.length} cache(s)`);
            } catch (e) {
                Logger.error('[CacheManager] Failed to clear caches:', e);
            }
        }

        // Tell SW to clear and skip waiting
        if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ action: 'clearCache' });
            navigator.serviceWorker.controller.postMessage({ action: 'skipWaiting' });
        }

        // Clear certain localStorage items (keep auth, theme, language, company, layout)
        const preserveKeys = [
            // Auth keys
            'omnex_token',
            'omnex_refresh_token',
            'omnex_user',
            // Theme & Layout keys (v2)
            'omnex-layout-config-v2',
            'omnex-layout-config-timestamp',
            'omnex-company-defaults',
            // Legacy theme/layout keys
            'omnex_layout_config',
            'omnex_theme',
            // Other settings
            'omnex_language',
            'omnex_active_company',
            'omnex_cache_version',
            'omnex_sidebar_collapsed'
        ];
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && !preserveKeys.includes(key)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });

        results.localStorage = true;
        Logger.log(`[CacheManager] Cleared ${keysToRemove.length} localStorage items`);

        return results;
    }

    /**
     * Force reload with cache clear
     */
    async forceReload() {
        await this.clearAll();

        // Unregister service worker
        if (navigator.serviceWorker) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                Logger.log('[CacheManager] Unregistered SW');
            }
        }

        // Hard reload
        setTimeout(() => {
            window.location.reload(true);
        }, 100);
    }

    /**
     * Get cache info
     */
    async getCacheInfo() {
        const info = {
            buildVersion: this.buildVersion,
            isDevelopment: this.isDevelopment,
            caches: [],
            localStorage: localStorage.length,
            serviceWorker: null
        };

        // Get cache names
        if ('caches' in window) {
            info.caches = await caches.keys();
        }

        // Get SW info
        if (navigator.serviceWorker?.controller) {
            const channel = new MessageChannel();
            const promise = new Promise(resolve => {
                channel.port1.onmessage = (event) => {
                    resolve(event.data);
                };
                setTimeout(() => resolve(null), 1000);
            });

            navigator.serviceWorker.controller.postMessage(
                { action: 'getCacheInfo' },
                [channel.port2]
            );

            info.serviceWorker = await promise;
        }

        return info;
    }

    /**
     * Render cache clear button for development
     */
    renderDevButton() {
        if (!this.isDevelopment) return '';

        return `
            <button type="button"
                    id="dev-cache-clear-btn"
                    class="btn btn-sm btn-outline-warning"
                    title="${(typeof window.__ === 'function' ? window.__('cache.clearTitle') : null) || 'Önbelleği Temizle (Development)'}"
                    style="margin-right: 0.5rem;">
                <i class="ti ti-refresh"></i>
                <span class="d-none d-md-inline ml-1">Cache</span>
            </button>
        `;
    }

    /**
     * Initialize dev button events
     */
    initDevButton() {
        const btn = document.getElementById('dev-cache-clear-btn');
        if (btn) {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                btn.disabled = true;
                btn.innerHTML = '<i class="ti ti-loader animate-spin"></i>';

                try {
                    await this.forceReload();
                } catch (err) {
                    Logger.error('[CacheManager] Error:', err);
                    btn.disabled = false;
                    btn.innerHTML = '<i class="ti ti-refresh"></i><span class="d-none d-md-inline ml-1">Cache</span>';
                }
            });
        }
    }

    /**
     * Show cache info modal
     */
    async showInfoModal() {
        const info = await this.getCacheInfo();
        const { Modal } = await import('../components/Modal.js');

        let cacheList = '';
        if (info.caches.length > 0) {
            cacheList = info.caches.map(name => `<li>${name}</li>`).join('');
        } else {
            cacheList = `<li class="text-muted">${(typeof window.__ === 'function' ? window.__('cache.noCache') : null) || 'Önbellek yok'}</li>`;
        }

        Modal.show({
            title: (typeof window.__ === 'function' ? window.__('cache.infoTitle') : null) || 'Cache Bilgisi',
            icon: 'ti-database',
            size: 'md',
            content: `
                <div class="space-y-4">
                    <div>
                        <strong>Build Version:</strong> ${info.buildVersion}
                    </div>
                    <div>
                        <strong>Mode:</strong> ${info.isDevelopment ? 'Development' : 'Production'}
                    </div>
                    <div>
                        <strong>localStorage Items:</strong> ${info.localStorage}
                    </div>
                    <div>
                        <strong>Service Worker Caches:</strong>
                        <ul class="list-disc pl-4 mt-1">${cacheList}</ul>
                    </div>
                    ${info.serviceWorker ? `
                    <div>
                        <strong>SW Version:</strong> ${info.serviceWorker.version}
                    </div>
                    ` : ''}
                </div>
            `,
            showCancel: false,
            confirmText: (typeof window.__ === 'function' ? window.__('cache.clearAll') : null) || 'Tümünü Temizle',
            confirmClass: 'btn-danger',
            onConfirm: async () => {
                await this.forceReload();
            }
        });
    }
}

// Create singleton instance
export const cacheManager = new CacheManager();

// Expose to window for debugging
window.OmnexCacheManager = cacheManager;

export default CacheManager;
