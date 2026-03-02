/**
 * Toolbar - Editor Araç Çubuğu Bileşeni
 *
 * Canvas üzerindeki işlemler için araç çubuğu.
 * Eleman ekleme, zoom, undo/redo, grid kontrolleri.
 *
 * KULLANIM:
 * ```javascript
 * import { Toolbar } from './editor/components/Toolbar.js';
 *
 * const toolbar = new Toolbar({
 *     container: '#toolbar-container',
 *     editor: editorInstance,
 *     i18n: (key) => translate(key)
 * });
 *
 * toolbar.mount();
 * ```
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

import { eventBus, EVENTS } from '../core/EventBus.js';

/**
 * Varsayılan toolbar öğeleri
 */
const DEFAULT_ITEMS = {
    elements: [
        { id: 'add-text', icon: 'ti-typography', label: 'editor.elements.text', action: 'addText' },
        { id: 'add-rect', icon: 'ti-square', label: 'editor.elements.rectangle', action: 'addRect' },
        { id: 'add-circle', icon: 'ti-circle', label: 'editor.elements.circle', action: 'addCircle' },
        { id: 'add-line', icon: 'ti-line', label: 'editor.elements.line', action: 'addLine' },
        { id: 'add-image', icon: 'ti-photo', label: 'editor.elements.image', action: 'addImage' }
    ],
    zoom: [
        { id: 'zoom-in', icon: 'ti-plus', label: 'editor.canvas.zoomIn', action: 'zoomIn' },
        { id: 'zoom-out', icon: 'ti-minus', label: 'editor.canvas.zoomOut', action: 'zoomOut' },
        { id: 'zoom-fit', icon: 'ti-maximize', label: 'editor.canvas.zoomFit', action: 'zoomFit' },
        { id: 'zoom-reset', icon: 'ti-zoom-reset', label: 'editor.canvas.zoomReset', action: 'zoomReset' }
    ],
    history: [
        { id: 'undo', icon: 'ti-arrow-back-up', label: 'editor.canvas.undo', action: 'undo', shortcut: 'Ctrl+Z' },
        { id: 'redo', icon: 'ti-arrow-forward-up', label: 'editor.canvas.redo', action: 'redo', shortcut: 'Ctrl+Y' }
    ],
    grid: [
        { id: 'toggle-grid', icon: 'ti-grid-dots', label: 'editor.canvas.toggleGrid', action: 'toggleGrid', toggle: true },
        { id: 'toggle-snap', icon: 'ti-magnet', label: 'editor.canvas.toggleSnap', action: 'toggleSnap', toggle: true }
    ],
    actions: [
        { id: 'delete', icon: 'ti-trash', label: 'editor.canvas.delete', action: 'deleteSelected', danger: true }
    ]
};

/**
 * Varsayılan ayarlar
 */
const DEFAULT_OPTIONS = {
    container: null,
    editor: null,
    i18n: null,
    items: null,
    layout: 'horizontal',      // 'horizontal' veya 'vertical'
    showLabels: false,         // Buton etiketlerini göster
    showZoomDisplay: true,     // Zoom seviyesi gösterimi
    showDividers: true,        // Grup arası çizgiler
    compactMode: false         // Kompakt mod
};

/**
 * Toolbar Sınıfı
 */
export class Toolbar {
    /**
     * @param {Object} options - Toolbar ayarları
     */
    constructor(options = {}) {
        /**
         * Ayarlar
         * @type {Object}
         */
        this.options = { ...DEFAULT_OPTIONS, ...options };

        /**
         * Container element
         * @type {HTMLElement|null}
         */
        this.container = null;

        /**
         * Toolbar element
         * @type {HTMLElement|null}
         */
        this.element = null;

        /**
         * Editor referansı
         * @type {Object|null}
         */
        this.editor = this.options.editor;

        /**
         * i18n fonksiyonu
         * @type {Function|null}
         */
        this._i18n = this.options.i18n;

        /**
         * Toolbar öğeleri
         * @type {Object}
         */
        this.items = this.options.items || DEFAULT_ITEMS;

        /**
         * Toggle durumları
         * @type {Map<string, boolean>}
         */
        this._toggleStates = new Map();

        /**
         * Event handler referansları
         * @type {Map<Element, Map<string, Function>>}
         */
        this._eventHandlers = new Map();

        /**
         * Event subscriptions
         * @type {Array}
         */
        this._subscriptions = [];

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
     * Toolbar'ı render et
     * @returns {string} HTML string
     */
    render() {
        const layoutClass = this.options.layout === 'vertical' ? 'toolbar-vertical' : 'toolbar-horizontal';
        const compactClass = this.options.compactMode ? 'toolbar-compact' : '';

        return `
            <div class="editor-toolbar ${layoutClass} ${compactClass}">
                ${this._renderGroup('elements', this.__('editor.toolbar.elements'))}
                ${this.options.showDividers ? '<div class="toolbar-divider"></div>' : ''}
                ${this._renderGroup('zoom', this.__('editor.toolbar.zoom'))}
                ${this.options.showZoomDisplay ? this._renderZoomDisplay() : ''}
                ${this.options.showDividers ? '<div class="toolbar-divider"></div>' : ''}
                ${this._renderGroup('history', this.__('editor.toolbar.history'))}
                ${this.options.showDividers ? '<div class="toolbar-divider"></div>' : ''}
                ${this._renderGroup('grid', this.__('editor.toolbar.grid'))}
                ${this.options.showDividers ? '<div class="toolbar-divider"></div>' : ''}
                ${this._renderGroup('actions', this.__('editor.toolbar.actions'))}
            </div>
        `;
    }

    /**
     * Toolbar grubunu render et
     * @private
     * @param {string} groupKey - Grup anahtarı
     * @param {string} [groupLabel] - Grup etiketi (tooltip için)
     * @returns {string} HTML string
     */
    _renderGroup(groupKey, groupLabel = '') {
        const items = this.items[groupKey];
        if (!items || items.length === 0) return '';

        return `
            <div class="toolbar-group" data-group="${groupKey}" title="${groupLabel}">
                ${items.map(item => this._renderButton(item)).join('')}
            </div>
        `;
    }

    /**
     * Toolbar butonunu render et
     * @private
     * @param {Object} item - Buton öğesi
     * @returns {string} HTML string
     */
    _renderButton(item) {
        const label = this.__(item.label);
        const shortcutText = item.shortcut ? ` (${item.shortcut})` : '';
        const dangerClass = item.danger ? 'toolbar-btn-danger' : '';
        const toggleClass = item.toggle ? 'toolbar-btn-toggle' : '';
        const activeClass = this._toggleStates.get(item.id) ? 'active' : '';

        return `
            <button
                type="button"
                class="toolbar-btn ${dangerClass} ${toggleClass} ${activeClass}"
                id="toolbar-${item.id}"
                data-action="${item.action}"
                data-toggle="${item.toggle || false}"
                title="${label}${shortcutText}"
            >
                <i class="ti ${item.icon}"></i>
                ${this.options.showLabels ? `<span class="toolbar-btn-label">${label}</span>` : ''}
            </button>
        `;
    }

    /**
     * Zoom gösterimini render et
     * @private
     * @returns {string} HTML string
     */
    _renderZoomDisplay() {
        const zoom = this.editor?.getZoom?.() || 1;
        const zoomPercent = Math.round(zoom * 100);

        return `
            <div class="toolbar-zoom-display" id="toolbar-zoom-display">
                ${zoomPercent}%
            </div>
        `;
    }

    /**
     * Toolbar'ı DOM'a ekle
     * @param {HTMLElement|string} [target] - Hedef element veya selector
     */
    mount(target) {
        const container = target
            ? (typeof target === 'string' ? document.querySelector(target) : target)
            : this.container;

        if (!container) {
            console.error('Toolbar: Container bulunamadı');
            return;
        }

        this.container = container;

        // HTML render et ve ekle
        const html = this.render();
        container.insertAdjacentHTML('beforeend', html);

        // Element referansını al
        this.element = container.querySelector('.editor-toolbar');

        // Event'leri bağla
        this._bindEvents();

        // Event subscriptions
        this._subscribeToEvents();
    }

    /**
     * Toolbar'ı yeniden render et
     */
    refresh() {
        if (!this.element || !this.container) return;

        // Mevcut element'i kaldır
        this.element.remove();

        // Yeniden render et
        const html = this.render();
        this.container.insertAdjacentHTML('beforeend', html);

        // Element referansını güncelle
        this.element = this.container.querySelector('.editor-toolbar');

        // Event'leri yeniden bağla
        this._bindEvents();
    }

    // ==========================================
    // EVENT BINDING
    // ==========================================

    /**
     * Event'leri bağla
     * @private
     */
    _bindEvents() {
        if (!this.element) return;

        // Tüm butonlara click event'i
        this.element.querySelectorAll('.toolbar-btn').forEach(btn => {
            this._addEventListener(btn, 'click', (e) => {
                e.preventDefault();
                const action = btn.dataset.action;
                const isToggle = btn.dataset.toggle === 'true';

                if (action) {
                    this._executeAction(action, btn, isToggle);
                }
            });
        });
    }

    /**
     * EventBus event'lerine subscribe ol
     * @private
     */
    _subscribeToEvents() {
        // Zoom değişikliği
        const zoomSub = eventBus.on(EVENTS.CANVAS_ZOOM, (data) => {
            this._updateZoomDisplay(data.zoom);
        });
        this._subscriptions.push(zoomSub);

        // History değişikliği
        const historySub = eventBus.on(EVENTS.HISTORY_CHANGE, (data) => {
            this._updateHistoryButtons(data);
        });
        this._subscriptions.push(historySub);

        // Grid değişikliği
        const gridSub = eventBus.on(EVENTS.GRID_TOGGLE, (data) => {
            this._updateToggleButton('toggle-grid', data.visible);
        });
        this._subscriptions.push(gridSub);

        // Snap değişikliği
        const snapSub = eventBus.on(EVENTS.SNAP_TOGGLE, (data) => {
            this._updateToggleButton('toggle-snap', data.enabled);
        });
        this._subscriptions.push(snapSub);
    }

    /**
     * Event listener ekle
     * @private
     * @param {Element} element - DOM elementi
     * @param {string} event - Event adı
     * @param {Function} handler - Event handler
     */
    _addEventListener(element, event, handler) {
        if (!element) return;

        element.addEventListener(event, handler);

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
    // ACTIONS
    // ==========================================

    /**
     * Aksiyon çalıştır
     * @private
     * @param {string} action - Aksiyon adı
     * @param {HTMLElement} btn - Buton elementi
     * @param {boolean} isToggle - Toggle buton mu
     */
    _executeAction(action, btn, isToggle) {
        if (!this.editor) {
            console.warn('Toolbar: Editor referansı yok');
            return;
        }

        // Toggle durumunu güncelle
        if (isToggle) {
            const currentState = this._toggleStates.get(btn.id.replace('toolbar-', '')) || false;
            this._toggleStates.set(btn.id.replace('toolbar-', ''), !currentState);
            btn.classList.toggle('active');
        }

        // Editor metodunu çağır
        if (typeof this.editor[action] === 'function') {
            // addImage için özel işlem (dosya seçici gerekli)
            if (action === 'addImage') {
                this._handleAddImage();
            } else {
                this.editor[action]();
            }
        } else {
            console.warn(`Toolbar: Editor'da "${action}" metodu bulunamadı`);
        }

        // Event emit
        eventBus.emit(EVENTS.TOOLBAR_ACTION, { action, isToggle });
    }

    /**
     * Görsel ekleme işlemi (dosya seçici ile)
     * @private
     */
    _handleAddImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            // Data URL oluştur
            const reader = new FileReader();
            reader.onload = async (event) => {
                const dataUrl = event.target?.result;
                if (dataUrl && this.editor?.addImage) {
                    await this.editor.addImage(dataUrl);
                }
            };
            reader.readAsDataURL(file);
        };

        input.click();
    }

    // ==========================================
    // UPDATE METHODS
    // ==========================================

    /**
     * Zoom gösterimini güncelle
     * @private
     * @param {number} zoom - Zoom seviyesi
     */
    _updateZoomDisplay(zoom) {
        const display = this.element?.querySelector('#toolbar-zoom-display');
        if (display) {
            display.textContent = `${Math.round(zoom * 100)}%`;
        }
    }

    /**
     * History butonlarını güncelle
     * @private
     * @param {Object} data - History durumu
     */
    _updateHistoryButtons(data) {
        const undoBtn = this.element?.querySelector('#toolbar-undo');
        const redoBtn = this.element?.querySelector('#toolbar-redo');

        if (undoBtn) {
            undoBtn.disabled = !data.canUndo;
            undoBtn.classList.toggle('disabled', !data.canUndo);
        }

        if (redoBtn) {
            redoBtn.disabled = !data.canRedo;
            redoBtn.classList.toggle('disabled', !data.canRedo);
        }
    }

    /**
     * Toggle butonunu güncelle
     * @private
     * @param {string} buttonId - Buton ID
     * @param {boolean} active - Aktif durumu
     */
    _updateToggleButton(buttonId, active) {
        const btn = this.element?.querySelector(`#toolbar-${buttonId}`);
        if (btn) {
            btn.classList.toggle('active', active);
            this._toggleStates.set(buttonId, active);
        }
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    /**
     * Editor referansını ayarla
     * @param {Object} editor - Editor instance
     */
    setEditor(editor) {
        this.editor = editor;
    }

    /**
     * Buton durumunu ayarla
     * @param {string} buttonId - Buton ID
     * @param {Object} state - Durum objesi {disabled, active}
     */
    setButtonState(buttonId, state) {
        const btn = this.element?.querySelector(`#toolbar-${buttonId}`);
        if (!btn) return;

        if (state.disabled !== undefined) {
            btn.disabled = state.disabled;
            btn.classList.toggle('disabled', state.disabled);
        }

        if (state.active !== undefined) {
            btn.classList.toggle('active', state.active);
            this._toggleStates.set(buttonId, state.active);
        }
    }

    /**
     * Tüm butonları devre dışı bırak
     */
    disableAll() {
        this.element?.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
        });
    }

    /**
     * Tüm butonları etkinleştir
     */
    enableAll() {
        this.element?.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('disabled');
        });
    }

    /**
     * Toolbar'ı gizle
     */
    hide() {
        if (this.element) {
            this.element.classList.add('hidden');
        }
    }

    /**
     * Toolbar'ı göster
     */
    show() {
        if (this.element) {
            this.element.classList.remove('hidden');
        }
    }

    // ==========================================
    // CLEANUP
    // ==========================================

    /**
     * Toolbar'ı DOM'dan kaldır
     */
    unmount() {
        // Event'leri temizle
        this._removeAllEventListeners();

        // Subscriptions temizle
        this._subscriptions.forEach(unsub => {
            if (typeof unsub === 'function') unsub();
        });
        this._subscriptions = [];

        // DOM'dan kaldır
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }

    /**
     * Toolbar'ı dispose et
     */
    dispose() {
        this.unmount();
        this.container = null;
        this.editor = null;
        this._i18n = null;
        this._toggleStates.clear();
    }
}

/**
 * Default export
 */
export default Toolbar;
