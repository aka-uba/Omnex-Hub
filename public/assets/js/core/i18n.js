/**
 * i18n - Internationalization
 *
 * @package OmnexDisplayHub
 */

import { Logger } from './Logger.js';

export class i18n {
    constructor() {
        this.locale = 'tr';
        this.translations = {};
        this.pageTranslations = {};
        this.currentPage = null;
        this.fallback = 'en';
        this.storageKey = window.OmnexConfig?.storageKeys?.language || 'omnex_language';
        this.rtlLanguages = window.OmnexConfig?.rtlLanguages || ['ar'];
        this.availableLocales = ['tr', 'en', 'ru', 'az', 'de', 'nl', 'fr', 'ar'];

        // Load stored locale
        const stored = localStorage.getItem(this.storageKey);
        if (stored && this.availableLocales.includes(stored)) {
            this.locale = stored;
        }
    }

    /**
     * Get available locales
     * @returns {Array} List of available locale codes
     */
    getAvailableLocales() {
        return this.availableLocales;
    }

    /**
     * Get locale info with names
     * @returns {Array} List of locale objects with code and name
     */
    getLocaleList() {
        const localeNames = {
            tr: 'Turkce',
            en: 'English',
            ru: 'Russkiy',
            az: 'Azerbaycanca',
            de: 'Deutsch',
            nl: 'Nederlands',
            fr: 'Francais',
            ar: 'Arabic'
        };

        return this.availableLocales.map(code => ({
            code,
            name: localeNames[code] || code
        }));
    }

    /**
     * Load common translations for locale
     */
    async load(locale) {
        this.locale = locale;
        localStorage.setItem(this.storageKey, locale);

        try {
            const basePath = window.OmnexConfig?.basePath || '';
            const version = window.OmnexConfig?.appVersion || window.app?.version || '';
            const isDev = window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1' ||
                          window.location.hostname.startsWith('192.168.');
            const cacheBuster = isDev ? `?t=${Date.now()}` : (version ? `?v=${version}` : '');
            const response = await fetch(`${basePath}/locales/${locale}/common.json${cacheBuster}`);

            if (response.ok) {
                this.translations[locale] = await response.json();
            } else {
                Logger.warn(`Common translations not found for locale: ${locale}`);
            }
        } catch (e) {
            Logger.error('Error loading common translations:', e);
        }

        // Update document direction
        this.updateDirection();

        return this;
    }

    /**
     * Load page-specific translations
     * @param {string} pageName - Name of the page (e.g., 'products', 'devices')
     */
    async loadPageTranslations(pageName) {
        if (!pageName) {
            Logger.warn('Page name is required for loadPageTranslations');
            return this;
        }

        this.currentPage = pageName;

        // Initialize page translations structure if not exists
        if (!this.pageTranslations[this.locale]) {
            this.pageTranslations[this.locale] = {};
        }

        // In development mode, always reload translations to get latest changes
        const isDev = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.startsWith('192.168.');
        const version = window.OmnexConfig?.appVersion || window.app?.version || '';
        const cacheBuster = isDev ? `?t=${Date.now()}` : (version ? `?v=${version}` : '');

        // Skip if already loaded (only in production)
        if (!isDev && this.pageTranslations[this.locale][pageName]) {
            Logger.debug(`Page translations already loaded: ${pageName}`);
            return this;
        }

        try {
            const basePath = window.OmnexConfig?.basePath || '';
            const response = await fetch(
                `${basePath}/locales/${this.locale}/pages/${pageName}.json${cacheBuster}`,
                { cache: 'no-store' }
            );

            if (response.ok) {
                this.pageTranslations[this.locale][pageName] = await response.json();
                Logger.debug(`Page translations loaded: ${pageName} (${this.locale})`);
            } else {
                Logger.debug(`Page translations not found: ${pageName} (${this.locale})`);
                this.pageTranslations[this.locale][pageName] = {};
            }
        } catch (e) {
            Logger.debug(`Error loading page translations for ${pageName}:`, e);
            this.pageTranslations[this.locale][pageName] = {};
        }

        // Also load fallback locale page translations if different
        if (this.locale !== this.fallback) {
            if (!this.pageTranslations[this.fallback]) {
                this.pageTranslations[this.fallback] = {};
            }

            if (!this.pageTranslations[this.fallback][pageName]) {
                try {
                    const basePath = window.OmnexConfig?.basePath || '';
                    const response = await fetch(
                        `${basePath}/locales/${this.fallback}/pages/${pageName}.json${cacheBuster}`,
                        { cache: 'no-store' }
                    );

                    if (response.ok) {
                        this.pageTranslations[this.fallback][pageName] = await response.json();
                    } else {
                        this.pageTranslations[this.fallback][pageName] = {};
                    }
                } catch (e) {
                    this.pageTranslations[this.fallback][pageName] = {};
                }
            }
        }

        return this;
    }

    /**
     * Clear page translations (call when leaving a page)
     */
    clearPageTranslations() {
        this.currentPage = null;
    }

    /**
     * Get translation - checks page translations first, then common
     * @param {string} key - Translation key (dot notation supported)
     * @param {Object} params - Parameters for interpolation
     */
    t(key, params = {}) {
        const keys = key.split('.');
        let value;

        // 1. Try current page translations (current locale)
        if (this.currentPage && this.pageTranslations[this.locale]?.[this.currentPage]) {
            value = this.getNestedValue(this.pageTranslations[this.locale][this.currentPage], keys);
        }

        // 2. Try ALL loaded page translations (current locale) - for components that use multiple page translations
        if (value === undefined && this.pageTranslations[this.locale]) {
            for (const pageName of Object.keys(this.pageTranslations[this.locale])) {
                if (pageName !== this.currentPage) {
                    value = this.getNestedValue(this.pageTranslations[this.locale][pageName], keys);
                    if (value !== undefined) break;
                }
            }
        }

        // 3. Try current page translations (fallback locale)
        if (value === undefined && this.currentPage && this.locale !== this.fallback) {
            if (this.pageTranslations[this.fallback]?.[this.currentPage]) {
                value = this.getNestedValue(this.pageTranslations[this.fallback][this.currentPage], keys);
            }
        }

        // 4. Try ALL loaded page translations (fallback locale)
        if (value === undefined && this.locale !== this.fallback && this.pageTranslations[this.fallback]) {
            for (const pageName of Object.keys(this.pageTranslations[this.fallback])) {
                value = this.getNestedValue(this.pageTranslations[this.fallback][pageName], keys);
                if (value !== undefined) break;
            }
        }

        // 5. Try common translations (current locale)
        if (value === undefined && this.translations[this.locale]) {
            value = this.getNestedValue(this.translations[this.locale], keys);
        }

        // 6. Try common translations (fallback locale)
        if (value === undefined && this.locale !== this.fallback && this.translations[this.fallback]) {
            value = this.getNestedValue(this.translations[this.fallback], keys);
        }

        // Return key if not found
        if (value === undefined) {
            return key;
        }

        // Replace parameters
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            for (const [param, val] of Object.entries(params)) {
                // Escape special regex characters in param name
                const escapedParam = String(param).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                value = value.replace(new RegExp(`\\{${escapedParam}\\}`, 'g'), val);
            }
        }

        return value;
    }

    /**
     * Get nested value from object using key array
     * @private
     */
    getNestedValue(obj, keys) {
        let value = obj;
        for (const k of keys) {
            if (value === null || value === undefined) return undefined;
            value = value[k];
        }
        // Only return leaf values (string, number, boolean).
        // Returning intermediate objects would falsely match partial key paths
        // and prevent fallthrough to common translations.
        if (value !== null && value !== undefined && typeof value === 'object') {
            return undefined;
        }
        return value;
    }

    /**
     * Get translation from page only (without fallback to common)
     * @param {string} key - Translation key
     * @param {Object} params - Parameters for interpolation
     */
    tp(key, params = {}) {
        if (!this.currentPage) {
            return key;
        }

        const keys = key.split('.');
        let value;

        // Try current locale page translations
        if (this.pageTranslations[this.locale]?.[this.currentPage]) {
            value = this.getNestedValue(this.pageTranslations[this.locale][this.currentPage], keys);
        }

        // Try fallback locale page translations
        if (value === undefined && this.locale !== this.fallback) {
            if (this.pageTranslations[this.fallback]?.[this.currentPage]) {
                value = this.getNestedValue(this.pageTranslations[this.fallback][this.currentPage], keys);
            }
        }

        if (value === undefined) {
            return key;
        }

        // Replace parameters
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            for (const [param, val] of Object.entries(params)) {
                // Escape special regex characters in param name
                const escapedParam = String(param).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                value = value.replace(new RegExp(`\\{${escapedParam}\\}`, 'g'), val);
            }
        }

        return value;
    }

    /**
     * Get translation from common translations only (skips page translations).
     * Use for keys that are always in common.json (e.g. mediaLibrary.folders.*).
     * @param {string} key - Translation key (dot notation)
     * @param {Object} params - Parameters for interpolation
     */
    tc(key, params = {}) {
        const keys = key.split('.');
        let value;

        // Try common translations (current locale)
        if (this.translations[this.locale]) {
            value = this.getNestedValue(this.translations[this.locale], keys);
        }

        // Try common translations (fallback locale)
        if (value === undefined && this.locale !== this.fallback && this.translations[this.fallback]) {
            value = this.getNestedValue(this.translations[this.fallback], keys);
        }

        // Return key if not found
        if (value === undefined) {
            return key;
        }

        // Replace parameters
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            for (const [param, val] of Object.entries(params)) {
                const escapedParam = String(param).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                value = value.replace(new RegExp(`\\{${escapedParam}\\}`, 'g'), val);
            }
        }

        return value;
    }

    /**
     * Check if translation exists
     * @param {string} key - Translation key
     */
    has(key) {
        const translated = this.t(key);
        return translated !== key;
    }

    /**
     * Get current locale
     */
    getLocale() {
        return this.locale;
    }

    /**
     * Set locale and reload translations
     */
    async setLocale(locale) {
        if (!this.availableLocales.includes(locale)) {
            Logger.warn(`Locale not available: ${locale}`);
            return this;
        }

        if (locale !== this.locale) {
            const previousPage = this.currentPage;

            // Load common translations
            await this.load(locale);

            // Reload page translations if a page was active
            if (previousPage) {
                // Clear old page translations for new locale
                if (this.pageTranslations[locale]) {
                    delete this.pageTranslations[locale][previousPage];
                }
                await this.loadPageTranslations(previousPage);
            }
        }
        return this;
    }

    /**
     * Check if current locale is RTL
     */
    isRtl() {
        return this.rtlLanguages.includes(this.locale);
    }

    /**
     * Get direction
     */
    getDirection() {
        return this.isRtl() ? 'rtl' : 'ltr';
    }

    /**
     * Update document direction
     */
    updateDirection() {
        const dir = this.getDirection();
        document.documentElement.dir = dir;
        document.documentElement.lang = this.locale;
    }

    /**
     * Preload other language translations in idle time
     * This is called after initial load to cache other languages for faster switching
     */
    preloadOtherLanguages() {
        // Get locales to preload (all except current)
        const localesToPreload = this.availableLocales.filter(l => l !== this.locale);

        if (localesToPreload.length === 0) return;

        const preloadLocale = async (locale) => {
            // Skip if already loaded
            if (this.translations[locale]) return;

            try {
                const basePath = window.OmnexConfig?.basePath || '';
                const version = window.OmnexConfig?.appVersion || window.app?.version || '';
                const isDev = window.location.hostname === 'localhost' ||
                              window.location.hostname === '127.0.0.1' ||
                              window.location.hostname.startsWith('192.168.');
                const cacheBuster = isDev ? `?t=${Date.now()}` : (version ? `?v=${version}` : '');
                const response = await fetch(`${basePath}/locales/${locale}/common.json${cacheBuster}`);

                if (response.ok) {
                    this.translations[locale] = await response.json();
                    Logger.debug(`Preloaded translations for: ${locale}`);
                }
            } catch (e) {
                // Silent fail for preloading
                Logger.debug(`Failed to preload translations for: ${locale}`);
            }
        };

        // Use requestIdleCallback if available, otherwise use setTimeout
        if ('requestIdleCallback' in window) {
            // Preload one by one during idle time
            let index = 0;

            const preloadNext = (deadline) => {
                // Check if we have time remaining and more locales to load
                while (deadline.timeRemaining() > 10 && index < localesToPreload.length) {
                    preloadLocale(localesToPreload[index]);
                    index++;
                }

                // Schedule more work if needed
                if (index < localesToPreload.length) {
                    window.requestIdleCallback(preloadNext, { timeout: 5000 });
                }
            };

            window.requestIdleCallback(preloadNext, { timeout: 5000 });
        } else {
            // Fallback: preload after a delay
            setTimeout(() => {
                localesToPreload.forEach((locale, i) => {
                    setTimeout(() => preloadLocale(locale), i * 500);
                });
            }, 2000);
        }
    }

    /**
     * Format number
     */
    formatNumber(value, options = {}) {
        const defaults = {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        };

        return new Intl.NumberFormat(this.locale, { ...defaults, ...options }).format(value);
    }

    /**
     * Get current currency from settings or default
     * @returns {string} Currency code (TRY, USD, EUR, etc.)
     */
    getCurrency() {
        // Try to get from app state first
        const appCurrency = window.app?.state?.get('settings')?.currency;
        if (appCurrency) return appCurrency;

        // Try localStorage
        const storedSettings = localStorage.getItem('omnex_settings');
        if (storedSettings) {
            try {
                const settings = JSON.parse(storedSettings);
                if (settings.currency) return settings.currency;
            } catch (e) {}
        }

        return 'TRY'; // Default
    }

    /**
     * Get currency symbol
     * @param {string} currency - Currency code
     * @returns {string} Currency symbol
     */
    getCurrencySymbol(currency = null) {
        const curr = currency || this.getCurrency();
        const symbols = {
            'TRY': '₺',
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'RUB': '₽',
            'AZN': '₼'
        };
        return symbols[curr] || curr;
    }

    /**
     * Format currency
     * @param {number} value - Value to format
     * @param {string} currency - Currency code (optional, uses settings if not provided)
     * @returns {string} Formatted currency string
     */
    formatCurrency(value, currency = null) {
        const curr = currency || this.getCurrency();
        return new Intl.NumberFormat(this.locale, {
            style: 'currency',
            currency: curr
        }).format(value);
    }

    /**
     * Format price with simple symbol (e.g., "29.99 ₺")
     * @param {number} value - Value to format
     * @param {string} currency - Currency code (optional)
     * @returns {string} Formatted price string
     */
    formatPrice(value, currency = null) {
        if (value === null || value === undefined || value === '') return '-';
        const curr = currency || this.getCurrency();
        const symbol = this.getCurrencySymbol(curr);
        const num = parseFloat(value);
        if (isNaN(num)) return '-';
        return `${num.toFixed(2)} ${symbol}`;
    }

    /**
     * Format date
     */
    formatDate(date, options = {}) {
        const d = date instanceof Date ? date : new Date(date);

        const defaults = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        };

        return new Intl.DateTimeFormat(this.locale, { ...defaults, ...options }).format(d);
    }

    /**
     * Format time
     */
    formatTime(date, options = {}) {
        const d = date instanceof Date ? date : new Date(date);

        const defaults = {
            hour: '2-digit',
            minute: '2-digit'
        };

        return new Intl.DateTimeFormat(this.locale, { ...defaults, ...options }).format(d);
    }

    /**
     * Format datetime
     */
    formatDateTime(date, options = {}) {
        const d = date instanceof Date ? date : new Date(date);

        const defaults = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };

        return new Intl.DateTimeFormat(this.locale, { ...defaults, ...options }).format(d);
    }

    /**
     * Format relative time
     */
    formatRelativeTime(date) {
        const d = date instanceof Date ? date : new Date(date);
        const now = new Date();
        const diff = now - d;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        const rtf = new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' });

        if (years > 0) return rtf.format(-years, 'year');
        if (months > 0) return rtf.format(-months, 'month');
        if (days > 0) return rtf.format(-days, 'day');
        if (hours > 0) return rtf.format(-hours, 'hour');
        if (minutes > 0) return rtf.format(-minutes, 'minute');
        return rtf.format(-seconds, 'second');
    }
}

// Global helper function with fallback support
// Usage: __('table.filters') or __('table.filters', 'Filtreler') or __('key', { param: 'value' })
window.__ = (key, paramsOrFallback = {}) => {
    const i18n = window.app?.i18n;

    // If second param is a string, treat it as fallback
    if (typeof paramsOrFallback === 'string') {
        const result = i18n ? i18n.t(key) : key;
        // Return fallback if translation equals key (not found)
        return result === key ? paramsOrFallback : result;
    }

    // Otherwise treat as params object
    return i18n ? i18n.t(key, paramsOrFallback) : key;
};

export default i18n;
