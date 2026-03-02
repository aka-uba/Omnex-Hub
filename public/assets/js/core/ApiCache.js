/**
 * API Cache Manager
 *
 * Client-side caching for API responses with:
 * - TTL-based expiration
 * - Memory cache (Map)
 * - Optional localStorage persistence
 * - Cache invalidation patterns
 * - Request deduplication
 *
 * @package OmnexDisplayHub
 */

export class ApiCache {
    constructor(options = {}) {
        this.options = {
            defaultTTL: options.defaultTTL || 5 * 60 * 1000, // 5 minutes
            maxEntries: options.maxEntries || 100,
            useLocalStorage: options.useLocalStorage || false,
            storagePrefix: options.storagePrefix || 'omnex_cache_',
            ...options
        };

        // In-memory cache
        this.cache = new Map();

        // Pending requests (for deduplication)
        this.pending = new Map();

        // Cache statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0
        };

        // Load from localStorage if enabled
        if (this.options.useLocalStorage) {
            this._loadFromStorage();
        }
    }

    /**
     * Get cached data
     * @param {string} key - Cache key
     * @returns {any|null} Cached data or null
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Check expiration
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return entry.data;
    }

    /**
     * Set cache data
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     * @param {number} ttl - Time to live in ms (optional)
     */
    set(key, data, ttl = null) {
        // Enforce max entries
        if (this.cache.size >= this.options.maxEntries) {
            this._evictOldest();
        }

        const entry = {
            data,
            expiresAt: Date.now() + (ttl || this.options.defaultTTL),
            createdAt: Date.now()
        };

        this.cache.set(key, entry);
        this.stats.sets++;

        // Persist to localStorage if enabled
        if (this.options.useLocalStorage) {
            this._saveToStorage(key, entry);
        }
    }

    /**
     * Check if key exists and is valid
     * @param {string} key - Cache key
     * @returns {boolean}
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) return false;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete cache entry
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);

        if (this.options.useLocalStorage) {
            localStorage.removeItem(this.options.storagePrefix + key);
        }
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();

        if (this.options.useLocalStorage) {
            this._clearStorage();
        }
    }

    /**
     * Invalidate cache entries matching pattern
     * @param {string|RegExp} pattern - Pattern to match
     */
    invalidate(pattern) {
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.delete(key);
            }
        }
    }

    /**
     * Generate cache key from URL and params
     * @param {string} url - Request URL
     * @param {object} params - Request params
     * @returns {string}
     */
    static generateKey(url, params = {}) {
        const sortedParams = Object.keys(params)
            .sort()
            .map(k => `${k}=${JSON.stringify(params[k])}`)
            .join('&');

        return sortedParams ? `${url}?${sortedParams}` : url;
    }

    /**
     * Fetch with cache
     * @param {string} url - Request URL
     * @param {object} options - Fetch options
     * @returns {Promise<any>}
     */
    async fetch(url, options = {}) {
        const {
            ttl,
            forceRefresh = false,
            cacheKey = null,
            ...fetchOptions
        } = options;

        // Only cache GET requests
        const method = (fetchOptions.method || 'GET').toUpperCase();
        if (method !== 'GET') {
            return this._doFetch(url, fetchOptions);
        }

        const key = cacheKey || ApiCache.generateKey(url, fetchOptions.params);

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cached = this.get(key);
            if (cached !== null) {
                return cached;
            }
        }

        // Check if same request is pending (deduplication)
        if (this.pending.has(key)) {
            return this.pending.get(key);
        }

        // Make request
        const promise = this._doFetch(url, fetchOptions)
            .then(data => {
                this.set(key, data, ttl);
                this.pending.delete(key);
                return data;
            })
            .catch(err => {
                this.pending.delete(key);
                throw err;
            });

        this.pending.set(key, promise);
        return promise;
    }

    /**
     * Perform actual fetch
     * @private
     */
    async _doFetch(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    }

    /**
     * Evict oldest cache entry
     * @private
     */
    _evictOldest() {
        let oldestKey = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.createdAt < oldestTime) {
                oldestTime = entry.createdAt;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.delete(oldestKey);
        }
    }

    /**
     * Load cache from localStorage
     * @private
     */
    _loadFromStorage() {
        try {
            const prefix = this.options.storagePrefix;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    const cacheKey = key.slice(prefix.length);
                    const entry = JSON.parse(localStorage.getItem(key));

                    // Only load if not expired
                    if (entry && Date.now() < entry.expiresAt) {
                        this.cache.set(cacheKey, entry);
                    } else {
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to load cache from localStorage:', e);
        }
    }

    /**
     * Save entry to localStorage
     * @private
     */
    _saveToStorage(key, entry) {
        try {
            localStorage.setItem(
                this.options.storagePrefix + key,
                JSON.stringify(entry)
            );
        } catch (e) {
            // localStorage might be full or disabled
            console.warn('Failed to save to localStorage:', e);
        }
    }

    /**
     * Clear all storage entries
     * @private
     */
    _clearStorage() {
        const prefix = this.options.storagePrefix;
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    /**
     * Get cache statistics
     * @returns {object}
     */
    getStats() {
        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
        };
    }
}

// Singleton instance for global use
let globalCache = null;

/**
 * Get global cache instance
 * @param {object} options - Cache options
 * @returns {ApiCache}
 */
export function getApiCache(options = {}) {
    if (!globalCache) {
        globalCache = new ApiCache(options);
    }
    return globalCache;
}

// TTL presets
export const CacheTTL = {
    NONE: 0,
    SHORT: 30 * 1000,        // 30 seconds
    MEDIUM: 5 * 60 * 1000,   // 5 minutes
    LONG: 30 * 60 * 1000,    // 30 minutes
    HOUR: 60 * 60 * 1000,    // 1 hour
    DAY: 24 * 60 * 60 * 1000 // 24 hours
};

export default ApiCache;
