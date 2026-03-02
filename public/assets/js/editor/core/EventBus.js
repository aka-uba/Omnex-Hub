/**
 * EventBus - Merkezi Event Sistemi
 *
 * WeakMap kullanarak memory leak'leri önler.
 * Context objeleri garbage collect edildiğinde listener'lar otomatik temizlenir.
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

// Singleton instance
let instance = null;

/**
 * WeakMap tabanlı context tracking
 * Context (this) garbage collected olduğunda listener'lar otomatik silinir
 */
const contextSubscriptions = new WeakMap();

/**
 * EventBus Singleton
 */
class EventBus {
    constructor() {
        if (instance) {
            return instance;
        }

        /**
         * Event -> Set<{callback, context}> mapping
         * @type {Map<string, Set<{callback: Function, context: Object}>>}
         */
        this.events = new Map();

        /**
         * Debug modu - event'leri console'a loglar
         * @type {boolean}
         */
        this.debug = false;

        instance = this;
    }

    /**
     * Event dinleyicisi ekle
     *
     * @param {string} event - Event adı
     * @param {Function} callback - Callback fonksiyonu
     * @param {Object} [context=null] - this context (WeakMap tracking için)
     * @returns {Function} Unsubscribe fonksiyonu
     *
     * @example
     * // Basit kullanım
     * eventBus.on('canvas:modified', (data) => console.log(data));
     *
     * @example
     * // Context ile (memory leak prevention)
     * eventBus.on('object:selected', this.handleSelect, this);
     */
    on(event, callback, context = null) {
        if (typeof callback !== 'function') {
            console.error(`EventBus.on: callback must be a function, got ${typeof callback}`);
            return () => {};
        }

        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }

        const subscription = { callback, context };
        this.events.get(event).add(subscription);

        // Context varsa WeakMap'e kaydet (GC tracking için)
        if (context !== null && typeof context === 'object') {
            if (!contextSubscriptions.has(context)) {
                contextSubscriptions.set(context, []);
            }
            contextSubscriptions.get(context).push({ event, subscription });
        }

        if (this.debug) {
            console.log(`[EventBus] Subscribed to "${event}"`, context ? `(context: ${context.constructor?.name})` : '');
        }

        // Unsubscribe fonksiyonu döndür
        return () => this.off(event, callback, context);
    }

    /**
     * Event dinleyicisini kaldır
     *
     * @param {string} event - Event adı
     * @param {Function} callback - Callback fonksiyonu
     * @param {Object} [context=null] - this context
     */
    off(event, callback, context = null) {
        if (!this.events.has(event)) return;

        const listeners = this.events.get(event);

        for (const listener of listeners) {
            if (listener.callback === callback && listener.context === context) {
                listeners.delete(listener);

                if (this.debug) {
                    console.log(`[EventBus] Unsubscribed from "${event}"`);
                }
                break;
            }
        }

        // Event'e ait listener kalmadıysa Map'ten sil
        if (listeners.size === 0) {
            this.events.delete(event);
        }
    }

    /**
     * Bir kere çalışan event dinleyicisi ekle
     *
     * @param {string} event - Event adı
     * @param {Function} callback - Callback fonksiyonu
     * @param {Object} [context=null] - this context
     * @returns {Function} Unsubscribe fonksiyonu
     */
    once(event, callback, context = null) {
        const wrappedCallback = (data) => {
            this.off(event, wrappedCallback, context);
            callback.call(context, data);
        };

        return this.on(event, wrappedCallback, context);
    }

    /**
     * Event emit et
     *
     * NOT: Listener listesini KOPYALAYARAK iterate et
     * Emit sırasında listener eklenirse/çıkarılırsa sorun olmaz
     *
     * @param {string} event - Event adı
     * @param {*} [data=null] - Event verisi
     */
    emit(event, data = null) {
        if (!this.events.has(event)) {
            if (this.debug) {
                console.log(`[EventBus] No listeners for "${event}"`);
            }
            return;
        }

        if (this.debug) {
            console.log(`[EventBus] Emitting "${event}"`, data);
        }

        // ÖNEMLI: Listeyi kopyala - emit sırasında mutation güvenli
        const listeners = [...this.events.get(event)];

        for (const { callback, context } of listeners) {
            try {
                callback.call(context, data);
            } catch (error) {
                console.error(`[EventBus] Error in "${event}" handler:`, error);
            }
        }
    }

    /**
     * Bir context'e ait tüm subscription'ları temizle
     * Component destroy edilirken çağrılmalı
     *
     * @param {Object} context - Temizlenecek context
     *
     * @example
     * // Component destroy'da
     * destroy() {
     *     eventBus.offAll(this);
     * }
     */
    offAll(context) {
        if (!context || typeof context !== 'object') return;

        const subscriptions = contextSubscriptions.get(context);
        if (!subscriptions) return;

        subscriptions.forEach(({ event, subscription }) => {
            if (this.events.has(event)) {
                this.events.get(event).delete(subscription);

                // Event'e ait listener kalmadıysa Map'ten sil
                if (this.events.get(event).size === 0) {
                    this.events.delete(event);
                }
            }
        });

        // WeakMap'ten silmeye gerek yok, GC halleder
        // Ama manuel temizlik için silebiliriz
        contextSubscriptions.delete(context);

        if (this.debug) {
            console.log(`[EventBus] Cleared all subscriptions for context:`, context.constructor?.name);
        }
    }

    /**
     * Belirli bir event'in tüm listener'larını temizle
     *
     * @param {string} event - Event adı
     */
    clearEvent(event) {
        if (this.events.has(event)) {
            this.events.delete(event);

            if (this.debug) {
                console.log(`[EventBus] Cleared all listeners for "${event}"`);
            }
        }
    }

    /**
     * Tüm event'leri temizle
     * Test veya tam reset için kullanılır
     */
    clearAll() {
        this.events.clear();

        if (this.debug) {
            console.log('[EventBus] Cleared all events');
        }
    }

    /**
     * Belirli bir event'e kaç listener bağlı olduğunu döndür
     *
     * @param {string} event - Event adı
     * @returns {number} Listener sayısı
     */
    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).size : 0;
    }

    /**
     * Tüm event isimlerini döndür
     *
     * @returns {string[]} Event isimleri
     */
    eventNames() {
        return [...this.events.keys()];
    }

    /**
     * Debug modunu aç/kapa
     *
     * @param {boolean} enabled - Debug durumu
     */
    setDebug(enabled) {
        this.debug = !!enabled;
        console.log(`[EventBus] Debug mode ${this.debug ? 'enabled' : 'disabled'}`);
    }

    /**
     * Singleton instance'ı sıfırla (test için)
     */
    static resetInstance() {
        instance = null;
    }
}

// Singleton export
export const eventBus = new EventBus();

// Class export (test için)
export { EventBus };

/**
 * Event Sabitleri
 * Typo'ları önlemek için sabit string'ler
 */
export const EVENTS = {
    // Canvas Events
    CANVAS_READY: 'canvas:ready',
    CANVAS_MODIFIED: 'canvas:modified',
    CANVAS_CLEARED: 'canvas:cleared',
    CANVAS_RESIZED: 'canvas:resized',

    // Object Events
    OBJECT_ADDED: 'object:added',
    OBJECT_REMOVED: 'object:removed',
    OBJECT_MODIFIED: 'object:modified',
    OBJECT_SELECTED: 'object:selected',
    OBJECT_DESELECTED: 'object:deselected',
    OBJECT_MOVING: 'object:moving',
    OBJECT_SCALING: 'object:scaling',
    OBJECT_ROTATING: 'object:rotating',

    // Selection Events
    SELECTION_CREATED: 'selection:created',
    SELECTION_UPDATED: 'selection:updated',
    SELECTION_CLEARED: 'selection:cleared',

    // History Events
    HISTORY_UNDO: 'history:undo',
    HISTORY_REDO: 'history:redo',
    HISTORY_SAVE: 'history:save',
    HISTORY_CLEAR: 'history:clear',
    HISTORY_CHANGE: 'history:change',

    // Panel Events
    PANEL_OPENED: 'panel:opened',
    PANEL_CLOSED: 'panel:closed',
    PANEL_MOVED: 'panel:moved',
    PANEL_COLLAPSED: 'panel:collapsed',
    PANEL_EXPANDED: 'panel:expanded',

    // Template Events
    TEMPLATE_LOADED: 'template:loaded',
    TEMPLATE_SAVED: 'template:saved',
    TEMPLATE_EXPORTED: 'template:exported',
    TEMPLATE_LOAD: 'template:load',

    // Editor Events
    EDITOR_DISPOSE: 'editor:dispose',

    // Tool Events
    TOOL_CHANGED: 'tool:changed',
    TOOL_ACTIVATED: 'tool:activated',
    TOOL_DEACTIVATED: 'tool:deactivated',

    // Grid/Layout Events
    GRID_CHANGED: 'grid:changed',
    GRID_SHOW: 'grid:show',
    GRID_HIDE: 'grid:hide',
    GRID_TOGGLE: 'grid:toggle',
    GRID_SIZE_CHANGE: 'grid:sizeChange',
    SNAP_ENABLE: 'snap:enable',
    SNAP_DISABLE: 'snap:disable',
    SNAP_TOGGLE: 'snap:toggle',
    LAYOUT_CHANGE: 'layout:change',
    LAYOUT_CHANGED: 'layout:changed',

    // Zoom/Pan Events
    ZOOM_CHANGED: 'zoom:changed',
    PAN_CHANGED: 'pan:changed',
    CANVAS_ZOOM: 'canvas:zoom',
    CANVAS_RESIZE: 'canvas:resize',
    CANVAS_CLEAR: 'canvas:clear',

    // Error Events
    ERROR_OCCURRED: 'error:occurred',
    WARNING_OCCURRED: 'warning:occurred',

    // Multi-Frame Events
    FRAME_SELECTED: 'frame:selected',
    FRAME_DESELECTED: 'frame:deselected',
    SLOT_SELECTED: 'slot:selected',
    SLOT_UPDATED: 'slot:updated',

    // Dynamic Field Events
    FIELD_ADDED: 'field:added',
    FIELD_REMOVED: 'field:removed',
    FIELD_UPDATED: 'field:updated',
    DYNAMIC_FIELD_ADD: 'dynamicField:add',
    DYNAMIC_FIELD_SELECT: 'dynamicField:select',

    // Object Double-Click Events
    OBJECT_DBLCLICK: 'object:dblclick',

    // Property Panel Events
    PROPERTY_CHANGED: 'property:changed',
    PROPERTY_REPLACE_IMAGE: 'property:replaceImage',
    PROPERTY_EDIT_BARCODE: 'property:editBarcode',

    // Background Events
    BACKGROUND_CHANGED: 'background:changed'
};
