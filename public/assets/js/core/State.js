/**
 * State - Global State Management
 *
 * @package OmnexDisplayHub
 */

import { Logger } from './Logger.js';

export class State {
    constructor() {
        this.state = {};
        this.listeners = new Map();
        this.storageKey = 'omnex_state';

        // Load persisted state
        this.loadFromStorage();
    }

    /**
     * Get state value
     */
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.state;

        for (const k of keys) {
            if (value === null || value === undefined) {
                return defaultValue;
            }
            value = value[k];
        }

        return value !== undefined ? value : defaultValue;
    }

    /**
     * Set state value
     */
    set(key, value, persist = false) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let current = this.state;

        // Navigate to parent
        for (const k of keys) {
            if (!(k in current) || typeof current[k] !== 'object') {
                current[k] = {};
            }
            current = current[k];
        }

        const oldValue = current[lastKey];
        current[lastKey] = value;

        // Persist if requested
        if (persist) {
            this.saveToStorage();
        }

        // Notify listeners
        this.notify(key, value, oldValue);

        return this;
    }

    /**
     * Update state (merge)
     */
    update(key, updates, persist = false) {
        const current = this.get(key, {});
        const newValue = { ...current, ...updates };
        return this.set(key, newValue, persist);
    }

    /**
     * Delete state key
     */
    delete(key, persist = false) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let current = this.state;

        for (const k of keys) {
            if (!(k in current)) {
                return this;
            }
            current = current[k];
        }

        const oldValue = current[lastKey];
        delete current[lastKey];

        if (persist) {
            this.saveToStorage();
        }

        this.notify(key, undefined, oldValue);

        return this;
    }

    /**
     * Clear all state
     */
    clear(persist = false) {
        this.state = {};

        if (persist) {
            localStorage.removeItem(this.storageKey);
        }

        this.notify('*', null);

        return this;
    }

    /**
     * Subscribe to state changes
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }

        this.listeners.get(key).add(callback);

        // Return unsubscribe function
        return () => {
            this.listeners.get(key).delete(callback);
        };
    }

    /**
     * Subscribe to any change (wildcard)
     */
    subscribeAll(callback) {
        return this.subscribe('*', callback);
    }

    /**
     * Notify listeners
     */
    notify(key, newValue, oldValue) {
        // Notify specific key listeners
        if (this.listeners.has(key)) {
            for (const callback of this.listeners.get(key)) {
                try {
                    callback(newValue, oldValue, key);
                } catch (e) {
                    Logger.error('State listener error:', e);
                }
            }
        }

        // Notify parent key listeners
        const parts = key.split('.');
        while (parts.length > 1) {
            parts.pop();
            const parentKey = parts.join('.');
            if (this.listeners.has(parentKey)) {
                const parentValue = this.get(parentKey);
                for (const callback of this.listeners.get(parentKey)) {
                    try {
                        callback(parentValue, null, parentKey);
                    } catch (e) {
                        Logger.error('State listener error:', e);
                    }
                }
            }
        }

        // Notify wildcard listeners
        if (this.listeners.has('*')) {
            for (const callback of this.listeners.get('*')) {
                try {
                    callback(newValue, oldValue, key);
                } catch (e) {
                    Logger.error('State listener error:', e);
                }
            }
        }
    }

    /**
     * Load state from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.state = JSON.parse(stored);
            }
        } catch (e) {
            Logger.error('Error loading state from storage:', e);
        }
    }

    /**
     * Save state to localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (e) {
            Logger.error('Error saving state to storage:', e);
        }
    }

    /**
     * Get full state (for debugging)
     */
    getAll() {
        return { ...this.state };
    }
}

export default State;
