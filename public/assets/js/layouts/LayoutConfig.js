/**
 * LayoutConfig.js - Configuration Types and Defaults
 * Omnex Display Hub Layout System V2
 *
 * Port from TypeScript layout-system-v2
 */

import { Logger } from '../core/Logger.js';

// =============================================================================
// TYPE CONSTANTS (Enum-like objects)
// =============================================================================

export const LayoutType = Object.freeze({
    SIDEBAR: 'sidebar',
    TOP: 'top',
    MOBILE: 'mobile'
});

export const ThemeMode = Object.freeze({
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
});

export const Direction = Object.freeze({
    LTR: 'ltr',
    RTL: 'rtl'
});

export const BackgroundType = Object.freeze({
    LIGHT: 'light',
    DARK: 'dark',
    BRAND: 'brand',
    GRADIENT: 'gradient',
    CUSTOM: 'custom'
});

export const MenuColor = Object.freeze({
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto',
    CUSTOM: 'custom'
});

export const SidebarPosition = Object.freeze({
    LEFT: 'left',
    RIGHT: 'right'
});

export const TopBarScroll = Object.freeze({
    FIXED: 'fixed',
    HIDDEN: 'hidden',
    HIDDEN_ON_HOVER: 'hidden-on-hover'
});

export const LayoutSource = Object.freeze({
    ROLE: 'role',
    USER: 'user',
    COMPANY: 'company',
    DEFAULT: 'default'
});

// =============================================================================
// STORAGE KEYS
// =============================================================================

export const STORAGE_KEYS = Object.freeze({
    layoutConfig: 'omnex-layout-config-v2',
    configTimestamp: 'omnex-layout-config-timestamp',
    companyDefaults: 'omnex-company-defaults',
    // Legacy keys for migration
    legacyConfig: 'omnex_layout_config',
    legacyTheme: 'omnex_theme'
});

// =============================================================================
// COLOR PALETTE
// =============================================================================

export const COLOR_PALETTE = Object.freeze([
    '#228be6', // Primary blue
    '#40c057', // Green
    '#fab005', // Yellow
    '#fd7e14', // Orange
    '#fa5252', // Red
    '#be4bdb', // Purple
    '#7950f2', // Violet
    '#15aabf', // Cyan
    '#82c91e', // Lime
    '#e64980', // Pink
    '#495057', // Gray
    '#212529', // Dark
    '#1864ab', // Dark blue
    '#2b8a3e', // Dark green
    '#e67700', // Dark orange
    '#c92a2a', // Dark red
    '#862e9c', // Dark purple
    '#5f3dc4'  // Dark violet
]);

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

export const DEFAULT_BORDER_CONFIG = Object.freeze({
    enabled: false,
    width: 1,
    color: '#dee2e6'
});

export const DEFAULT_SIDEBAR_CONFIG = Object.freeze({
    background: BackgroundType.LIGHT,
    customColor: null,
    width: 260,
    minWidth: 200,
    maxWidth: 320,
    collapsed: false,
    collapsedWidth: 64,
    menuColor: MenuColor.AUTO,
    customMenuColor: null,
    logoPosition: 'top',
    logoSize: 'medium',
    hoverEffects: true,
    border: { ...DEFAULT_BORDER_CONFIG },
    position: SidebarPosition.LEFT
});

export const DEFAULT_TOP_CONFIG = Object.freeze({
    background: BackgroundType.LIGHT,
    customColor: null,
    height: 64,
    minHeight: 48,
    maxHeight: 96,
    scrollBehavior: TopBarScroll.FIXED,
    sticky: true,
    menuColor: MenuColor.AUTO,
    customMenuColor: null,
    logoPosition: 'left',
    logoSize: 'medium',
    border: { ...DEFAULT_BORDER_CONFIG }
});

export const DEFAULT_MOBILE_CONFIG = Object.freeze({
    headerHeight: 56,
    iconSize: 24,
    menuAnimation: 'slide',
    bottomBarVisible: false,
    iconSpacing: 8
});

export const DEFAULT_CONTENT_AREA_CONFIG = Object.freeze({
    width: {
        value: 100,
        unit: '%',
        min: 320,
        max: 1920
    },
    padding: {
        top: 24,
        right: 24,
        bottom: 24,
        left: 24
    },
    margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    },
    responsive: {
        mobile: {
            padding: { top: 16, right: 16, bottom: 16, left: 16 }
        },
        tablet: {
            padding: { top: 20, right: 20, bottom: 20, left: 20 }
        }
    }
});

export const DEFAULT_LAYOUT_CONFIG = Object.freeze({
    layoutType: LayoutType.SIDEBAR,
    themeMode: ThemeMode.LIGHT,
    direction: Direction.LTR,
    footerVisible: true,
    sidebar: { ...DEFAULT_SIDEBAR_CONFIG },
    top: { ...DEFAULT_TOP_CONFIG },
    mobile: { ...DEFAULT_MOBILE_CONFIG },
    contentArea: { ...DEFAULT_CONTENT_AREA_CONFIG },
    layoutSource: LayoutSource.DEFAULT
});

// =============================================================================
// BREAKPOINTS
// =============================================================================

export const BREAKPOINTS = Object.freeze({
    mobile: 768,
    tablet: 1024,
    desktop: 1025
});

export const MEDIA_QUERIES = Object.freeze({
    mobile: '(max-width: 768px)',
    tablet: '(min-width: 769px) and (max-width: 1024px)',
    desktop: '(min-width: 1025px)'
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Deep merge two objects
 * @param {Object} target - Base object
 * @param {Object} source - Object with updates
 * @returns {Object} Merged object
 */
export function deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
        if (source[key] !== undefined) {
            if (
                source[key] !== null &&
                typeof source[key] === 'object' &&
                !Array.isArray(source[key]) &&
                target[key] !== null &&
                typeof target[key] === 'object' &&
                !Array.isArray(target[key])
            ) {
                result[key] = deepMerge(target[key], source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }

    return result;
}

/**
 * Merge config with defaults
 * @param {Object} config - Partial config
 * @returns {Object} Complete config with defaults
 */
export function mergeWithDefaults(config) {
    return deepMerge(DEFAULT_LAYOUT_CONFIG, config || {});
}

/**
 * Get background color from type
 * @param {string} type - BackgroundType value
 * @param {string|null} customColor - Custom color if type is 'custom'
 * @returns {string} CSS color value
 */
export function getBackgroundColor(type, customColor = null) {
    switch (type) {
        case BackgroundType.LIGHT:
            return '#ffffff';
        case BackgroundType.DARK:
            return '#1f2937';
        case BackgroundType.BRAND:
            return '#228be6';
        case BackgroundType.GRADIENT:
            return 'linear-gradient(135deg, #228be6 0%, #1864ab 100%)';
        case BackgroundType.CUSTOM:
            return customColor || '#ffffff';
        default:
            return '#ffffff';
    }
}

/**
 * Load config from localStorage
 * @returns {Object|null} Saved config or null
 */
export function loadFromLocalStorage() {
    try {
        let config = null;

        const saved = localStorage.getItem(STORAGE_KEYS.layoutConfig);
        if (saved) {
            config = JSON.parse(saved);
        } else {
            // Try legacy config key
            const legacy = localStorage.getItem(STORAGE_KEYS.legacyConfig);
            if (legacy) {
                const legacyConfig = JSON.parse(legacy);
                // Migrate legacy config
                config = migrateLegacyConfig(legacyConfig);
            }
        }

        // Note: Legacy theme key (omnex_theme) is no longer used for overriding
        // AuthToolbar now writes directly to omnex-layout-config-v2
        // This prevents the old theme from overriding user's new selection

        return config;
    } catch (e) {
        Logger.error('Failed to load layout config from localStorage:', e);
        return null;
    }
}

/**
 * Save config to localStorage
 * @param {Object} config - Config to save
 */
export function saveToLocalStorage(config) {
    try {
        localStorage.setItem(STORAGE_KEYS.layoutConfig, JSON.stringify(config));
        localStorage.setItem(STORAGE_KEYS.configTimestamp, Date.now().toString());
    } catch (e) {
        Logger.error('Failed to save layout config to localStorage:', e);
    }
}

/**
 * Get company defaults from localStorage
 * @returns {Object|null} Company defaults or null
 */
export function getCompanyDefaults() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.companyDefaults);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        Logger.error('Failed to load company defaults:', e);
        return null;
    }
}

/**
 * Set company defaults in localStorage
 * @param {Object} config - Config to set as company default
 */
export function setCompanyDefaults(config) {
    try {
        localStorage.setItem(STORAGE_KEYS.companyDefaults, JSON.stringify(config));
    } catch (e) {
        Logger.error('Failed to save company defaults:', e);
    }
}

/**
 * Migrate legacy config format to v2
 * @param {Object} legacyConfig - Old config format
 * @returns {Object} New config format
 */
export function migrateLegacyConfig(legacyConfig) {
    return {
        layoutType: legacyConfig.layoutType || LayoutType.SIDEBAR,
        themeMode: legacyConfig.themeMode || ThemeMode.LIGHT,
        direction: legacyConfig.direction || Direction.LTR,
        footerVisible: true,
        sidebar: {
            ...DEFAULT_SIDEBAR_CONFIG,
            width: legacyConfig.sidebar?.width || 260,
            collapsed: legacyConfig.sidebar?.collapsed || false,
            position: legacyConfig.sidebar?.position || SidebarPosition.LEFT,
            background: legacyConfig.sidebar?.backgroundColor ? BackgroundType.CUSTOM : BackgroundType.LIGHT,
            customColor: legacyConfig.sidebar?.backgroundColor || null
        },
        top: {
            ...DEFAULT_TOP_CONFIG,
            height: legacyConfig.header?.height || 64,
            background: legacyConfig.header?.backgroundColor ? BackgroundType.CUSTOM : BackgroundType.LIGHT,
            customColor: legacyConfig.header?.backgroundColor || null
        },
        mobile: { ...DEFAULT_MOBILE_CONFIG },
        contentArea: {
            ...DEFAULT_CONTENT_AREA_CONFIG,
            width: {
                value: legacyConfig.content?.maxWidth || 1400,
                unit: 'px',
                min: 320,
                max: 1920
            },
            padding: {
                top: legacyConfig.content?.padding || 24,
                right: legacyConfig.content?.padding || 24,
                bottom: legacyConfig.content?.padding || 24,
                left: legacyConfig.content?.padding || 24
            }
        },
        layoutSource: LayoutSource.USER
    };
}

/**
 * Validate config structure
 * @param {Object} config - Config to validate
 * @returns {boolean} True if valid
 */
export function validateConfig(config) {
    if (!config || typeof config !== 'object') return false;

    // Check required fields
    if (!Object.values(LayoutType).includes(config.layoutType)) return false;
    if (!Object.values(ThemeMode).includes(config.themeMode)) return false;
    if (!Object.values(Direction).includes(config.direction)) return false;

    return true;
}

/**
 * Get current system theme preference
 * @returns {string} 'light' or 'dark'
 */
export function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return ThemeMode.DARK;
    }
    return ThemeMode.LIGHT;
}

/**
 * Resolve auto theme to actual theme
 * @param {string} themeMode - Theme mode setting
 * @returns {string} Resolved theme ('light' or 'dark')
 */
export function resolveTheme(themeMode) {
    if (themeMode === ThemeMode.AUTO) {
        return getSystemTheme();
    }
    return themeMode;
}

/**
 * Create debounced function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
