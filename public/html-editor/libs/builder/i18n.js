/**
 * VvvebJs i18n (Internationalization) System
 * Çoklu dil desteği yönetim sistemi
 *
 * Works with Vvveb.I18n.{locale} objects from locales/*.js files
 */

(function() {
    'use strict';

    // Ensure Vvveb namespace exists
    window.Vvveb = window.Vvveb || {};
    Vvveb.I18n = Vvveb.I18n || {};

    // Available languages configuration
    const languages = {
        'tr': { name: 'Türkçe', flag: '🇹🇷' },
        'en': { name: 'English', flag: '🇬🇧' }
    };

    // Current locale
    let currentLocale = 'en';

    /**
     * Detect initial locale
     */
    function detectLocale() {
        // Check URL parameter first
        const urlParams = new URLSearchParams(window.location.search);
        const urlLocale = urlParams.get('lang');
        if (urlLocale && languages[urlLocale]) {
            return urlLocale;
        }

        // Check localStorage
        const savedLocale = localStorage.getItem('vvveb_locale');
        if (savedLocale && languages[savedLocale]) {
            return savedLocale;
        }

        // Check browser language
        const browserLang = navigator.language.split('-')[0];
        if (languages[browserLang]) {
            return browserLang;
        }

        return 'en';
    }

    /**
     * Translation function
     */
    function translate(key, defaultValue) {
        const translations = Vvveb.I18n[currentLocale];
        if (translations && translations[key] !== undefined) {
            return translations[key];
        }
        // Fallback to English
        const enTranslations = Vvveb.I18n['en'];
        if (enTranslations && enTranslations[key] !== undefined) {
            return enTranslations[key];
        }
        // Return default or key
        return defaultValue !== undefined ? defaultValue : key;
    }

    /**
     * Set locale and reload
     */
    function setLocale(locale) {
        if (!languages[locale]) {
            console.warn('Unknown locale:', locale);
            return false;
        }

        localStorage.setItem('vvveb_locale', locale);

        // Reload to apply new language
        window.location.reload();
        return true;
    }

    /**
     * Get current locale
     */
    function getLocale() {
        return currentLocale;
    }

    /**
     * Get available languages
     */
    function getLanguages() {
        return languages;
    }

    /**
     * Register translations for a locale
     * Used by lang-*.js files to add their translations
     */
    function registerTranslations(locale, translations) {
        if (!Vvveb.I18n[locale]) {
            Vvveb.I18n[locale] = {};
        }
        // Merge translations (don't overwrite existing)
        Object.keys(translations).forEach(key => {
            if (Vvveb.I18n[locale][key] === undefined) {
                Vvveb.I18n[locale][key] = translations[key];
            }
        });
    }

    /**
     * Create language selector UI
     */
    function createLanguageSelector() {
        const currentLang = languages[currentLocale];

        // Create dropdown HTML
        const selectorHtml = `
            <div class="dropdown d-inline-block" id="vvveb-language-selector">
                <button class="btn btn-light btn-sm dropdown-toggle" type="button"
                        data-bs-toggle="dropdown" aria-expanded="false" title="Dil / Language">
                    <span class="lang-flag">${currentLang.flag}</span>
                    <span class="lang-name d-none d-md-inline ms-1">${currentLang.name}</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                    ${Object.entries(languages).map(([code, lang]) => `
                        <li>
                            <a class="dropdown-item ${code === currentLocale ? 'active' : ''}"
                               href="#" data-locale="${code}">
                                <span class="lang-flag me-2">${lang.flag}</span>
                                ${lang.name}
                            </a>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;

        // Find insertion point - before dark mode button or in float-end section
        const darkModeBtn = document.querySelector('.btn-dark-mode');
        if (darkModeBtn) {
            darkModeBtn.insertAdjacentHTML('beforebegin', selectorHtml);
        } else {
            // Fallback - add to top panel end
            const topPanelEnd = document.querySelector('#top-panel .float-end.me-3');
            if (topPanelEnd) {
                topPanelEnd.insertAdjacentHTML('afterbegin', selectorHtml);
            }
        }

        // Add click handlers
        document.querySelectorAll('#vvveb-language-selector .dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const locale = e.currentTarget.dataset.locale;
                if (locale !== currentLocale) {
                    setLocale(locale);
                }
            });
        });
    }

    /**
     * Add CSS for language selector
     */
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #vvveb-language-selector {
                margin-right: 0.5rem;
            }
            #vvveb-language-selector .dropdown-toggle {
                display: flex;
                align-items: center;
                gap: 0.25rem;
                padding: 0.25rem 0.5rem;
                border: 1px solid #dee2e6;
            }
            #vvveb-language-selector .lang-flag {
                font-size: 1.1rem;
                line-height: 1;
            }
            #vvveb-language-selector .lang-name {
                font-size: 0.8rem;
            }
            #vvveb-language-selector .dropdown-menu {
                min-width: 140px;
            }
            #vvveb-language-selector .dropdown-item {
                display: flex;
                align-items: center;
                padding: 0.5rem 1rem;
            }
            #vvveb-language-selector .dropdown-item.active {
                background-color: #0d6efd;
                color: white;
            }
            #vvveb-language-selector .dropdown-item:hover:not(.active) {
                background-color: #f8f9fa;
            }
            /* Dark mode support */
            .dark-mode #vvveb-language-selector .dropdown-toggle {
                border-color: #495057;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Initialize i18n system
     */
    function init() {
        // Detect and set current locale
        currentLocale = detectLocale();
        localStorage.setItem('vvveb_locale', currentLocale);

        // Sync with Vvveb.I18n.locale for compatibility
        Vvveb.I18n.locale = currentLocale;

        // Add styles
        addStyles();

        // Create language selector when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createLanguageSelector);
        } else {
            createLanguageSelector();
        }

        console.log('VvvebJs i18n initialized, locale:', currentLocale);
    }

    // Export global translation function
    window.__ = translate;

    // Export API with getter for currentLocale
    window.VvvebI18n = {
        t: translate,
        setLocale: setLocale,
        getLocale: getLocale,
        getLanguages: getLanguages,
        registerTranslations: registerTranslations,
        get currentLocale() { return currentLocale; }
    };

    // Initialize
    init();

})();
