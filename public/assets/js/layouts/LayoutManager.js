/**
 * LayoutManager - Layout System Controller V2
 *
 * @package OmnexDisplayHub
 */

import { ColorUtils } from './ColorUtils.js';
import {
    LayoutType,
    ThemeMode,
    BackgroundType,
    SidebarPosition,
    DEFAULT_LAYOUT_CONFIG,
    STORAGE_KEYS,
    deepMerge,
    loadFromLocalStorage,
    saveToLocalStorage,
    getBackgroundColor,
    resolveTheme,
    debounce
} from './LayoutConfig.js';
import { Logger } from '../core/Logger.js';
import { cacheManager } from '../core/CacheManager.js';
import { CompanySelector } from '../components/CompanySelector.js';
import { LanguageSelector } from '../components/LanguageSelector.js';
import { BranchSelector } from '../components/BranchSelector.js';
import { NotificationManager } from '../core/NotificationManager.js';
import { NotificationDropdown } from '../components/NotificationDropdown.js';

export class LayoutManager {
    constructor(app) {
        this.app = app;
        this.config = this.loadConfig();
        this.isLayoutVisible = false;
        this.isSidebarCollapsed = this.config.sidebar?.collapsed || false;
        this.isMobileMenuOpen = false;
        this.configurator = null;
        this.companySelector = null;
        this.languageSelector = null;
        this.branchSelector = null;
        this.notificationManager = null;
        this.notificationDropdown = null;

        // Debounced API sync
        this.debouncedApiSync = debounce(this.syncToApi.bind(this), 2000);
    }

    /**
     * i18n helper
     */
    __(key, params = {}) {
        return this.app?.i18n?.t(key, params) || key;
    }

    /**
     * Initialize layout
     */
    async init() {
        this.applyTheme();
        this.applyDirection();
        this.applyLayoutStyles();
        this.setupEventListeners();
        this.setupMediaQueries();

        // Initialize CompanySelector
        await this.initCompanySelector();

        // Initialize LanguageSelector
        await this.initLanguageSelector();

        // Initialize BranchSelector
        await this.initBranchSelector();

        // Initialize notification system
        await this.initNotificationSystem();

        // Initialize ThemeConfigurator (lazy load)
        this.initConfigurator();
    }

    /**
     * Initialize notification system
     * Only initializes if user is authenticated
     */
    async initNotificationSystem() {
        // Skip initialization if user is not authenticated
        if (!this.app.auth?.isAuthenticated()) {
            Logger.debug('NotificationSystem skipped - user not authenticated');
            return;
        }

        try {
            this.notificationManager = new NotificationManager(this.app);
            this.notificationDropdown = new NotificationDropdown(this.app, this.notificationManager);
            await this.notificationManager.init();
            await this.notificationDropdown.init();
            Logger.debug('NotificationSystem initialized');
        } catch (e) {
            Logger.warn('NotificationSystem init failed:', e);
        }
    }

    /**
     * Initialize company selector for SuperAdmin
     */
    async initCompanySelector() {
        this.companySelector = new CompanySelector(this.app);
        await this.companySelector.init();
    }

    /**
     * Initialize language selector
     */
    async initLanguageSelector() {
        this.languageSelector = new LanguageSelector(this.app);
        await this.languageSelector.init();
    }

    /**
     * Initialize branch selector for authenticated users
     */
    async initBranchSelector() {
        // Skip if user is not authenticated
        if (!this.app.auth?.isAuthenticated()) {
            Logger.debug('BranchSelector skipped - user not authenticated');
            return;
        }

        try {
            this.branchSelector = new BranchSelector(this.app);
            await this.branchSelector.init();
            Logger.debug('BranchSelector initialized');
        } catch (e) {
            Logger.warn('BranchSelector init failed:', e);
        }
    }

    /**
     * Initialize theme configurator
     */
    async initConfigurator() {
        try {
            const { ThemeConfigurator } = await import('./ThemeConfigurator.js');
            this.configurator = new ThemeConfigurator(this.app);
            this.configurator.init();
        } catch (e) {
            Logger.error('Failed to load ThemeConfigurator:', e);
        }
    }

    /**
     * Load config from localStorage with migration support
     * Note: This only loads from localStorage initially.
     * API config (with company defaults) is loaded after authentication via loadFromApi()
     */
    loadConfig() {
        const saved = loadFromLocalStorage();
        if (saved) {
            return deepMerge(DEFAULT_LAYOUT_CONFIG, saved);
        }
        return { ...DEFAULT_LAYOUT_CONFIG };
    }

    /**
     * Load config from API (called after authentication)
     * Priority: user config > company default > system default
     * This ensures company defaults are applied even in new browsers
     * @param {boolean} preserveLocalTheme - If true, preserves locally selected theme (used after login)
     */
    async loadConfigFromApiWithPriority(preserveLocalTheme = true) {
        try {
            // Get the theme that user selected on login page BEFORE loading API config
            // This is only used when preserveLocalTheme is true (after login from auth pages)
            let preservedTheme = null;
            if (preserveLocalTheme) {
                const currentLocalConfig = loadFromLocalStorage();
                preservedTheme = currentLocalConfig?.themeMode;
                Logger.debug('Local theme to preserve:', preservedTheme);
            }

            const response = await this.app.api.get('/layout/config');
            if (response.success && response.data?.config) {
                // API returns the correct config based on priority (user > company > default)
                const apiConfig = response.data.config;
                const source = response.data.source; // 'user', 'company', or 'default'

                Logger.debug('Layout config loaded from API:', { source, config: apiConfig });

                // Merge with defaults and apply
                this.config = deepMerge(DEFAULT_LAYOUT_CONFIG, apiConfig);

                // If preserveLocalTheme is true AND user had selected a theme on login page,
                // use that theme instead of API's theme
                // This ensures theme changes made on login/register pages persist after login
                if (preserveLocalTheme && preservedTheme && (preservedTheme === 'dark' || preservedTheme === 'light')) {
                    // Only override if different from API theme
                    if (this.config.themeMode !== preservedTheme) {
                        Logger.debug('Overriding API theme with local theme:', preservedTheme);
                        this.config.themeMode = preservedTheme;
                    }
                }

                // Save to localStorage for offline access
                this.saveConfig();

                // Apply all visual changes
                this.applyTheme();
                this.applyDirection();
                this.applyLayoutStyles();

                // If layout is already visible, refresh it
                if (this.isLayoutVisible) {
                    await this.refreshLayout();
                }

                return { config: this.config, source };
            }
        } catch (error) {
            Logger.error('Failed to load layout config from API:', error);
        }
        return null;
    }

    /**
     * Save config to localStorage
     */
    saveConfig() {
        saveToLocalStorage(this.config);
    }

    /**
     * Get config value by dot notation
     */
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.config;

        for (const k of keys) {
            if (value === null || value === undefined) return defaultValue;
            value = value[k];
        }

        return value !== undefined ? value : defaultValue;
    }

    /**
     * Set config value by dot notation
     */
    set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let current = this.config;

        for (const k of keys) {
            if (!(k in current)) current[k] = {};
            current = current[k];
        }

        current[lastKey] = value;
        this.saveConfig();
        return this;
    }

    /**
     * Apply configuration changes
     * @param {Object} changes - Partial config changes
     */
    async applyConfig(changes) {
        // Deep merge changes
        this.config = deepMerge(this.config, changes);

        // Save to localStorage immediately
        this.saveConfig();

        // Apply visual changes
        if (changes.themeMode !== undefined) {
            this.applyTheme();
            this.updateThemeIcon();
        }

        if (changes.direction !== undefined) {
            this.applyDirection();
        }

        if (changes.layoutType !== undefined) {
            await this.refreshLayout();
        }

        if (changes.sidebar !== undefined) {
            this.applySidebarStyles();

            // If sidebar position changed, need to refresh the entire layout
            // because header layout depends on sidebar position
            if (changes.sidebar.position !== undefined) {
                await this.refreshLayout();
            }
        }

        if (changes.contentArea !== undefined) {
            this.applyContentStyles();
        }

        if (changes.footerVisible !== undefined) {
            this.updateFooterVisibility();
        }

        // Apply all CSS variables
        this.applyLayoutStyles();

        // Trigger debounced API sync
        this.debouncedApiSync();

        // Notify state subscribers
        if (this.app.state) {
            this.app.state.set('layout.config', this.config);
        }
    }

    /**
     * Reset config to defaults (company default > system default)
     */
    async resetConfig() {
        try {
            // First, delete user config from API
            await this.app.api.delete('/layout/config');

            // Fetch fresh config (will return company default if exists, otherwise system default)
            const response = await this.app.api.get('/layout/config');
            if (response.success && response.data?.config) {
                this.config = deepMerge(DEFAULT_LAYOUT_CONFIG, response.data.config);
            } else {
                this.config = { ...DEFAULT_LAYOUT_CONFIG };
            }
        } catch (error) {
            // Fallback to system defaults
            this.config = { ...DEFAULT_LAYOUT_CONFIG };
        }

        this.saveConfig();
        this.applyTheme();
        this.applyDirection();
        this.applyLayoutStyles();
        await this.refreshLayout();
    }

    /**
     * Sync config to API
     */
    async syncToApi() {
        try {
            await this.app.api.put('/layout/config', { config: this.config });
        } catch (error) {
            Logger.error('Failed to sync layout config to API:', error);
        }
    }

    /**
     * Load config from API
     * @deprecated Use loadConfigFromApiWithPriority() instead
     */
    async loadFromApi() {
        return this.loadConfigFromApiWithPriority();
    }

    /**
     * Apply all layout CSS variables
     */
    applyLayoutStyles() {
        const root = document.documentElement;
        const sidebar = this.config.sidebar || {};
        const top = this.config.top || {};
        const contentArea = this.config.contentArea || {};
        const padding = contentArea.padding || {};

        // Check if dark mode is active - if so, let CSS handle sidebar/header colors
        const currentTheme = resolveTheme(this.config.themeMode);
        const isDarkMode = currentTheme === 'dark';

        // Sidebar variables
        root.style.setProperty('--sidebar-width', `${sidebar.width || 260}px`);
        root.style.setProperty('--sidebar-collapsed-width', `${sidebar.collapsedWidth || 64}px`);

        // Apply sidebar background
        // In dark mode, remove inline styles so global-dark.css takes over
        if (isDarkMode) {
            // Dark mode: let CSS (global-dark.css) control all sidebar colors
            root.style.removeProperty('--sidebar-bg');
            root.style.removeProperty('--sidebar-text');
            root.style.removeProperty('--sidebar-icon');
            root.style.removeProperty('--sidebar-group-title');
            root.style.removeProperty('--sidebar-hover');
            root.style.removeProperty('--sidebar-active');
            root.style.removeProperty('--sidebar-active-text');
            root.style.removeProperty('--sidebar-scrollbar-thumb');
            root.style.removeProperty('--sidebar-scrollbar-track');
            root.style.removeProperty('--sidebar-divider');
            root.style.removeProperty('--sidebar-border-color');
        } else {
            // Light mode: apply theme customizer settings
            const sidebarBg = getBackgroundColor(sidebar.background, sidebar.customColor);
            if (!sidebarBg.includes('gradient')) {
                root.style.setProperty('--sidebar-bg', sidebarBg);

                // Calculate contrast text color
                const textColor = ColorUtils.getContrastTextColor(sidebarBg);
                root.style.setProperty('--sidebar-text', textColor);
                root.style.setProperty('--sidebar-icon', textColor);

                // Calculate hover/active colors based on background lightness
                const isLight = ColorUtils.isLightColor(sidebarBg);

                // Group title color (muted version of text color)
                const groupTitleColor = isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';
                root.style.setProperty('--sidebar-group-title', groupTitleColor);

                root.style.setProperty('--sidebar-hover', isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)');
                // Active state: slightly more prominent than hover, using text color with transparency
                root.style.setProperty('--sidebar-active', isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.15)');
                root.style.setProperty('--sidebar-active-text', textColor);

                // Scrollbar colors based on background
                root.style.setProperty('--sidebar-scrollbar-thumb', isLight ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.3)');
                root.style.setProperty('--sidebar-scrollbar-track', 'transparent');

                // Internal divider color (thin, subtle)
                root.style.setProperty('--sidebar-divider', isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)');

                // Border color based on background (for outer edge only)
                const borderColor = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
                root.style.setProperty('--sidebar-border-color', sidebar.border?.color || borderColor);
            }
        }

        // Sidebar border width
        if (sidebar.border?.enabled !== false) {
            root.style.setProperty('--sidebar-border-width', `${sidebar.border?.width || 1}px`);
        } else {
            root.style.setProperty('--sidebar-border-width', '0px');
        }

        // Top nav / Header variables
        root.style.setProperty('--header-height', `${top.height || 64}px`);

        // Apply header background
        // In dark mode OR when 'light' is selected, defer to CSS theme
        const headerBgType = top.background || 'light';
        if (!isDarkMode && headerBgType !== 'light') {
            const headerBg = getBackgroundColor(top.background, top.customColor);
            if (!headerBg.includes('gradient')) {
                root.style.setProperty('--header-bg', headerBg);

                // Calculate contrast text color for header
                const headerTextColor = ColorUtils.getContrastTextColor(headerBg);
                root.style.setProperty('--header-text', headerTextColor);

                // Calculate header hover/active colors based on background
                const headerIsLight = ColorUtils.isLightColor(headerBg);
                root.style.setProperty('--header-hover', headerIsLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.1)');
                root.style.setProperty('--header-active', headerIsLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)');
                root.style.setProperty('--header-active-text', headerTextColor);

                // Calculate header border color based on background
                const headerBorderColor = headerIsLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
                root.style.setProperty('--header-border-color', top.border?.color || headerBorderColor);

                // Dropdown menu colors - match header background
                root.style.setProperty('--header-dropdown-bg', headerBg);
                root.style.setProperty('--header-dropdown-text', headerTextColor);
                root.style.setProperty('--header-dropdown-border', headerIsLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)');
                root.style.setProperty('--header-dropdown-hover', headerIsLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)');
                root.style.setProperty('--header-dropdown-active', headerIsLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)');
                root.style.setProperty('--header-dropdown-header-bg', headerIsLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)');
                root.style.setProperty('--header-dropdown-icon-bg', headerIsLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)');
                root.style.setProperty('--header-dropdown-icon-color', headerTextColor);
                root.style.setProperty('--header-dropdown-shadow', headerIsLight
                    ? '0 20px 40px -12px rgba(0, 0, 0, 0.15), 0 8px 16px -6px rgba(0, 0, 0, 0.1)'
                    : '0 20px 40px -12px rgba(0, 0, 0, 0.3), 0 8px 16px -6px rgba(0, 0, 0, 0.2)');
            } else {
                // For gradient backgrounds
                root.style.setProperty('--header-bg', headerBg);
                root.style.setProperty('--header-text', '#ffffff');
                root.style.setProperty('--header-hover', 'rgba(255, 255, 255, 0.1)');
                root.style.setProperty('--header-active', 'rgba(255, 255, 255, 0.15)');
                root.style.setProperty('--header-active-text', '#ffffff');
                root.style.setProperty('--header-border-color', 'rgba(255, 255, 255, 0.1)');

                // Dropdown menu colors for gradient backgrounds - match header
                root.style.setProperty('--header-dropdown-bg', headerBg);
                root.style.setProperty('--header-dropdown-text', '#ffffff');
                root.style.setProperty('--header-dropdown-border', 'rgba(255, 255, 255, 0.08)');
                root.style.setProperty('--header-dropdown-hover', 'rgba(255, 255, 255, 0.06)');
                root.style.setProperty('--header-dropdown-active', 'rgba(255, 255, 255, 0.1)');
                root.style.setProperty('--header-dropdown-header-bg', 'rgba(255, 255, 255, 0.04)');
                root.style.setProperty('--header-dropdown-icon-bg', 'rgba(255, 255, 255, 0.06)');
                root.style.setProperty('--header-dropdown-icon-color', '#ffffff');
                root.style.setProperty('--header-dropdown-shadow', '0 20px 40px -12px rgba(0, 0, 0, 0.3), 0 8px 16px -6px rgba(0, 0, 0, 0.2)');
            }
        } else {
            // Remove any inline header styles so CSS theme takes over
            root.style.removeProperty('--header-bg');
            root.style.removeProperty('--header-text');
            root.style.removeProperty('--header-hover');
            root.style.removeProperty('--header-active');
            root.style.removeProperty('--header-active-text');
            root.style.removeProperty('--header-border-color');

            // Remove dropdown styles so CSS defaults take over
            root.style.removeProperty('--header-dropdown-bg');
            root.style.removeProperty('--header-dropdown-text');
            root.style.removeProperty('--header-dropdown-border');
            root.style.removeProperty('--header-dropdown-hover');
            root.style.removeProperty('--header-dropdown-active');
            root.style.removeProperty('--header-dropdown-header-bg');
            root.style.removeProperty('--header-dropdown-icon-bg');
            root.style.removeProperty('--header-dropdown-icon-color');
            root.style.removeProperty('--header-dropdown-shadow');
        }

        // Header border width
        if (top.border?.enabled !== false) {
            root.style.setProperty('--header-border-width', `${top.border?.width || 1}px`);
        } else {
            root.style.setProperty('--header-border-width', '0px');
        }

        // Content area variables - use dynamic <style> element for responsive padding
        // Inline styles override media queries, so we must use a stylesheet approach
        this.applyResponsivePadding(contentArea);

        // Content width
        const width = contentArea.width || {};
        if (width.unit === '%') {
            root.style.setProperty('--content-max-width', `${width.value || 100}%`);
        } else {
            root.style.setProperty('--content-max-width', `${width.value || 1400}px`);
        }
    }

    /**
     * Apply responsive content padding via dynamic <style> element
     * This ensures mobile/tablet padding from ThemeConfigurator actually works,
     * since inline CSS variables would override media query-based values.
     */
    applyResponsivePadding(contentArea) {
        const padding = contentArea.padding || {};
        const responsive = contentArea.responsive || {};
        const tabletPadding = responsive.tablet?.padding || {};
        const mobilePadding = responsive.mobile?.padding || {};

        // Desktop defaults
        const dt = padding.top ?? 24;
        const dr = padding.right ?? 24;
        const db = padding.bottom ?? 24;
        const dl = padding.left ?? 24;

        // Tablet defaults (fallback to 20)
        const tt = tabletPadding.top ?? 20;
        const tr = tabletPadding.right ?? 20;
        const tb = tabletPadding.bottom ?? 20;
        const tl = tabletPadding.left ?? 20;

        // Mobile defaults (fallback to 16)
        const mt = mobilePadding.top ?? 16;
        const mr = mobilePadding.right ?? 16;
        const mb = mobilePadding.bottom ?? 16;
        const ml = mobilePadding.left ?? 16;

        const css = `
            :root {
                --content-padding-top: ${dt}px;
                --content-padding-right: ${dr}px;
                --content-padding-bottom: ${db}px;
                --content-padding-left: ${dl}px;
            }
            @media (max-width: 1024px) {
                :root {
                    --content-padding-top: ${tt}px;
                    --content-padding-right: ${tr}px;
                    --content-padding-bottom: ${tb}px;
                    --content-padding-left: ${tl}px;
                }
            }
            @media (max-width: 768px) {
                :root {
                    --content-padding-top: ${mt}px;
                    --content-padding-right: ${mr}px;
                    --content-padding-bottom: ${mb}px;
                    --content-padding-left: ${ml}px;
                }
            }
        `;

        // Remove any previous inline padding variables (cleanup from old approach)
        const root = document.documentElement;
        root.style.removeProperty('--content-padding-top');
        root.style.removeProperty('--content-padding-right');
        root.style.removeProperty('--content-padding-bottom');
        root.style.removeProperty('--content-padding-left');

        // Create or update dynamic style element
        let styleEl = document.getElementById('omnex-responsive-padding');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'omnex-responsive-padding';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = css;
    }

    /**
     * Apply sidebar-specific styles
     */
    applySidebarStyles() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        const sidebarConfig = this.config.sidebar || {};

        // Update collapsed state
        if (sidebarConfig.collapsed !== undefined) {
            this.isSidebarCollapsed = sidebarConfig.collapsed;
            sidebar.classList.toggle('collapsed', this.isSidebarCollapsed);

            const toggle = document.getElementById('sidebar-toggle');
            if (toggle) {
                toggle.querySelector('i').className = this.isSidebarCollapsed
                    ? 'ti ti-chevron-right'
                    : 'ti ti-chevron-left';
            }
        }

        // Update position
        if (sidebarConfig.position === SidebarPosition.RIGHT) {
            sidebar.classList.add('sidebar-right');
        } else {
            sidebar.classList.remove('sidebar-right');
        }
    }

    /**
     * Apply content area styles
     */
    applyContentStyles() {
        // CSS variables are applied in applyLayoutStyles
        // This method can be extended for responsive adjustments
    }

    /**
     * Update footer visibility
     */
    updateFooterVisibility() {
        const footer = document.getElementById('footer');
        if (footer) {
            footer.style.display = this.config.footerVisible !== false ? 'block' : 'none';
        }
    }

    /**
     * Refresh the entire layout
     */
    async refreshLayout() {
        if (this.isLayoutVisible) {
            // Set to false so showLayout() will actually re-render
            this.isLayoutVisible = false;

            // Re-render the layout and wait for it to complete
            await this.showLayout();

            // Reload current page via router to restore content properly
            // force=true is critical: layout switch doesn't change the URL hash,
            // so navigate() would silently skip re-rendering without it
            if (this.app.router) {
                const currentHash = window.location.hash || '#/dashboard';
                const route = currentHash.replace('#', '');
                this.app.router.navigate(route, {}, true);
            }
        }
    }

    /**
     * Update theme icon in header
     */
    updateThemeIcon() {
        const icon = document.querySelector('#theme-toggle i');
        if (icon) {
            const resolvedTheme = resolveTheme(this.config.themeMode);
            icon.className = `ti ti-${resolvedTheme === 'dark' ? 'sun' : 'moon'}`;
        }
    }

    /**
     * Re-initialize selectors if they haven't loaded proper data yet
     * This handles the case where LayoutManager.init() was called before login
     */
    async reinitializeSelectorsIfNeeded() {
        const user = this.app.auth.getUser();

        // Re-init CompanySelector if user is SuperAdmin and companies not loaded
        if (user?.role === 'SuperAdmin' && this.companySelector) {
            if (!this.companySelector.companies || this.companySelector.companies.length === 0) {
                Logger.debug('Re-initializing CompanySelector for authenticated SuperAdmin');
                await this.companySelector.init();
            }
        } else if (this.companySelector) {
            // For non-SuperAdmin users, just re-init to get company info from user
            this.companySelector.initActiveCompany();
        }

        // Re-init BranchSelector if not initialized properly
        if (!this.branchSelector) {
            try {
                this.branchSelector = new BranchSelector(this.app);
                await this.branchSelector.init();
                Logger.debug('BranchSelector initialized on showLayout');
            } catch (e) {
                Logger.warn('BranchSelector init failed:', e);
            }
        }

        // Re-init NotificationManager if not initialized
        if (!this.notificationManager) {
            await this.initNotificationSystem();
        }
    }

    /**
     * Ensure Tabler Icons font is loaded before rendering
     * Uses Font Loading API with fallback
     */
    async ensureIconFontLoaded() {
        // Check if Font Loading API is supported
        if (!document.fonts) {
            // Fallback: wait a short time for font to load
            await new Promise(resolve => setTimeout(resolve, 200));
            return;
        }

        try {
            // First, wait for all fonts to be ready (most reliable method)
            await document.fonts.ready;

            // Then specifically check tabler-icons font
            const isLoaded = document.fonts.check('16px "tabler-icons"');
            if (!isLoaded) {
                // If not loaded yet, explicitly load it
                const fontLoadPromise = document.fonts.load('16px "tabler-icons"');
                const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000)); // 3 second max wait

                await Promise.race([fontLoadPromise, timeoutPromise]);
            }

            // Wait for next frame AND a small delay to ensure browser has rendered
            await new Promise(resolve => requestAnimationFrame(() => {
                setTimeout(resolve, 50);
            }));
        } catch (e) {
            Logger.warn('Font loading check failed:', e);
            // Continue anyway after a delay
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    /**
     * Show layout (for authenticated pages)
     */
    async showLayout() {
        if (this.isLayoutVisible) {
            // Just update if already visible
            this.updateActiveMenu();
            return;
        }

        // Re-initialize selectors for authenticated user
        // This is needed because LayoutManager.init() might have been called
        // before user logged in, so selectors might not have proper data
        if (this.app.auth?.isAuthenticated()) {
            await this.reinitializeSelectorsIfNeeded();
        }

        // Ensure icon font is loaded before rendering layout
        await this.ensureIconFontLoaded();

        const app = document.getElementById('app');

        if (this.config.layoutType === LayoutType.TOP) {
            app.innerHTML = this.renderTopLayout();
            // Remove sidebar layout class from body (for sticky header)
            document.body.classList.remove('has-sidebar-layout');
        } else {
            app.innerHTML = this.renderSidebarLayout();
            // Add sidebar layout class to body (for sticky header)
            document.body.classList.add('has-sidebar-layout');
        }

        this.isLayoutVisible = true;
        this.bindLayoutEvents();
        this.updateActiveMenu();
        this.applyLayoutStyles();

        // Force icons to re-render by toggling display
        // This ensures the font glyphs are rendered even if font was loaded after initial paint
        requestAnimationFrame(() => {
            const icons = document.querySelectorAll('.ti');
            icons.forEach(icon => {
                // Force style recalculation by temporarily changing display
                const originalDisplay = icon.style.display;
                icon.style.display = 'none';
                // Force browser to apply the change
                icon.offsetHeight;
                // Restore display
                icon.style.display = originalDisplay || '';
            });

            // Second pass: force repaint after a small delay
            setTimeout(() => {
                icons.forEach(icon => {
                    icon.offsetHeight;
                });
            }, 50);
        });

        // Initialize notification system if not already initialized
        if (!this.notificationManager && this.app.auth?.isAuthenticated()) {
            this.initNotificationSystem();
        }

        // Show theme configurator
        if (this.configurator) {
            this.configurator.show();
        }

        // Update mobile header height CSS variable for dropdown positioning
        this.updateMobileHeaderHeight();
    }

    /**
     * Measure actual header height and update CSS variable for mobile dropdown positioning
     */
    updateMobileHeaderHeight() {
        requestAnimationFrame(() => {
            const header = document.getElementById('header');
            if (header) {
                const height = header.offsetHeight;
                document.documentElement.style.setProperty('--mobile-header-2row-height', `${height}px`);
            }
        });
    }

    /**
     * Hide layout (for auth pages)
     */
    hideLayout() {
        this.isLayoutVisible = false;

        // Clear the app container
        const container = document.getElementById('app');
        if (container) {
            container.innerHTML = '';
        }

        // Remove sidebar layout class from body
        document.body.classList.remove('has-sidebar-layout');

        // Hide theme configurator
        if (this.configurator) {
            this.configurator.hide();
        }
    }

    /**
     * Render sidebar layout HTML
     */
    renderSidebarLayout() {
        const user = this.app.auth.getUser();
        const basePath = window.OmnexConfig?.basePath || '';
        const sidebarConfig = this.config.sidebar || {};
        const sidebarCollapsed = sidebarConfig.collapsed;
        const isRight = sidebarConfig.position === SidebarPosition.RIGHT;

        const layoutClasses = [
            'layout-sidebar',
            isRight ? 'layout-sidebar-right' : '',
            sidebarCollapsed ? 'sidebar-collapsed' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${layoutClasses}">
                <!-- Sidebar -->
                <aside class="sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${isRight ? 'sidebar-right' : ''}" id="sidebar">
                    <!-- Mobil kapatma butonu -->
                    <button class="sidebar-mobile-close" id="sidebar-mobile-close" aria-label="${this.__('layout.closeSidebar')}">
                        <i class="ti ti-x"></i>
                    </button>
                    <div class="sidebar-header">
                        <a href="#/dashboard" class="sidebar-logo">
                            <img src="${basePath}/branding/favicon.png" alt="OmneX" class="sidebar-logo-icon">
                            <span>OmneX Hub</span>
                        </a>
                    </div>

                    <nav class="sidebar-content" id="sidebar-nav">
                        ${this.renderMenu()}
                    </nav>

                    <div class="sidebar-footer">
                        <div class="nav-item" id="user-menu-trigger">
                            <div class="user-avatar">
                                ${user?.avatar
                                    ? `<img src="${basePath}/${user.avatar}" alt="${user.first_name}">`
                                    : (user?.first_name?.[0] || 'U') + (user?.last_name?.[0] || '')
                                }
                            </div>
                            <div class="nav-item-label">
                                <div class="user-name">${user?.first_name || ''} ${user?.last_name || ''}</div>
                                <div class="user-role text-xs text-muted">${this.getRoleLabel(user?.role)}</div>
                            </div>
                        </div>
                    </div>
                </aside>

                <!-- Main Content -->
                <div class="main-content" id="main-content">
                    ${this.renderHeader(user, isRight)}

                    <!-- Page Content -->
                    <main class="page-content" id="page-content">
                        <!-- Page content will be rendered here -->
                    </main>

                    ${this.config.footerVisible !== false ? this.renderFooter() : ''}
                </div>

                <!-- Mobile Sidebar Overlay -->
                <div class="sidebar-overlay" id="sidebar-overlay"></div>
            </div>
        `;
    }

    /**
     * Render top navigation layout HTML
     */
    renderTopLayout() {
        const user = this.app.auth.getUser();
        const basePath = window.OmnexConfig?.basePath || '';

        return `
            <div class="layout-top">
                <!-- Top Navigation -->
                <header class="top-nav" id="top-nav">
                    <div class="top-nav-container">
                        <div class="top-nav-left">
                            <a href="#/dashboard" class="top-nav-logo">
                                <img src="${basePath}/branding/favicon.png" alt="OmneX" class="top-nav-logo-icon">
                                <span>OmneX Hub</span>
                            </a>

                            <nav class="top-nav-menu" id="top-nav-menu">
                                ${this.renderTopMenu()}
                            </nav>
                        </div>

                        <div class="top-nav-right">
                            ${this.languageSelector ? this.languageSelector.render() : ''}

                            ${this.notificationDropdown ? this.notificationDropdown.render() : ''}

                            ${cacheManager.isDevelopment ? `
                            <button class="header-btn" id="dev-cache-clear-btn" title="${this.__('layout.clearCache')}">
                                <i class="ti ti-refresh"></i>
                            </button>
                            ` : ''}

                            <button class="header-btn" id="theme-toggle" title="${this.__('layout.toggleTheme')}">
                                <i class="ti ti-${resolveTheme(this.config.themeMode) === 'dark' ? 'sun' : 'moon'}"></i>
                            </button>

                            <button class="header-btn" id="fullscreen-btn" title="${this.__('layout.fullscreen')}">
                                <i class="ti ti-maximize"></i>
                            </button>

                            <button class="header-btn" id="pwa-install-header-btn" title="${this.__('layout.installApp')}" style="display: none;">
                                <i class="ti ti-download"></i>
                            </button>

                            ${this.companySelector ? this.companySelector.render() : ''}

                            ${this.branchSelector ? this.branchSelector.render() : ''}

                            <div class="user-menu-wrapper">
                                <button class="user-menu" id="header-user-menu">
                                    <div class="user-avatar">
                                        ${user?.avatar
                                            ? `<img src="${basePath}/${user.avatar}" alt="${user.first_name}">`
                                            : (user?.first_name?.[0] || 'U') + (user?.last_name?.[0] || '')
                                        }
                                    </div>
                                    <div class="user-info">
                                        <div class="user-name">${user?.first_name || ''} ${user?.last_name || ''}</div>
                                        <div class="user-role">${this.getRoleLabel(user?.role)}</div>
                                    </div>
                                    <i class="ti ti-chevron-down text-muted"></i>
                                </button>
                                <div class="user-dropdown" id="user-dropdown">
                                    <div class="user-dropdown-header">
                                        <div class="user-dropdown-avatar">
                                            ${user?.avatar
                                                ? `<img src="${basePath}/${user.avatar}" alt="${user.first_name}">`
                                                : (user?.first_name?.[0] || 'U') + (user?.last_name?.[0] || '')
                                            }
                                        </div>
                                        <div class="user-dropdown-info">
                                            <span class="user-dropdown-name">${user?.first_name || ''} ${user?.last_name || ''}</span>
                                            <span class="user-dropdown-email">${user?.email || ''}</span>
                                        </div>
                                    </div>
                                    <div class="user-dropdown-list">
                                        <a href="#/profile" class="user-dropdown-item">
                                            <div class="user-dropdown-item-icon">
                                                <i class="ti ti-user"></i>
                                            </div>
                                            <span>${this.__('layout.profile')}</span>
                                        </a>
                                        <a href="#/settings" class="user-dropdown-item">
                                            <div class="user-dropdown-item-icon">
                                                <i class="ti ti-settings"></i>
                                            </div>
                                            <span>${this.__('layout.settings')}</span>
                                        </a>
                                    </div>
                                    <div class="user-dropdown-footer">
                                        <button class="user-dropdown-logout-btn" id="header-logout-btn">
                                            <i class="ti ti-logout"></i>
                                            <span>${this.__('layout.logout')}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button class="top-nav-mobile-toggle lg:hidden" id="mobile-menu-toggle">
                            <i class="ti ti-menu-2"></i>
                        </button>
                    </div>
                </header>

                <!-- Main Content -->
                <main class="page-content top-layout-content" id="page-content">
                    <!-- Page content will be rendered here -->
                </main>

                ${this.config.footerVisible !== false ? this.renderFooter() : ''}
            </div>

            <!-- Mobile Menu Backdrop -->
            <div class="modal-backdrop hidden" id="mobile-backdrop"></div>
        `;
    }

    /**
     * Render header component
     * @param {Object} user - Current user
     * @param {boolean} isRightSidebar - Whether sidebar is on the right
     */
    renderHeader(user, isRightSidebar = false) {
        const basePath = window.OmnexConfig?.basePath || '';
        const themeIcon = resolveTheme(this.config.themeMode) === 'dark' ? 'sun' : 'moon';
        const headerClass = isRightSidebar ? 'header header-right-sidebar' : 'header';

        // Toggle buttons - position changes based on sidebar position
        const toggleButtons = `
            <button class="header-btn mobile-menu-toggle" id="mobile-menu-toggle">
                <i class="ti ti-menu-2"></i>
            </button>
            <button class="header-btn sidebar-expand-btn" id="sidebar-expand-btn" title="${this.__('layout.toggleSidebar')}">
                <i class="ti ti-chevron-${isRightSidebar ? 'left' : 'right'}"></i>
            </button>
        `;

        // Company selector (for SuperAdmin or to show current company)
        let companySelectorHtml = '';
        try {
            companySelectorHtml = this.companySelector?.render() || '';
        } catch (e) {
            Logger.warn('CompanySelector render failed:', e);
        }

        // Branch selector (for authenticated users)
        let branchSelectorHtml = '';
        try {
            branchSelectorHtml = this.branchSelector?.render() || '';
        } catch (e) {
            Logger.warn('BranchSelector render failed:', e);
        }

        // Language selector
        let languageSelectorHtml = '';
        try {
            languageSelectorHtml = this.languageSelector?.render() || '';
        } catch (e) {
            Logger.warn('LanguageSelector render failed:', e);
        }

        // Notification dropdown
        let notificationDropdownHtml = '';
        try {
            notificationDropdownHtml = this.notificationDropdown?.render() || '';
        } catch (e) {
            Logger.warn('NotificationDropdown render failed:', e);
        }

        // Cache clear button (development only)
        const cacheButtonHtml = cacheManager.isDevelopment ? `
            <button class="header-btn" id="dev-cache-clear-btn" title="${this.__('layout.clearCache')}">
                <i class="ti ti-refresh"></i>
            </button>
        ` : '';

        // User menu HTML (reusable)
        const userMenuHtml = `
            <div class="user-menu-wrapper">
                <button class="user-menu" id="header-user-menu">
                    <div class="user-avatar">
                        ${user?.avatar
                            ? `<img src="${basePath}/${user.avatar}" alt="${user.first_name}">`
                            : (user?.first_name?.[0] || 'U') + (user?.last_name?.[0] || '')
                        }
                    </div>
                    <div class="user-info">
                        <div class="user-name">${user?.first_name || ''} ${user?.last_name || ''}</div>
                        <div class="user-role">${this.getRoleLabel(user?.role)}</div>
                    </div>
                    <i class="ti ti-chevron-down text-muted"></i>
                </button>
                <div class="user-dropdown" id="user-dropdown">
                    <div class="user-dropdown-header">
                        <div class="user-dropdown-avatar">
                            ${user?.avatar
                                ? `<img src="${basePath}/${user.avatar}" alt="${user.first_name}">`
                                : (user?.first_name?.[0] || 'U') + (user?.last_name?.[0] || '')
                            }
                        </div>
                        <div class="user-dropdown-info">
                            <span class="user-dropdown-name">${user?.first_name || ''} ${user?.last_name || ''}</span>
                            <span class="user-dropdown-email">${user?.email || ''}</span>
                        </div>
                    </div>
                    <div class="user-dropdown-list">
                        <a href="#/profile" class="user-dropdown-item">
                            <div class="user-dropdown-item-icon">
                                <i class="ti ti-user"></i>
                            </div>
                            <span>${this.__('layout.profile')}</span>
                        </a>
                        <a href="#/settings" class="user-dropdown-item">
                            <div class="user-dropdown-item-icon">
                                <i class="ti ti-settings"></i>
                            </div>
                            <span>${this.__('layout.settings')}</span>
                        </a>
                    </div>
                    <div class="user-dropdown-footer">
                        <button class="user-dropdown-logout-btn" id="header-logout-btn">
                            <i class="ti ti-logout"></i>
                            <span>${this.__('layout.logout')}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Primary buttons (Row 1 on mobile): Language, Company, Branch, User
        const primaryButtons = `
            ${languageSelectorHtml}
            ${companySelectorHtml}
            ${branchSelectorHtml}
            ${userMenuHtml}
        `;

        // Secondary buttons (Row 2 on mobile): icon buttons
        const secondaryButtons = `
            ${notificationDropdownHtml}
            ${cacheButtonHtml}
            <button class="header-btn" id="theme-toggle" title="${this.__('layout.toggleTheme')}">
                <i class="ti ti-${themeIcon}"></i>
            </button>
            <button class="header-btn" id="fullscreen-btn" title="${this.__('layout.fullscreen')}">
                <i class="ti ti-maximize"></i>
            </button>
            <button class="header-btn" id="pwa-install-header-btn" title="${this.__('layout.installApp')}" style="display: none;">
                <i class="ti ti-download"></i>
            </button>
        `;

        // For right sidebar: user menu on left, toggle on right
        // For left sidebar: toggle on left, user menu on right
        if (isRightSidebar) {
            return `
                <header class="${headerClass}" id="header">
                    <div class="header-left">
                        ${userMenuHtml}
                        ${companySelectorHtml}
                        ${branchSelectorHtml}
                        ${languageSelectorHtml}
                        ${notificationDropdownHtml}
                    </div>
                    <div class="header-secondary">
                        ${cacheButtonHtml}
                        <button class="header-btn" id="fullscreen-btn" title="${this.__('layout.fullscreen')}">
                            <i class="ti ti-maximize"></i>
                        </button>
                        <button class="header-btn" id="theme-toggle" title="${this.__('layout.toggleTheme')}">
                            <i class="ti ti-${themeIcon}"></i>
                        </button>
                        <button class="header-btn" id="pwa-install-header-btn" title="${this.__('layout.installApp')}" style="display: none;">
                            <i class="ti ti-download"></i>
                        </button>
                    </div>
                    <div class="header-right">
                        ${toggleButtons}
                    </div>
                </header>
            `;
        } else {
            // Header logo (light/dark mode) - hidden on mobile/tablet (<=1024px)
            const isMobile = window.innerWidth <= 1024;
            const headerLogo = isMobile ? '' : `
                <a href="#/dashboard" class="header-logo" style="display:${isMobile ? 'none' : 'flex'}">
                    <img src="${basePath}/branding/logo-light.png" alt="OmneX" class="header-logo-light">
                    <img src="${basePath}/branding/logo.png" alt="OmneX" class="header-logo-dark">
                </a>
            `;

            return `
                <header class="${headerClass}" id="header">
                    <div class="header-left">
                        ${toggleButtons}
                        ${headerLogo}
                    </div>
                    <div class="header-secondary">
                        ${secondaryButtons}
                    </div>
                    <div class="header-right">
                        ${primaryButtons}
                    </div>
                </header>
            `;
        }
    }

    /**
     * Render footer component
     */
    renderFooter() {
        return `
            <footer class="footer" id="footer">
                <div class="footer-content">
                    <span>&copy; ${new Date().getFullYear()} Omnex Display Hub. ${this.__('layout.allRightsReserved')}</span>
                </div>
            </footer>
        `;
    }

    /**
     * Render navigation menu for sidebar
     */
    renderMenu() {
        const menuItems = this.getMenuItems();
        const currentPath = window.location.hash.replace('#', '') || '/dashboard';

        // Paths that should NOT match their parent paths
        const exactMatchPaths = ['/settings', '/notifications', '/products'];

        let html = '';

        menuItems.forEach(group => {
            if (group.title) {
                html += `<div class="nav-group-title">${group.title}</div>`;
            }

            group.items.forEach(item => {
                let isActive = false;

                if (exactMatchPaths.includes(item.href)) {
                    isActive = currentPath === item.href;
                } else {
                    isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
                }

                html += `
                    <a href="#${item.href}" class="nav-item ${isActive ? 'active' : ''}">
                        <span class="nav-item-icon"><i class="ti ti-${item.icon}"></i></span>
                        <span class="nav-item-label">${item.label}</span>
                        ${item.badge ? `<span class="nav-item-badge">${item.badge}</span>` : ''}
                    </a>
                `;
            });
        });

        return html;
    }

    /**
     * Render navigation menu for top layout with grouped dropdowns
     */
    renderTopMenu() {
        const menuItems = this.getMenuItems();
        const currentPath = window.location.hash.replace('#', '') || '/dashboard';

        // Paths that should NOT match their parent paths
        const exactMatchPaths = ['/settings', '/notifications', '/products'];

        let html = '';

        menuItems.forEach((group, groupIndex) => {
            // Check if any item in this group is active
            const hasActiveItem = group.items.some(item => {
                if (exactMatchPaths.includes(item.href)) {
                    return currentPath === item.href;
                }
                return currentPath === item.href || currentPath.startsWith(item.href + '/');
            });

            // Groups without title (like Dashboard) - render as direct items
            if (!group.title || group.items.length === 1) {
                group.items.forEach(item => {
                    let isActive = false;
                    if (exactMatchPaths.includes(item.href)) {
                        isActive = currentPath === item.href;
                    } else {
                        isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
                    }

                    html += `
                        <a href="#${item.href}" class="top-nav-item ${isActive ? 'active' : ''}">
                            <i class="ti ti-${item.icon}"></i>
                            <span>${item.label}</span>
                        </a>
                    `;
                });
            } else {
                // Groups with title - render as dropdown
                const groupIcon = this.getGroupIcon(group.title);

                html += `
                    <div class="top-nav-dropdown ${hasActiveItem ? 'has-active' : ''}" data-group="${groupIndex}">
                        <button class="top-nav-dropdown-trigger ${hasActiveItem ? 'active' : ''}">
                            <i class="ti ti-${groupIcon}"></i>
                            <span>${group.title}</span>
                            <i class="ti ti-chevron-down top-nav-dropdown-arrow"></i>
                        </button>
                        <div class="top-nav-dropdown-menu">
                            <div class="top-nav-dropdown-header">
                                <i class="ti ti-${groupIcon}"></i>
                                <span>${group.title}</span>
                            </div>
                            <div class="top-nav-dropdown-items">
                                ${group.items.map(item => {
                                    let isActive = false;
                                    if (exactMatchPaths.includes(item.href)) {
                                        isActive = currentPath === item.href;
                                    } else {
                                        isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
                                    }
                                    return `
                                        <a href="#${item.href}" class="top-nav-dropdown-item ${isActive ? 'active' : ''}">
                                            <div class="top-nav-dropdown-item-icon">
                                                <i class="ti ti-${item.icon}"></i>
                                            </div>
                                            <span>${item.label}</span>
                                            ${item.badge ? `<span class="top-nav-dropdown-badge">${item.badge}</span>` : ''}
                                        </a>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        return html;
    }

    /**
     * Get icon for menu group title
     */
    getGroupIcon(title) {
        const icons = {
            [this.__('layout.menu.management')]: 'layout-grid',
            [this.__('layout.menu.devices')]: 'device-desktop',
            [this.__('layout.menu.reports')]: 'chart-bar',
            [this.__('layout.menu.settings')]: 'settings',
            [this.__('layout.menu.admin')]: 'shield-check'
        };
        return icons[title] || 'folder';
    }

    /**
     * Get menu items based on user role
     */
    getMenuItems() {
        const user = this.app.auth.getUser();
        const role = user?.role || 'Viewer';

        const items = [
            {
                title: '',
                items: [
                    { label: this.__('nav.dashboard', 'Dashboard'), href: '/dashboard', icon: 'home', roles: ['*'] },
                    { label: this.__('layout.menu.notifications'), href: '/notifications', icon: 'bell', roles: ['*'] }
                ]
            },
            {
                title: this.__('layout.menu.management'),
                items: [
                    { label: this.__('layout.menu.products'), href: '/products', icon: 'package', roles: ['*'] },
                    { label: this.__('layout.menu.bundles'), href: '/bundles', icon: 'box-multiple', roles: ['*'] },
                    { label: this.__('layout.menu.kunyeDistribution'), href: '/products/kunye-distribution', icon: 'leaf', roles: ['*'] },
                    { label: this.__('layout.menu.bulkSend'), href: '/admin/queue', icon: 'send', roles: ['*'] },
                    { label: this.__('layout.menu.templates'), href: '/templates', icon: 'layout', roles: ['*'] },
                    { label: this.__('layout.menu.webTemplates'), href: '/web-templates', icon: 'code', roles: ['*'] },
                    { label: this.__('layout.menu.media'), href: '/media', icon: 'photo', roles: ['*'] }
                ]
            },
            {
                title: this.__('layout.menu.devices'),
                items: [
                    { label: this.__('layout.menu.devicesList'), href: '/devices', icon: 'device-tablet', roles: ['*'] },
                    { label: this.__('layout.menu.signage'), href: '/signage', icon: 'screen-share', roles: ['*'] }
                ]
            },
            {
                title: this.__('layout.menu.reports'),
                items: [
                    { label: this.__('layout.menu.reportsPage'), href: '/reports', icon: 'chart-bar', roles: ['*'] }
                ]
            },
            {
                title: this.__('layout.menu.settings'),
                items: [
                    { label: this.__('layout.menu.settingsPage'), href: '/settings', icon: 'settings', roles: ['Admin', 'SuperAdmin'] },
                    { label: this.__('layout.menu.integrations'), href: '/settings/integrations', icon: 'plug-connected', roles: ['Admin', 'SuperAdmin'] },
                    { label: this.__('layout.menu.gatewayManagement'), href: '/settings/gateways', icon: 'network', roles: ['Admin', 'SuperAdmin'] },
                    { label: this.__('layout.menu.notificationSettings'), href: '/notifications/settings', icon: 'bell-cog', roles: ['*'] },
                    { label: this.__('layout.menu.about'), href: '/about', icon: 'info-circle', roles: ['*'] }
                ]
            }
        ];

        // Add admin menu for SuperAdmin and Admin
        if (role === 'SuperAdmin' || role === 'Admin') {
            const adminItems = [
                { label: this.__('layout.menu.systemStatus'), href: '/admin/system-status', icon: 'server-2', roles: ['SuperAdmin', 'Admin'] }
            ];

            // SuperAdmin-only items
            if (role === 'SuperAdmin') {
                adminItems.push(
                    { label: this.__('layout.menu.users'), href: '/admin/users', icon: 'users', roles: ['SuperAdmin'] },
                    { label: this.__('layout.menu.companies'), href: '/admin/companies', icon: 'building', roles: ['SuperAdmin'] },
                    { label: this.__('layout.menu.branches'), href: '/admin/branches', icon: 'building-store', roles: ['SuperAdmin', 'Admin'] },
                    { label: this.__('layout.menu.licenses'), href: '/admin/licenses', icon: 'license', roles: ['SuperAdmin'] },
                    { label: this.__('layout.menu.auditLog'), href: '/admin/audit-log', icon: 'history', roles: ['SuperAdmin'] },
                    { label: this.__('layout.menu.tenantBackups'), href: '/admin/backups', icon: 'database-export', roles: ['SuperAdmin'] },
                    { label: this.__('layout.menu.logManagement'), href: '/admin/logs', icon: 'file-text', roles: ['SuperAdmin'] },
                    { label: this.__('layout.menu.setupWizard'), href: '/admin/setup-wizard', icon: 'wand', roles: ['SuperAdmin'] }
                );
            } else {
                // Admin can also access branches
                adminItems.push(
                    { label: this.__('layout.menu.branches'), href: '/admin/branches', icon: 'building-store', roles: ['SuperAdmin', 'Admin'] }
                );
            }

            items.push({
                title: this.__('layout.menu.admin'),
                items: adminItems
            });
        }

        // Filter by role
        return items.map(group => ({
            ...group,
            items: group.items.filter(item =>
                item.roles.includes('*') || item.roles.includes(role)
            )
        })).filter(group => group.items.length > 0);
    }

    /**
     * Get role label
     */
    getRoleLabel(role) {
        const labels = {
            SuperAdmin: this.__('layout.roles.superAdmin'),
            Admin: this.__('layout.roles.admin'),
            Editor: this.__('layout.roles.editor'),
            Viewer: this.__('layout.roles.viewer')
        };
        return labels[role] || role;
    }

    /**
     * Bind layout events
     */
    bindLayoutEvents() {
        // Mobile menu toggle (hamburger menu for mobile)
        document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        // Sidebar expand/collapse button in header (for desktop)
        document.getElementById('sidebar-expand-btn')?.addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Mobile sidebar overlay
        document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
            this.closeMobileMenu();
        });

        // Mobile sidebar close button
        document.getElementById('sidebar-mobile-close')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.closeMobileMenu();
        });

        // Theme toggle
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            this.toggleTheme();
        });

        // PWA install button
        document.getElementById('pwa-install-header-btn')?.addEventListener('click', () => {
            if (this.app.pwaPrompt) {
                this.app.pwaPrompt.promptInstall();
            }
        });

        // Update PWA button visibility based on current state
        if (this.app.pwaPrompt && this.app.pwaPrompt.canInstall()) {
            this.app.pwaPrompt.updateHeaderButton(true);
        }

        // Header scroll behavior (only for top layout)
        if (this.config.layoutType === LayoutType.TOP) {
            this.setupHeaderScrollBehavior();
            this.bindTopNavDropdowns();
        }

        // Fullscreen toggle
        document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // User menu dropdown toggle
        document.getElementById('header-user-menu')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleUserDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('user-dropdown');
            const userMenu = document.getElementById('header-user-menu');
            if (dropdown && !dropdown.contains(e.target) && !userMenu?.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });

        // Logout button
        document.getElementById('header-logout-btn')?.addEventListener('click', () => {
            this.handleLogout();
        });

        // Company selector events
        if (this.companySelector) {
            this.companySelector.bindEvents();
        }

        // Language selector events
        if (this.languageSelector) {
            this.languageSelector.bindEvents();
        }

        // Branch selector events
        if (this.branchSelector) {
            this.branchSelector.bindEvents();
        }

        // Notification dropdown events
        if (this.notificationDropdown) {
            this.notificationDropdown.bindEvents();
        }

        // Cache clear button (development only)
        document.getElementById('dev-cache-clear-btn')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const icon = btn.querySelector('i');

            btn.disabled = true;
            icon.className = 'ti ti-loader animate-spin';

            try {
                await cacheManager.forceReload();
            } catch (err) {
                Logger.error('Cache clear failed:', err);
                btn.disabled = false;
                icon.className = 'ti ti-refresh';
            }
        });
    }

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('sidebar-toggle');

        if (!sidebar) return;

        this.isSidebarCollapsed = !this.isSidebarCollapsed;
        sidebar.classList.toggle('collapsed', this.isSidebarCollapsed);

        // Also update layout wrapper for CSS targeting
        const layoutWrapper = document.querySelector('.layout-sidebar');
        if (layoutWrapper) {
            layoutWrapper.classList.toggle('sidebar-collapsed', this.isSidebarCollapsed);
        }

        if (toggle) {
            const isRight = this.config.sidebar?.position === SidebarPosition.RIGHT;
            toggle.querySelector('i').className = this.isSidebarCollapsed
                ? `ti ti-chevron-${isRight ? 'left' : 'right'}`
                : `ti ti-chevron-${isRight ? 'right' : 'left'}`;
        }

        // Update config and save
        this.applyConfig({ sidebar: { collapsed: this.isSidebarCollapsed } });
    }

    /**
     * Toggle mobile menu
     */
    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const topNavMenu = document.getElementById('top-nav-menu');
        const overlay = document.getElementById('sidebar-overlay');

        this.isMobileMenuOpen = !this.isMobileMenuOpen;

        if (sidebar) {
            sidebar.classList.toggle('open', this.isMobileMenuOpen);
        }

        if (topNavMenu) {
            topNavMenu.classList.toggle('open', this.isMobileMenuOpen);
        }

        if (overlay) {
            overlay.classList.toggle('visible', this.isMobileMenuOpen);
        }

        // Prevent body scroll when menu is open
        document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : '';
    }

    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const topNavMenu = document.getElementById('top-nav-menu');
        const overlay = document.getElementById('sidebar-overlay');

        this.isMobileMenuOpen = false;

        sidebar?.classList.remove('open');
        topNavMenu?.classList.remove('open');
        overlay?.classList.remove('visible');

        // Restore body scroll
        document.body.style.overflow = '';
    }

    /**
     * Bind top navigation dropdown events
     */
    bindTopNavDropdowns() {
        const dropdowns = document.querySelectorAll('.top-nav-dropdown');

        dropdowns.forEach(dropdown => {
            const trigger = dropdown.querySelector('.top-nav-dropdown-trigger');

            if (trigger) {
                // Toggle dropdown on click
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // Close other dropdowns
                    dropdowns.forEach(d => {
                        if (d !== dropdown) {
                            d.classList.remove('open');
                        }
                    });

                    // Toggle current dropdown
                    dropdown.classList.toggle('open');
                });

                // Hover to open (on desktop)
                if (window.innerWidth > 1024) {
                    dropdown.addEventListener('mouseenter', () => {
                        dropdown.classList.add('open');
                    });

                    dropdown.addEventListener('mouseleave', () => {
                        dropdown.classList.remove('open');
                    });
                }
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.top-nav-dropdown')) {
                dropdowns.forEach(d => d.classList.remove('open'));
            }
        });

        // Close dropdowns when pressing Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dropdowns.forEach(d => d.classList.remove('open'));
            }
        });
    }

    /**
     * Setup header scroll behavior
     */
    setupHeaderScrollBehavior() {
        const topNav = document.getElementById('top-nav');
        if (!topNav) return;

        const scrollBehavior = this.config.top?.scrollBehavior || 'fixed';

        // Remove previous scroll listener if exists
        if (this._scrollHandler) {
            window.removeEventListener('scroll', this._scrollHandler);
        }

        // Reset header state
        topNav.classList.remove('header-hidden', 'header-show-on-hover');

        if (scrollBehavior === 'fixed') {
            // Header always visible - default sticky behavior
            topNav.style.position = 'sticky';
            topNav.style.top = '0';
            return;
        }

        let lastScrollY = 0;
        let ticking = false;

        this._scrollHandler = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY;
                    const headerHeight = topNav.offsetHeight;

                    if (scrollBehavior === 'hidden') {
                        // Hide header when scrolling down, show when scrolling up
                        if (currentScrollY > lastScrollY && currentScrollY > headerHeight) {
                            topNav.classList.add('header-hidden');
                        } else {
                            topNav.classList.remove('header-hidden');
                        }
                    } else if (scrollBehavior === 'hidden-on-hover') {
                        // Hide header but show on hover
                        if (currentScrollY > headerHeight) {
                            topNav.classList.add('header-hidden', 'header-show-on-hover');
                        } else {
                            topNav.classList.remove('header-hidden', 'header-show-on-hover');
                        }
                    }

                    lastScrollY = currentScrollY;
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', this._scrollHandler, { passive: true });
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        const currentTheme = resolveTheme(this.config.themeMode);
        const newTheme = currentTheme === 'dark' ? ThemeMode.LIGHT : ThemeMode.DARK;
        this.applyConfig({ themeMode: newTheme });
    }

    /**
     * Set theme
     */
    setTheme(theme) {
        this.applyConfig({ themeMode: theme });
    }

    /**
     * Apply theme
     */
    applyTheme() {
        const theme = resolveTheme(this.config.themeMode);
        const isDark = theme === 'dark';

        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light';

        // Note: No longer saving to legacy key (omnex_theme)
        // All theme data is now in omnex-layout-config-v2
    }

    /**
     * Apply direction
     */
    applyDirection() {
        // Prefer i18n direction (RTL languages like Arabic), then config, then default ltr
        const i18nDirection = this.app?.i18n?.getDirection?.();
        const direction = i18nDirection || this.config.direction || 'ltr';
        document.documentElement.dir = direction;
        document.documentElement.lang = this.app?.i18n?.locale || document.documentElement.lang;
    }

    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Toggle user dropdown menu
     */
    toggleUserDropdown() {
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('open');
        }
    }

    /**
     * Handle user logout
     */
    async handleLogout() {
        try {
            // Close dropdown
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown) dropdown.classList.remove('open');

            // Call logout API
            if (this.app.auth) {
                await this.app.auth.logout();
            }

            // Redirect to login
            this.app.router.navigate('/login');
        } catch (error) {
            Logger.error('Logout failed:', error);
            // Still redirect to login on error
            this.app.router.navigate('/login');
        }
    }

    /**
     * Update active menu item
     */
    updateActiveMenu() {
        const currentPath = window.location.hash.replace('#', '') || '/dashboard';

        // Paths that should NOT match their parent paths
        // e.g., /settings/gateways should NOT activate /settings
        const exactMatchPaths = ['/settings', '/notifications', '/products'];

        // Update sidebar nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            const href = item.getAttribute('href')?.replace('#', '');
            if (!href) return;

            let isActive = false;

            // Check if this href requires exact match
            if (exactMatchPaths.includes(href)) {
                // Exact match only for these paths
                isActive = currentPath === href;
            } else {
                // Normal behavior: exact match or child path
                isActive = currentPath === href || currentPath.startsWith(href + '/');
            }

            item.classList.toggle('active', isActive);
        });

        // Update top nav items
        document.querySelectorAll('.top-nav-item').forEach(item => {
            const href = item.getAttribute('href')?.replace('#', '');
            if (!href) return;

            let isActive = false;

            if (exactMatchPaths.includes(href)) {
                isActive = currentPath === href;
            } else {
                isActive = currentPath === href || currentPath.startsWith(href + '/');
            }

            item.classList.toggle('active', isActive);
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for route changes
        window.addEventListener('hashchange', () => {
            if (this.isLayoutVisible) {
                this.updateActiveMenu();
                this.closeMobileMenu();
            }
        });

        // Listen for theme preference changes (for auto mode)
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (this.config.themeMode === ThemeMode.AUTO) {
                this.applyTheme();
                this.updateThemeIcon();
            }
        });
    }

    /**
     * Setup media queries for responsive behavior
     */
    setupMediaQueries() {
        const mobileQuery = window.matchMedia('(max-width: 1024px)');

        const handleMobileChange = (e) => {
            if (e.matches) {
                // Mobile view - close menu
                this.closeMobileMenu();
            }
            // Update header height variable when breakpoint changes
            this.updateMobileHeaderHeight();
        };

        mobileQuery.addEventListener('change', handleMobileChange);
        handleMobileChange(mobileQuery);

        // Also update on resize for two-row header height changes
        window.addEventListener('resize', () => {
            this.updateMobileHeaderHeight();
        });
    }

    /**
     * Destroy layout manager
     */
    destroy() {
        if (this.configurator) {
            this.configurator.destroy();
        }
        if (this.notificationManager) {
            this.notificationManager.destroy();
        }
        if (this.notificationDropdown) {
            this.notificationDropdown.destroy();
        }
    }
}

export default LayoutManager;
