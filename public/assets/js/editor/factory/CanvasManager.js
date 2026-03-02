/**
 * CanvasManager - Fabric.js Canvas Yönetimi
 *
 * Canvas oluşturma, boyutlandırma, zoom, pan ve temel event binding işlemleri.
 * v7 uyumlu event pointer sistemi kullanır.
 *
 * KULLANIM:
 * ```javascript
 * import { CanvasManager } from './editor/factory/CanvasManager.js';
 *
 * const manager = new CanvasManager({
 *     containerId: 'canvas-container',
 *     width: 800,
 *     height: 600
 * });
 *
 * await manager.initialize();
 *
 * // Zoom
 * manager.zoomIn();
 * manager.zoomOut();
 * manager.zoomToFit();
 *
 * // Pan
 * manager.enablePan();
 * manager.disablePan();
 *
 * // Export
 * const dataUrl = manager.toDataURL();
 * const json = manager.toJSON();
 * ```
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

import { eventBus, EVENTS } from '../core/EventBus.js';
import { CUSTOM_PROPS, isTransient } from '../core/CustomProperties.js';
import {
    Canvas,
    StaticCanvas,
    waitForFabric,
    isFabricLoaded
} from '../core/FabricExports.js';

/**
 * Varsayılan canvas ayarları
 */
const DEFAULT_CANVAS_OPTIONS = {
    // Boyutlar
    width: 800,
    height: 600,

    // Arka plan (CSS variable'dan al)
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff',

    // Seçim
    selection: true,
    selectionColor: 'rgba(34, 139, 230, 0.3)',
    selectionBorderColor: '#228be6',
    selectionLineWidth: 1,

    // Grid ve rehber çizgileri (v7)
    controlsAboveOverlay: true,

    // Performans
    renderOnAddRemove: true,
    skipTargetFind: false,

    // Preserve object stacking
    preserveObjectStacking: true,

    // Stop context menu
    stopContextMenu: true,

    // Fire events for right click
    fireRightClick: true,
    fireMiddleClick: true
};

/**
 * Zoom limitleri
 */
const ZOOM_LIMITS = {
    min: 0.1,
    max: 5,
    step: 0.1
};

/**
 * CanvasManager Sınıfı
 */
export class CanvasManager {
    /**
     * @param {Object} options - Canvas ayarları
     * @param {string} [options.containerId] - Canvas container element ID
     * @param {string} [options.canvasId] - Canvas element ID (containerId yerine kullanılabilir)
     * @param {number} [options.width=800] - Canvas genişliği
     * @param {number} [options.height=600] - Canvas yüksekliği
     * @param {string} [options.backgroundColor='#ffffff'] - Arka plan rengi
     * @param {boolean} [options.staticMode=false] - Static canvas modu
     */
    constructor(options = {}) {
        /**
         * Canvas container ID (containerId veya canvasId kullanılabilir)
         * @type {string}
         */
        this.containerId = options.containerId || options.canvasId;

        /**
         * Canvas genişliği
         * @type {number}
         */
        this.width = options.width || DEFAULT_CANVAS_OPTIONS.width;

        /**
         * Canvas yüksekliği
         * @type {number}
         */
        this.height = options.height || DEFAULT_CANVAS_OPTIONS.height;

        /**
         * Canvas ayarları
         * @type {Object}
         */
        this.options = { ...DEFAULT_CANVAS_OPTIONS, ...options };

        /**
         * Static mode flag
         * @type {boolean}
         */
        this.staticMode = options.staticMode || false;

        /**
         * Fabric.js Canvas instance
         * @type {Object|null}
         */
        this.canvas = null;

        /**
         * Mevcut zoom seviyesi
         * @type {number}
         */
        this.currentZoom = 1;

        /**
         * Pan modu aktif mi
         * @type {boolean}
         */
        this.isPanning = false;

        /**
         * Pan başlangıç noktası
         * @type {{x: number, y: number}|null}
         */
        this.panStart = null;

        /**
         * Son viewport transform (pan için)
         * @type {number[]|null}
         */
        this.lastViewportTransform = null;

        /**
         * Event handler referansları (cleanup için)
         * @type {Object}
         */
        this._eventHandlers = {};

        /**
         * Initialized flag
         * @type {boolean}
         */
        this._initialized = false;

    }

    /**
     * Canvas'ı başlat (init() alias'ı)
     * @returns {Promise<Object>} Fabric.js Canvas instance
     */
    async init() {
        return this.initialize();
    }

    /**
     * Canvas'ı başlat
     * @returns {Promise<Object>} Fabric.js Canvas instance
     */
    async initialize() {
        // Fabric.js yüklenene kadar bekle
        await waitForFabric();

        let canvasElementId;

        // Mevcut canvas element'i kontrol et (containerId doğrudan canvas ID olabilir)
        const existingCanvas = document.getElementById(this.containerId);
        if (existingCanvas && existingCanvas.tagName.toLowerCase() === 'canvas') {
            // containerId zaten bir canvas element'e işaret ediyor
            canvasElementId = this.containerId;
            existingCanvas.width = this.width;
            existingCanvas.height = this.height;
        } else if (existingCanvas) {
            // Container element'in içine canvas oluştur
            const canvasElement = document.createElement('canvas');
            canvasElement.id = `${this.containerId}-canvas`;
            canvasElement.width = this.width;
            canvasElement.height = this.height;
            existingCanvas.appendChild(canvasElement);
            canvasElementId = canvasElement.id;
        } else {
            throw new Error(`CanvasManager: Element bulunamadı: #${this.containerId}`);
        }

        // Fabric.js Canvas oluştur
        const CanvasClass = this.staticMode ? StaticCanvas : Canvas;

        this.canvas = new CanvasClass(canvasElementId, {
            width: this.width,
            height: this.height,
            backgroundColor: this.options.backgroundColor,
            enableRetinaScaling: false,
            selection: this.options.selection,
            selectionColor: this.options.selectionColor,
            selectionBorderColor: this.options.selectionBorderColor,
            selectionLineWidth: this.options.selectionLineWidth,
            controlsAboveOverlay: this.options.controlsAboveOverlay,
            renderOnAddRemove: this.options.renderOnAddRemove,
            skipTargetFind: this.options.skipTargetFind,
            preserveObjectStacking: this.options.preserveObjectStacking,
            stopContextMenu: this.options.stopContextMenu,
            fireRightClick: this.options.fireRightClick,
            fireMiddleClick: this.options.fireMiddleClick
        });

        // Event binding
        this._bindCanvasEvents();

        // Keyboard shortcuts
        this._bindKeyboardEvents();

        // Mouse wheel zoom
        this._bindMouseWheelZoom();

        this._initialized = true;

        // Canvas hazır event'i
        eventBus.emit(EVENTS.CANVAS_READY, { canvas: this.canvas });

        return this.canvas;
    }

    /**
     * Canvas event'lerini bağla
     * @private
     */
    _bindCanvasEvents() {
        if (!this.canvas) return;

        // Selection events
        this._eventHandlers.selectionCreated = (e) => {
            eventBus.emit(EVENTS.SELECTION_CREATED, {
                selected: e.selected,
                target: e.target
            });
        };
        this.canvas.on('selection:created', this._eventHandlers.selectionCreated);

        this._eventHandlers.selectionUpdated = (e) => {
            eventBus.emit(EVENTS.SELECTION_UPDATED, {
                selected: e.selected,
                deselected: e.deselected,
                target: e.target
            });
        };
        this.canvas.on('selection:updated', this._eventHandlers.selectionUpdated);

        this._eventHandlers.selectionCleared = (e) => {
            eventBus.emit(EVENTS.SELECTION_CLEARED, {
                deselected: e.deselected
            });
        };
        this.canvas.on('selection:cleared', this._eventHandlers.selectionCleared);

        // Object events
        this._eventHandlers.objectModified = (e) => {
            // Transient nesneleri atla
            if (isTransient(e.target)) return;

            // Metin nesneleri için scale → width/height normalizasyonu
            // Orantısız scale edildiğinde (sadece genişlik çekildiğinde) scaleX → width dönüşümü yapar
            // Böylece metin görsel olarak düzgün görünür ve render'da doğru genişlik kullanılır
            if (e.action === 'scale' || e.action === 'scaleX' || e.action === 'scaleY') {
                this._normalizeTextScale(e.target);
            }

            eventBus.emit(EVENTS.OBJECT_MODIFIED, {
                target: e.target,
                action: e.action
            });
            eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'object:modified' });
        };
        this.canvas.on('object:modified', this._eventHandlers.objectModified);

        this._eventHandlers.objectMoving = (e) => {
            const obj = e.target;
            if (obj) {
                // Canvas sınırlarını al
                const canvasWidth = this.canvas.width;
                const canvasHeight = this.canvas.height;

                // Nesnenin bounding box'ını al
                const boundingRect = obj.getBoundingRect(true, true);
                const objWidth = boundingRect.width;
                const objHeight = boundingRect.height;

                // Sol sınır kontrolü
                if (boundingRect.left < 0) {
                    obj.left = obj.left - boundingRect.left;
                }
                // Sağ sınır kontrolü
                if (boundingRect.left + objWidth > canvasWidth) {
                    obj.left = obj.left - (boundingRect.left + objWidth - canvasWidth);
                }
                // Üst sınır kontrolü
                if (boundingRect.top < 0) {
                    obj.top = obj.top - boundingRect.top;
                }
                // Alt sınır kontrolü
                if (boundingRect.top + objHeight > canvasHeight) {
                    obj.top = obj.top - (boundingRect.top + objHeight - canvasHeight);
                }

                obj.setCoords();
            }

            eventBus.emit(EVENTS.OBJECT_MOVING, {
                target: e.target,
                // v7 pointer
                scenePoint: e.scenePoint,
                viewportPoint: e.viewportPoint
            });
        };
        this.canvas.on('object:moving', this._eventHandlers.objectMoving);

        this._eventHandlers.objectScaling = (e) => {
            const obj = e.target;
            if (obj) {
                // Metin nesneleri için anlık scale → width normalizasyonu
                // Böylece sürüklerken metin stretch olmaz
                const type = (obj.type || '').toLowerCase();
                if (['text', 'i-text', 'itext', 'textbox'].includes(type)) {
                    this._normalizeTextScaleLive(obj);
                }

                // Canvas sınırlarını al
                const canvasWidth = this.canvas.width;
                const canvasHeight = this.canvas.height;

                // Nesnenin bounding box'ını al
                const boundingRect = obj.getBoundingRect(true, true);
                const objWidth = boundingRect.width;
                const objHeight = boundingRect.height;

                // Ölçekleme sonrası nesne canvas dışına çıkıyorsa sınırla
                let needsAdjustment = false;

                // Sol sınır kontrolü
                if (boundingRect.left < 0) {
                    obj.left = obj.left - boundingRect.left;
                    needsAdjustment = true;
                }
                // Sağ sınır kontrolü
                if (boundingRect.left + objWidth > canvasWidth) {
                    // Sağdan taşıyorsa, ya pozisyonu düzelt ya da ölçeği sınırla
                    const overflow = boundingRect.left + objWidth - canvasWidth;
                    if (obj.left > 0) {
                        obj.left = Math.max(0, obj.left - overflow);
                    }
                    needsAdjustment = true;
                }
                // Üst sınır kontrolü
                if (boundingRect.top < 0) {
                    obj.top = obj.top - boundingRect.top;
                    needsAdjustment = true;
                }
                // Alt sınır kontrolü
                if (boundingRect.top + objHeight > canvasHeight) {
                    const overflow = boundingRect.top + objHeight - canvasHeight;
                    if (obj.top > 0) {
                        obj.top = Math.max(0, obj.top - overflow);
                    }
                    needsAdjustment = true;
                }

                if (needsAdjustment) {
                    obj.setCoords();
                }
            }

            eventBus.emit(EVENTS.OBJECT_SCALING, {
                target: e.target,
                scenePoint: e.scenePoint,
                viewportPoint: e.viewportPoint
            });
        };
        this.canvas.on('object:scaling', this._eventHandlers.objectScaling);

        this._eventHandlers.objectRotating = (e) => {
            eventBus.emit(EVENTS.OBJECT_ROTATING, {
                target: e.target,
                scenePoint: e.scenePoint,
                viewportPoint: e.viewportPoint
            });
        };
        this.canvas.on('object:rotating', this._eventHandlers.objectRotating);

        this._eventHandlers.objectAdded = (e) => {
            if (isTransient(e.target)) return;
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: e.target });
        };
        this.canvas.on('object:added', this._eventHandlers.objectAdded);

        this._eventHandlers.objectRemoved = (e) => {
            if (isTransient(e.target)) return;
            eventBus.emit(EVENTS.OBJECT_REMOVED, { object: e.target });
            eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'object:removed' });
        };
        this.canvas.on('object:removed', this._eventHandlers.objectRemoved);

        // Mouse events (pan için)
        this._eventHandlers.mouseDown = (e) => {
            if (this.isPanning && e.e.button === 0) {
                // v7: scenePoint ve viewportPoint kullanımı
                const pointer = e.scenePoint || this.canvas.getScenePoint(e.e);
                this.panStart = { x: pointer.x, y: pointer.y };
                this.lastViewportTransform = [...this.canvas.viewportTransform];
                this.canvas.selection = false;
                this.canvas.defaultCursor = 'grabbing';
                this.canvas.setCursor('grabbing');
            }
        };
        this.canvas.on('mouse:down', this._eventHandlers.mouseDown);

        this._eventHandlers.mouseMove = (e) => {
            if (this.isPanning && this.panStart && this.lastViewportTransform) {
                const pointer = e.scenePoint || this.canvas.getScenePoint(e.e);
                const dx = pointer.x - this.panStart.x;
                const dy = pointer.y - this.panStart.y;

                const vpt = [...this.lastViewportTransform];
                vpt[4] += dx * this.currentZoom;
                vpt[5] += dy * this.currentZoom;

                this.canvas.setViewportTransform(vpt);
                this.canvas.requestRenderAll();
            }
        };
        this.canvas.on('mouse:move', this._eventHandlers.mouseMove);

        this._eventHandlers.mouseUp = (e) => {
            if (this.isPanning) {
                this.panStart = null;
                this.lastViewportTransform = null;
                this.canvas.defaultCursor = 'grab';
                this.canvas.setCursor('grab');
            }
        };
        this.canvas.on('mouse:up', this._eventHandlers.mouseUp);

        // Double-click event - obje düzenleme modalı açmak için
        this._eventHandlers.mouseDblclick = (e) => {
            if (e.target) {
                eventBus.emit(EVENTS.OBJECT_DBLCLICK, {
                    target: e.target,
                    pointer: e.scenePoint || e.pointer,
                    e: e.e
                });
            }
        };
        this.canvas.on('mouse:dblclick', this._eventHandlers.mouseDblclick);
    }

    /**
     * Keyboard event'lerini bağla
     * @private
     */
    _bindKeyboardEvents() {
        this._eventHandlers.keydown = (e) => {
            // Space: Pan modu toggle
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                this.enablePan();
            }

            // Delete/Backspace: Seçili nesneyi sil
            if ((e.code === 'Delete' || e.code === 'Backspace') && !this._isInputFocused()) {
                e.preventDefault();
                this.deleteSelected();
            }

            // Ctrl+A: Tümünü seç
            if (e.ctrlKey && e.code === 'KeyA' && !this._isInputFocused()) {
                e.preventDefault();
                this.selectAll();
            }

            // Ctrl+D: Seçimi kaldır
            if (e.ctrlKey && e.code === 'KeyD' && !this._isInputFocused()) {
                e.preventDefault();
                this.deselectAll();
            }

            // Ctrl+0: Zoom reset
            if (e.ctrlKey && e.code === 'Digit0') {
                e.preventDefault();
                this.zoomReset();
            }

            // Ctrl++: Zoom in
            if (e.ctrlKey && (e.code === 'Equal' || e.code === 'NumpadAdd')) {
                e.preventDefault();
                this.zoomIn();
            }

            // Ctrl+-: Zoom out
            if (e.ctrlKey && (e.code === 'Minus' || e.code === 'NumpadSubtract')) {
                e.preventDefault();
                this.zoomOut();
            }
        };

        this._eventHandlers.keyup = (e) => {
            // Space: Pan modu kapat
            if (e.code === 'Space') {
                this.disablePan();
            }
        };

        document.addEventListener('keydown', this._eventHandlers.keydown);
        document.addEventListener('keyup', this._eventHandlers.keyup);
    }

    /**
     * Mouse wheel zoom bağla
     * @private
     */
    _bindMouseWheelZoom() {
        if (!this.canvas) return;

        this._eventHandlers.mouseWheel = (opt) => {
            // Ctrl tuşu ile zoom
            if (opt.e.ctrlKey) {
                opt.e.preventDefault();
                opt.e.stopPropagation();

                const delta = opt.e.deltaY;
                let zoom = this.currentZoom;

                if (delta < 0) {
                    zoom = Math.min(zoom + ZOOM_LIMITS.step, ZOOM_LIMITS.max);
                } else {
                    zoom = Math.max(zoom - ZOOM_LIMITS.step, ZOOM_LIMITS.min);
                }

                // Zoom noktası (fare konumu)
                const pointer = opt.viewportPoint || this.canvas.getViewportPoint(opt.e);
                this.zoomToPoint(zoom, pointer);
            }
        };

        this.canvas.on('mouse:wheel', this._eventHandlers.mouseWheel);
    }

    /**
     * Input alanı focus durumunu kontrol et
     * @private
     * @returns {boolean}
     */
    _isInputFocused() {
        const activeEl = document.activeElement;
        return activeEl && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable
        );
    }

    // ==========================================
    // ZOOM İŞLEMLERİ
    // ==========================================

    /**
     * Zoom in
     * @param {number} [step=ZOOM_LIMITS.step] - Zoom artış miktarı
     */
    zoomIn(step = ZOOM_LIMITS.step) {
        const newZoom = Math.min(this.currentZoom + step, ZOOM_LIMITS.max);
        this.setZoom(newZoom);
    }

    /**
     * Zoom out
     * @param {number} [step=ZOOM_LIMITS.step] - Zoom azalış miktarı
     */
    zoomOut(step = ZOOM_LIMITS.step) {
        const newZoom = Math.max(this.currentZoom - step, ZOOM_LIMITS.min);
        this.setZoom(newZoom);
    }

    /**
     * Zoom seviyesi ayarla
     * @param {number} zoom - Yeni zoom seviyesi
     */
    setZoom(zoom) {
        if (!this.canvas) return;

        const clampedZoom = Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, zoom));

        // Canvas merkezine zoom
        const center = this.canvas.getCenterPoint();
        this.canvas.zoomToPoint(center, clampedZoom);

        this.currentZoom = clampedZoom;
        this.canvas.requestRenderAll();

        eventBus.emit(EVENTS.ZOOM_CHANGED, { zoom: this.currentZoom });
    }

    /**
     * Belirli noktaya zoom
     * @param {number} zoom - Zoom seviyesi
     * @param {{x: number, y: number}} point - Zoom noktası
     */
    zoomToPoint(zoom, point) {
        if (!this.canvas) return;

        const clampedZoom = Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, zoom));
        this.canvas.zoomToPoint(point, clampedZoom);

        this.currentZoom = clampedZoom;
        this.canvas.requestRenderAll();

        eventBus.emit(EVENTS.ZOOM_CHANGED, { zoom: this.currentZoom });
    }

    /**
     * Zoom'u sıfırla (1:1)
     */
    zoomReset() {
        if (!this.canvas) return;

        this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        this.currentZoom = 1;
        this.canvas.requestRenderAll();

        eventBus.emit(EVENTS.ZOOM_CHANGED, { zoom: 1 });
    }

    /**
     * Canvas'ı viewport'a sığdır
     */
    zoomToFit() {
        if (!this.canvas) return;

        const objects = this.canvas.getObjects().filter(obj => !isTransient(obj));
        if (objects.length === 0) {
            this.zoomReset();
            return;
        }

        // Tüm nesneleri kapsayan bounding box
        const bounds = this._getObjectsBounds(objects);
        if (!bounds) {
            this.zoomReset();
            return;
        }

        const padding = 50;
        const scaleX = (this.canvas.width - padding * 2) / bounds.width;
        const scaleY = (this.canvas.height - padding * 2) / bounds.height;
        const zoom = Math.min(scaleX, scaleY, 1);

        this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;

        this.canvas.zoomToPoint({ x: centerX, y: centerY }, zoom);

        // Canvas'ı ortala
        const vpt = this.canvas.viewportTransform;
        vpt[4] = (this.canvas.width / 2) - centerX * zoom;
        vpt[5] = (this.canvas.height / 2) - centerY * zoom;
        this.canvas.setViewportTransform(vpt);

        this.currentZoom = zoom;
        this.canvas.requestRenderAll();

        eventBus.emit(EVENTS.ZOOM_CHANGED, { zoom });
    }

    /**
     * Nesnelerin toplam bounds'unu hesapla
     * @private
     * @param {Object[]} objects - Fabric.js nesneleri
     * @returns {{left: number, top: number, width: number, height: number}|null}
     */
    _getObjectsBounds(objects) {
        if (!objects || objects.length === 0) return null;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        objects.forEach(obj => {
            const bounds = obj.getBoundingRect();
            minX = Math.min(minX, bounds.left);
            minY = Math.min(minY, bounds.top);
            maxX = Math.max(maxX, bounds.left + bounds.width);
            maxY = Math.max(maxY, bounds.top + bounds.height);
        });

        return {
            left: minX,
            top: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Mevcut zoom seviyesini al
     * @returns {number}
     */
    getZoom() {
        return this.currentZoom;
    }

    // ==========================================
    // PAN İŞLEMLERİ
    // ==========================================


    /**
     * Pan modunu aktifleştir
     */
    enablePan() {
        this.isPanning = true;
        if (this.canvas) {
            this.canvas.selection = false;
            this.canvas.defaultCursor = 'grab';
            this.canvas.setCursor('grab');
            this.canvas.forEachObject(obj => {
                obj.set('selectable', false);
            });
        }
        eventBus.emit(EVENTS.PAN_CHANGED, { enabled: true });
    }

    /**
     * Pan modunu deaktifleştir
     */
    disablePan() {
        this.isPanning = false;
        this.panStart = null;
        this.lastViewportTransform = null;

        if (this.canvas) {
            this.canvas.selection = true;
            this.canvas.defaultCursor = 'default';
            this.canvas.setCursor('default');

            this.canvas.forEachObject(obj => {
                // Locked olmayan nesneleri seçilebilir yap
                if (!obj.get(CUSTOM_PROPS.LOCKED)) {
                    obj.set('selectable', true);
                }
            });

            this.canvas.requestRenderAll();
        }
        eventBus.emit(EVENTS.PAN_CHANGED, { enabled: false });
    }

    /**
     * Pan durumunu al
     * @returns {boolean}
     */
    isPanEnabled() {
        return this.isPanning;
    }

    // ==========================================
    // SEÇİM İŞLEMLERİ
    // ==========================================

    /**
     * Tüm nesneleri seç
     */
    selectAll() {
        if (!this.canvas) return;

        const objects = this.canvas.getObjects().filter(obj =>
            !isTransient(obj) && obj.selectable !== false
        );

        if (objects.length === 0) return;

        this.canvas.discardActiveObject();
        const selection = new fabric.ActiveSelection(objects, { canvas: this.canvas });
        this.canvas.setActiveObject(selection);
        this.canvas.requestRenderAll();
    }

    /**
     * Seçimi kaldır
     */
    deselectAll() {
        if (!this.canvas) return;
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
    }

    /**
     * Seçili nesneleri al
     * @returns {Object[]}
     */
    getSelectedObjects() {
        if (!this.canvas) return [];

        const activeObject = this.canvas.getActiveObject();
        if (!activeObject) return [];

        if (activeObject.type === 'activeSelection' || activeObject.type === 'ActiveSelection') {
            return activeObject.getObjects();
        }

        return [activeObject];
    }

    /**
     * Seçili nesneleri sil
     */
    deleteSelected() {
        if (!this.canvas) return;

        const activeObject = this.canvas.getActiveObject();
        if (!activeObject) return;

        if (activeObject.type === 'activeSelection' || activeObject.type === 'ActiveSelection') {
            activeObject.forEachObject(obj => {
                this.canvas.remove(obj);
            });
            this.canvas.discardActiveObject();
        } else {
            this.canvas.remove(activeObject);
        }

        this.canvas.requestRenderAll();
        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'delete' });
    }

    // ==========================================
    // CANVAS BOYUTLANDIRMA
    // ==========================================

    /**
     * Canvas boyutunu değiştir
     * @param {number} width - Yeni genişlik
     * @param {number} height - Yeni yükseklik
     */
    setSize(width, height) {
        if (!this.canvas) return;

        this.width = width;
        this.height = height;

        this.canvas.setDimensions({ width, height });
        this.canvas.requestRenderAll();

        eventBus.emit(EVENTS.CANVAS_RESIZED, { width, height });
    }

    /**
     * Canvas boyutunu değiştir (setSize alias'ı)
     * @param {number} width - Yeni genişlik
     * @param {number} height - Yeni yükseklik
     */
    setDimensions(width, height) {
        return this.setSize(width, height);
    }

    /**
     * Canvas boyutlarını al
     * @returns {{width: number, height: number}}
     */
    getSize() {
        return { width: this.width, height: this.height };
    }

    /**
     * Arka plan rengini değiştir
     * @param {string} color - CSS renk değeri
     */
    setBackgroundColor(color) {
        if (!this.canvas) return;
        this.canvas.backgroundColor = color;
        this.canvas.requestRenderAll();
        eventBus.emit(EVENTS.BACKGROUND_CHANGED, { color });
    }

    /**
     * Arka plan görselini ayarla
     * @param {string} url - Görsel URL'si
     * @param {Object} [options={}] - Görsel özellikleri
     * @returns {Promise<void>}
     */
    async setBackgroundImage(url, options = {}) {
        if (!this.canvas) return;

        return new Promise((resolve, reject) => {
            this.canvas.setBackgroundImage(url, () => {
                this.canvas.requestRenderAll();
                eventBus.emit(EVENTS.BACKGROUND_CHANGED, { image: url });
                resolve();
            }, options);
        });
    }

    // ==========================================
    // EXPORT İŞLEMLERİ
    // ==========================================

    /**
     * Canvas'ı data URL olarak export et
     * V7 için: Grid, overlay ve geçici nesneleri gizleyip, render tamamlandıktan sonra export yap
     * @param {Object} [options={}] - Export seçenekleri
     * @returns {string} Data URL
     */
    toDataURL(options = {}) {
        if (!this.canvas) {
            console.warn('[CanvasManager] toDataURL: Canvas yok');
            return '';
        }

        const defaultOptions = {
            format: 'png',
            quality: 1,
            multiplier: 1,
            enableRetinaScaling: false
        };

        const finalOptions = { ...defaultOptions, ...options };
        // V7'de format 'jpeg' olmalı, 'jpg' değil
        if (finalOptions.format === 'jpg') {
            finalOptions.format = 'jpeg';
        }

        // 1. Mevcut viewport transform'u sakla
        const originalViewport = this.canvas.viewportTransform ? [...this.canvas.viewportTransform] : [1, 0, 0, 1, 0, 0];

        // 2. Grid çizgilerini ve overlay'ları geçici olarak gizle
        const hiddenObjects = [];
        const allObjects = this.canvas.getObjects();

        allObjects.forEach(obj => {
            // Grid çizgilerini, overlay'ları ve region indicator'ları gizle
            const customType = obj.customType || obj.get?.('customType');
            const shouldHide =
                obj.isGridLine ||
                obj.isGridBackground ||
                obj.isRegionOverlay ||
                obj.isRegionIndicator ||
                obj.isSmartGuide ||
                obj.excludeFromExport ||
                customType === 'grid-line' ||
                customType === 'region-overlay' ||
                customType === 'smart-guide' ||
                obj.name === 'grid' ||
                obj.name === 'gridLine' ||
                obj.name === 'regionOverlay';

            if (shouldHide && obj.visible !== false) {
                hiddenObjects.push({ obj, wasVisible: obj.visible });
                obj.visible = false;
            }
        });

        // 3. Viewport'u sıfırla (zoom/pan etkisini kaldır) - V7 uyumlu
        if (this.canvas.setViewportTransform) {
            this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        } else {
            this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
        }

        // 4. Canvas'ı senkron olarak render et - V7 için calcOffset çağır
        this.canvas.calcOffset && this.canvas.calcOffset();
        this.canvas.renderAll();

        // 5. Export yap - V7 uyumlu
        let dataURL = '';
        try {
            dataURL = this.canvas.toDataURL(finalOptions);

            // Debug: Export sonucu kontrol et
            if (!dataURL || dataURL === 'data:,' || dataURL.length < 100) {
                // Alternatif: lowerCanvasEl üzerinden dene (V7 için)
                const lowerCanvas = this.canvas.lowerCanvasEl || this.canvas.getElement?.();
                if (lowerCanvas && lowerCanvas.toDataURL) {
                    dataURL = lowerCanvas.toDataURL(`image/${finalOptions.format}`, finalOptions.quality);
                }
            }
        } catch (error) {
            console.error('[CanvasManager] toDataURL hatası:', error);

            // Hata durumunda lowerCanvasEl dene
            try {
                const lowerCanvas = this.canvas.lowerCanvasEl || this.canvas.getElement?.();
                if (lowerCanvas && lowerCanvas.toDataURL) {
                    dataURL = lowerCanvas.toDataURL(`image/${finalOptions.format}`, finalOptions.quality);
                }
            } catch (fallbackError) {
                // Fallback da başarısız
            }
        }

        // 6. Gizlenen nesneleri tekrar göster
        hiddenObjects.forEach(({ obj, wasVisible }) => {
            obj.visible = wasVisible !== false;
        });

        // 7. Viewport'u geri yükle - V7 uyumlu
        if (this.canvas.setViewportTransform) {
            this.canvas.setViewportTransform(originalViewport);
        } else {
            this.canvas.viewportTransform = originalViewport;
        }

        // 8. Canvas'ı tekrar render et (orijinal duruma döndür)
        this.canvas.renderAll();

        return dataURL;
    }

    /**
     * Metin nesneleri için scale → width/fontSize normalizasyonu
     *
     * Fabric.js'de bir textbox orantısız scale edildiğinde (örn. sadece sağa çekildiğinde):
     * - scaleX artıyor ama scaleY aynı kalıyor → metin yatay gerilmiş görünüyor
     * - Bu metod scaleX'i width'e, scaleY'yi fontSize'a dönüştürür
     * - Sonuç: Metin düzgün orantılı görünür, render'da doğru boyutlar kullanılır
     *
     * @param {fabric.Object} obj - Scale edilmiş nesne
     * @private
     */
    _normalizeTextScale(obj) {
        if (!obj) return;

        const type = (obj.type || '').toLowerCase();
        const isText = ['text', 'i-text', 'itext', 'textbox'].includes(type);
        if (!isText) return;

        const scaleX = obj.scaleX || 1;
        const scaleY = obj.scaleY || 1;

        // Eğer her iki scale de 1 ise normalizasyona gerek yok
        if (Math.abs(scaleX - 1) < 0.001 && Math.abs(scaleY - 1) < 0.001) return;

        // scaleX → width dönüşümü, scaleY → 1'e sıfırla
        // Font boyutu değişmez — kullanıcı elle ayarlar
        const newWidth = obj.width * scaleX;

        obj.set({
            width: newWidth,
            scaleX: 1,
            scaleY: 1
        });

        // Fabric.js v7 text cache ve koordinatları güncelle
        if (obj.initDimensions) obj.initDimensions();
        obj.setCoords();

        if (this.canvas) {
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Metin nesneleri için canlı (sürükleme sırasında) scale normalizasyonu
     *
     * object:scaling event'inde çağrılır. scaleX'i width'e dönüştürür,
     * scaleY'yi 1'e sabitler. Böylece metin sürükleme sırasında stretch olmaz.
     * Font boyutu değişmez — sadece kutu genişliği değişir.
     *
     * @param {fabric.Object} obj - Scale edilen metin nesnesi
     * @private
     */
    _normalizeTextScaleLive(obj) {
        if (!obj) return;

        const scaleX = obj.scaleX || 1;
        const scaleY = obj.scaleY || 1;

        // Değişiklik yoksa atla
        if (Math.abs(scaleX - 1) < 0.001 && Math.abs(scaleY - 1) < 0.001) return;

        // scaleX → width dönüşümü (metin yatay stretch olmaz)
        const newWidth = obj.width * scaleX;

        obj.set({
            width: newWidth,
            scaleX: 1,
            scaleY: 1
        });

        obj.setCoords();
    }

    /**
     * Canvas'ı JSON olarak export et
     * @param {string[]} [propertiesToInclude=[]] - Dahil edilecek ek özellikler
     * @returns {Object} JSON verisi
     */
    toJSON(propertiesToInclude = []) {
        if (!this.canvas) return {};

        // CUSTOM_PROPS değerlerini dahil et
        const customProps = Object.values(CUSTOM_PROPS);
        const allProps = [...new Set([...propertiesToInclude, ...customProps])];

        return this.canvas.toJSON(allProps);
    }

    /**
     * JSON'dan canvas'ı yükle
     * @param {Object} json - Canvas JSON verisi
     * @returns {Promise<void>}
     */
    async loadFromJSON(json) {
        if (!this.canvas) return;

        // Fabric.js 7: Promise tabanlı API
        return this.canvas.loadFromJSON(json).then(() => {
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.TEMPLATE_LOADED, { json });
        });
    }

    // ==========================================
    // TEMİZLİK
    // ==========================================

    /**
     * Canvas'ı temizle
     * @param {boolean} [keepBackground=false] - Arka planı koru
     */
    clear(keepBackground = false) {
        if (!this.canvas) return;

        if (keepBackground) {
            const bg = this.canvas.backgroundColor;
            const bgImage = this.canvas.backgroundImage;
            this.canvas.clear();
            this.canvas.backgroundColor = bg;
            this.canvas.backgroundImage = bgImage;
        } else {
            this.canvas.clear();
        }

        this.canvas.requestRenderAll();
        eventBus.emit(EVENTS.CANVAS_CLEARED, {});
    }

    /**
     * CanvasManager'ı dispose et
     */
    dispose() {
        // Event listener'ları kaldır
        if (this._eventHandlers.keydown) {
            document.removeEventListener('keydown', this._eventHandlers.keydown);
        }
        if (this._eventHandlers.keyup) {
            document.removeEventListener('keyup', this._eventHandlers.keyup);
        }

        // Canvas event'lerini kaldır
        if (this.canvas) {
            try {
                // Önce tüm event'leri kaldır
                this.canvas.off();

                // V7'de dispose güvenli mi kontrol et
                if (this.canvas.dispose && typeof this.canvas.dispose === 'function') {
                    // Canvas context'inin var olup olmadığını kontrol et
                    const ctx = this.canvas.getContext?.() || this.canvas.contextContainer;
                    if (ctx) {
                        this.canvas.dispose();
                    } else {
                        console.warn('[CanvasManager] Canvas context bulunamadı, dispose atlanıyor');
                    }
                }
            } catch (e) {
                console.warn('[CanvasManager] Canvas dispose hatası:', e.message);
            }
            this.canvas = null;
        }

        // Container'ı temizle
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = '';
        }

        this._eventHandlers = {};
        this._initialized = false;

        // EventBus'tan bu context'e ait tüm subscription'ları temizle
        eventBus.offAll(this);
    }

    /**
     * Canvas instance'ını al
     * @returns {Object|null} Fabric.js Canvas
     */
    getCanvas() {
        return this.canvas;
    }

    /**
     * Initialized durumunu al
     * @returns {boolean}
     */
    isInitialized() {
        return this._initialized;
    }
}

/**
 * Default export
 */
export default CanvasManager;
