/**
 * HistoryManager - Undo/Redo Yönetimi
 *
 * Canvas değişikliklerini izler ve geri alma/yineleme işlemlerini yönetir.
 * Debounce ile gereksiz kayıtları önler.
 *
 * KULLANIM:
 * ```javascript
 * import { HistoryManager } from './editor/managers/HistoryManager.js';
 *
 * const historyManager = new HistoryManager(canvas, {
 *     maxHistory: 50,
 *     debounceMs: 300
 * });
 *
 * // Geri al
 * historyManager.undo();
 *
 * // Yinele
 * historyManager.redo();
 *
 * // Manuel kaydet
 * historyManager.saveState('Metin eklendi');
 *
 * // Durumu dinle
 * historyManager.onHistoryChange((canUndo, canRedo) => {
 *     undoButton.disabled = !canUndo;
 *     redoButton.disabled = !canRedo;
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
    maxHistory: 50,        // Maksimum history adımı
    debounceMs: 300,       // Debounce süresi (ms)
    excludeEvents: []      // Hariç tutulacak event'ler
};

/**
 * HistoryManager Sınıfı
 */
export class HistoryManager {
    /**
     * @param {Object} options - Ayarlar
     * @param {Object} options.canvas - Fabric.js Canvas instance
     * @param {number} [options.maxSize] - Maksimum history boyutu
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
        this.options = { ...DEFAULT_OPTIONS, maxSize: options.maxSize };

        /**
         * Undo stack
         * @type {Array<{state: string, description: string, timestamp: number}>}
         */
        this._undoStack = [];

        /**
         * Redo stack
         * @type {Array<{state: string, description: string, timestamp: number}>}
         */
        this._redoStack = [];

        /**
         * History değişikliği callback'leri
         * @type {Function[]}
         */
        this._historyCallbacks = [];

        /**
         * Debounce timer
         * @type {number|null}
         */
        this._debounceTimer = null;

        /**
         * History işlemi devam ediyor mu (undo/redo sırasında event'leri atla)
         * @type {boolean}
         */
        this._isProcessing = false;

        /**
         * Son kaydedilen state hash (duplicate önleme)
         * @type {string}
         */
        this._lastStateHash = '';

        /**
         * Event handler referansları
         * @type {Object}
         */
        this._eventHandlers = {};

        // Event'leri bağla
        this._bindEvents();

        // İlk durumu kaydet
        this._saveInitialState();
    }

    /**
     * Event'leri bağla
     * @private
     */
    _bindEvents() {
        // Canvas modification event'i
        this._eventHandlers.canvasModified = (data) => {
            if (this._isProcessing) return;

            // Hariç tutulan event'leri atla
            if (data?.source && this.options.excludeEvents.includes(data.source)) {
                return;
            }

            this._debounceSave(data?.source || 'modification');
        };
        eventBus.on(EVENTS.CANVAS_MODIFIED, this._eventHandlers.canvasModified, this);

        // Object ekleme/silme için direkt kayıt
        this._eventHandlers.objectAdded = (data) => {
            if (this._isProcessing) return;
            if (shouldExcludeFromHistory(data?.object)) return;
            this._debounceSave('object:added');
        };
        eventBus.on(EVENTS.OBJECT_ADDED, this._eventHandlers.objectAdded, this);

        this._eventHandlers.objectRemoved = (data) => {
            if (this._isProcessing) return;
            if (shouldExcludeFromHistory(data?.object)) return;
            this._debounceSave('object:removed');
        };
        eventBus.on(EVENTS.OBJECT_REMOVED, this._eventHandlers.objectRemoved, this);

        // Keyboard shortcuts
        this._eventHandlers.keydown = (e) => {
            // Ctrl+Z: Undo
            if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }

            // Ctrl+Shift+Z veya Ctrl+Y: Redo
            if ((e.ctrlKey && e.shiftKey && e.code === 'KeyZ') ||
                (e.ctrlKey && e.code === 'KeyY')) {
                e.preventDefault();
                this.redo();
            }
        };
        document.addEventListener('keydown', this._eventHandlers.keydown);
    }

    /**
     * İlk durumu kaydet
     * @private
     */
    _saveInitialState() {
        if (!this.canvas) return;

        const state = this._getCanvasState();
        this._undoStack.push({
            state: state,
            description: 'Initial state',
            timestamp: Date.now()
        });
        this._lastStateHash = this._hashState(state);
    }

    /**
     * Debounce ile kaydet
     * @private
     * @param {string} description - İşlem açıklaması
     */
    _debounceSave(description) {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        this._debounceTimer = setTimeout(() => {
            this.saveState(description);
            this._debounceTimer = null;
        }, this.options.debounceMs);
    }

    /**
     * Canvas durumunu JSON olarak al
     * @private
     * @returns {string}
     */
    _getCanvasState() {
        if (!this.canvas) return '{}';

        // History'den hariç tutulacak nesneleri filtrele
        const objects = this.canvas.getObjects().filter(obj => !shouldExcludeFromHistory(obj));

        // Custom props dahil et
        const json = this.canvas.toJSON(SERIALIZABLE_PROPS);

        // Filtrelenmiş nesnelerle state oluştur
        json.objects = objects.map(obj => obj.toJSON(SERIALIZABLE_PROPS));

        return JSON.stringify(json);
    }

    /**
     * State hash'i oluştur (duplicate önleme)
     * @private
     * @param {string} state - JSON state
     * @returns {string}
     */
    _hashState(state) {
        // Basit hash fonksiyonu
        let hash = 0;
        for (let i = 0; i < state.length; i++) {
            const char = state.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    // ==========================================
    // KAYIT İŞLEMLERİ
    // ==========================================

    /**
     * Mevcut durumu kaydet
     * @param {string} [description='State saved'] - İşlem açıklaması
     * @returns {boolean} Kayıt başarılı mı
     */
    saveState(description = 'State saved') {
        if (!this.canvas || this._isProcessing) return false;

        const state = this._getCanvasState();
        const stateHash = this._hashState(state);

        // Aynı state ise kaydetme
        if (stateHash === this._lastStateHash) {
            return false;
        }

        // Max history kontrolü
        if (this._undoStack.length >= this.options.maxHistory) {
            this._undoStack.shift(); // En eski kaydı sil
        }

        // Yeni state ekle
        this._undoStack.push({
            state: state,
            description: description,
            timestamp: Date.now()
        });

        // Redo stack'i temizle (yeni işlem yapıldı)
        this._redoStack = [];

        this._lastStateHash = stateHash;

        // Callback'leri bildir
        this._notifyHistoryChange();

        eventBus.emit(EVENTS.HISTORY_SAVE, {
            description,
            undoCount: this._undoStack.length,
            redoCount: 0
        });

        return true;
    }

    /**
     * Geri al
     * @returns {boolean} İşlem başarılı mı
     */
    undo() {
        if (!this.canvas || !this.canUndo()) return false;

        this._isProcessing = true;

        try {
            // Mevcut durumu redo stack'e al
            const currentState = this._getCanvasState();
            const currentItem = this._undoStack.pop();

            this._redoStack.push({
                state: currentState,
                description: currentItem?.description || 'Undo',
                timestamp: Date.now()
            });

            // Önceki durumu yükle
            const previousState = this._undoStack[this._undoStack.length - 1];
            if (previousState) {
                this._loadState(previousState.state);
                this._lastStateHash = this._hashState(previousState.state);
            }

            this._notifyHistoryChange();

            eventBus.emit(EVENTS.HISTORY_UNDO, {
                description: previousState?.description,
                undoCount: this._undoStack.length,
                redoCount: this._redoStack.length
            });

            return true;
        } finally {
            this._isProcessing = false;
        }
    }

    /**
     * Yinele
     * @returns {boolean} İşlem başarılı mı
     */
    redo() {
        if (!this.canvas || !this.canRedo()) return false;

        this._isProcessing = true;

        try {
            // Redo stack'ten al
            const redoItem = this._redoStack.pop();

            if (redoItem) {
                // Mevcut durumu undo stack'e ekle
                this._undoStack.push({
                    state: this._getCanvasState(),
                    description: redoItem.description,
                    timestamp: Date.now()
                });

                // Redo durumunu yükle
                this._loadState(redoItem.state);
                this._lastStateHash = this._hashState(redoItem.state);
            }

            this._notifyHistoryChange();

            eventBus.emit(EVENTS.HISTORY_REDO, {
                description: redoItem?.description,
                undoCount: this._undoStack.length,
                redoCount: this._redoStack.length
            });

            return true;
        } finally {
            this._isProcessing = false;
        }
    }

    /**
     * State'i canvas'a yükle
     * @private
     * @param {string} state - JSON state
     */
    _loadState(state) {
        if (!this.canvas) return;

        const json = JSON.parse(state);

        // Fabric.js 7: Promise tabanlı API
        this.canvas.loadFromJSON(json).then(() => {
            this.canvas.requestRenderAll();
        });
    }

    // ==========================================
    // SORGULAMA
    // ==========================================

    /**
     * Undo yapılabilir mi?
     * @returns {boolean}
     */
    canUndo() {
        return this._undoStack.length > 1; // İlk state hariç
    }

    /**
     * Redo yapılabilir mi?
     * @returns {boolean}
     */
    canRedo() {
        return this._redoStack.length > 0;
    }

    /**
     * Undo adım sayısını al
     * @returns {number}
     */
    getUndoCount() {
        return Math.max(0, this._undoStack.length - 1);
    }

    /**
     * Redo adım sayısını al
     * @returns {number}
     */
    getRedoCount() {
        return this._redoStack.length;
    }

    /**
     * History listesini al
     * @returns {Array<{description: string, timestamp: number, type: 'undo'|'redo'}>}
     */
    getHistoryList() {
        const list = [];

        // Undo stack (tersine)
        for (let i = this._undoStack.length - 1; i >= 1; i--) {
            list.push({
                description: this._undoStack[i].description,
                timestamp: this._undoStack[i].timestamp,
                type: 'undo',
                index: i
            });
        }

        return list;
    }

    // ==========================================
    // HISTORY DEĞİŞİKLİĞİ DİNLEME
    // ==========================================

    /**
     * History değişikliğini dinle
     * @param {Function} callback - Callback fonksiyonu (canUndo, canRedo, undoCount, redoCount) => void
     * @returns {Function} Unsubscribe fonksiyonu
     */
    onHistoryChange(callback) {
        if (typeof callback !== 'function') {
            console.error('HistoryManager: callback must be a function');
            return () => {};
        }

        this._historyCallbacks.push(callback);

        // İlk durum bildirimi
        callback(this.canUndo(), this.canRedo(), this.getUndoCount(), this.getRedoCount());

        // Unsubscribe fonksiyonu döndür
        return () => {
            const index = this._historyCallbacks.indexOf(callback);
            if (index > -1) {
                this._historyCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * History değişikliğini bildir
     * @private
     */
    _notifyHistoryChange() {
        const canUndo = this.canUndo();
        const canRedo = this.canRedo();
        const undoCount = this.getUndoCount();
        const redoCount = this.getRedoCount();

        this._historyCallbacks.forEach(callback => {
            try {
                callback(canUndo, canRedo, undoCount, redoCount);
            } catch (err) {
                console.error('HistoryManager: Callback hatası:', err);
            }
        });
    }

    // ==========================================
    // TEMİZLİK
    // ==========================================

    /**
     * History'i temizle
     * @param {boolean} [keepCurrent=true] - Mevcut durumu koru
     */
    clear(keepCurrent = true) {
        if (keepCurrent && this.canvas) {
            const currentState = this._getCanvasState();
            this._undoStack = [{
                state: currentState,
                description: 'Cleared history',
                timestamp: Date.now()
            }];
            this._lastStateHash = this._hashState(currentState);
        } else {
            this._undoStack = [];
            this._lastStateHash = '';
        }

        this._redoStack = [];
        this._notifyHistoryChange();

        eventBus.emit(EVENTS.HISTORY_CLEAR, {});
    }

    /**
     * Belirli bir noktaya git
     * @param {number} index - History index'i
     * @returns {boolean} İşlem başarılı mı
     */
    goToState(index) {
        if (index < 0 || index >= this._undoStack.length) return false;

        this._isProcessing = true;

        try {
            // Index'e kadar olan state'leri redo'ya taşı
            while (this._undoStack.length > index + 1) {
                const item = this._undoStack.pop();
                if (item) {
                    this._redoStack.push(item);
                }
            }

            // State'i yükle
            const targetState = this._undoStack[index];
            if (targetState) {
                this._loadState(targetState.state);
                this._lastStateHash = this._hashState(targetState.state);
            }

            this._notifyHistoryChange();
            return true;
        } finally {
            this._isProcessing = false;
        }
    }

    /**
     * Canvas referansını güncelle
     * @param {Object} canvas - Yeni canvas instance
     */
    setCanvas(canvas) {
        this.canvas = canvas;
        this.clear(false);
        this._saveInitialState();
    }

    /**
     * Manager'ı dispose et
     */
    dispose() {
        // Debounce timer'ı temizle
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }

        // Keyboard event'i kaldır
        if (this._eventHandlers.keydown) {
            document.removeEventListener('keydown', this._eventHandlers.keydown);
        }

        // EventBus'tan kaldır
        eventBus.offAll(this);

        // Referansları temizle
        this._undoStack = [];
        this._redoStack = [];
        this._historyCallbacks = [];
        this._eventHandlers = {};
        this.canvas = null;
    }
}

/**
 * Default export
 */
export default HistoryManager;
