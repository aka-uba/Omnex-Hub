/**
 * StyleLoader - CSS Loading State Manager
 *
 * Ensures that stylesheets are fully loaded and parsed before
 * rendering page content to prevent FOUC (Flash of Unstyled Content).
 *
 * @package OmnexDisplayHub
 * @version 1.0.0
 */

import { Logger } from './Logger.js';

class StyleLoaderClass {
    constructor() {
        this._stylesReady = false;
        this._readyPromise = null;
        this._resolveReady = null;
    }

    /**
     * Check if all stylesheets are loaded and ready
     * @returns {Promise<boolean>}
     */
    async ensureStylesLoaded() {
        // If already confirmed ready, return immediately
        if (this._stylesReady) {
            return true;
        }

        // If we're already waiting, return the existing promise
        if (this._readyPromise) {
            return this._readyPromise;
        }

        // Create a new promise to track loading state
        this._readyPromise = new Promise((resolve) => {
            this._resolveReady = resolve;
            this._checkStylesLoaded();
        });

        return this._readyPromise;
    }

    /**
     * Internal method to check if styles are loaded
     */
    _checkStylesLoaded() {
        const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
        const pendingSheets = [];

        stylesheets.forEach((link) => {
            // Skip if already loaded
            if (link.sheet) {
                return;
            }

            pendingSheets.push(
                new Promise((resolve) => {
                    // Already loaded
                    if (link.sheet) {
                        resolve();
                        return;
                    }

                    const onLoad = () => {
                        link.removeEventListener('load', onLoad);
                        link.removeEventListener('error', onError);
                        resolve();
                    };

                    const onError = () => {
                        link.removeEventListener('load', onLoad);
                        link.removeEventListener('error', onError);
                        Logger.warn('StyleLoader: Failed to load stylesheet:', link.href);
                        resolve(); // Resolve anyway to not block
                    };

                    link.addEventListener('load', onLoad);
                    link.addEventListener('error', onError);

                    // Timeout fallback (5 seconds max wait)
                    setTimeout(onLoad, 5000);
                })
            );
        });

        if (pendingSheets.length === 0) {
            // All sheets already loaded
            this._markReady();
        } else {
            Promise.all(pendingSheets).then(() => {
                this._markReady();
            });
        }
    }

    /**
     * Mark styles as ready
     */
    _markReady() {
        this._stylesReady = true;
        if (this._resolveReady) {
            this._resolveReady(true);
        }
        Logger.debug('StyleLoader: All stylesheets loaded');
    }

    /**
     * Check if document fonts are loaded (optional, for font-dependent layouts)
     * @returns {Promise<boolean>}
     */
    async ensureFontsLoaded() {
        if (document.fonts && document.fonts.ready) {
            try {
                await Promise.race([
                    document.fonts.ready,
                    new Promise(resolve => setTimeout(resolve, 3000)) // 3s timeout
                ]);
                Logger.debug('StyleLoader: Fonts loaded');
                return true;
            } catch (e) {
                Logger.warn('StyleLoader: Font loading timeout');
                return true; // Continue anyway
            }
        }
        return true;
    }

    /**
     * Ensure both styles and fonts are loaded
     * @returns {Promise<boolean>}
     */
    async ensureReady() {
        await Promise.all([
            this.ensureStylesLoaded(),
            this.ensureFontsLoaded()
        ]);
        return true;
    }

    /**
     * Check if a specific CSS class exists (useful for checking if CSS is parsed)
     * @param {string} className - CSS class to check
     * @returns {boolean}
     */
    hasClass(className) {
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules || []) {
                    if (rule.selectorText && rule.selectorText.includes('.' + className)) {
                        return true;
                    }
                }
            } catch (e) {
                // Cross-origin stylesheets may throw
                continue;
            }
        }
        return false;
    }

    /**
     * Wait for a specific CSS class to become available
     * @param {string} className - CSS class to wait for
     * @param {number} timeout - Max wait time in ms
     * @returns {Promise<boolean>}
     */
    async waitForClass(className, timeout = 5000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            if (this.hasClass(className)) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        Logger.warn(`StyleLoader: Timeout waiting for class .${className}`);
        return false;
    }

    /**
     * Force a style recalculation
     * Useful after dynamic content is added
     */
    forceReflow() {
        // Reading offsetHeight forces a reflow
        document.body.offsetHeight;
    }

    /**
     * Reset state (for testing purposes)
     */
    reset() {
        this._stylesReady = false;
        this._readyPromise = null;
        this._resolveReady = null;
    }
}

// Export singleton instance
export const StyleLoader = new StyleLoaderClass();
export default StyleLoader;
