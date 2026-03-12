/**
 * Logger - Controlled logging utility
 *
 * By default, all logging is suppressed. To enable debug logs:
 * - Set window.OmnexConfig.debug = true in config
 * - Or add ?debug=true to URL
 * @package OmnexDisplayHub
 */

const isDebugEnabled = () => {
    // Check if debug mode is explicitly enabled
    const urlParams = new URLSearchParams(window.location.search);
    return window.OmnexConfig?.debug === true || urlParams.get('debug') === 'true';
};

const Logger = {
    /**
     * Log a debug message (only when debug enabled)
     */
    debug(...args) {
        if (isDebugEnabled()) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Log an info message (only when debug enabled)
     */
    log(...args) {
        if (isDebugEnabled()) {
            console.log(...args);
        }
    },

    /**
     * Log a warning message (only when debug enabled)
     */
    warn(...args) {
        if (isDebugEnabled()) {
            console.warn(...args);
        }
    },

    /**
     * Log a warning message (compat alias)
     */
    warning(...args) {
        this.warn(...args);
    },

    /**
     * Log an error message (always shown - errors are important)
     */
    error(...args) {
        console.error(...args);
    },

    /**
     * Log an info message (alias for log)
     */
    info(...args) {
        this.log(...args);
    }
};

export default Logger;
export { Logger };
