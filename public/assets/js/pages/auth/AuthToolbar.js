/**
 * AuthToolbar - Toolbar Component for Auth Pages
 *
 * Provides language selector, theme toggle, and PWA install button
 * for login, register, and forgot password pages.
 *
 * @package OmnexDisplayHub
 */

export class AuthToolbar {
    constructor(app) {
        this.app = app;
        this.isLangDropdownOpen = false;
        this.deferredPrompt = null;
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           window.navigator.standalone === true;
        this.storageKey = 'omnex_language';

        // i18n helper - falls back to key if i18n not ready
        this.__ = (key, params = {}) => {
            return this.app?.i18n ? this.app.i18n.t(key, params) : key;
        };

        // Available languages
        this.languages = [
            { code: 'tr', nativeName: 'Türkçe', flag: 'TR', flagFile: 'tr.png' },
            { code: 'en', nativeName: 'English', flag: 'EN', flagFile: 'gb.png' },
            { code: 'ru', nativeName: 'Русский', flag: 'RU', flagFile: 'ru.png' },
            { code: 'az', nativeName: 'Azərbaycan', flag: 'AZ', flagFile: 'az.png' },
            { code: 'de', nativeName: 'Deutsch', flag: 'DE', flagFile: 'de.png' },
            { code: 'nl', nativeName: 'Nederlands', flag: 'NL', flagFile: 'nl.png' },
            { code: 'fr', nativeName: 'Français', flag: 'FR', flagFile: 'fr.png' },
            { code: 'ar', nativeName: 'العربية', flag: 'AR', flagFile: 'sa.png' }
        ];
    }

    /**
     * Get flag image HTML for a language
     */
    getFlagImg(lang) {
        const basePath = window.OmnexConfig?.basePath || '';
        return `<img src="${basePath}/assets/images/flags/${lang.flagFile}" alt="${lang.flag}" class="flag-img">`;
    }

    /**
     * Get current language code
     */
    getCurrentLanguageCode() {
        return localStorage.getItem(this.storageKey) || 'tr';
    }

    /**
     * Get current language object
     */
    getCurrentLanguage() {
        const code = this.getCurrentLanguageCode();
        return this.languages.find(lang => lang.code === code) || this.languages[0];
    }

    /**
     * Get current theme from layout config (same as LayoutManager uses)
     */
    getCurrentTheme() {
        const layoutConfigKey = 'omnex-layout-config-v2';
        try {
            const config = localStorage.getItem(layoutConfigKey);
            if (config) {
                const parsed = JSON.parse(config);
                if (parsed.themeMode) {
                    return parsed.themeMode;
                }
            }
        } catch (e) {
            // Silently fail
        }
        return 'light';
    }

    /**
     * Render toolbar HTML
     */
    render() {
        const currentLang = this.getCurrentLanguage();

        return `
            <div class="auth-toolbar" id="auth-toolbar">
                <!-- Language Selector -->
                <div class="auth-lang-selector" id="auth-lang-selector">
                    <button class="auth-lang-btn" id="auth-lang-btn" title="${this.__('languages.selectLanguage')}">
                        ${this.getFlagImg(currentLang)}
                        <span class="lang-code">${currentLang.flag}</span>
                        <i class="ti ti-chevron-down"></i>
                    </button>
                    <div class="auth-lang-dropdown" id="auth-lang-dropdown">
                        ${this.languages.map(lang => `
                            <button class="auth-lang-dropdown-item ${lang.code === currentLang.code ? 'active' : ''}"
                                    data-lang-code="${lang.code}">
                                ${this.getFlagImg(lang)}
                                <span class="lang-name">${lang.nativeName}</span>
                                ${lang.code === currentLang.code ? '<i class="ti ti-check"></i>' : ''}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Theme Toggle -->
                <button class="auth-toolbar-btn auth-theme-btn" id="auth-theme-btn" title="${this.__('layout.toggleTheme')}">
                    <i class="ti ti-sun"></i>
                    <i class="ti ti-moon"></i>
                </button>

                <!-- PWA Install -->
                <button class="auth-toolbar-btn auth-pwa-btn" id="auth-pwa-btn" title="${this.__('layout.installApp')}">
                    <i class="ti ti-download"></i>
                </button>
            </div>
        `;
    }

    /**
     * Initialize toolbar after render
     */
    init() {
        this.applyCurrentTheme();
        this.bindLanguageSelector();
        this.bindThemeToggle();
        this.bindPwaInstall();
    }

    /**
     * Apply current theme to document on page load
     */
    applyCurrentTheme() {
        const currentTheme = this.getCurrentTheme();
        const isDark = currentTheme === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    }

    /**
     * Bind language selector events
     */
    bindLanguageSelector() {
        const btn = document.getElementById('auth-lang-btn');
        const dropdown = document.getElementById('auth-lang-dropdown');

        if (!btn || !dropdown) return;

        // Toggle dropdown
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isLangDropdownOpen = !this.isLangDropdownOpen;
            dropdown.classList.toggle('open', this.isLangDropdownOpen);
        });

        // Close on outside click
        this._outsideClickHandler = (e) => {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                this.isLangDropdownOpen = false;
                dropdown.classList.remove('open');
            }
        };
        document.addEventListener('click', this._outsideClickHandler);

        // Handle language selection
        dropdown.querySelectorAll('.auth-lang-dropdown-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                const langCode = item.dataset.langCode;
                await this.setLanguage(langCode);
            });
        });
    }

    /**
     * Set language and reload
     */
    async setLanguage(langCode) {
        const lang = this.languages.find(l => l.code === langCode);
        if (!lang) return;

        localStorage.setItem(this.storageKey, langCode);

        // Reload the page to apply new language
        window.location.reload();
    }

    /**
     * Bind theme toggle events
     */
    bindThemeToggle() {
        const btn = document.getElementById('auth-theme-btn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            this.toggleTheme();
        });
    }

    /**
     * Toggle theme between light and dark
     * Uses LayoutManager if available, otherwise falls back to direct localStorage
     * This ensures theme persists from auth pages to dashboard after login
     */
    toggleTheme() {
        // If LayoutManager is available, use it for consistent behavior
        if (this.app?.layout?.toggleTheme) {
            this.app.layout.toggleTheme();
            return;
        }

        // Fallback: Direct localStorage manipulation (when LayoutManager not ready)
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        // Save directly to the main layout config that LayoutManager uses
        const layoutConfigKey = 'omnex-layout-config-v2';

        try {
            let config = {};
            const existingConfig = localStorage.getItem(layoutConfigKey);

            if (existingConfig) {
                try {
                    config = JSON.parse(existingConfig);
                } catch (parseError) {
                    config = {};
                }
            }

            // Update theme in config
            config.themeMode = newTheme;

            // Write to localStorage
            localStorage.setItem(layoutConfigKey, JSON.stringify(config));
        } catch (e) {
            console.error('AuthToolbar: Error saving theme:', e);
            // Fallback: try to save just the theme
            try {
                localStorage.setItem(layoutConfigKey, JSON.stringify({ themeMode: newTheme }));
            } catch (fallbackError) {
                console.error('AuthToolbar: Fallback save also failed:', fallbackError);
            }
        }

        // Apply theme to document immediately
        const isDark = newTheme === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    }

    /**
     * Bind PWA install events
     */
    bindPwaInstall() {
        const btn = document.getElementById('auth-pwa-btn');
        if (!btn) return;

        // Don't show if already installed as PWA
        if (this.isStandalone) {
            btn.style.display = 'none';
            return;
        }

        // Listen for beforeinstallprompt event
        this._beforeInstallHandler = (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            btn.classList.add('show');
        };
        window.addEventListener('beforeinstallprompt', this._beforeInstallHandler);

        // Listen for app installed event
        this._appInstalledHandler = () => {
            this.deferredPrompt = null;
            btn.classList.remove('show');
        };
        window.addEventListener('appinstalled', this._appInstalledHandler);

        // Handle click
        btn.addEventListener('click', () => {
            this.promptInstall();
        });

        // For iOS/Android, show button for manual instructions
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);

        if ((isIOS || isAndroid) && !this.isStandalone) {
            setTimeout(() => {
                if (!this.deferredPrompt) {
                    btn.classList.add('show');
                }
            }, 1000);
        }
    }

    /**
     * Trigger install prompt or show instructions
     */
    async promptInstall() {
        if (this.deferredPrompt) {
            // Chrome/Edge/etc - native install prompt
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            this.deferredPrompt = null;
        } else {
            // Show manual instructions
            this.showManualInstructions();
        }
    }

    /**
     * Show manual installation instructions modal
     */
    showManualInstructions() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        const basePath = window.OmnexConfig?.basePath || '';

        // Remove existing modal if any
        document.getElementById('auth-pwa-modal')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'auth-pwa-modal';
        overlay.className = 'pwa-install-modal';

        let instructions = '';

        if (isIOS) {
            instructions = `
                <div class="pwa-instruction">
                    <div class="pwa-step">
                        <span class="step-number">1</span>
                        <p>${this.__('pwa.iosStep1')}</p>
                    </div>
                    <div class="pwa-step">
                        <span class="step-number">2</span>
                        <p>${this.__('pwa.iosStep2')}</p>
                    </div>
                    <div class="pwa-step">
                        <span class="step-number">3</span>
                        <p>${this.__('pwa.iosStep3')}</p>
                    </div>
                </div>
            `;
        } else if (isAndroid) {
            instructions = `
                <div class="pwa-instruction">
                    <div class="pwa-step">
                        <span class="step-number">1</span>
                        <p>${this.__('pwa.androidStep1')}</p>
                    </div>
                    <div class="pwa-step">
                        <span class="step-number">2</span>
                        <p>${this.__('pwa.androidStep2')}</p>
                    </div>
                    <div class="pwa-step">
                        <span class="step-number">3</span>
                        <p>${this.__('pwa.androidStep3')}</p>
                    </div>
                </div>
            `;
        } else {
            instructions = `
                <div class="pwa-instruction">
                    <div class="pwa-step">
                        <span class="step-number">1</span>
                        <p>${this.__('pwa.desktopStep1')}</p>
                    </div>
                    <div class="pwa-step">
                        <span class="step-number">2</span>
                        <p>${this.__('pwa.desktopStep2')}</p>
                    </div>
                    <div class="pwa-step">
                        <span class="step-number">3</span>
                        <p>${this.__('pwa.desktopStep3')}</p>
                    </div>
                </div>
            `;
        }

        overlay.innerHTML = `
            <div class="pwa-install-modal-content">
                <div class="pwa-modal-header">
                    <div class="pwa-app-info">
                        <img src="${basePath}/branding/icon-192.png" alt="Omnex Hub" class="pwa-app-icon">
                        <div>
                            <h3>Omnex Display Hub</h3>
                            <p>${this.__('pwa.installOnDevice')}</p>
                        </div>
                    </div>
                    <button class="pwa-modal-close" id="auth-pwa-modal-close">
                        <i class="ti ti-x"></i>
                    </button>
                </div>
                <div class="pwa-modal-body">
                    <p class="pwa-benefits">
                        <span><i class="ti ti-check"></i> ${this.__('pwa.quickAccess')}</span>
                        <span><i class="ti ti-check"></i> ${this.__('pwa.offlineUse')}</span>
                        <span><i class="ti ti-check"></i> ${this.__('pwa.notifications')}</span>
                    </p>
                    <h4>${this.__('pwa.howToInstall')}</h4>
                    ${instructions}
                </div>
                <div class="pwa-modal-footer">
                    <button class="btn btn-outline" id="auth-pwa-modal-later">${this.__('pwa.close')}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Close handlers
        document.getElementById('auth-pwa-modal-close').addEventListener('click', () => overlay.remove());
        document.getElementById('auth-pwa-modal-later').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    /**
     * Cleanup on destroy
     */
    destroy() {
        // Remove event listeners
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
        }
        if (this._beforeInstallHandler) {
            window.removeEventListener('beforeinstallprompt', this._beforeInstallHandler);
        }
        if (this._appInstalledHandler) {
            window.removeEventListener('appinstalled', this._appInstalledHandler);
        }
    }
}

export default AuthToolbar;
