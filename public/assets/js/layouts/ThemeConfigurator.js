/**
 * ThemeConfigurator.js - Settings Panel Component
 * Omnex Display Hub Layout System V2
 *
 * Floating settings panel for customizing layout, theme, and appearance.
 */

import {
    LayoutType,
    ThemeMode,
    BackgroundType,
    SidebarPosition,
    TopBarScroll,
    COLOR_PALETTE,
    DEFAULT_LAYOUT_CONFIG,
    STORAGE_KEYS,
    deepMerge,
    saveToLocalStorage,
    getBackgroundColor,
    debounce,
    resolveTheme
} from './LayoutConfig.js';

import { ColorUtils } from './ColorUtils.js';
import { Logger } from '../core/Logger.js';
import { Toast } from '../components/Toast.js';

export class ThemeConfigurator {
    constructor(app) {
        this.app = app;
        this.__ = (key, params = {}) => this.app?.i18n?.t(key, params) || key;
        this.isOpen = false;
        this.activeTab = 'desktop';
        this.container = null;
        this.panel = null;
        this.overlay = null;
        this.floatingBtn = null;

        // Debounced save to API
        this.debouncedSaveToApi = debounce(this.saveToApi.bind(this), 2000);

        // Bind methods
        this.open = this.open.bind(this);
        this.close = this.close.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * Initialize the configurator
     */
    init() {
        Logger.log('ThemeConfigurator: Initializing...');

        // Create container
        this.container = document.createElement('div');
        this.container.id = 'theme-configurator';
        document.body.appendChild(this.container);

        // Render initial state
        this.render();

        Logger.log('ThemeConfigurator: Rendered, floatingBtn:', this.floatingBtn);

        // Bind global events
        document.addEventListener('keydown', this.handleKeyDown);

        // Listen to layout config changes from other sources
        if (this.app.state && typeof this.app.state.subscribe === 'function') {
            this.app.state.subscribe('layout.config', () => {
                if (this.isOpen) {
                    this.updatePanelValues();
                }
            });
        }
    }

    /**
     * Get current config from LayoutManager
     */
    getConfig() {
        return this.app.layout?.config || DEFAULT_LAYOUT_CONFIG;
    }

    /**
     * Get current user role
     */
    getUserRole() {
        const user = this.app.state?.get('user');
        return user?.role || 'User';
    }

    /**
     * Check if user is admin
     */
    isAdmin() {
        const role = this.getUserRole();
        const isAdmin = ['Admin', 'SuperAdmin'].includes(role);
        Logger.debug('ThemeConfigurator.isAdmin:', { role, isAdmin });
        return isAdmin;
    }

    /**
     * Render the configurator
     */
    render() {
        this.container.innerHTML = `
            ${this.renderFloatingButton()}
            ${this.renderOverlay()}
            ${this.renderPanel()}
        `;

        // Get references
        this.floatingBtn = this.container.querySelector('.tc-floating-btn');
        this.overlay = this.container.querySelector('.tc-overlay');
        this.panel = this.container.querySelector('.tc-panel');

        // Bind events
        this.bindEvents();
    }

    /**
     * Render floating settings button
     */
    renderFloatingButton() {
        return `
            <div class="tc-floating-container">
                <button class="tc-floating-btn" title="${this.__('theme.title')}" aria-label="${this.__('theme.title')}">
                    <svg class="tc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                </button>
            </div>
        `;
    }

    /**
     * Render overlay
     */
    renderOverlay() {
        return `<div class="tc-overlay"></div>`;
    }

    /**
     * Render settings panel
     */
    renderPanel() {
        const config = this.getConfig();

        return `
            <div class="tc-panel">
                ${this.renderPanelHeader()}
                <div class="tc-panel-content">
                    ${this.renderLayoutSection(config)}
                    ${this.renderThemeSection(config)}
                    ${this.renderSidebarSection(config)}
                    ${this.renderHeaderSection(config)}
                    ${this.renderContentAreaSection(config)}
                    ${this.renderFooterSection(config)}
                    ${this.isAdmin() ? this.renderAdminSection() : ''}
                </div>
                ${this.renderPanelFooter()}
            </div>
        `;
    }

    /**
     * Render panel header
     */
    renderPanelHeader() {
        return `
            <div class="tc-panel-header">
                <h3 class="tc-panel-title">${this.__('theme.title')}</h3>
                <button class="tc-panel-close" aria-label="${this.__('theme.close')}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;
    }

    /**
     * Render layout type section
     */
    renderLayoutSection(config) {
        const isSidebar = config.layoutType === LayoutType.SIDEBAR;
        const isTop = config.layoutType === LayoutType.TOP;

        return `
            <div class="tc-section">
                <h4 class="tc-section-title">${this.__('theme.layoutType')}</h4>
                <div class="tc-layout-grid">
                    <button class="tc-layout-card ${isSidebar ? 'active' : ''}" data-layout="${LayoutType.SIDEBAR}">
                        <div class="tc-layout-card-icon">
                            <svg viewBox="0 0 48 32" fill="none">
                                <rect x="1" y="1" width="12" height="30" rx="2" fill="${isSidebar ? '#228be6' : '#dee2e6'}" stroke="${isSidebar ? '#1864ab' : '#adb5bd'}"/>
                                <rect x="15" y="1" width="32" height="30" rx="2" fill="${isSidebar ? '#e7f5ff' : '#f8f9fa'}" stroke="${isSidebar ? '#74c0fc' : '#dee2e6'}"/>
                            </svg>
                        </div>
                        <span class="tc-layout-card-label">Sidebar</span>
                    </button>
                    <button class="tc-layout-card ${isTop ? 'active' : ''}" data-layout="${LayoutType.TOP}">
                        <div class="tc-layout-card-icon">
                            <svg viewBox="0 0 48 32" fill="none">
                                <rect x="1" y="1" width="46" height="8" rx="2" fill="${isTop ? '#228be6' : '#dee2e6'}" stroke="${isTop ? '#1864ab' : '#adb5bd'}"/>
                                <rect x="1" y="11" width="46" height="20" rx="2" fill="${isTop ? '#e7f5ff' : '#f8f9fa'}" stroke="${isTop ? '#74c0fc' : '#dee2e6'}"/>
                            </svg>
                        </div>
                        <span class="tc-layout-card-label">Top Navigation</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render theme mode section
     */
    renderThemeSection(config) {
        const isLight = config.themeMode === ThemeMode.LIGHT;
        const isDark = config.themeMode === ThemeMode.DARK;
        const isAuto = config.themeMode === ThemeMode.AUTO;

        return `
            <div class="tc-section">
                <h4 class="tc-section-title">${this.__('theme.themeMode')}</h4>
                <div class="tc-theme-grid">
                    <button class="tc-theme-btn ${isLight ? 'active' : ''}" data-theme="${ThemeMode.LIGHT}">
                        <svg class="tc-theme-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="5"></circle>
                            <line x1="12" y1="1" x2="12" y2="3"></line>
                            <line x1="12" y1="21" x2="12" y2="23"></line>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                            <line x1="1" y1="12" x2="3" y2="12"></line>
                            <line x1="21" y1="12" x2="23" y2="12"></line>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                        </svg>
                        <span class="tc-theme-btn-label">${this.__('theme.light')}</span>
                    </button>
                    <button class="tc-theme-btn ${isDark ? 'active' : ''}" data-theme="${ThemeMode.DARK}">
                        <svg class="tc-theme-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                        </svg>
                        <span class="tc-theme-btn-label">${this.__('theme.dark')}</span>
                    </button>
                    <button class="tc-theme-btn ${isAuto ? 'active' : ''}" data-theme="${ThemeMode.AUTO}">
                        <svg class="tc-theme-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                            <line x1="8" y1="21" x2="16" y2="21"></line>
                            <line x1="12" y1="17" x2="12" y2="21"></line>
                        </svg>
                        <span class="tc-theme-btn-label">${this.__('theme.auto')}</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render sidebar settings section
     */
    renderSidebarSection(config) {
        const sidebar = config.sidebar || {};
        const isLeft = sidebar.position === SidebarPosition.LEFT;
        const isRight = sidebar.position === SidebarPosition.RIGHT;
        const showSidebar = config.layoutType === LayoutType.SIDEBAR;

        if (!showSidebar) {
            return '';
        }

        return `
            <div class="tc-section">
                <h4 class="tc-section-title">${this.__('theme.sidebarSettings')}</h4>
                <div class="tc-section-content">
                    <!-- Position -->
                    <div class="tc-position-grid">
                        <button class="tc-position-btn ${isLeft ? 'active' : ''}" data-position="${SidebarPosition.LEFT}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="9" y1="3" x2="9" y2="21"></line>
                            </svg>
                            <span class="tc-position-btn-label">${this.__('theme.left')}</span>
                        </button>
                        <button class="tc-position-btn ${isRight ? 'active' : ''}" data-position="${SidebarPosition.RIGHT}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="15" y1="3" x2="15" y2="21"></line>
                            </svg>
                            <span class="tc-position-btn-label">${this.__('theme.right')}</span>
                        </button>
                    </div>

                    <!-- Width Slider -->
                    <div class="tc-slider-wrapper">
                        <div class="tc-slider-header">
                            <span class="tc-slider-label">${this.__('theme.width')}</span>
                            <span class="tc-slider-value" id="sidebar-width-value">${sidebar.width || 260}px</span>
                        </div>
                        <input type="range" class="tc-slider" id="sidebar-width"
                            min="200" max="320" value="${sidebar.width || 260}" step="10">
                    </div>

                    <!-- Collapsed Toggle -->
                    <div class="tc-switch-wrapper">
                        <span class="tc-switch-label">${this.__('theme.startCollapsed')}</span>
                        <label class="tc-switch">
                            <input type="checkbox" id="sidebar-collapsed" ${sidebar.collapsed ? 'checked' : ''}>
                            <span class="tc-switch-track"></span>
                        </label>
                    </div>

                    <!-- Background Color -->
                    ${this.renderColorPicker('sidebar-bg', this.__('theme.background'), sidebar.background, sidebar.customColor)}

                    <!-- Border Section -->
                    <div class="tc-border-section">
                        <div class="tc-switch-wrapper">
                            <span class="tc-switch-label">${this.__('theme.border')}</span>
                            <label class="tc-switch">
                                <input type="checkbox" id="sidebar-border" ${sidebar.border?.enabled !== false ? 'checked' : ''}>
                                <span class="tc-switch-track"></span>
                            </label>
                        </div>

                        <!-- Border Width Slider -->
                        <div class="tc-slider-wrapper tc-border-options" id="border-options" style="${sidebar.border?.enabled === false ? 'display: none;' : ''}">
                            <div class="tc-slider-header">
                                <span class="tc-slider-label">${this.__('theme.borderWidth')}</span>
                                <span class="tc-slider-value" id="border-width-value">${sidebar.border?.width || 1}px</span>
                            </div>
                            <input type="range" class="tc-slider" id="border-width"
                                min="0" max="4" value="${sidebar.border?.width || 1}" step="1">
                        </div>

                        <!-- Border Color -->
                        <div class="tc-color-row tc-border-options" style="${sidebar.border?.enabled === false ? 'display: none;' : ''}">
                            <span class="tc-color-label">${this.__('theme.borderColor')}</span>
                            <input type="color" class="tc-color-input" id="border-color"
                                value="${sidebar.border?.color || '#e9ecef'}">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render header/top bar settings section (only for top layout)
     */
    renderHeaderSection(config) {
        const top = config.top || {};
        const isTopLayout = config.layoutType === 'top';

        // Hide completely when not in top layout
        if (!isTopLayout) {
            return '';
        }

        const scrollBehavior = top.scrollBehavior || 'fixed';

        return `
            <div class="tc-section">
                <h4 class="tc-section-title">${this.__('theme.topNavigation')}</h4>
                <div class="tc-section-content">
                    <!-- Scroll Behavior -->
                    <div class="tc-select-wrapper">
                        <span class="tc-select-label">${this.__('theme.scrollBehavior')}</span>
                        <select class="tc-select" id="header-scroll-behavior">
                            <option value="fixed" ${scrollBehavior === 'fixed' ? 'selected' : ''}>${this.__('theme.scrollFixed')}</option>
                            <option value="hidden" ${scrollBehavior === 'hidden' ? 'selected' : ''}>${this.__('theme.scrollHidden')}</option>
                            <option value="hidden-on-hover" ${scrollBehavior === 'hidden-on-hover' ? 'selected' : ''}>${this.__('theme.scrollHiddenOnHover')}</option>
                        </select>
                    </div>

                    <!-- Height Slider -->
                    <div class="tc-slider-wrapper">
                        <div class="tc-slider-header">
                            <span class="tc-slider-label">${this.__('theme.height')}</span>
                            <span class="tc-slider-value" id="header-height-value">${top.height || 64}px</span>
                        </div>
                        <input type="range" class="tc-slider" id="header-height"
                            min="48" max="96" value="${top.height || 64}" step="4">
                    </div>

                    <!-- Background Color -->
                    ${this.renderColorPicker('header-bg', this.__('theme.background'), top.background, top.customColor)}

                    <!-- Border Section -->
                    <div class="tc-border-section">
                        <div class="tc-switch-wrapper">
                            <span class="tc-switch-label">${this.__('theme.border')}</span>
                            <label class="tc-switch">
                                <input type="checkbox" id="header-border" ${top.border?.enabled !== false ? 'checked' : ''}>
                                <span class="tc-switch-track"></span>
                            </label>
                        </div>

                        <!-- Border Width Slider -->
                        <div class="tc-slider-wrapper tc-header-border-options" style="${top.border?.enabled === false ? 'display: none;' : ''}">
                            <div class="tc-slider-header">
                                <span class="tc-slider-label">${this.__('theme.borderWidth')}</span>
                                <span class="tc-slider-value" id="header-border-width-value">${top.border?.width || 1}px</span>
                            </div>
                            <input type="range" class="tc-slider" id="header-border-width"
                                min="0" max="4" value="${top.border?.width || 1}" step="1">
                        </div>

                        <!-- Border Color -->
                        <div class="tc-color-row tc-header-border-options" style="${top.border?.enabled === false ? 'display: none;' : ''}">
                            <span class="tc-color-label">${this.__('theme.borderColor')}</span>
                            <input type="color" class="tc-color-input" id="header-border-color"
                                value="${top.border?.color || '#e9ecef'}">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render content area section
     */
    renderContentAreaSection(config) {
        const contentArea = config.contentArea || {};
        const padding = contentArea.padding || { top: 24, right: 24, bottom: 24, left: 24 };

        return `
            <div class="tc-section">
                <h4 class="tc-section-title">${this.__('theme.contentArea')}</h4>
                <div class="tc-section-content">
                    <!-- Responsive Tabs -->
                    <div class="tc-tabs">
                        <button class="tc-tab ${this.activeTab === 'desktop' ? 'active' : ''}" data-tab="desktop">${this.__('theme.desktop')}</button>
                        <button class="tc-tab ${this.activeTab === 'tablet' ? 'active' : ''}" data-tab="tablet">${this.__('theme.tablet')}</button>
                        <button class="tc-tab ${this.activeTab === 'mobile' ? 'active' : ''}" data-tab="mobile">${this.__('theme.mobile')}</button>
                    </div>

                    <!-- Desktop Tab -->
                    <div class="tc-tab-content ${this.activeTab === 'desktop' ? 'active' : ''}" data-tab-content="desktop">
                        <div class="tc-padding-grid">
                            <div class="tc-padding-item">
                                <label class="tc-padding-label">${this.__('theme.top')}</label>
                                <input type="number" class="tc-padding-input" id="padding-top" value="${padding.top}" min="0" max="100">
                            </div>
                            <div class="tc-padding-item">
                                <label class="tc-padding-label">${this.__('theme.right')}</label>
                                <input type="number" class="tc-padding-input" id="padding-right" value="${padding.right}" min="0" max="100">
                            </div>
                            <div class="tc-padding-item">
                                <label class="tc-padding-label">${this.__('theme.bottom')}</label>
                                <input type="number" class="tc-padding-input" id="padding-bottom" value="${padding.bottom}" min="0" max="100">
                            </div>
                            <div class="tc-padding-item">
                                <label class="tc-padding-label">${this.__('theme.left')}</label>
                                <input type="number" class="tc-padding-input" id="padding-left" value="${padding.left}" min="0" max="100">
                            </div>
                        </div>
                    </div>

                    <!-- Tablet Tab -->
                    <div class="tc-tab-content ${this.activeTab === 'tablet' ? 'active' : ''}" data-tab-content="tablet">
                        <div class="tc-padding-grid">
                            <div class="tc-padding-item">
                                <label class="tc-padding-label">${this.__('theme.top')}</label>
                                <input type="number" class="tc-padding-input" id="padding-top-tablet"
                                    value="${contentArea.responsive?.tablet?.padding?.top || 20}" min="0" max="100">
                            </div>
                            <div class="tc-padding-item">
                                <label class="tc-padding-label">${this.__('theme.right')}</label>
                                <input type="number" class="tc-padding-input" id="padding-right-tablet"
                                    value="${contentArea.responsive?.tablet?.padding?.right || 20}" min="0" max="100">
                            </div>
                            <div class="tc-padding-item">
                                <label class="tc-padding-label">${this.__('theme.bottom')}</label>
                                <input type="number" class="tc-padding-input" id="padding-bottom-tablet"
                                    value="${contentArea.responsive?.tablet?.padding?.bottom || 20}" min="0" max="100">
                            </div>
                            <div class="tc-padding-item">
                                <label class="tc-padding-label">${this.__('theme.left')}</label>
                                <input type="number" class="tc-padding-input" id="padding-left-tablet"
                                    value="${contentArea.responsive?.tablet?.padding?.left || 20}" min="0" max="100">
                            </div>
                        </div>
                    </div>

                    <!-- Mobile Tab -->
                    <div class="tc-tab-content ${this.activeTab === 'mobile' ? 'active' : ''}" data-tab-content="mobile">
                        <div class="tc-padding-grid">
                            <div class="tc-padding-item">
                                <label class="tc-padding-label">${this.__('theme.top')}</label>
                                <input type="number" class="tc-padding-input" id="padding-top-mobile"
                                    value="${contentArea.responsive?.mobile?.padding?.top || 16}" min="0" max="100">
                            </div>
                            <div class="tc-padding-item">
                                <label class="tc-padding-label">${this.__('theme.right')}</label>
                                <input type="number" class="tc-padding-input" id="padding-right-mobile"
                                    value="${contentArea.responsive?.mobile?.padding?.right || 16}" min="0" max="100">
                            </div>
                            <div class="tc-padding-item">
                                <label class="tc-padding-label">${this.__('theme.bottom')}</label>
                                <input type="number" class="tc-padding-input" id="padding-bottom-mobile"
                                    value="${contentArea.responsive?.mobile?.padding?.bottom || 16}" min="0" max="100">
                            </div>
                            <div class="tc-padding-item">
                                <label class="tc-padding-label">${this.__('theme.left')}</label>
                                <input type="number" class="tc-padding-input" id="padding-left-mobile"
                                    value="${contentArea.responsive?.mobile?.padding?.left || 16}" min="0" max="100">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render footer visibility section
     */
    renderFooterSection(config) {
        return `
            <div class="tc-section">
                <h4 class="tc-section-title">Footer</h4>
                <div class="tc-switch-wrapper">
                    <span class="tc-switch-label">${this.__('theme.showFooter')}</span>
                    <label class="tc-switch">
                        <input type="checkbox" id="footer-visible" ${config.footerVisible !== false ? 'checked' : ''}>
                        <span class="tc-switch-track"></span>
                    </label>
                </div>
            </div>
        `;
    }

    /**
     * Render admin-only section
     */
    renderAdminSection() {
        return `
            <div class="tc-divider"></div>
            <div class="tc-section tc-admin-section">
                <h4 class="tc-section-title">
                    <span>${this.__('theme.admin')}</span>
                    <span class="tc-admin-badge">Admin</span>
                </h4>
                <div class="tc-section-content">
                    <button class="tc-btn tc-btn-secondary" id="set-company-default" style="width: 100%;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                            <path d="M2 17l10 5 10-5"></path>
                            <path d="M2 12l10 5 10-5"></path>
                        </svg>
                        ${this.__('theme.saveAsCompanyDefault')}
                    </button>
                    <p style="font-size: 11px; color: var(--tc-text-muted); margin: 8px 0 0 0;">
                        ${this.__('theme.companyDefaultDescription')}
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Render color picker component
     */
    renderColorPicker(id, label, background, customColor) {
        const bgType = background || BackgroundType.LIGHT;
        const isCustom = bgType === BackgroundType.CUSTOM;

        return `
            <div class="tc-color-section">
                <span class="tc-color-label">${label}</span>
                <div class="tc-color-palette">
                    ${this.renderColorSwatch(id, BackgroundType.LIGHT, bgType, '#ffffff', this.__('theme.light'))}
                    ${this.renderColorSwatch(id, BackgroundType.DARK, bgType, '#1f2937', this.__('theme.dark'))}
                    ${this.renderColorSwatch(id, BackgroundType.BRAND, bgType, '#228be6', this.__('theme.brand'))}
                    ${COLOR_PALETTE.slice(0, 3).map(color =>
                        this.renderColorSwatch(id, BackgroundType.CUSTOM, bgType, color, color, customColor === color)
                    ).join('')}
                </div>
                <div class="tc-color-custom">
                    <input type="color" class="tc-color-input" id="${id}-custom"
                        value="${customColor || '#228be6'}">
                    <input type="text" class="tc-color-hex" id="${id}-hex"
                        value="${customColor || '#228be6'}" placeholder="#000000">
                </div>
            </div>
        `;
    }

    /**
     * Render color swatch
     */
    renderColorSwatch(groupId, type, currentType, color, title, isActive = false) {
        // For CUSTOM type swatches, only mark active if isActive is explicitly true
        // For other types (LIGHT, DARK, BRAND), mark active if type matches currentType
        let active = false;
        if (type === BackgroundType.CUSTOM) {
            // Custom swatches are only active when explicitly marked via isActive parameter
            active = isActive;
        } else {
            // Standard swatches (LIGHT, DARK, BRAND) are active when type matches
            active = type === currentType;
        }
        const isLight = ColorUtils.isLightColor(color);

        return `
            <button class="tc-color-swatch ${active ? 'active' : ''} ${isLight ? 'light' : ''}"
                data-color-group="${groupId}"
                data-color-type="${type}"
                data-color="${color}"
                style="background-color: ${color};"
                title="${title}">
            </button>
        `;
    }

    /**
     * Render panel footer
     */
    renderPanelFooter() {
        return `
            <div class="tc-panel-footer">
                <button class="tc-btn tc-btn-ghost tc-btn-sm" id="reset-config">${this.__('theme.reset')}</button>
                <button class="tc-btn tc-btn-primary" id="save-config">${this.__('theme.save')}</button>
            </div>
        `;
    }

    /**
     * Bind all event handlers
     */
    bindEvents() {
        Logger.log('ThemeConfigurator: Binding events, floatingBtn:', this.floatingBtn);

        // Floating button
        if (this.floatingBtn) {
            this.floatingBtn.addEventListener('click', this.open);
            Logger.log('ThemeConfigurator: Click listener added to floating button');
        } else {
            Logger.error('ThemeConfigurator: floatingBtn is null!');
        }

        // Overlay click to close
        this.overlay?.addEventListener('click', this.close);

        // Close button
        this.panel?.querySelector('.tc-panel-close')?.addEventListener('click', this.close);

        // Layout type buttons
        this.panel?.querySelectorAll('[data-layout]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const layout = e.currentTarget.dataset.layout;
                this.applyChanges({ layoutType: layout });
            });
        });

        // Theme mode buttons
        this.panel?.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.applyChanges({ themeMode: theme });
            });
        });

        // Sidebar position buttons
        this.panel?.querySelectorAll('[data-position]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const position = e.currentTarget.dataset.position;
                this.applyChanges({ sidebar: { position } });
            });
        });

        // Sidebar width slider
        const widthSlider = this.panel?.querySelector('#sidebar-width');
        widthSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.panel.querySelector('#sidebar-width-value').textContent = `${value}px`;
            this.applyChanges({ sidebar: { width: value } });
        });

        // Sidebar collapsed toggle
        const collapsedToggle = this.panel?.querySelector('#sidebar-collapsed');
        collapsedToggle?.addEventListener('change', (e) => {
            this.applyChanges({ sidebar: { collapsed: e.target.checked } });
        });

        // Sidebar border toggle
        const borderToggle = this.panel?.querySelector('#sidebar-border');
        borderToggle?.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            this.applyChanges({ sidebar: { border: { enabled } } });

            // Show/hide border options
            this.panel?.querySelectorAll('.tc-border-options').forEach(el => {
                el.style.display = enabled ? '' : 'none';
            });
        });

        // Border width slider
        const borderWidthSlider = this.panel?.querySelector('#border-width');
        borderWidthSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.panel.querySelector('#border-width-value').textContent = `${value}px`;
            this.applyChanges({ sidebar: { border: { width: value } } });
        });

        // Border color input
        const borderColorInput = this.panel?.querySelector('#border-color');
        borderColorInput?.addEventListener('input', (e) => {
            this.applyChanges({ sidebar: { border: { color: e.target.value } } });
        });

        // Header scroll behavior
        const headerScrollBehavior = this.panel?.querySelector('#header-scroll-behavior');
        headerScrollBehavior?.addEventListener('change', (e) => {
            this.applyChanges({ top: { scrollBehavior: e.target.value } });
        });

        // Header height slider
        const headerHeightSlider = this.panel?.querySelector('#header-height');
        headerHeightSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.panel.querySelector('#header-height-value').textContent = `${value}px`;
            this.applyChanges({ top: { height: value } });
        });

        // Header border toggle
        const headerBorderToggle = this.panel?.querySelector('#header-border');
        headerBorderToggle?.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            this.applyChanges({ top: { border: { enabled } } });

            // Show/hide header border options
            this.panel?.querySelectorAll('.tc-header-border-options').forEach(el => {
                el.style.display = enabled ? '' : 'none';
            });
        });

        // Header border width slider
        const headerBorderWidthSlider = this.panel?.querySelector('#header-border-width');
        headerBorderWidthSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.panel.querySelector('#header-border-width-value').textContent = `${value}px`;
            this.applyChanges({ top: { border: { width: value } } });
        });

        // Header border color input
        const headerBorderColorInput = this.panel?.querySelector('#header-border-color');
        headerBorderColorInput?.addEventListener('input', (e) => {
            this.applyChanges({ top: { border: { color: e.target.value } } });
        });

        // Color swatches
        this.panel?.querySelectorAll('.tc-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                const group = e.currentTarget.dataset.colorGroup;
                const type = e.currentTarget.dataset.colorType;
                const color = e.currentTarget.dataset.color;

                // Update UI
                this.panel.querySelectorAll(`[data-color-group="${group}"]`).forEach(s => {
                    s.classList.remove('active');
                });
                e.currentTarget.classList.add('active');

                // Apply changes based on group
                if (group === 'sidebar-bg') {
                    this.applyChanges({
                        sidebar: {
                            background: type,
                            customColor: type === BackgroundType.CUSTOM ? color : null
                        }
                    });
                } else if (group === 'header-bg') {
                    this.applyChanges({
                        top: {
                            background: type,
                            customColor: type === BackgroundType.CUSTOM ? color : null
                        }
                    });
                }
            });
        });

        // Custom color input
        const customColorInput = this.panel?.querySelector('#sidebar-bg-custom');
        customColorInput?.addEventListener('input', (e) => {
            const color = e.target.value;
            this.panel.querySelector('#sidebar-bg-hex').value = color;
            this.applyChanges({
                sidebar: {
                    background: BackgroundType.CUSTOM,
                    customColor: color
                }
            });
        });

        // Hex input
        const hexInput = this.panel?.querySelector('#sidebar-bg-hex');
        hexInput?.addEventListener('change', (e) => {
            let color = e.target.value;
            if (!color.startsWith('#')) color = '#' + color;
            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                this.panel.querySelector('#sidebar-bg-custom').value = color;
                this.applyChanges({
                    sidebar: {
                        background: BackgroundType.CUSTOM,
                        customColor: color
                    }
                });
            }
        });

        // Header custom color input
        const headerCustomColorInput = this.panel?.querySelector('#header-bg-custom');
        headerCustomColorInput?.addEventListener('input', (e) => {
            const color = e.target.value;
            const hexInput = this.panel.querySelector('#header-bg-hex');
            if (hexInput) hexInput.value = color;
            this.applyChanges({
                top: {
                    background: BackgroundType.CUSTOM,
                    customColor: color
                }
            });
        });

        // Header hex input
        const headerHexInput = this.panel?.querySelector('#header-bg-hex');
        headerHexInput?.addEventListener('change', (e) => {
            let color = e.target.value;
            if (!color.startsWith('#')) color = '#' + color;
            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                const colorInput = this.panel.querySelector('#header-bg-custom');
                if (colorInput) colorInput.value = color;
                this.applyChanges({
                    top: {
                        background: BackgroundType.CUSTOM,
                        customColor: color
                    }
                });
            }
        });

        // Tabs
        this.panel?.querySelectorAll('.tc-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.activeTab = tabName;

                // Update tab buttons
                this.panel.querySelectorAll('.tc-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Update tab content
                this.panel.querySelectorAll('.tc-tab-content').forEach(content => {
                    content.classList.toggle('active', content.dataset.tabContent === tabName);
                });
            });
        });

        // Padding inputs - Desktop
        ['top', 'right', 'bottom', 'left'].forEach(side => {
            const input = this.panel?.querySelector(`#padding-${side}`);
            input?.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 0;
                this.applyChanges({
                    contentArea: {
                        padding: { [side]: value }
                    }
                });
            });
        });

        // Padding inputs - Tablet
        ['top', 'right', 'bottom', 'left'].forEach(side => {
            const input = this.panel?.querySelector(`#padding-${side}-tablet`);
            input?.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 0;
                this.applyChanges({
                    contentArea: {
                        responsive: {
                            tablet: {
                                padding: { [side]: value }
                            }
                        }
                    }
                });
            });
        });

        // Padding inputs - Mobile
        ['top', 'right', 'bottom', 'left'].forEach(side => {
            const input = this.panel?.querySelector(`#padding-${side}-mobile`);
            input?.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 0;
                this.applyChanges({
                    contentArea: {
                        responsive: {
                            mobile: {
                                padding: { [side]: value }
                            }
                        }
                    }
                });
            });
        });

        // Footer toggle
        const footerToggle = this.panel?.querySelector('#footer-visible');
        footerToggle?.addEventListener('change', (e) => {
            this.applyChanges({ footerVisible: e.target.checked });
        });

        // Save button
        const saveBtn = this.panel?.querySelector('#save-config');
        saveBtn?.addEventListener('click', () => {
            this.saveConfig();
            this.close();
        });

        // Reset button
        const resetBtn = this.panel?.querySelector('#reset-config');
        resetBtn?.addEventListener('click', () => {
            this.resetConfig();
        });

        // Set company default button (admin only)
        const setDefaultBtn = this.panel?.querySelector('#set-company-default');
        setDefaultBtn?.addEventListener('click', () => {
            this.setCompanyDefault();
        });
    }

    /**
     * Handle keyboard events
     */
    handleKeyDown(e) {
        if (e.key === 'Escape' && this.isOpen) {
            this.close();
        }
    }

    /**
     * Open the settings panel
     */
    open() {
        Logger.log('ThemeConfigurator: Opening panel...');
        this.isOpen = true;
        this.floatingBtn?.classList.add('active');
        this.overlay?.classList.add('visible');

        // Re-render panel content to ensure admin section visibility is correct
        this.refreshPanel();

        this.panel?.classList.add('open');
        document.body.style.overflow = 'hidden';

        // Update panel values with current config
        this.updatePanelValues();
    }

    /**
     * Close the settings panel
     */
    close() {
        this.isOpen = false;
        this.floatingBtn?.classList.remove('active');
        this.overlay?.classList.remove('visible');
        this.panel?.classList.remove('open');
        document.body.style.overflow = '';
    }

    /**
     * Update panel input values from current config
     */
    updatePanelValues() {
        const config = this.getConfig();

        // Update layout type
        this.panel?.querySelectorAll('[data-layout]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.layout === config.layoutType);
        });

        // Update theme mode
        this.panel?.querySelectorAll('[data-theme]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === config.themeMode);
        });

        // Update sidebar position
        this.panel?.querySelectorAll('[data-position]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.position === config.sidebar?.position);
        });

        // Update sidebar settings
        const widthSlider = this.panel?.querySelector('#sidebar-width');
        if (widthSlider) {
            widthSlider.value = config.sidebar?.width || 260;
            const valueDisplay = this.panel?.querySelector('#sidebar-width-value');
            if (valueDisplay) valueDisplay.textContent = `${config.sidebar?.width || 260}px`;
        }

        const collapsedToggle = this.panel?.querySelector('#sidebar-collapsed');
        if (collapsedToggle) collapsedToggle.checked = config.sidebar?.collapsed || false;

        const borderToggle = this.panel?.querySelector('#sidebar-border');
        if (borderToggle) borderToggle.checked = config.sidebar?.border?.enabled !== false;

        // Update sidebar border width
        const borderWidthSlider = this.panel?.querySelector('#border-width');
        if (borderWidthSlider) {
            borderWidthSlider.value = config.sidebar?.border?.width || 1;
            const valueDisplay = this.panel?.querySelector('#border-width-value');
            if (valueDisplay) valueDisplay.textContent = `${config.sidebar?.border?.width || 1}px`;
        }

        // Update sidebar border color
        const borderColorInput = this.panel?.querySelector('#border-color');
        if (borderColorInput) borderColorInput.value = config.sidebar?.border?.color || '#e9ecef';

        // Update header settings (only if top layout)
        if (config.layoutType === 'top') {
            const headerScrollBehavior = this.panel?.querySelector('#header-scroll-behavior');
            if (headerScrollBehavior) headerScrollBehavior.value = config.top?.scrollBehavior || 'fixed';

            const headerHeightSlider = this.panel?.querySelector('#header-height');
            if (headerHeightSlider) {
                headerHeightSlider.value = config.top?.height || 64;
                const valueDisplay = this.panel?.querySelector('#header-height-value');
                if (valueDisplay) valueDisplay.textContent = `${config.top?.height || 64}px`;
            }

            const headerBorderToggle = this.panel?.querySelector('#header-border');
            if (headerBorderToggle) headerBorderToggle.checked = config.top?.border?.enabled !== false;

            const headerBorderWidthSlider = this.panel?.querySelector('#header-border-width');
            if (headerBorderWidthSlider) {
                headerBorderWidthSlider.value = config.top?.border?.width || 1;
                const valueDisplay = this.panel?.querySelector('#header-border-width-value');
                if (valueDisplay) valueDisplay.textContent = `${config.top?.border?.width || 1}px`;
            }

            const headerBorderColorInput = this.panel?.querySelector('#header-border-color');
            if (headerBorderColorInput) headerBorderColorInput.value = config.top?.border?.color || '#e9ecef';
        }

        const footerToggle = this.panel?.querySelector('#footer-visible');
        if (footerToggle) footerToggle.checked = config.footerVisible !== false;

        // Update desktop padding inputs
        ['top', 'right', 'bottom', 'left'].forEach(side => {
            const input = this.panel?.querySelector(`#padding-${side}`);
            if (input) {
                input.value = config.contentArea?.padding?.[side] ?? 24;
            }
        });

        // Update tablet padding inputs
        ['top', 'right', 'bottom', 'left'].forEach(side => {
            const input = this.panel?.querySelector(`#padding-${side}-tablet`);
            if (input) {
                input.value = config.contentArea?.responsive?.tablet?.padding?.[side] ?? 20;
            }
        });

        // Update mobile padding inputs
        ['top', 'right', 'bottom', 'left'].forEach(side => {
            const input = this.panel?.querySelector(`#padding-${side}-mobile`);
            if (input) {
                input.value = config.contentArea?.responsive?.mobile?.padding?.[side] ?? 16;
            }
        });

        // Update sidebar background color swatches
        const sidebarBg = config.sidebar?.background || 'light';
        const sidebarCustomColor = config.sidebar?.customColor;
        this.panel?.querySelectorAll('[data-color-group="sidebar-bg"]').forEach(swatch => {
            const type = swatch.dataset.colorType;
            const color = swatch.dataset.color;
            // For CUSTOM type swatches, only mark active when background is 'custom' AND color matches
            // For other types (light, dark, brand), mark active when type matches background
            let isActive = false;
            if (type === BackgroundType.CUSTOM) {
                isActive = sidebarBg === 'custom' && color === sidebarCustomColor;
            } else {
                isActive = type === sidebarBg;
            }
            swatch.classList.toggle('active', isActive);
        });

        // Update sidebar custom color inputs
        const sidebarCustomInput = this.panel?.querySelector('#sidebar-bg-custom');
        if (sidebarCustomInput && sidebarCustomColor) sidebarCustomInput.value = sidebarCustomColor;
        const sidebarHexInput = this.panel?.querySelector('#sidebar-bg-hex');
        if (sidebarHexInput && sidebarCustomColor) sidebarHexInput.value = sidebarCustomColor;

        // Update header background color swatches (only if top layout)
        if (config.layoutType === 'top') {
            const headerBg = config.top?.background || 'light';
            const headerCustomColor = config.top?.customColor;
            this.panel?.querySelectorAll('[data-color-group="header-bg"]').forEach(swatch => {
                const type = swatch.dataset.colorType;
                const color = swatch.dataset.color;
                // For CUSTOM type swatches, only mark active when background is 'custom' AND color matches
                // For other types (light, dark, brand), mark active when type matches background
                let isActive = false;
                if (type === BackgroundType.CUSTOM) {
                    isActive = headerBg === 'custom' && color === headerCustomColor;
                } else {
                    isActive = type === headerBg;
                }
                swatch.classList.toggle('active', isActive);
            });

            // Update header custom color inputs
            const headerCustomInput = this.panel?.querySelector('#header-bg-custom');
            if (headerCustomInput && headerCustomColor) headerCustomInput.value = headerCustomColor;
            const headerHexInput = this.panel?.querySelector('#header-bg-hex');
            if (headerHexInput && headerCustomColor) headerHexInput.value = headerCustomColor;
        }
    }

    /**
     * Apply configuration changes
     */
    async applyChanges(changes) {
        if (this.app.layout) {
            await this.app.layout.applyConfig(changes);

            // If layout type changed, re-render the panel to show/hide sections
            if (changes.layoutType !== undefined) {
                this.refreshPanel();
            }
        }
    }

    /**
     * Refresh the panel content while keeping it open
     */
    refreshPanel() {
        const wasOpen = this.isOpen;

        // Re-render just the panel content
        if (this.panel) {
            // Store scroll position
            const scrollTop = this.panel.querySelector('.tc-panel-content')?.scrollTop || 0;

            // Re-render panel
            const panelHtml = this.renderPanel();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = panelHtml;
            const newPanel = tempDiv.querySelector('.tc-panel');

            if (newPanel) {
                this.panel.innerHTML = newPanel.innerHTML;

                // Re-bind events
                this.bindPanelEvents();

                // Restore scroll position
                const content = this.panel.querySelector('.tc-panel-content');
                if (content) content.scrollTop = scrollTop;

                // Restore open state
                if (wasOpen) {
                    this.panel.classList.add('open');
                }
            }
        }
    }

    /**
     * Bind only panel-internal events (not floating button)
     */
    bindPanelEvents() {
        // Close button
        this.panel?.querySelector('.tc-panel-close')?.addEventListener('click', this.close);

        // Layout type buttons
        this.panel?.querySelectorAll('[data-layout]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const layout = e.currentTarget.dataset.layout;
                this.applyChanges({ layoutType: layout });
            });
        });

        // Theme mode buttons
        this.panel?.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.applyChanges({ themeMode: theme });
            });
        });

        // Sidebar position buttons
        this.panel?.querySelectorAll('[data-position]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const position = e.currentTarget.dataset.position;
                this.applyChanges({ sidebar: { position } });
            });
        });

        // Sidebar width slider
        const widthSlider = this.panel?.querySelector('#sidebar-width');
        widthSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.panel.querySelector('#sidebar-width-value').textContent = `${value}px`;
            this.applyChanges({ sidebar: { width: value } });
        });

        // Sidebar collapsed toggle
        const collapsedToggle = this.panel?.querySelector('#sidebar-collapsed');
        collapsedToggle?.addEventListener('change', (e) => {
            this.applyChanges({ sidebar: { collapsed: e.target.checked } });
        });

        // Sidebar border toggle
        const borderToggle = this.panel?.querySelector('#sidebar-border');
        borderToggle?.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            this.applyChanges({ sidebar: { border: { enabled } } });

            // Show/hide border options
            this.panel?.querySelectorAll('.tc-border-options').forEach(el => {
                el.style.display = enabled ? '' : 'none';
            });
        });

        // Border width slider
        const borderWidthSlider = this.panel?.querySelector('#border-width');
        borderWidthSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.panel.querySelector('#border-width-value').textContent = `${value}px`;
            this.applyChanges({ sidebar: { border: { width: value } } });
        });

        // Border color input
        const borderColorInput = this.panel?.querySelector('#border-color');
        borderColorInput?.addEventListener('input', (e) => {
            this.applyChanges({ sidebar: { border: { color: e.target.value } } });
        });

        // Header scroll behavior
        const headerScrollBehavior = this.panel?.querySelector('#header-scroll-behavior');
        headerScrollBehavior?.addEventListener('change', (e) => {
            this.applyChanges({ top: { scrollBehavior: e.target.value } });
        });

        // Header height slider
        const headerHeightSlider = this.panel?.querySelector('#header-height');
        headerHeightSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.panel.querySelector('#header-height-value').textContent = `${value}px`;
            this.applyChanges({ top: { height: value } });
        });

        // Header border toggle
        const headerBorderToggle = this.panel?.querySelector('#header-border');
        headerBorderToggle?.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            this.applyChanges({ top: { border: { enabled } } });

            // Show/hide header border options
            this.panel?.querySelectorAll('.tc-header-border-options').forEach(el => {
                el.style.display = enabled ? '' : 'none';
            });
        });

        // Header border width slider
        const headerBorderWidthSlider = this.panel?.querySelector('#header-border-width');
        headerBorderWidthSlider?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.panel.querySelector('#header-border-width-value').textContent = `${value}px`;
            this.applyChanges({ top: { border: { width: value } } });
        });

        // Header border color input
        const headerBorderColorInput = this.panel?.querySelector('#header-border-color');
        headerBorderColorInput?.addEventListener('input', (e) => {
            this.applyChanges({ top: { border: { color: e.target.value } } });
        });

        // Color swatches
        this.panel?.querySelectorAll('.tc-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                const group = e.currentTarget.dataset.colorGroup;
                const type = e.currentTarget.dataset.colorType;
                const color = e.currentTarget.dataset.color;

                // Update UI
                this.panel.querySelectorAll(`[data-color-group="${group}"]`).forEach(s => {
                    s.classList.remove('active');
                });
                e.currentTarget.classList.add('active');

                // Apply changes based on group
                if (group === 'sidebar-bg') {
                    this.applyChanges({
                        sidebar: {
                            background: type,
                            customColor: type === BackgroundType.CUSTOM ? color : null
                        }
                    });
                } else if (group === 'header-bg') {
                    this.applyChanges({
                        top: {
                            background: type,
                            customColor: type === BackgroundType.CUSTOM ? color : null
                        }
                    });
                }
            });
        });

        // Custom color input
        const customColorInput = this.panel?.querySelector('#sidebar-bg-custom');
        customColorInput?.addEventListener('input', (e) => {
            const color = e.target.value;
            this.panel.querySelector('#sidebar-bg-hex').value = color;
            this.applyChanges({
                sidebar: {
                    background: BackgroundType.CUSTOM,
                    customColor: color
                }
            });
        });

        // Hex input
        const hexInput = this.panel?.querySelector('#sidebar-bg-hex');
        hexInput?.addEventListener('change', (e) => {
            let color = e.target.value;
            if (!color.startsWith('#')) color = '#' + color;
            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                this.panel.querySelector('#sidebar-bg-custom').value = color;
                this.applyChanges({
                    sidebar: {
                        background: BackgroundType.CUSTOM,
                        customColor: color
                    }
                });
            }
        });

        // Header custom color input
        const headerCustomColorInput = this.panel?.querySelector('#header-bg-custom');
        headerCustomColorInput?.addEventListener('input', (e) => {
            const color = e.target.value;
            const hexInputEl = this.panel.querySelector('#header-bg-hex');
            if (hexInputEl) hexInputEl.value = color;
            this.applyChanges({
                top: {
                    background: BackgroundType.CUSTOM,
                    customColor: color
                }
            });
        });

        // Header hex input
        const headerHexInput = this.panel?.querySelector('#header-bg-hex');
        headerHexInput?.addEventListener('change', (e) => {
            let color = e.target.value;
            if (!color.startsWith('#')) color = '#' + color;
            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                const colorInput = this.panel.querySelector('#header-bg-custom');
                if (colorInput) colorInput.value = color;
                this.applyChanges({
                    top: {
                        background: BackgroundType.CUSTOM,
                        customColor: color
                    }
                });
            }
        });

        // Tabs
        this.panel?.querySelectorAll('.tc-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.activeTab = tabName;

                // Update tab buttons
                this.panel.querySelectorAll('.tc-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Update tab content
                this.panel.querySelectorAll('.tc-tab-content').forEach(content => {
                    content.classList.toggle('active', content.dataset.tabContent === tabName);
                });
            });
        });

        // Padding inputs - Desktop
        ['top', 'right', 'bottom', 'left'].forEach(side => {
            const input = this.panel?.querySelector(`#padding-${side}`);
            input?.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 0;
                this.applyChanges({
                    contentArea: {
                        padding: { [side]: value }
                    }
                });
            });
        });

        // Padding inputs - Tablet
        ['top', 'right', 'bottom', 'left'].forEach(side => {
            const input = this.panel?.querySelector(`#padding-${side}-tablet`);
            input?.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 0;
                this.applyChanges({
                    contentArea: {
                        responsive: {
                            tablet: {
                                padding: { [side]: value }
                            }
                        }
                    }
                });
            });
        });

        // Padding inputs - Mobile
        ['top', 'right', 'bottom', 'left'].forEach(side => {
            const input = this.panel?.querySelector(`#padding-${side}-mobile`);
            input?.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 0;
                this.applyChanges({
                    contentArea: {
                        responsive: {
                            mobile: {
                                padding: { [side]: value }
                            }
                        }
                    }
                });
            });
        });

        // Footer toggle
        const footerToggle = this.panel?.querySelector('#footer-visible');
        footerToggle?.addEventListener('change', (e) => {
            this.applyChanges({ footerVisible: e.target.checked });
        });

        // Save button
        const saveBtn = this.panel?.querySelector('#save-config');
        saveBtn?.addEventListener('click', () => {
            this.saveConfig();
            this.close();
        });

        // Reset button
        const resetBtn = this.panel?.querySelector('#reset-config');
        resetBtn?.addEventListener('click', () => {
            this.resetConfig();
        });

        // Set company default button (admin only)
        const setDefaultBtn = this.panel?.querySelector('#set-company-default');
        setDefaultBtn?.addEventListener('click', () => {
            this.setCompanyDefault();
        });
    }

    /**
     * Save configuration to localStorage and API
     */
    saveConfig() {
        const config = this.getConfig();
        saveToLocalStorage(config);
        this.saveToApi();

        // Show success notification
        Toast.success(this.__('theme.saved'));
    }

    /**
     * Save configuration to API
     */
    async saveToApi() {
        try {
            const config = this.getConfig();
            await this.app.api.put('/layout/config', { config });
        } catch (error) {
            Logger.error('Failed to save layout config to API:', error);
        }
    }

    /**
     * Reset configuration to defaults (loads company default from API)
     */
    async resetConfig() {
        if (this.app.layout) {
            try {
                // Delete user config and load company/system default from API
                await this.app.layout.resetConfig();
                this.updatePanelValues();
                Toast.info(this.__('theme.resetToDefault'));
            } catch (error) {
                Logger.error('Failed to reset config:', error);
                Toast.error(this.__('theme.resetFailed'));
            }
        }
    }

    /**
     * Set current config as company default (admin only)
     */
    async setCompanyDefault() {
        if (!this.isAdmin()) {
            return;
        }

        try {
            const config = this.getConfig();

            // Save to API with company scope
            await this.app.api.post('/layout/config', {
                scope: 'company',
                config
            });

            Toast.success(this.__('theme.companyDefaultSaved'));
        } catch (error) {
            Logger.error('Failed to set company default:', error);
            Toast.error(this.__('theme.saveFailed'));
        }
    }

    /**
     * Hide the configurator (for auth pages)
     */
    hide() {
        this.close();
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * Show the configurator
     */
    show() {
        if (this.container) {
            this.container.style.display = '';
        }
    }

    /**
     * Destroy the configurator
     */
    destroy() {
        document.removeEventListener('keydown', this.handleKeyDown);
        this.container?.remove();
    }
}

export default ThemeConfigurator;
