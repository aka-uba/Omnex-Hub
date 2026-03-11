/**
 * LanguageSelector - Language Selector Component
 *
 * Allows users to switch between available languages.
 * Stores the selection in localStorage and triggers page refresh.
 *
 * @package OmnexDisplayHub
 */

import { Logger } from '../core/Logger.js';

export class LanguageSelector {
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.storageKey = 'omnex_language';
        this._outsideClickHandler = null;
        this._syncDropdownHandler = null;

        // Available languages (nativeName = always in that language's own script)
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
     * i18n helper
     */
    __(key, params = {}) {
        return this.app.i18n ? this.app.i18n.t(key, params) : key;
    }

    /**
     * Initialize the language selector
     */
    async init() {
        // Get current language from storage or default
        this.currentLanguage = this.getCurrentLanguage();
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
     * Get translated language name (in current UI language)
     */
    getTranslatedName(langCode) {
        return this.__(`languages.${langCode}`) || langCode;
    }

    /**
     * Set language
     */
    async setLanguage(langCode) {
        const lang = this.languages.find(l => l.code === langCode);
        if (!lang) return;

        localStorage.setItem(this.storageKey, langCode);
        this.currentLanguage = lang;

        // Load new translations if i18n is available
        if (this.app.i18n) {
            await this.app.i18n.load(langCode);
        }

        // Dispatch custom event for pages to handle
        window.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { language: lang }
        }));

        // Reload the page to apply new language
        window.location.reload();
    }

    /**
     * Get flag image HTML for a language
     */
    getFlagImg(lang) {
        const basePath = window.OmnexConfig?.basePath || '';
        return `<img src="${basePath}/assets/images/flags/${lang.flagFile}" alt="${lang.flag}" class="flag-img">`;
    }

    /**
     * Render the language selector for header
     */
    render() {
        const currentLang = this.getCurrentLanguage();
        const translatedCurrentName = this.getTranslatedName(currentLang.code);
        const selectLabel = this.__('languages.selectLanguage');

        return `
            <div class="language-selector-wrapper">
                <button class="language-selector-btn" id="language-selector-btn" title="${selectLabel}">
                    ${this.getFlagImg(currentLang)}
                    <span class="language-code">${currentLang.flag}</span>
                    <i class="ti ti-chevron-down"></i>
                </button>
                <div class="language-dropdown" id="language-dropdown">
                    <div class="language-dropdown-header">
                        <div class="language-dropdown-icon">
                            <i class="ti ti-world"></i>
                        </div>
                        <div class="language-dropdown-info">
                            <span class="language-dropdown-label">${selectLabel}</span>
                            <span class="language-dropdown-current">${translatedCurrentName}</span>
                        </div>
                    </div>
                    <div class="language-dropdown-list">
                        ${this.languages.map(lang => `
                            <button class="language-dropdown-item ${lang.code === currentLang.code ? 'active' : ''}"
                                    data-lang-code="${lang.code}">
                                <div class="language-item-flag">
                                    ${this.getFlagImg(lang)}
                                </div>
                                <div class="language-item-info">
                                    <div class="language-item-name">${this.getTranslatedName(lang.code)}</div>
                                    <div class="language-item-native">${lang.nativeName}</div>
                                </div>
                                ${lang.code === currentLang.code ? '<i class="ti ti-check text-primary"></i>' : ''}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Bind events after render
     */
    bindEvents() {
        const btn = document.getElementById('language-selector-btn');
        const dropdown = document.getElementById('language-dropdown');

        if (!btn || !dropdown) return;

        // Toggle dropdown
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !dropdown.classList.contains('open');
            if (willOpen) {
                window.dispatchEvent(new CustomEvent('omnex:header-dropdown-open', {
                    detail: { source: 'language' }
                }));
            }
            this.isOpen = willOpen;
            dropdown.classList.toggle('open', willOpen);
        });

        // Close on outside click
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
        }
        this._outsideClickHandler = (e) => {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                this.isOpen = false;
                dropdown.classList.remove('open');
            }
        };
        document.addEventListener('click', this._outsideClickHandler);

        // Close when another header dropdown opens
        if (this._syncDropdownHandler) {
            window.removeEventListener('omnex:header-dropdown-open', this._syncDropdownHandler);
        }
        this._syncDropdownHandler = (e) => {
            if (e?.detail?.source !== 'language') {
                this.isOpen = false;
                dropdown.classList.remove('open');
            }
        };
        window.addEventListener('omnex:header-dropdown-open', this._syncDropdownHandler);

        // Handle language selection
        dropdown.querySelectorAll('.language-dropdown-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                const langCode = item.dataset.langCode;
                await this.setLanguage(langCode);
            });
        });
    }

    destroy() {
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
            this._outsideClickHandler = null;
        }
        if (this._syncDropdownHandler) {
            window.removeEventListener('omnex:header-dropdown-open', this._syncDropdownHandler);
            this._syncDropdownHandler = null;
        }
    }
}

export default LanguageSelector;
