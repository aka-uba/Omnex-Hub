/**
 * PanelBase - Temel Panel Sınıfı
 *
 * Tüm editor panelleri için temel sınıf.
 * Ortak özellikler: açılma/kapanma, render, event binding, i18n desteği.
 *
 * KULLANIM:
 * ```javascript
 * import { PanelBase } from './editor/panels/PanelBase.js';
 *
 * class MyPanel extends PanelBase {
 *     constructor(options) {
 *         super({
 *             ...options,
 *             panelId: 'my-panel',
 *             title: 'My Panel'
 *         });
 *     }
 *
 *     renderContent() {
 *         return `<div>Panel içeriği</div>`;
 *     }
 *
 *     bindEvents() {
 *         // Event listener'ları bağla
 *     }
 * }
 * ```
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

import { eventBus, EVENTS } from '../core/EventBus.js';

/**
 * Varsayılan ayarlar
 */
const DEFAULT_OPTIONS = {
    panelId: 'panel',
    title: 'Panel',
    icon: 'ti-settings',
    collapsible: true,
    collapsed: false,
    visible: true,
    container: null,        // DOM container element veya selector
    i18n: null              // i18n fonksiyonu
};

/**
 * PanelBase Sınıfı
 */
export class PanelBase {
    /**
     * @param {Object} [options={}] - Panel ayarları
     */
    constructor(options = {}) {
        /**
         * Panel ayarları
         * @type {Object}
         */
        this.options = { ...DEFAULT_OPTIONS, ...options };

        /**
         * Panel ID
         * @type {string}
         */
        this.panelId = this.options.panelId;

        /**
         * Panel DOM elementi
         * @type {HTMLElement|null}
         */
        this.element = null;

        /**
         * Panel container
         * @type {HTMLElement|null}
         */
        this.container = null;

        /**
         * Panel görünür mü
         * @type {boolean}
         */
        this._visible = this.options.visible;

        /**
         * Panel kapalı mı (collapsed)
         * @type {boolean}
         */
        this._collapsed = this.options.collapsed;

        /**
         * i18n fonksiyonu
         * @type {Function|null}
         */
        this._i18n = this.options.i18n;

        /**
         * Event handler referansları (cleanup için)
         * @type {Map<Element, Map<string, Function>>}
         */
        this._eventHandlers = new Map();

        // Container'ı ayarla
        this._setupContainer();
    }

    /**
     * Container'ı ayarla
     * @private
     */
    _setupContainer() {
        if (this.options.container) {
            if (typeof this.options.container === 'string') {
                this.container = document.querySelector(this.options.container);
            } else {
                this.container = this.options.container;
            }
        }
    }

    // ==========================================
    // i18n DESTEĞİ
    // ==========================================

    /**
     * Çeviri al
     * @param {string} key - Çeviri anahtarı
     * @param {Object} [params={}] - Parametreler
     * @returns {string}
     */
    __(key, params = {}) {
        if (this._i18n && typeof this._i18n === 'function') {
            return this._i18n(key, params);
        }
        // Fallback: window.__ veya key döndür
        if (typeof window.__ === 'function') {
            return window.__(key, params);
        }
        return key;
    }

    /**
     * i18n fonksiyonunu ayarla
     * @param {Function} i18nFn - i18n fonksiyonu
     */
    setI18n(i18nFn) {
        this._i18n = i18nFn;
    }

    // ==========================================
    // RENDER
    // ==========================================

    /**
     * Panel'i render et
     * @returns {string} HTML string
     */
    render() {
        const collapsedClass = this._collapsed ? 'collapsed' : '';
        const hiddenClass = !this._visible ? 'hidden' : '';

        return `
            <div id="${this.panelId}" class="editor-panel ${collapsedClass} ${hiddenClass}" data-panel="${this.panelId}">
                ${this.options.collapsible ? this._renderHeader() : ''}
                <div class="panel-body">
                    ${this.renderContent()}
                </div>
            </div>
        `;
    }

    /**
     * Panel header'ını render et
     * @private
     * @returns {string} HTML string
     */
    _renderHeader() {
        const icon = this.options.icon ? `<i class="${this.options.icon}"></i>` : '';
        const title = this.__(this.options.title);
        const collapseIcon = this._collapsed ? 'ti-chevron-down' : 'ti-chevron-up';

        return `
            <div class="panel-header" data-action="toggle-collapse">
                <div class="panel-header-left">
                    ${icon}
                    <span class="panel-title">${title}</span>
                </div>
                <div class="panel-header-right">
                    <button type="button" class="panel-collapse-btn" title="${this.__('editor.panel.toggle')}">
                        <i class="${collapseIcon}"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Panel içeriğini render et (override edilmeli)
     * @returns {string} HTML string
     */
    renderContent() {
        return '<div class="panel-content-placeholder">Panel içeriği</div>';
    }

    /**
     * Panel'i DOM'a ekle
     * @param {HTMLElement|string} [target] - Hedef element veya selector
     */
    mount(target) {
        const container = target
            ? (typeof target === 'string' ? document.querySelector(target) : target)
            : this.container;

        if (!container) {
            console.error('PanelBase: Container bulunamadı');
            return;
        }

        this.container = container;

        // HTML render et ve ekle
        const html = this.render();
        container.insertAdjacentHTML('beforeend', html);

        // Element referansını al
        this.element = container.querySelector(`#${this.panelId}`);

        // Event'leri bağla
        this._bindBaseEvents();
        this.bindEvents();

        // Mount event
        eventBus.emit(EVENTS.PANEL_MOUNT, { panelId: this.panelId });
    }

    /**
     * Panel'i yeniden render et
     */
    refresh() {
        if (!this.element || !this.container) return;

        // Mevcut element'i kaldır
        this.element.remove();

        // Yeniden render et
        const html = this.render();
        this.container.insertAdjacentHTML('beforeend', html);

        // Element referansını güncelle
        this.element = this.container.querySelector(`#${this.panelId}`);

        // Event'leri yeniden bağla
        this._bindBaseEvents();
        this.bindEvents();
    }

    // ==========================================
    // EVENT BINDING
    // ==========================================

    /**
     * Temel event'leri bağla
     * @private
     */
    _bindBaseEvents() {
        if (!this.element) return;

        // Collapse toggle
        const header = this.element.querySelector('.panel-header');
        if (header) {
            this._addEventListener(header, 'click', (e) => {
                // Buton tıklaması değilse
                if (!e.target.closest('button')) {
                    this.toggleCollapse();
                }
            });
        }

        // Collapse button
        const collapseBtn = this.element.querySelector('.panel-collapse-btn');
        if (collapseBtn) {
            this._addEventListener(collapseBtn, 'click', (e) => {
                e.stopPropagation();
                this.toggleCollapse();
            });
        }
    }

    /**
     * Panel-specific event'leri bağla (override edilmeli)
     */
    bindEvents() {
        // Alt sınıflar override etmeli
    }

    /**
     * Event listener ekle (cleanup için takip et)
     * @protected
     * @param {Element} element - DOM elementi
     * @param {string} event - Event adı
     * @param {Function} handler - Event handler
     * @param {Object} [options] - Event listener options
     */
    _addEventListener(element, event, handler, options) {
        if (!element) return;

        element.addEventListener(event, handler, options);

        // Cleanup için kaydet
        if (!this._eventHandlers.has(element)) {
            this._eventHandlers.set(element, new Map());
        }
        this._eventHandlers.get(element).set(event, handler);
    }

    /**
     * Tüm event listener'ları kaldır
     * @private
     */
    _removeAllEventListeners() {
        this._eventHandlers.forEach((events, element) => {
            events.forEach((handler, event) => {
                element.removeEventListener(event, handler);
            });
        });
        this._eventHandlers.clear();
    }

    // ==========================================
    // COLLAPSE / EXPAND
    // ==========================================

    /**
     * Panel'i kapat (collapse)
     */
    collapse() {
        if (this._collapsed) return;

        this._collapsed = true;

        if (this.element) {
            this.element.classList.add('collapsed');

            // İkon güncelle
            const icon = this.element.querySelector('.panel-collapse-btn i');
            if (icon) {
                icon.className = 'ti ti-chevron-down';
            }
        }

        eventBus.emit(EVENTS.PANEL_COLLAPSE, { panelId: this.panelId });
    }

    /**
     * Panel'i aç (expand)
     */
    expand() {
        if (!this._collapsed) return;

        this._collapsed = false;

        if (this.element) {
            this.element.classList.remove('collapsed');

            // İkon güncelle
            const icon = this.element.querySelector('.panel-collapse-btn i');
            if (icon) {
                icon.className = 'ti ti-chevron-up';
            }
        }

        eventBus.emit(EVENTS.PANEL_EXPAND, { panelId: this.panelId });
    }

    /**
     * Collapse toggle
     */
    toggleCollapse() {
        if (this._collapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    }

    /**
     * Panel kapalı mı?
     * @returns {boolean}
     */
    isCollapsed() {
        return this._collapsed;
    }

    // ==========================================
    // VISIBILITY
    // ==========================================

    /**
     * Panel'i göster
     */
    show() {
        if (this._visible) return;

        this._visible = true;

        if (this.element) {
            this.element.classList.remove('hidden');
        }

        eventBus.emit(EVENTS.PANEL_SHOW, { panelId: this.panelId });
    }

    /**
     * Panel'i gizle
     */
    hide() {
        if (!this._visible) return;

        this._visible = false;

        if (this.element) {
            this.element.classList.add('hidden');
        }

        eventBus.emit(EVENTS.PANEL_HIDE, { panelId: this.panelId });
    }

    /**
     * Visibility toggle
     */
    toggleVisibility() {
        if (this._visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Panel görünür mü?
     * @returns {boolean}
     */
    isVisible() {
        return this._visible;
    }

    // ==========================================
    // DOM HELPERS
    // ==========================================

    /**
     * Panel içinde element bul
     * @param {string} selector - CSS selector
     * @returns {Element|null}
     */
    $(selector) {
        return this.element?.querySelector(selector) || null;
    }

    /**
     * Panel içinde tüm elementleri bul
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    $$(selector) {
        return this.element?.querySelectorAll(selector) || [];
    }

    /**
     * Panel body elementini al
     * @returns {Element|null}
     */
    getBody() {
        return this.$('.panel-body');
    }

    /**
     * Panel body içeriğini güncelle
     * @param {string} html - Yeni HTML
     */
    setBodyContent(html) {
        const body = this.getBody();
        if (body) {
            body.innerHTML = html;
        }
    }

    // ==========================================
    // TEMİZLİK
    // ==========================================

    /**
     * Panel'i DOM'dan kaldır
     */
    unmount() {
        // Event'leri temizle
        this._removeAllEventListeners();

        // DOM'dan kaldır
        if (this.element) {
            this.element.remove();
            this.element = null;
        }

        eventBus.emit(EVENTS.PANEL_UNMOUNT, { panelId: this.panelId });
    }

    /**
     * Panel'i dispose et
     */
    dispose() {
        this.unmount();
        this.container = null;
        this._i18n = null;
    }
}

/**
 * Default export
 */
export default PanelBase;
