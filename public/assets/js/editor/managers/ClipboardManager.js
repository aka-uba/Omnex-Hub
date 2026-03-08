/**
 * ClipboardManager - Kopyala/Yapıştır Yönetimi
 *
 * Canvas nesnelerini kopyalama, kesme ve yapıştırma işlemlerini yönetir.
 * Hem internal clipboard hem de sistem clipboard desteği sunar.
 *
 * KULLANIM:
 * ```javascript
 * import { ClipboardManager } from './editor/managers/ClipboardManager.js';
 *
 * const clipboardManager = new ClipboardManager(canvas);
 *
 * // Seçili nesneleri kopyala
 * clipboardManager.copy();
 *
 * // Seçili nesneleri kes
 * clipboardManager.cut();
 *
 * // Yapıştır
 * clipboardManager.paste();
 *
 * // Yerinde çoğalt (duplicate)
 * clipboardManager.duplicate();
 *
 * // Clipboard durumunu dinle
 * clipboardManager.onClipboardChange((hasContent) => {
 *     pasteButton.disabled = !hasContent;
 * });
 * ```
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

import { eventBus, EVENTS } from '../core/EventBus.js';
import { CUSTOM_PROPS, shouldExcludeFromHistory, SERIALIZABLE_PROPS } from '../core/CustomProperties.js';

/**
 * Varsayılan ayarlar
 */
const DEFAULT_OPTIONS = {
    pasteOffset: 20,           // Yapıştırma offset (px)
    enableSystemClipboard: true, // Sistem clipboard desteği
    duplicateOffset: 10        // Duplicate offset (px)
};

/**
 * ClipboardManager Sınıfı
 */
export class ClipboardManager {
    /**
     * @param {Object} options - Ayarlar
     * @param {Object} options.canvas - Fabric.js Canvas instance
     */
    constructor(options = {}) {
        /**
         * Fabric.js Canvas referansı
         * @type {Object}
         */
        this.canvas = options.canvas;

        /**
         * Ayarlar
         * @type {Object}
         */
        this.options = { ...DEFAULT_OPTIONS };

        /**
         * Internal clipboard (JSON formatında nesneler)
         * @type {Array<Object>}
         */
        this._clipboard = [];

        /**
         * Clipboard değişikliği callback'leri
         * @type {Function[]}
         */
        this._clipboardCallbacks = [];

        /**
         * Son yapıştırma sayacı (offset hesaplama için)
         * @type {number}
         */
        this._pasteCount = 0;

        /**
         * Keyboard event handler referansı
         * @type {Function|null}
         */
        this._keydownHandler = null;

        // Keyboard shortcuts bağla
        this._bindKeyboardShortcuts();
    }

    /**
     * Keyboard shortcuts bağla
     * @private
     */
    _bindKeyboardShortcuts() {
        this._keydownHandler = (e) => {
            // Canvas'a focus yoksa atla
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable)) {
                return;
            }

            // Ctrl+C: Copy
            if (e.ctrlKey && e.code === 'KeyC' && !e.shiftKey) {
                e.preventDefault();
                this.copy();
            }

            // Ctrl+X: Cut
            if (e.ctrlKey && e.code === 'KeyX' && !e.shiftKey) {
                e.preventDefault();
                this.cut();
            }

            // Ctrl+V: Paste
            if (e.ctrlKey && e.code === 'KeyV' && !e.shiftKey) {
                e.preventDefault();
                this.paste();
            }

            // Ctrl+D: Duplicate
            if (e.ctrlKey && e.code === 'KeyD' && !e.shiftKey) {
                e.preventDefault();
                this.duplicate();
            }
        };

        document.addEventListener('keydown', this._keydownHandler);
    }

    // ==========================================
    // KOPYALAMA İŞLEMLERİ
    // ==========================================

    /**
     * Seçili nesneleri kopyala
     * @returns {boolean} İşlem başarılı mı
     */
    copy() {
        if (!this.canvas) return false;

        const activeObjects = this._getSelectedObjects();
        if (activeObjects.length === 0) return false;

        // Clipboard'ı temizle
        this._clipboard = [];
        this._pasteCount = 0;

        // Nesneleri serialize et
        activeObjects.forEach(obj => {
            if (shouldExcludeFromHistory(obj)) return;

            const serialized = obj.toJSON(SERIALIZABLE_PROPS);
            this._clipboard.push(serialized);
        });

        // Callback'leri bildir
        this._notifyClipboardChange();

        // Sistem clipboard'a da kopyala (opsiyonel)
        if (this.options.enableSystemClipboard) {
            this._copyToSystemClipboard();
        }

        eventBus.emit(EVENTS.CLIPBOARD_COPY, {
            count: this._clipboard.length
        });

        return true;
    }

    /**
     * Seçili nesneleri kes
     * @returns {boolean} İşlem başarılı mı
     */
    cut() {
        if (!this.canvas) return false;

        const activeObjects = this._getSelectedObjects();
        if (activeObjects.length === 0) return false;

        // Önce kopyala
        const copySuccess = this.copy();
        if (!copySuccess) return false;

        // Sonra sil
        activeObjects.forEach(obj => {
            this.canvas.remove(obj);
        });

        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();

        eventBus.emit(EVENTS.CLIPBOARD_CUT, {
            count: this._clipboard.length
        });

        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'cut' });

        return true;
    }

    /**
     * Clipboard içeriğini yapıştır
     * @param {Object} [options={}] - Yapıştırma seçenekleri
     * @returns {Promise<Array<Object>>} Yapıştırılan nesneler
     */
    async paste(options = {}) {
        if (!this.canvas) return [];
        if (this._clipboard.length === 0) return [];

        const {
            offsetX = this.options.pasteOffset,
            offsetY = this.options.pasteOffset,
            center = false
        } = options;

        // Yapıştırma sayacını artır
        this._pasteCount++;

        const pastedObjects = [];

        // Her nesneyi yapıştır
        for (const serialized of this._clipboard) {
            try {
                const cloned = await this._deserializeObject(serialized);
                if (!cloned) continue;

                // Yeni objectId ata (frame/selection bağları için benzersiz olmalı)
                cloned.set(CUSTOM_PROPS.OBJECT_ID, this._generateUUID());

                // Pozisyon ayarla
                if (center) {
                    // Canvas ortasına
                    cloned.set({
                        left: this.canvas.width / 2,
                        top: this.canvas.height / 2
                    });
                } else {
                    // Offset ile
                    const totalOffset = this._pasteCount * offsetX;
                    cloned.set({
                        left: (cloned.left || 0) + totalOffset,
                        top: (cloned.top || 0) + (this._pasteCount * offsetY)
                    });
                }

                this._clampObjectIntoCanvas(cloned);

                this.canvas.add(cloned);
                pastedObjects.push(cloned);
            } catch (err) {
                console.error('ClipboardManager: Yapıştırma hatası:', err);
            }
        }

        // Yapıştırılan nesneleri seç
        if (pastedObjects.length > 0) {
            this.canvas.discardActiveObject();

            if (pastedObjects.length === 1) {
                this.canvas.setActiveObject(pastedObjects[0]);
            } else {
                const selection = new fabric.ActiveSelection(pastedObjects, {
                    canvas: this.canvas
                });
                this.canvas.setActiveObject(selection);
            }

            this.canvas.requestRenderAll();

            eventBus.emit(EVENTS.CLIPBOARD_PASTE, {
                count: pastedObjects.length
            });

            eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'paste' });
        }

        return pastedObjects;
    }

    /**
     * Seçili nesneleri yerinde çoğalt
     * @returns {Promise<Array<Object>>} Çoğaltılan nesneler
     */
    async duplicate() {
        if (!this.canvas) return [];

        const activeObjects = this._getSelectedObjects();
        if (activeObjects.length === 0) return [];

        const duplicatedObjects = [];

        for (const obj of activeObjects) {
            if (shouldExcludeFromHistory(obj)) continue;

            try {
                const serialized = obj.toJSON(SERIALIZABLE_PROPS);
                const cloned = await this._deserializeObject(serialized);
                if (!cloned) continue;

                // Yeni objectId ata (frame/selection bağları için benzersiz olmalı)
                cloned.set(CUSTOM_PROPS.OBJECT_ID, this._generateUUID());

                // Offset ile pozisyonla
                cloned.set({
                    left: (cloned.left || 0) + this.options.duplicateOffset,
                    top: (cloned.top || 0) + this.options.duplicateOffset
                });

                this._clampObjectIntoCanvas(cloned);

                this.canvas.add(cloned);
                duplicatedObjects.push(cloned);
            } catch (err) {
                console.error('ClipboardManager: Duplicate hatası:', err);
            }
        }

        // Çoğaltılan nesneleri seç
        if (duplicatedObjects.length > 0) {
            this.canvas.discardActiveObject();

            if (duplicatedObjects.length === 1) {
                this.canvas.setActiveObject(duplicatedObjects[0]);
            } else {
                const selection = new fabric.ActiveSelection(duplicatedObjects, {
                    canvas: this.canvas
                });
                this.canvas.setActiveObject(selection);
            }

            this.canvas.requestRenderAll();

            eventBus.emit(EVENTS.CLIPBOARD_DUPLICATE, {
                count: duplicatedObjects.length
            });

            eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'duplicate' });
        }

        return duplicatedObjects;
    }

    // ==========================================
    // YARDIMCI METODLAR
    // ==========================================

    /**
     * Seçili nesneleri al
     * @private
     * @returns {Array<Object>}
     */
    _getSelectedObjects() {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject) return [];

        // ActiveSelection ise (v7: 'ActiveSelection', v5: 'activeSelection'/'activeselection')
        if (activeObject.type === 'activeselection' || activeObject.type === 'activeSelection' || activeObject.type === 'ActiveSelection') {
            return activeObject.getObjects();
        }

        // Tek nesne
        return [activeObject];
    }

    /**
     * Serialized nesneyi deserialize et
     * @private
     * @param {Object} serialized - JSON formatında nesne
     * @returns {Promise<Object>} Fabric.js nesnesi
     */
    async _deserializeObject(serialized) {
        return new Promise((resolve, reject) => {
            // fabric.util.enlivenObjects kullanarak nesneyi oluştur
            fabric.util.enlivenObjects([serialized], {
                reviver: (obj, instance) => {
                    // Custom properties'i geri yükle
                    if (serialized[CUSTOM_PROPS.OBJECT_ID]) {
                        instance.set(CUSTOM_PROPS.OBJECT_ID, serialized[CUSTOM_PROPS.OBJECT_ID]);
                    }
                    if (serialized[CUSTOM_PROPS.TYPE]) {
                        instance.set(CUSTOM_PROPS.TYPE, serialized[CUSTOM_PROPS.TYPE]);
                    }
                    if (serialized[CUSTOM_PROPS.DYNAMIC_FIELD]) {
                        instance.set(CUSTOM_PROPS.DYNAMIC_FIELD, serialized[CUSTOM_PROPS.DYNAMIC_FIELD]);
                    }
                    // Diğer custom props...
                    SERIALIZABLE_PROPS.forEach(prop => {
                        if (serialized[prop] !== undefined) {
                            instance.set(prop, serialized[prop]);
                        }
                    });
                }
            }).then(objects => {
                resolve(objects[0] || null);
            }).catch(err => {
                reject(err);
            });
        });
    }

    /**
     * Nesneyi canvas sınırları içine taşı (gerekirse).
     * @private
     * @param {Object} obj
     */
    _clampObjectIntoCanvas(obj) {
        if (!this.canvas || !obj) return;

        obj.setCoords?.();
        const rect = obj.getBoundingRect?.(true, true);
        if (!rect) return;

        const canvasW = Number(this.canvas.width) || 0;
        const canvasH = Number(this.canvas.height) || 0;
        if (canvasW <= 0 || canvasH <= 0) return;

        let dx = 0;
        let dy = 0;

        if (rect.left < 0) dx = -rect.left;
        if (rect.top < 0) dy = -rect.top;

        const overflowRight = rect.left + rect.width - canvasW;
        const overflowBottom = rect.top + rect.height - canvasH;
        if (overflowRight > 0) dx -= overflowRight;
        if (overflowBottom > 0) dy -= overflowBottom;

        if (dx !== 0 || dy !== 0) {
            obj.set({
                left: (Number(obj.left) || 0) + dx,
                top: (Number(obj.top) || 0) + dy
            });
            obj.setCoords?.();
        }
    }

    /**
     * UUID oluştur
     * @private
     * @returns {string}
     */
    _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Sistem clipboard'a kopyala
     * @private
     */
    _copyToSystemClipboard() {
        if (!navigator.clipboard) return;

        try {
            const data = JSON.stringify({
                type: 'omnex-fabric-objects',
                version: '7.0',
                objects: this._clipboard
            });

            navigator.clipboard.writeText(data).catch(err => {
                // Silent fail - sistem clipboard erişimi olmayabilir
            });
        } catch (err) {
            // Silent fail
        }
    }

    /**
     * Sistem clipboard'dan oku
     * @returns {Promise<boolean>} Başarılı mı
     */
    async pasteFromSystemClipboard() {
        if (!navigator.clipboard) return false;

        try {
            const text = await navigator.clipboard.readText();
            const data = JSON.parse(text);

            if (data.type === 'omnex-fabric-objects' && Array.isArray(data.objects)) {
                this._clipboard = data.objects;
                this._pasteCount = 0;
                this._notifyClipboardChange();
                return await this.paste();
            }
        } catch (err) {
            // Silent fail - geçersiz clipboard içeriği
        }

        return false;
    }

    // ==========================================
    // CLIPBOARD DURUMU
    // ==========================================

    /**
     * Clipboard'da içerik var mı?
     * @returns {boolean}
     */
    hasContent() {
        return this._clipboard.length > 0;
    }

    /**
     * Clipboard içerik sayısı
     * @returns {number}
     */
    getContentCount() {
        return this._clipboard.length;
    }

    /**
     * Clipboard'ı temizle
     */
    clear() {
        this._clipboard = [];
        this._pasteCount = 0;
        this._notifyClipboardChange();

        eventBus.emit(EVENTS.CLIPBOARD_CLEAR, {});
    }

    // ==========================================
    // CLIPBOARD DEĞİŞİKLİĞİ DİNLEME
    // ==========================================

    /**
     * Clipboard değişikliğini dinle
     * @param {Function} callback - Callback fonksiyonu (hasContent) => void
     * @returns {Function} Unsubscribe fonksiyonu
     */
    onClipboardChange(callback) {
        if (typeof callback !== 'function') {
            console.error('ClipboardManager: callback must be a function');
            return () => {};
        }

        this._clipboardCallbacks.push(callback);

        // İlk durum bildirimi
        callback(this.hasContent());

        // Unsubscribe fonksiyonu döndür
        return () => {
            const index = this._clipboardCallbacks.indexOf(callback);
            if (index > -1) {
                this._clipboardCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Clipboard değişikliğini bildir
     * @private
     */
    _notifyClipboardChange() {
        const hasContent = this.hasContent();

        this._clipboardCallbacks.forEach(callback => {
            try {
                callback(hasContent);
            } catch (err) {
                console.error('ClipboardManager: Callback hatası:', err);
            }
        });
    }

    // ==========================================
    // TEMİZLİK
    // ==========================================

    /**
     * Canvas referansını güncelle
     * @param {Object} canvas - Yeni canvas instance
     */
    setCanvas(canvas) {
        this.canvas = canvas;
    }

    /**
     * Manager'ı dispose et
     */
    dispose() {
        // Keyboard event'i kaldır
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
            this._keydownHandler = null;
        }

        // Referansları temizle
        this._clipboard = [];
        this._clipboardCallbacks = [];
        this.canvas = null;
    }
}

/**
 * Default export
 */
export default ClipboardManager;
