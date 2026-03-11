/**
 * TemplateEditorV7 - Ana Editor Sınıfı
 *
 * Fabric.js v7.1.0 tabanlı modüler template editor.
 * Tüm modülleri (core, factory, managers, panels) bir araya getirir.
 *
 * KULLANIM:
 * ```javascript
 * import { TemplateEditorV7 } from './editor/TemplateEditorV7.js';
 *
 * const editor = new TemplateEditorV7({
 *     container: '#editor-container',
 *     canvasId: 'template-canvas',
 *     width: 800,
 *     height: 1280,
 *     i18n: (key) => translate(key),
 *     onSave: async (data) => { ... },
 *     onLoad: async () => { ... }
 * });
 *
 * await editor.init();
 * ```
 *
 * @version 7.0.0
 * @author Omnex Display Hub
 */

// Core modülleri
import { eventBus, EVENTS } from './core/EventBus.js';
import { CUSTOM_PROPS, CUSTOM_TYPES, DYNAMIC_FIELDS, SERIALIZABLE_PROPS } from './core/CustomProperties.js';
import { FrameService } from './services/FrameService.js';
import {
    Canvas,
    Rect,
    Circle,
    Triangle,
    FabricText,
    IText,
    Textbox,
    FabricImage,
    Group,
    Line,
    Polygon,
    Path,
    V7_ORIGIN,
    waitForFabric,
    isFabricLoaded
} from './core/FabricExports.js';
import LegacyAdapter, { loadCanvasWithAdapter, exportAsV5, detectVersion } from './core/LegacyAdapter.js';

// Factory modülleri
import { ObjectFactory } from './factory/ObjectFactory.js';
import { CanvasManager } from './factory/CanvasManager.js';

// Manager modülleri
import { SelectionManager } from './managers/SelectionManager.js';
import { HistoryManager } from './managers/HistoryManager.js';
import { ClipboardManager } from './managers/ClipboardManager.js';
import { GridManager } from './managers/GridManager.js';

// Panel modülleri
import { PropertyPanel } from './panels/PropertyPanel.js';
import { LayersPanel } from './panels/LayersPanel.js';
import { DynamicFieldsPanel } from './panels/DynamicFieldsPanel.js';

/**
 * Varsayılan ayarlar
 */
const DEFAULT_OPTIONS = {
    container: null,
    canvasId: 'template-canvas',
    width: 800,
    height: 1280,
    backgroundColor: '#ffffff',
    gridEnabled: true,          // Grid çizgileri varsayılan görünür
    gridSize: 20,
    snapEnabled: false,         // Grid snap kapalı
    smartGuidesEnabled: true,   // Hizalama çizgileri açık
    historyEnabled: true,
    maxHistorySize: 50,
    i18n: null,
    onSave: null,
    onLoad: null,
    onSelectionChange: null,
    onObjectModified: null,
    onCanvasReady: null
};

/**
 * TemplateEditorV7 Sınıfı
 */
export class TemplateEditorV7 {
    /**
     * @param {Object} options - Editor ayarları
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
         * Canvas Manager instance
         * @type {CanvasManager|null}
         */
        this.canvasManager = null;

        /**
         * Fabric.js Canvas referansı (shortcut)
         * @type {fabric.Canvas|null}
         */
        this.canvas = null;

        /**
         * Object Factory instance
         * @type {ObjectFactory|null}
         */
        this.objectFactory = null;

        /**
         * Selection Manager instance
         * @type {SelectionManager|null}
         */
        this.selectionManager = null;

        /**
         * History Manager instance
         * @type {HistoryManager|null}
         */
        this.historyManager = null;

        /**
         * Clipboard Manager instance
         * @type {ClipboardManager|null}
         */
        this.clipboardManager = null;

        /**
         * Grid Manager instance
         * @type {GridManager|null}
         */
        this.gridManager = null;

        /**
         * Property Panel instance
         * @type {PropertyPanel|null}
         */
        this.propertyPanel = null;

        /**
         * Layers Panel instance
         * @type {LayersPanel|null}
         */
        this.layersPanel = null;

        /**
         * Dynamic Fields Panel instance
         * @type {DynamicFieldsPanel|null}
         */
        this.dynamicFieldsPanel = null;

        /**
         * Legacy Adapter instance
         * @type {LegacyAdapter|null}
         */
        this.legacyAdapter = null;

        /**
         * i18n fonksiyonu
         * @type {Function|null}
         */
        this._i18n = this.options.i18n;

        /**
         * Initialized flag
         * @type {boolean}
         */
        this._initialized = false;

        /**
         * Current zoom level
         * @type {number}
         */
        this._zoom = 1;

        /**
         * Template metadata
         * @type {Object}
         */
        this._templateMeta = {
            id: null,
            name: '',
            description: '',
            type: 'label',
            width: this.options.width,
            height: this.options.height,
            createdAt: null,
            updatedAt: null
        };

        /**
         * Event subscriptions
         * @type {Array}
         */
        this._subscriptions = [];

        /**
         * ActiveSelection sürükleme sırasında frame senkron state
         * @type {{selection:Object,lastCenter:{x:number,y:number}}|null}
         */
        this._activeSelectionMoveState = null;

        /**
         * Save işlemi devam ediyor mu (tekrarlı Ctrl+S çağrılarını önler)
         * @type {boolean}
         */
        this._isSaving = false;
        this._lastObjectDblClickAt = 0;
        this._lastObjectDblClickTarget = null;
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    /**
     * Editor'ü başlat
     * @returns {Promise<void>}
     */
    async init() {
        if (this._initialized) {
            console.warn('TemplateEditorV7: Already initialized');
            return;
        }

        // Container'ı bul
        this._setupContainer();

        // Canvas Manager oluştur ve canvas'ı başlat
        await this._initCanvasManager();

        // ==================== FIX: Fabric.js v7 Custom Property Serialization ====================
        // Fabric.js v7'de canvas.toJSON(propertyList) custom property'leri serialize ETMİYOR.
        // Çözüm: FabricObject.prototype.toObject override edilerek SERIALIZABLE_PROPS her zaman dahil edilir.
        // Bu sayede canvas.toJSON() çağrıldığında tüm custom property'ler (customType, frameCols,
        // dynamicField, isDataField, vs.) otomatik olarak JSON çıktısına dahil olur.
        // NOT: Bu patch _initCanvasManager() SONRASI çağrılmalı çünkü CanvasManager waitForFabric() ile
        // Fabric.js'in yüklenmesini bekliyor. Patch öncesi Fabric.js yüklü olmalı.
        this._patchFabricSerialization();
        // ==========================================================================================

        // Object Factory oluştur
        this._initObjectFactory();

        // Managers'ları başlat
        this._initManagers();

        // Frame Service (9-slice frame overlay engine)
        this.frameService = new FrameService();

        // Panels'leri başlat
        this._initPanels();

        // Legacy Adapter oluştur
        this._initLegacyAdapter();

        // Event'leri dinle
        this._bindEvents();

        // Keyboard shortcuts
        this._bindKeyboardShortcuts();

        // İlk history kaydı
        if (this.options.historyEnabled && this.historyManager) {
            this.historyManager.saveState();
            this._updateUndoRedoButtons({
                canUndo: this.historyManager.canUndo(),
                canRedo: this.historyManager.canRedo()
            });
        }

        this._initialized = true;

        // Ready event
        eventBus.emit(EVENTS.CANVAS_READY, { editor: this });

        // Callback
        if (this.options.onCanvasReady) {
            this.options.onCanvasReady(this);
        }
    }

    /**
     * Fabric.js Object serialization patch
     * Fabric.js v7'de canvas.toJSON(additionalProperties) custom property'leri
     * serialize etmiyor. Bu metod FabricObject.prototype.toObject'i override ederek
     * SERIALIZABLE_PROPS listesindeki tüm custom property'leri her zaman dahil eder.
     * @private
     */
    _patchFabricSerialization() {
        const f = window.fabric;
        if (!f) {
            console.warn('[TemplateEditorV7] Fabric.js not loaded, skipping serialization patch');
            return;
        }

        // FabricObject base class'ı bul
        const FabricObj = f.FabricObject || f.Object;
        if (!FabricObj || !FabricObj.prototype) {
            console.warn('[TemplateEditorV7] FabricObject prototype not found');
            return;
        }

        // Zaten patch edilmiş mi kontrol et
        if (FabricObj.prototype.__omnexPatched) {
            return;
        }

        const originalToObject = FabricObj.prototype.toObject;
        const customPropKeys = [...SERIALIZABLE_PROPS];

        FabricObj.prototype.toObject = function(additionalProperties = []) {
            // Orijinal toObject'i çağır (Fabric.js'in kendi property'leri + additionalProperties)
            const obj = originalToObject.call(this, additionalProperties);

            // Custom property'leri ekle (undefined olmayanları)
            customPropKeys.forEach(key => {
                const val = this[key];
                if (val !== undefined && val !== null) {
                    obj[key] = val;
                }
            });

            // additionalProperties'i de ekle (varsa)
            if (additionalProperties && additionalProperties.length > 0) {
                additionalProperties.forEach(key => {
                    const val = this[key];
                    if (val !== undefined && val !== null) {
                        obj[key] = val;
                    }
                });
            }

            return obj;
        };

        FabricObj.prototype.__omnexPatched = true;
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

        if (!this.container) {
            console.warn('TemplateEditorV7: Container not found, using document.body');
            this.container = document.body;
        }
    }

    /**
     * Canvas Manager'ı başlat
     * @private
     */
    async _initCanvasManager() {
        this.canvasManager = new CanvasManager({
            canvasId: this.options.canvasId,
            width: this.options.width,
            height: this.options.height,
            backgroundColor: this.options.backgroundColor
        });

        await this.canvasManager.init();
        this.canvas = this.canvasManager.getCanvas();

        if (!this.canvas) {
            throw new Error('TemplateEditorV7: Failed to initialize canvas');
        }
    }

    /**
     * Object Factory'yi başlat
     * @private
     */
    _initObjectFactory() {
        this.objectFactory = new ObjectFactory({
            canvas: this.canvas,
            defaultStyles: {
                fill: '#333333',
                stroke: '#000000',
                strokeWidth: 0,
                fontSize: 24,
                fontFamily: 'Arial'
            }
        });
    }

    /**
     * Manager'ları başlat
     * @private
     */
    _initManagers() {
        // Selection Manager
        this.selectionManager = new SelectionManager({
            canvas: this.canvas
        });

        // History Manager
        if (this.options.historyEnabled) {
            this.historyManager = new HistoryManager({
                canvas: this.canvas,
                maxSize: this.options.maxHistorySize
            });
        }

        // Clipboard Manager
        this.clipboardManager = new ClipboardManager({
            canvas: this.canvas
        });

        // Grid Manager
        this.gridManager = new GridManager({
            canvas: this.canvas,
            canvasWidth: this.options.width,
            canvasHeight: this.options.height,
            gridSize: this.options.gridSize,
            showGrid: this.options.gridEnabled,
            snapEnabled: this.options.snapEnabled,
            smartGuidesEnabled: this.options.smartGuidesEnabled,
            onRegionSelect: (region) => this._onRegionSelect(region),
            onLayoutChange: (layoutId, layout) => this._onLayoutChange(layoutId, layout)
        });
    }

    /**
     * Panel'leri başlat
     * @private
     */
    _initPanels() {
        // i18n fonksiyonu - önce this._i18n, sonra window.__ fallback
        const i18nFn = this._i18n || ((key, params = {}) => {
            if (typeof window.__ === 'function') {
                return window.__(key, params);
            }
            return key;
        });

        // Property Panel - sağ panel container'ına mount edilecek
        // collapsible: false - EditorWrapper zaten chart-card-header sağlıyor
        const propertyContainer = this.container.querySelector('#property-panel-container');
        if (propertyContainer) {
            this.propertyPanel = new PropertyPanel({
                container: propertyContainer,
                canvas: this.canvas,
                i18n: i18nFn,
                collapsible: false
            });
            this.propertyPanel.editor = this;
            this.propertyPanel.setFrameService(this.frameService);
            this.propertyPanel.mount();
        }

        // Layers Panel
        const layersContainer = this.container.querySelector('#layers-panel-container');
        if (layersContainer) {
            this.layersPanel = new LayersPanel({
                container: layersContainer,
                canvas: this.canvas,
                selectionManager: this.selectionManager,
                i18n: i18nFn,
                collapsible: false
            });
            this.layersPanel.mount();
        }

        // Dynamic Fields Panel
        const dynamicFieldsContainer = this.container.querySelector('#dynamic-fields-panel-container');
        if (dynamicFieldsContainer) {
            this.dynamicFieldsPanel = new DynamicFieldsPanel({
                container: dynamicFieldsContainer,
                i18n: i18nFn,
                collapsible: false,
                onFieldSelect: (fieldKey, options) => {
                    this._addDynamicField(fieldKey, options);
                }
            });
            this.dynamicFieldsPanel.mount();
        }
    }

    /**
     * Floating Inspector Panel'e PropertyPanel ve LayersPanel bağla
     * Inspector DOM'daki container'lara ikincil panel instance'ları oluşturur.
     * @private
     */
    _initInspectorBinding() {
        if (!this._inspectorPanel || !this.canvas) return;

        const i18nFn = this._i18n || ((key, params = {}) => {
            if (typeof window.__ === 'function') {
                return window.__(key, params);
            }
            return key;
        });

        // Inspector Properties Panel
        const inspPropsContainer = this._inspectorPanel.querySelector('#inspector-properties-container');
        if (inspPropsContainer) {
            inspPropsContainer.innerHTML = '';
            this._inspectorPropertyPanel = new PropertyPanel({
                panelId: 'inspector-property-panel',
                container: inspPropsContainer,
                canvas: this.canvas,
                i18n: i18nFn,
                collapsible: false
            });
            this._inspectorPropertyPanel.editor = this;
            this._inspectorPropertyPanel.setFrameService(this.frameService);
            this._inspectorPropertyPanel.mount();
        }

        // Inspector Layers Panel
        const inspLayersContainer = this._inspectorPanel.querySelector('#inspector-layers-container');
        if (inspLayersContainer) {
            inspLayersContainer.innerHTML = '';
            this._inspectorLayersPanel = new LayersPanel({
                panelId: 'inspector-layers-panel',
                container: inspLayersContainer,
                canvas: this.canvas,
                selectionManager: this.selectionManager,
                i18n: i18nFn,
                collapsible: false
            });
            this._inspectorLayersPanel.mount();
        }
    }

    /**
     * Legacy Adapter'ı başlat
     * @private
     */
    _initLegacyAdapter() {
        // LegacyAdapter bir utility object, constructor değil
        this.legacyAdapter = LegacyAdapter;
    }

    /**
     * Event'leri dinle
     * @private
     */
    _bindEvents() {
        // Canvas event'leri - EventBus üzerinden
        const selectionCreatedSub = eventBus.on(EVENTS.SELECTION_CREATED, (data) => {
            if (this.options.onSelectionChange) {
                this.options.onSelectionChange(data.selected);
            }
        });
        this._subscriptions.push(selectionCreatedSub);

        const selectionClearedSub = eventBus.on(EVENTS.SELECTION_CLEARED, () => {
            this._activeSelectionMoveState = null;
            if (this.options.onSelectionChange) {
                this.options.onSelectionChange(null);
            }
        });
        this._subscriptions.push(selectionClearedSub);

        const objectModifiedSub = eventBus.on(EVENTS.OBJECT_MODIFIED, (data) => {
            this._activeSelectionMoveState = null;
            if (this.options.onObjectModified) {
                this.options.onObjectModified(data.target);
            }
            const syncTargets = this._collectFrameSyncTargets(data?.target);
            syncTargets.forEach((obj) => {
                this.frameService?.updateFrame(obj, this.canvas);
            });
        });
        this._subscriptions.push(objectModifiedSub);

        // Frame: sync position during move (lightweight, no re-render)
        const objectMovingSub = eventBus.on(EVENTS.OBJECT_MOVING, (data) => {
            if (this._isActiveSelection(data?.target)) {
                this._syncFramesByActiveSelectionDelta(data.target);
                return;
            }

            this._activeSelectionMoveState = null;
            const syncTargets = this._collectFrameSyncTargets(data?.target);
            syncTargets.forEach((obj) => this._syncFramePosition(obj));
        });
        this._subscriptions.push(objectMovingSub);

        // Frame: sync transform during scaling (live preview)
        const objectScalingSub = eventBus.on(EVENTS.OBJECT_SCALING, (data) => {
            this._activeSelectionMoveState = null;
            const syncTargets = this._collectFrameSyncTargets(data?.target);
            syncTargets.forEach((obj) => {
                this._syncFramePosition(obj);
                this.frameService?.updateFrame(obj, this.canvas);
            });
        });
        this._subscriptions.push(objectScalingSub);

        // Frame z-order sync: when layers are reordered, keep frames behind their targets
        const canvasModifiedSub = eventBus.on(EVENTS.CANVAS_MODIFIED, (data) => {
            const source = data?.source;
            if (
                source === 'layers-order' ||
                source === 'layers-reorder' ||
                source === 'align' ||
                source === 'distribute' ||
                source === 'group' ||
                source === 'ungroup' ||
                source === 'history-load'
            ) {
                this.frameService?.syncAllZOrders(this.canvas);
            }

            if (source === 'align' || source === 'distribute' || source === 'group' || source === 'ungroup') {
                this._syncFramesForActiveSelection();
            }

            if (source === 'history-load' && this.gridManager) {
                if (typeof this.gridManager.refreshGridVisibility === 'function') {
                    this.gridManager.refreshGridVisibility();
                } else if (this.gridManager.isGridVisible?.()) {
                    this.gridManager._removeGrid?.();
                    this.gridManager._createGrid?.();
                }
            }
        });
        this._subscriptions.push(canvasModifiedSub);

        // History change event
        const historyChangeSub = eventBus.on(EVENTS.HISTORY_CHANGE, (data) => {
            this._updateUndoRedoButtons(data);
        });
        this._subscriptions.push(historyChangeSub);

        // Double-click event - obje düzenleme modalı
        const dblclickSub = eventBus.on(EVENTS.OBJECT_DBLCLICK, (data) => {
            this._handleObjectDblClick(data.target);
        });
        this._subscriptions.push(dblclickSub);
    }

    /**
     * Klavye kısayollarını bağla
     * @private
     */
    _bindKeyboardShortcuts() {
        this._keydownHandler = (e) => {
            // Canvas fokuslandığında veya input/textarea'da değilse
            const target = e.target;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            if (isInput) return;

            // Ctrl/Cmd kombinasyonları
            const isCtrl = e.ctrlKey || e.metaKey;

            if (isCtrl) {
                switch (e.key.toLowerCase()) {
                    case 'a':
                        e.preventDefault();
                        this.selectAll();
                        break;

                    case 's':
                        e.preventDefault();
                        this.save();
                        break;

                    case 'g':
                        e.preventDefault();
                        this.toggleGrid();
                        break;
                }
            }

            // Tek tuş kısayolları
            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    if (!isInput) {
                        e.preventDefault();
                        this.deleteSelected();
                    }
                    break;

                case 'Escape':
                    this.clearSelection();
                    break;
            }
        };

        document.addEventListener('keydown', this._keydownHandler);
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

        // Panel'lere de aktar
        if (this.propertyPanel) this.propertyPanel.setI18n(i18nFn);
        if (this.layersPanel) this.layersPanel.setI18n(i18nFn);
        if (this.dynamicFieldsPanel) this.dynamicFieldsPanel.setI18n(i18nFn);
    }

    // ==========================================
    // OBJECT OPERATIONS
    // ==========================================

    /**
     * Metin ekle
     * @param {string} [text=''] - Metin içeriği
     * @param {Object} [options={}] - Ek seçenekler
     * @returns {Promise<fabric.IText>}
     */
    async addText(text = '', options = {}) {
        const obj = await this.objectFactory.createTextbox(text || this.__('editor.elements.newText'), {
            originX: 'left',
            originY: 'top',
            ...options
        });
        // ObjectFactory zaten canvas'a ekliyor
        if (obj && this.canvas) {
            this.canvas.setActiveObject(obj);
            this.canvas.requestRenderAll();
        }
        this._saveHistory();
        return obj;
    }

    /**
     * Shape Library'den şekil ekle (ShapePicker modal açar)
     */
    async addShape() {
        const { ShapePicker } = await import('./components/ShapePicker.js');
        const __ = (key) => {
            if (typeof window.__ === 'function') return window.__(key);
            return key;
        };
        ShapePicker.open({
            __,
            onSelect: async ({ shapeId, fill, stroke, strokeWidth, variant, radius }) => {
                const obj = await this.objectFactory.createShape(shapeId, {
                    fill, stroke, strokeWidth, variant, radius,
                    width: 150, height: 105
                });
                if (obj && this.canvas) {
                    this.canvas.setActiveObject(obj);
                    this.canvas.requestRenderAll();
                }
                this._saveHistory();
            }
        });
    }

    /**
     * Sync frame overlay position with target object (lightweight, during drag)
     * @private
     */
    _collectFrameSyncTargets(targetObj) {
        if (!targetObj || !this.frameService) return [];

        const type = String(targetObj.type || '').toLowerCase();
        if (type === 'activeselection') {
            const objects = typeof targetObj.getObjects === 'function' ? targetObj.getObjects() : [];
            return objects.filter(obj => this.frameService.hasFrame(obj));
        }

        if (this.frameService.hasFrame(targetObj)) {
            return [targetObj];
        }

        return [];
    }

    /**
     * ActiveSelection kontrolü
     * @private
     * @param {Object} obj
     * @returns {boolean}
     */
    _isActiveSelection(obj) {
        const type = String(obj?.type || '').toLowerCase();
        return type === 'activeselection';
    }

    /**
     * Grup sürükleme sırasında frame'leri selection delta kadar taşı.
     * @private
     * @param {Object} selectionObj
     */
    _syncFramesByActiveSelectionDelta(selectionObj) {
        if (!selectionObj || !this.canvas || !this.frameService) return;

        const center = selectionObj.getCenterPoint?.();
        if (!center) return;

        if (!this._activeSelectionMoveState || this._activeSelectionMoveState.selection !== selectionObj) {
            this._activeSelectionMoveState = {
                selection: selectionObj,
                lastCenter: { x: center.x, y: center.y }
            };
            return;
        }

        const last = this._activeSelectionMoveState.lastCenter;
        const dx = center.x - last.x;
        const dy = center.y - last.y;
        this._activeSelectionMoveState.lastCenter = { x: center.x, y: center.y };

        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return;

        const objects = typeof selectionObj.getObjects === 'function' ? selectionObj.getObjects() : [];
        objects.forEach((obj) => {
            const overlayId = obj?.[CUSTOM_PROPS.FRAME_OVERLAY_ID];
            if (!overlayId) return;

            const frameObj = this.canvas.getObjects().find(
                o => o?.[CUSTOM_PROPS.OBJECT_ID] === overlayId
            );
            if (!frameObj) return;

            frameObj.set({
                left: (Number(frameObj.left) || 0) + dx,
                top: (Number(frameObj.top) || 0) + dy
            });
            frameObj.setCoords();
        });
    }

    /**
     * Sync framed objects currently inside active selection.
     * @private
     */
    _syncFramesForActiveSelection() {
        if (!this.canvas || !this.frameService) return;

        const activeObj = this.canvas.getActiveObject();
        const targets = this._collectFrameSyncTargets(activeObj);
        if (!targets.length) return;

        targets.forEach((obj) => {
            this._syncFramePosition(obj);
            this.frameService.updateFrame(obj, this.canvas);
        });
    }

    /**
     * Sync frame overlay position with target object (lightweight, during drag)
     * @private
     */
    _syncFramePosition(targetObj) {
        if (!targetObj || !this.canvas) return;

        const overlayId = targetObj[CUSTOM_PROPS.FRAME_OVERLAY_ID];
        if (!overlayId) return;

        const frameObj = this.canvas.getObjects().find(
            o => o[CUSTOM_PROPS.OBJECT_ID] === overlayId
        );
        if (!frameObj) return;

        // Get blank offsets for positioning
        const frameId = targetObj[CUSTOM_PROPS.FRAME_ID];
        // Quick async-free positioning: just offset from stored blank values
        // frameBlank is embedded in the frameDef but we don't have it synchronously.
        // We'll use a simpler approach: compute offset from current positions difference
        // The original offset was set during applyFrame. On move, preserve that offset.
        const dL = frameObj._frameOffsetLeft ?? 0;
        const dT = frameObj._frameOffsetTop ?? 0;

        const center = typeof targetObj.getCenterPoint === 'function'
            ? targetObj.getCenterPoint()
            : { x: Number(targetObj.left) || 0, y: Number(targetObj.top) || 0 };

        frameObj.set({
            left: (Number(center?.x) || 0) + dL,
            top: (Number(center?.y) || 0) + dT
        });
        frameObj.setCoords();
    }

    /**
     * Dikdörtgen ekle
     * @param {Object} [options={}] - Ek seçenekler
     * @returns {Promise<fabric.Rect>}
     */
    async addRect(options = {}) {
        const obj = await this.objectFactory.createRect({
            width: 150,
            height: 100,
            ...options
        });
        // ObjectFactory zaten canvas'a ekliyor
        if (obj && this.canvas) {
            this.canvas.setActiveObject(obj);
            this.canvas.requestRenderAll();
        }
        this._saveHistory();
        return obj;
    }

    /**
     * Bağımsız kenarlık çerçevesi ekle
     * İç alan varsayılan olarak şeffaftır; denetçiden dolgu rengi verilebilir.
     * @param {Object} [options={}]
     * @returns {Promise<fabric.Rect>}
     */
    async addBorderFrame(options = {}) {
        const fallbackStrokeWidth = Number(options?.strokeWidth);
        const resolvedStrokeWidth = Number.isFinite(fallbackStrokeWidth) && fallbackStrokeWidth > 0
            ? fallbackStrokeWidth
            : 1;
        const obj = await this.objectFactory.createRect({
            width: 220,
            height: 140,
            fill: 'rgba(0,0,0,0)',
            stroke: '#111827',
            strokeWidth: resolvedStrokeWidth,
            rx: 0,
            ry: 0,
            [CUSTOM_PROPS.OBJECT_NAME]: this.__('editor.tools.borderFrame') || 'Çerçeve',
            ...options
        });

        if (obj && this.canvas) {
            this.canvas.setActiveObject(obj);
            this.canvas.requestRenderAll();
        }
        this._saveHistory();
        return obj;
    }

    /**
     * Daire ekle
     * @param {Object} [options={}] - Ek seçenekler
     * @returns {Promise<fabric.Circle>}
     */
    async addCircle(options = {}) {
        const obj = await this.objectFactory.createCircle({
            radius: 50,
            ...options
        });
        // ObjectFactory zaten canvas'a ekliyor
        if (obj && this.canvas) {
            this.canvas.setActiveObject(obj);
            this.canvas.requestRenderAll();
        }
        this._saveHistory();
        return obj;
    }

    /**
     * Çizgi ekle
     * @param {Object} [options={}] - Ek seçenekler
     * @returns {Promise<fabric.Line>}
     */
    async addLine(options = {}) {
        const { x1 = 50, y1 = 50, x2 = 200, y2 = 50, ...restOptions } = options;
        const points = [x1, y1, x2, y2];
        const obj = await this.objectFactory.createLine(points, restOptions);
        // ObjectFactory zaten canvas'a ekliyor
        if (obj && this.canvas) {
            this.canvas.setActiveObject(obj);
            this.canvas.requestRenderAll();
        }
        this._saveHistory();
        return obj;
    }

    /**
     * Preset tabanli dekoratif cizgi ekle (divider stili)
     * @param {Object} style
     * @returns {Promise<Object>}
     */
    async addLinePreset(style = {}) {
        const renderType = String(style.renderType || 'simple');
        if (renderType === 'simple') {
            return this.addLine({
                x1: 60,
                y1: 60,
                x2: 300,
                y2: 60,
                stroke: style.stroke || '#111827',
                strokeWidth: Number(style.strokeWidth || 4),
                strokeDashArray: style.strokeDashArray || null,
                strokeLineCap: style.strokeLineCap || 'round',
                strokeLineJoin: style.strokeLineJoin || 'round',
                fill: null
            });
        }

        const color = style.stroke || '#111827';
        const width = Math.max(1, Number(style.strokeWidth || 4));
        const pathByType = {
            wave: 'M 20 40 Q 40 16 60 40 T 100 40 T 140 40 T 180 40 T 220 40 T 260 40',
            pulseWave: 'M 20 40 Q 32 24 44 40 T 68 40 T 92 40 T 116 40 T 140 40 T 164 40 T 188 40 T 212 40 T 236 40 T 260 40',
            scallop: 'M 20 40 Q 30 24 40 40 Q 50 56 60 40 Q 70 24 80 40 Q 90 56 100 40 Q 110 24 120 40 Q 130 56 140 40 Q 150 24 160 40 Q 170 56 180 40 Q 190 24 200 40 Q 210 56 220 40 Q 230 24 240 40 Q 250 50 260 40',
            zigzag: 'M 20 40 L 36 24 L 52 40 L 68 24 L 84 40 L 100 24 L 116 40 L 132 24 L 148 40 L 164 24 L 180 40 L 196 24 L 212 40 L 228 24 L 244 40 L 260 24 L 276 40',
            chevron: 'M 20 40 L 34 28 L 48 40 L 62 28 L 76 40 L 90 28 L 104 40 L 118 28 L 132 40 L 146 28 L 160 40 L 174 28 L 188 40 L 202 28 L 216 40 L 230 28 L 244 40 L 260 28',
            step: 'M 20 46 L 44 46 L 44 30 L 68 30 L 68 46 L 92 46 L 92 30 L 116 30 L 116 46 L 140 46 L 140 30 L 164 30 L 164 46 L 188 46 L 188 30 L 212 30 L 212 46 L 236 46 L 236 30 L 260 30 L 260 46',
            notch: 'M 20 40 L 48 40 L 56 28 L 64 40 L 96 40 L 104 28 L 112 40 L 144 40 L 152 28 L 160 40 L 192 40 L 200 28 L 208 40 L 260 40',
            bracket: 'M 20 52 Q 20 36 34 36 L 246 36 Q 260 36 260 52 M 34 36 L 34 20 M 246 36 L 246 20',
            arc: 'M 20 42 Q 80 18 140 32 Q 200 46 260 22',
            chain: 'M 20 40 H 260 M 36 40 A 8 8 0 1 0 52 40 A 8 8 0 1 0 36 40 M 78 40 A 8 8 0 1 0 94 40 A 8 8 0 1 0 78 40 M 120 40 A 8 8 0 1 0 136 40 A 8 8 0 1 0 120 40 M 162 40 A 8 8 0 1 0 178 40 A 8 8 0 1 0 162 40 M 204 40 A 8 8 0 1 0 220 40 A 8 8 0 1 0 204 40',
            ribbon: 'M 20 40 L 36 28 L 52 40 L 68 52 L 84 40 L 100 28 L 116 40 L 132 52 L 148 40 L 164 28 L 180 40 L 196 52 L 212 40 L 228 28 L 244 40 L 260 52',
            stitch: 'M 20 40 H 260 M 28 32 L 36 48 M 52 32 L 60 48 M 76 32 L 84 48 M 100 32 L 108 48 M 124 32 L 132 48 M 148 32 L 156 48 M 172 32 L 180 48 M 196 32 L 204 48 M 220 32 L 228 48',
            skyline: 'M 20 44 L 36 44 L 36 28 L 48 28 L 48 38 L 62 38 L 62 22 L 76 22 L 76 40 L 90 40 L 90 18 L 106 18 L 106 34 L 122 34 L 122 26 L 136 26 L 136 42 L 152 42 L 152 20 L 170 20 L 170 38 L 188 38 L 188 30 L 202 30 L 202 44 L 260 44',
            ticket: 'M 20 40 H 260 M 36 40 A 2 2 0 1 0 40 40 A 2 2 0 1 0 36 40 M 76 40 A 2 2 0 1 0 80 40 A 2 2 0 1 0 76 40 M 116 40 A 2 2 0 1 0 120 40 A 2 2 0 1 0 116 40 M 156 40 A 2 2 0 1 0 160 40 A 2 2 0 1 0 156 40 M 196 40 A 2 2 0 1 0 200 40 A 2 2 0 1 0 196 40',
            hook: 'M 20 40 H 72 Q 86 40 86 54 Q 86 62 94 62 H 140 Q 154 62 154 48 Q 154 40 162 40 H 260',
            twinline: 'M 20 32 H 260 M 20 46 H 260'
        };

        const hashType = (type) => {
            const text = String(type || '');
            let h = 2166136261;
            for (let i = 0; i < text.length; i++) {
                h ^= text.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return h >>> 0;
        };

        const autoPathByType = (type) => {
            const t = String(type || '').toLowerCase();
            if (!t) return '';
            const h = hashType(t);
            const v = h % 5;

            if (t.includes('basic') || t.includes('minimal') || t.includes('hairline') || t.includes('solid')) {
                if (v === 0) return 'M 20 40 H 260';
                if (v === 1) return 'M 20 40 H 260 M 116 40 H 144';
                if (v === 2) return 'M 20 40 H 260 M 130 28 V 52';
                if (v === 3) return 'M 20 36 H 260 M 20 44 H 260';
                return 'M 20 40 H 260 M 100 40 L 108 34 L 116 40 L 108 46 Z M 144 40 L 152 34 L 160 40 L 152 46 Z';
            }

            if (t.includes('premium') || t.includes('luxury') || t.includes('gold') || t.includes('jewel') || t.includes('crest') || t.includes('medallion')) {
                if (v === 0) return 'M 20 40 H 96 M 164 40 H 260 M 118 40 L 130 24 L 142 40 L 130 56 Z';
                if (v === 1) return 'M 20 40 H 260 M 112 40 a 18 18 0 1 1 36 0 a 18 18 0 1 1 -36 0';
                if (v === 2) return 'M 20 34 H 260 M 20 46 H 260 M 120 40 L 130 28 L 140 40 L 130 52 Z';
                if (v === 3) return 'M 20 40 H 260 M 130 24 L 136 34 L 148 34 L 138 42 L 142 54 L 130 46 L 118 54 L 122 42 L 112 34 L 124 34 Z';
                return 'M 20 40 H 104 M 156 40 H 260 M 110 40 a 20 12 0 1 0 40 0 a 20 12 0 1 0 -40 0';
            }

            if (t.includes('ramadan') || t.includes('bayram') || t.includes('hilal') || t.includes('mosque') || t.includes('lantern') || t.includes('islamic')) {
                if (v === 0) return 'M 20 40 H 260 M 130 26 a 12 12 0 1 1 0 24 a 8 8 0 1 0 0 -24';
                if (v === 1) return 'M 20 40 H 108 M 152 40 H 260 M 130 24 L 136 36 L 150 36 L 138 44 L 142 56 L 130 48 L 118 56 L 122 44 L 110 36 L 124 36 Z';
                if (v === 2) return 'M 20 40 H 260 M 130 20 L 130 30 M 118 30 H 142 V 54 H 118 Z';
                if (v === 3) return 'M 20 40 H 260 M 96 40 L 104 30 L 112 40 L 104 50 Z M 148 40 L 156 30 L 164 40 L 156 50 Z';
                return 'M 20 44 Q 80 20 130 34 Q 180 48 260 26';
            }

            if (t.includes('national') || t.includes('republic') || t.includes('victory') || t.includes('flag') || t.includes('state')) {
                if (v === 0) return 'M 20 34 H 260 M 20 46 H 260 M 130 26 L 134 34 L 143 34 L 136 40 L 139 48 L 130 43 L 121 48 L 124 40 L 117 34 L 126 34 Z';
                if (v === 1) return 'M 20 40 H 260 M 120 40 a 10 10 0 1 1 20 0 a 10 10 0 1 1 -20 0';
                if (v === 2) return 'M 20 36 H 260 M 20 44 H 260 M 108 40 H 152';
                if (v === 3) return 'M 20 40 H 260 M 78 40 L 84 30 L 90 40 L 84 50 Z M 170 40 L 176 30 L 182 40 L 176 50 Z';
                return 'M 20 40 H 260 M 130 28 L 138 40 L 130 52 L 122 40 Z';
            }

            if (t.includes('new-year') || t.includes('holiday') || t.includes('winter') || t.includes('snow') || t.includes('sparkle') || t.includes('confetti') || t.includes('gift') || t.includes('celebration')) {
                if (v === 0) return 'M 20 40 H 260 M 130 26 L 134 34 L 142 34 L 136 40 L 138 48 L 130 43 L 122 48 L 124 40 L 118 34 L 126 34 Z';
                if (v === 1) return 'M 20 40 H 260 M 92 34 L 92 46 M 106 32 L 106 48 M 130 30 L 130 50 M 154 32 L 154 48 M 168 34 L 168 46';
                if (v === 2) return 'M 20 40 H 260 M 120 40 L 130 28 L 140 40 L 130 52 Z M 100 40 L 106 34 L 112 40 L 106 46 Z M 148 40 L 154 34 L 160 40 L 154 46 Z';
                if (v === 3) return 'M 20 40 H 108 M 152 40 H 260 M 118 30 H 142 V 50 H 118 Z M 130 30 V 50';
                return 'M 20 40 H 260 M 130 24 L 130 56 M 116 40 H 144 M 120 28 L 140 52 M 140 28 L 120 52';
            }

            if (t.includes('campaign') || t.includes('promo') || t.includes('discount') || t.includes('sale') || t.includes('opening')) {
                if (v === 0) return 'M 20 40 H 232 L 260 40 L 240 28 M 260 40 L 240 52';
                if (v === 1) return 'M 20 40 H 260 M 118 28 H 142 V 52 H 118 Z';
                if (v === 2) return 'M 20 40 H 260 M 110 40 L 122 26 L 134 40 L 122 54 Z M 126 40 L 138 26 L 150 40 L 138 54 Z';
                if (v === 3) return 'M 20 36 H 260 M 20 44 H 260 M 220 26 L 244 40 L 220 54';
                return 'M 20 40 H 260 M 120 28 H 140 M 120 52 H 140 M 120 28 V 52 M 140 28 V 52';
            }

            if (t.includes('price') || t.includes('retail') || t.includes('pos') || t.includes('marker') || t.includes('label')) {
                if (v === 0) return 'M 20 40 H 260 M 120 40 L 130 28 L 140 40 L 130 52 Z';
                if (v === 1) return 'M 20 40 H 104 M 156 40 H 260 M 108 28 H 152 V 52 H 108 Z';
                if (v === 2) return 'M 20 40 H 260 M 116 40 H 144 M 130 24 V 56';
                if (v === 3) return 'M 20 40 H 114 M 146 40 H 260 M 118 30 L 142 50 M 142 30 L 118 50';
                return 'M 20 34 H 260 M 20 46 H 260 M 130 28 L 138 40 L 130 52 L 122 40 Z';
            }

            if (t.includes('floral') || t.includes('flower') || t.includes('leaf') || t.includes('rose') || t.includes('bloom') || t.includes('garden') || t.includes('petal')) {
                if (v === 0) return 'M 20 40 Q 56 26 92 40 T 164 40 T 236 40 T 260 40';
                if (v === 1) return 'M 20 40 H 260 M 96 40 C 106 28 118 28 128 40 C 118 52 106 52 96 40 M 132 40 C 142 28 154 28 164 40 C 154 52 142 52 132 40';
                if (v === 2) return 'M 20 40 H 260 M 88 40 a 4 4 0 1 1 8 0 a 4 4 0 1 1 -8 0 M 126 40 a 6 6 0 1 1 12 0 a 6 6 0 1 1 -12 0 M 166 40 a 4 4 0 1 1 8 0 a 4 4 0 1 1 -8 0';
                if (v === 3) return 'M 20 40 H 260 M 70 40 C 80 28 92 28 102 40 C 92 52 80 52 70 40 M 158 40 C 168 28 180 28 190 40 C 180 52 168 52 158 40';
                return 'M 20 44 Q 70 24 130 40 Q 190 56 260 34';
            }

            if (t.includes('tech') || t.includes('digital') || t.includes('circuit') || t.includes('scanline') || t.includes('data') || t.includes('pixel') || t.includes('futuristic') || t.includes('blue-screen')) {
                if (v === 0) return 'M 20 40 H 260 M 20 32 H 260 M 20 48 H 260';
                if (v === 1) return 'M 20 40 H 80 V 26 H 126 V 54 H 176 V 40 H 260';
                if (v === 2) return 'M 20 40 H 260 M 40 34 V 46 M 68 34 V 46 M 96 34 V 46 M 124 34 V 46 M 152 34 V 46 M 180 34 V 46 M 208 34 V 46';
                if (v === 3) return 'M 20 40 H 260 M 100 28 H 160 V 52 H 100 Z';
                return 'M 20 40 H 92 L 104 26 L 118 52 L 134 30 L 148 48 L 164 28 H 260';
            }

            if (t.includes('ornamental') || t.includes('baroque') || t.includes('vintage') || t.includes('symmetric') || t.includes('scroll') || t.includes('teardrop') || t.includes('curl')) {
                if (v === 0) return 'M 20 40 C 44 24 68 24 92 40 H 168 C 192 24 216 24 260 40';
                if (v === 1) return 'M 20 40 H 260 M 112 40 C 118 26 142 26 148 40 C 142 54 118 54 112 40';
                if (v === 2) return 'M 20 40 C 48 56 76 24 104 40 C 132 56 160 24 188 40 C 212 52 236 52 260 40';
                if (v === 3) return 'M 20 40 H 260 M 120 40 L 130 28 L 140 40 L 130 52 Z';
                return 'M 20 40 C 40 30 60 30 80 40 S 120 50 140 40 S 180 30 200 40 S 232 50 260 40';
            }

            if (t.includes('double') || t.includes('triple') || t.includes('rail') || t.includes('ribbon')) {
                if (v === 0) return 'M 20 32 H 260 M 20 48 H 260';
                if (v === 1) return 'M 20 28 H 260 M 20 40 H 260 M 20 52 H 260';
                if (v === 2) return 'M 20 32 H 260 M 20 48 H 260 M 124 40 L 130 32 L 136 40 L 130 48 Z';
                if (v === 3) return 'M 20 40 L 38 28 L 56 40 L 74 52 L 92 40 L 110 28 L 128 40 L 146 52 L 164 40 L 182 28 L 200 40 L 218 52 L 236 40 L 260 30';
                return 'M 20 40 H 260 M 30 40 a 4 4 0 1 1 8 0 a 4 4 0 1 1 -8 0 M 218 40 a 4 4 0 1 1 8 0 a 4 4 0 1 1 -8 0';
            }

            if (t.includes('dashed') || t.includes('dash')) return 'M 20 40 H 260';
            if (t.includes('dotted') || t.includes('dot')) return 'M 20 40 H 260';

            return 'M 20 40 Q 40 26 60 40 T 100 40 T 140 40 T 180 40 T 220 40 T 260 40';
        };

        const pathData = pathByType[renderType] || autoPathByType(renderType) || pathByType.wave;
        const pathObj = new Path(pathData, {
            ...V7_ORIGIN,
            left: 220,
            top: 220,
            fill: '',
            stroke: color,
            strokeWidth: width,
            strokeDashArray: style.strokeDashArray || null,
            strokeLineCap: style.strokeLineCap || 'round',
            strokeLineJoin: style.strokeLineJoin || 'round',
            strokeUniform: true
        });

        pathObj.set(CUSTOM_PROPS.CUSTOM_TYPE, CUSTOM_TYPES.LINE);
        pathObj.set(CUSTOM_PROPS.OBJECT_NAME, this.__('editor.tools.line') || 'Cizgi');

        this.canvas.add(pathObj);
        this.canvas.setActiveObject(pathObj);
        this.canvas.requestRenderAll();
        this._saveHistory();
        return pathObj;
    }

    /**
     * Görsel ekle
     * @param {string} url - Görsel URL'si
     * @param {Object} [options={}] - Ek seçenekler
     * @returns {Promise<fabric.Image>}
     */
    async addImage(url, options = {}) {
        const obj = await this.objectFactory.createImage(url, options);
        // ObjectFactory zaten canvas'a ekliyor
        if (obj && this.canvas) {
            this.canvas.setActiveObject(obj);
            this.canvas.requestRenderAll();
        }
        this._saveHistory();
        return obj;
    }

    /**
     * Barkod ekle
     * @param {string} [value='8690000000001'] - Barkod değeri
     * @param {Object} [options={}] - Ek seçenekler
     * @returns {Promise<fabric.Image>}
     */
    async addBarcode(value = '8690000000001', options = {}) {
        if (typeof JsBarcode === 'undefined') {
            console.warn('TemplateEditorV7: JsBarcode yüklenmemiş');
            // Fallback: metin placeholder
            return this.addText('|||||||||||', {
                fontFamily: 'Courier New',
                fontSize: 32,
                customType: 'barcode',
                ...options
            });
        }

        try {
            const obj = await this.objectFactory.createBarcode(value, options);
            if (obj && this.canvas) {
                this.canvas.setActiveObject(obj);
                this.canvas.requestRenderAll();
            }
            this._saveHistory();
            return obj;
        } catch (err) {
            console.error('TemplateEditorV7: Barkod oluşturulamadı:', err);
            return this.addText('|||||||||||', {
                fontFamily: 'Courier New',
                fontSize: 32,
                customType: 'barcode',
                ...options
            });
        }
    }

    /**
     * QR Kod ekle
     * @param {string} [value='https://example.com'] - QR kod değeri
     * @param {Object} [options={}] - Ek seçenekler
     * @returns {Promise<fabric.Image>}
     */
    async addQRCode(value = 'https://example.com', options = {}) {
        if (typeof QRCode === 'undefined') {
            console.warn('TemplateEditorV7: QRCode yüklenmemiş');
            // Fallback: kare placeholder
            return this.addRect({
                width: 100,
                height: 100,
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
                customType: 'qrcode',
                ...options
            });
        }

        try {
            const obj = await this.objectFactory.createQRCode(value, options);
            if (obj && this.canvas) {
                this.canvas.setActiveObject(obj);
                this.canvas.requestRenderAll();
            }
            this._saveHistory();
            return obj;
        } catch (err) {
            console.error('TemplateEditorV7: QR kod oluşturulamadı:', err);
            return this.addRect({
                width: 100,
                height: 100,
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
                customType: 'qrcode',
                ...options
            });
        }
    }

    /**
     * Dinamik alan ekle
     * @param {string} fieldKey - Alan anahtarı
     * @param {Object} [options={}] - Ek seçenekler
     * @returns {Promise<fabric.Object>}
     */
    async _addDynamicField(fieldKey, options = {}) {
        const { type, label, placeholder } = options;

        let obj;

        switch (type) {
            case 'barcode':
                // JsBarcode ile gerçek barkod oluştur
                if (typeof JsBarcode !== 'undefined' && this.objectFactory.createBarcode) {
                    try {
                        obj = await this.objectFactory.createBarcode(placeholder || '8690000000001', {
                            format: options.barcodeFormat || 'EAN13',
                            [CUSTOM_PROPS.IS_DATA_FIELD]: true,
                            [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey
                        });
                    } catch (err) {
                        console.warn('TemplateEditorV7: Barkod oluşturulamadı, metin placeholder kullanılıyor:', err);
                        obj = await this.objectFactory.createText(`|||||||||||`, {
                            fontSize: 32,
                            fontFamily: 'Courier New',
                            [CUSTOM_PROPS.CUSTOM_TYPE]: 'barcode',
                            [CUSTOM_PROPS.IS_DATA_FIELD]: true,
                            [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey,
                            [CUSTOM_PROPS.PLACEHOLDER]: placeholder || `{{${fieldKey}}}`
                        });
                    }
                } else {
                    // Fallback: metin placeholder
                    obj = await this.objectFactory.createText(`|||||||||||`, {
                        fontSize: 32,
                        fontFamily: 'Courier New',
                        [CUSTOM_PROPS.CUSTOM_TYPE]: 'barcode',
                        [CUSTOM_PROPS.IS_DATA_FIELD]: true,
                        [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey,
                        [CUSTOM_PROPS.PLACEHOLDER]: placeholder || `{{${fieldKey}}}`
                    });
                }
                break;

            case 'qrcode':
                // qrcodejs ile gerçek QR kod oluştur
                if (typeof QRCode !== 'undefined' && this.objectFactory.createQRCode) {
                    try {
                        obj = await this.objectFactory.createQRCode(placeholder || 'https://example.com', {
                            width: 100,
                            height: 100,
                            [CUSTOM_PROPS.IS_DATA_FIELD]: true,
                            [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey
                        });
                    } catch (err) {
                        console.warn('TemplateEditorV7: QR kod oluşturulamadı, kare placeholder kullanılıyor:', err);
                        obj = await this.objectFactory.createRect({
                            width: 100,
                            height: 100,
                            fill: '#ffffff',
                            stroke: '#000000',
                            strokeWidth: 2,
                            [CUSTOM_PROPS.CUSTOM_TYPE]: 'qrcode',
                            [CUSTOM_PROPS.IS_DATA_FIELD]: true,
                            [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey
                        });
                    }
                } else {
                    // Fallback: kare placeholder
                    obj = await this.objectFactory.createRect({
                        width: 100,
                        height: 100,
                        fill: '#ffffff',
                        stroke: '#000000',
                        strokeWidth: 2,
                        [CUSTOM_PROPS.CUSTOM_TYPE]: 'qrcode',
                        [CUSTOM_PROPS.IS_DATA_FIELD]: true,
                        [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey
                    });
                }
                break;

            case 'image': {
                // Placeholder görsel - canvas genişliğini kaplar
                const canvasW = this.canvas?.width || 800;
                const canvasH = this.canvas?.height || 1280;
                const imgW = canvasW;
                const imgH = Math.round(canvasW * 0.6); // 60% oranında yükseklik

                obj = await this.objectFactory.createRect({
                    width: imgW,
                    height: imgH,
                    left: canvasW / 2,
                    top: imgH / 2,
                    fill: '#f0f0f0',
                    stroke: '#1565C0',
                    strokeWidth: 2,
                    strokeDashArray: [8, 4],
                    [CUSTOM_PROPS.CUSTOM_TYPE]: 'image-placeholder',
                    [CUSTOM_PROPS.IS_DATA_FIELD]: true,
                    [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey
                });
                break;
            }

            case 'video': {
                // Video placeholder - cihazda ayrı video katmanı olarak oynatılır
                // Ekran yarı yarıya bölünür: üst yarı tasarım, alt yarı video
                const vCanvasW = this.canvas?.width || 800;
                const vCanvasH = this.canvas?.height || 1280;
                const vpW = vCanvasW;
                const vpH = Math.round(vCanvasH * 0.5); // %50 yükseklik - yarı yarıya

                // Arkaplan rect
                const videoBg = new Rect({
                    width: vpW,
                    height: vpH,
                    fill: '#1a1a2e',
                    stroke: '#e94560',
                    strokeWidth: 3,
                    strokeDashArray: [10, 5],
                    rx: 4,
                    ry: 4,
                    originX: 'center',
                    originY: 'center',
                    left: 0,
                    top: 0
                });

                // Play üçgeni (▶)
                const playSize = Math.min(vpW, vpH) * 0.2;
                const playIcon = new Triangle({
                    width: playSize,
                    height: playSize,
                    fill: 'rgba(255,255,255,0.7)',
                    angle: 90,
                    originX: 'center',
                    originY: 'center',
                    left: 0,
                    top: -vpH * 0.05,
                    selectable: false,
                    evented: false
                });

                // "VIDEO" yazısı
                const videoLabel = new FabricText(fieldKey === 'videos' ? '▶ VIDEOS' : '▶ VIDEO', {
                    fontSize: Math.max(14, Math.round(vpH * 0.07)),
                    fontFamily: 'Arial',
                    fontWeight: 'bold',
                    fill: 'rgba(255,255,255,0.5)',
                    originX: 'center',
                    originY: 'center',
                    left: 0,
                    top: vpH * 0.3,
                    selectable: false,
                    evented: false
                });

                // Tek Group olarak oluştur
                const videoGroup = new Group([videoBg, playIcon, videoLabel], {
                    originX: 'center',
                    originY: 'center',
                    left: vCanvasW / 2,
                    top: vCanvasH - vpH / 2
                });

                // v7 constructor custom/non-default prop'ları set etmeyebilir, .set() ile garanti et
                videoGroup.set('subTargetCheck', false);
                videoGroup.set('interactive', false);

                // Alt nesneler kesinlikle ayrı seçilememeli
                videoGroup.getObjects().forEach(child => {
                    child.set('selectable', false);
                    child.set('evented', false);
                });

                // Custom prop'ları Group üzerine ayarla
                this.objectFactory._applyBaseProperties(videoGroup, CUSTOM_TYPES.VIDEO_PLACEHOLDER, {
                    [CUSTOM_PROPS.IS_DATA_FIELD]: true,
                    [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey,
                    [CUSTOM_PROPS.IS_VIDEO_PLACEHOLDER]: true,
                    [CUSTOM_PROPS.IS_MULTIPLE_VIDEOS]: fieldKey === 'videos',
                    [CUSTOM_PROPS.PLACEHOLDER]: fieldKey === 'videos' ? '{Videos}' : '{Video}'
                });

                if (this.canvas) {
                    this.canvas.add(videoGroup);
                    this.canvas.setActiveObject(videoGroup);
                    this.canvas.requestRenderAll();
                    eventBus.emit(EVENTS.OBJECT_ADDED, { object: videoGroup });
                }
                obj = videoGroup;
                break;
            }

            case 'price':
                // Fiyat metni (büyük font) - canvas'ta okunabilir label göster
                obj = await this.objectFactory.createTextbox(this._getFieldLabel(fieldKey), {
                    fontSize: 36,
                    fontWeight: 'bold',
                    originX: 'left',
                    originY: 'top',
                    fill: '#e74c3c',
                    [CUSTOM_PROPS.CUSTOM_TYPE]: 'price',
                    [CUSTOM_PROPS.IS_DATA_FIELD]: true,
                    [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey,
                    [CUSTOM_PROPS.PLACEHOLDER]: placeholder || `{{${fieldKey}}}`
                });
                break;

            case 'date':
                // Tarih metni - canvas'ta okunabilir label göster
                obj = await this.objectFactory.createTextbox(this._getFieldLabel(fieldKey), {
                    fontSize: 14,
                    originX: 'left',
                    originY: 'top',
                    fill: '#666666',
                    [CUSTOM_PROPS.CUSTOM_TYPE]: 'date',
                    [CUSTOM_PROPS.IS_DATA_FIELD]: true,
                    [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey,
                    [CUSTOM_PROPS.PLACEHOLDER]: placeholder || `{{${fieldKey}}}`
                });
                break;

            default:
                // Normal metin alanı - canvas'ta okunabilir label göster
                obj = await this.objectFactory.createTextbox(this._getFieldLabel(fieldKey), {
                    fontSize: 20,
                    originX: 'left',
                    originY: 'top',
                    [CUSTOM_PROPS.CUSTOM_TYPE]: 'dynamic-text',
                    [CUSTOM_PROPS.IS_DATA_FIELD]: true,
                    [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey,
                    [CUSTOM_PROPS.PLACEHOLDER]: placeholder || `{{${fieldKey}}}`
                });
        }

        if (obj && this.canvas) {
            // ObjectFactory zaten canvas'a ekliyor, tekrar eklemeye gerek yok
            this.canvas.setActiveObject(obj);
            this.canvas.requestRenderAll();
            this._saveHistory();

            eventBus.emit(EVENTS.DYNAMIC_FIELD_ADD, {
                fieldKey,
                object: obj,
                options
            });
        }

        return obj;
    }

    /**
     * Yüklenen şablondaki objelerin eksik custom props'larını onar.
     * v7 bug döneminde kaydedilen şablonlarda dynamicField/isDataField kaybolmuş olabilir.
     * Text içeriğine bakarak hangi dinamik alan olduğunu tahmin eder ve props'ları ekler.
     */
    _repairDynamicFieldProps() {
        if (!this.canvas) return;

        // Label -> field key eşleştirme tablosu
        const labelToFieldMap = {
            'ürün adı': 'product_name', 'urun adi': 'product_name', 'ürün ad': 'product_name',
            'sku': 'sku', 'stok kodu': 'sku', 'ürün kodu': 'sku', 'urun kodu': 'sku',
            'barkod': 'barcode', 'barcode': 'barcode',
            'açıklama': 'description', 'aciklama': 'description', 'description': 'description',
            'güncel fiyat': 'current_price', 'guncel fiyat': 'current_price', 'fiyat': 'current_price',
            'satış fiyatı': 'current_price', 'satis fiyati': 'current_price', 'price': 'current_price',
            'eski fiyat': 'previous_price', 'önceki fiyat': 'previous_price',
            'fiyat + tl': 'price_with_currency', 'fiyat + ₺': 'price_with_currency',
            'kdv oranı': 'vat_rate', 'kdv orani': 'vat_rate', 'kdv': 'vat_rate',
            'indirim %': 'discount_percent', 'indirim': 'discount_percent',
            'kampanya metni': 'campaign_text', 'kampanya': 'campaign_text',
            'kategori': 'category', 'category': 'category',
            'alt kategori': 'subcategory', 'subcategory': 'subcategory',
            'marka': 'brand', 'brand': 'brand',
            'birim': 'unit', 'unit': 'unit',
            'ağırlık': 'weight', 'agirlik': 'weight', 'weight': 'weight',
            'stok miktarı': 'stock', 'stok miktari': 'stock', 'stok': 'stock',
            'menşei': 'origin', 'mensei': 'origin', 'origin': 'origin',
            'üretim şekli': 'production_type', 'uretim sekli': 'production_type',
            'raf konumu': 'shelf_location',
            'tedarikçi kodu': 'supplier_code', 'tedarikci kodu': 'supplier_code',
            'künye no': 'kunye_no', 'kunye no': 'kunye_no',
            'bugünün tarihi': 'date_today', 'bugunun tarihi': 'date_today', 'tarih': 'date_today',
            'tarih ve saat': 'date_time',
            'product name': 'product_name', 'name': 'product_name',
            'current price': 'current_price', 'previous price': 'previous_price',
            'üretici adı': 'uretici_adi', 'uretici adi': 'uretici_adi',
            'malın adı': 'malin_adi', 'malin adi': 'malin_adi',
            'malın cinsi': 'malin_cinsi', 'malin cinsi': 'malin_cinsi',
            'malın türü': 'malin_turu', 'malin turu': 'malin_turu',
            'üretim yeri': 'uretim_yeri', 'uretim yeri': 'uretim_yeri',
            'işletme adı': 'isletme_adi', 'isletme adi': 'isletme_adi',
        };

        // Field key -> customType eşleştirme
        const fieldToCustomType = {
            'barcode': 'barcode',
            'kunye_no': 'barcode',
            'current_price': 'price',
            'previous_price': 'price',
            'price_with_currency': 'price',
            'vat_rate': 'price',
            'discount_percent': 'price',
            'image_url': 'image-placeholder',
            'date_today': 'date',
            'date_time': 'date',
        };

        const barcodePattern = /^\|{3,}$/;
        let repairedCount = 0;

        this.canvas.getObjects().forEach((obj, index) => {
            // Zaten doğru props'ları olan objeleri atla
            if (obj[CUSTOM_PROPS.DYNAMIC_FIELD] || obj[CUSTOM_PROPS.IS_DATA_FIELD]) {
                return;
            }

            const type = (obj.type || '').toLowerCase();

            // Video placeholder kontrolü (koyu dikdörtgen, customType=video-placeholder)
            if (type === 'rect' || type === 'group') {
                const fill = obj.fill || '';
                const ct = obj[CUSTOM_PROPS.CUSTOM_TYPE] || '';
                // Zaten video-placeholder customType'ı varsa prop'ları tamamla
                if (ct === 'video-placeholder' || ct === CUSTOM_TYPES.VIDEO_PLACEHOLDER) {
                    obj[CUSTOM_PROPS.IS_DATA_FIELD] = true;
                    obj[CUSTOM_PROPS.DYNAMIC_FIELD] = obj[CUSTOM_PROPS.DYNAMIC_FIELD] || 'video_url';
                    obj[CUSTOM_PROPS.IS_VIDEO_PLACEHOLDER] = true;
                    repairedCount++;
                    return;
                }
                // Koyu renkli büyük Rect = video placeholder olabilir
                if (type === 'rect' && (fill === '#1a1a2e' || fill === 'rgb(26,26,46)')) {
                    obj[CUSTOM_PROPS.IS_DATA_FIELD] = true;
                    obj[CUSTOM_PROPS.DYNAMIC_FIELD] = 'video_url';
                    obj[CUSTOM_PROPS.CUSTOM_TYPE] = CUSTOM_TYPES.VIDEO_PLACEHOLDER;
                    obj[CUSTOM_PROPS.IS_VIDEO_PLACEHOLDER] = true;
                    repairedCount++;
                    return;
                }
            }

            // Image placeholder kontrolü (SVG/PNG base64 placeholder)
            if (type === 'image') {
                const src = obj.src || '';
                const w = obj.width || 0;
                const h = obj.height || 0;
                // SVG placeholder (200x200) veya küçük PNG placeholder
                if ((src.startsWith('data:image/svg+xml') && w <= 300 && h <= 300) ||
                    (src.startsWith('data:image/png') && w <= 200 && h <= 200)) {
                    obj[CUSTOM_PROPS.IS_DATA_FIELD] = true;
                    obj[CUSTOM_PROPS.DYNAMIC_FIELD] = 'image_url';
                    obj[CUSTOM_PROPS.CUSTOM_TYPE] = 'image-placeholder';
                    obj[CUSTOM_PROPS.PLACEHOLDER] = '{{image_url}}';
                    repairedCount++;
                }
                return;
            }

            // Text tipi objelere bak
            if (!['text', 'i-text', 'textbox'].includes(type)) return;

            const rawText = obj.text || '';
            if (!rawText.trim()) return;

            const normalizedText = rawText.trim().toLowerCase();
            let matchedField = null;

            // Barkod placeholder kontrolü (|||||||||||)
            if (barcodePattern.test(rawText.trim())) {
                matchedField = 'barcode';
            } else {
                matchedField = labelToFieldMap[normalizedText] || null;
            }

            if (matchedField) {
                const customType = fieldToCustomType[matchedField] || 'dynamic-text';

                obj[CUSTOM_PROPS.IS_DATA_FIELD] = true;
                obj[CUSTOM_PROPS.DYNAMIC_FIELD] = matchedField;
                obj[CUSTOM_PROPS.CUSTOM_TYPE] = customType;
                obj[CUSTOM_PROPS.PLACEHOLDER] = `{{${matchedField}}}`;

                // Text'i de placeholder formatına çevir (barcode hariç)
                if (matchedField !== 'barcode') {
                    obj.set('text', `{{${matchedField}}}`);
                }

                repairedCount++;
            }
        });

        if (repairedCount > 0) {
        }
    }

    /**
     * Dynamic text olarak kullanılan legacy Text nesnelerini Textbox'a çevir.
     * Böylece kaydedilmiş width korunur ve seçim kutusu gerçek alanı gösterir.
     * @private
     * @param {Array<Object>} [originalJsonObjects=[]]
     */
    _upgradeDynamicTextObjectsToTextbox(originalJsonObjects = []) {
        if (!this.canvas || typeof Textbox !== 'function') return;

        const objects = this.canvas.getObjects();
        if (!Array.isArray(objects) || objects.length === 0) return;

        const activeObject = this.canvas.getActiveObject();
        let hasChanges = false;

        objects.forEach((obj, index) => {
            if (!obj) return;

            const type = String(obj.type || '').toLowerCase();
            if (!['text', 'i-text', 'itext', 'fabrictext'].includes(type)) return;

            const jsonObj = originalJsonObjects[index] || null;
            const jsonType = String(jsonObj?.type || '').toLowerCase();

            const customType = String(
                obj[CUSTOM_PROPS.CUSTOM_TYPE] ||
                obj.customType ||
                jsonObj?.[CUSTOM_PROPS.CUSTOM_TYPE] ||
                jsonObj?.customType ||
                ''
            ).toLowerCase();

            const dynamicField =
                obj[CUSTOM_PROPS.DYNAMIC_FIELD] ||
                obj.dynamicField ||
                jsonObj?.[CUSTOM_PROPS.DYNAMIC_FIELD] ||
                jsonObj?.dynamicField ||
                '';

            const isDataField = !!(
                obj[CUSTOM_PROPS.IS_DATA_FIELD] ||
                obj.isDataField ||
                jsonObj?.[CUSTOM_PROPS.IS_DATA_FIELD] ||
                jsonObj?.isDataField
            );

            const isDynamicLike =
                !!dynamicField ||
                isDataField ||
                customType === 'dynamic-text' ||
                customType === 'price' ||
                customType === 'date';

            const jsonWidth = Number(jsonObj?.width);
            const liveWidth = Number(obj.width);
            const hasWidthDrift = Number.isFinite(jsonWidth) && Number.isFinite(liveWidth) && (jsonWidth - liveWidth) > 2;

            if (!isDynamicLike && jsonType !== 'textbox' && !hasWidthDrift) return;

            const desiredWidthRaw = jsonObj?.width ?? obj.width ?? (typeof obj.getScaledWidth === 'function' ? obj.getScaledWidth() : 0);
            const desiredWidth = Math.max(1, Number(desiredWidthRaw) || 1);
            const sourceHeightRaw = jsonObj?.height ?? obj.height ?? (typeof obj.getScaledHeight === 'function' ? obj.getScaledHeight() : 0);
            const sourceHeight = Math.max(1, Number(sourceHeightRaw) || 1);
            const normalizedPos = this._resolveLeftTopFromOrigin(obj, desiredWidth, sourceHeight);

            const textbox = new Textbox(obj.text || '', {
                left: normalizedPos.left,
                top: normalizedPos.top,
                originX: 'left',
                originY: 'top',
                angle: obj.angle || 0,
                scaleX: obj.scaleX || 1,
                scaleY: obj.scaleY || 1,
                skewX: obj.skewX || 0,
                skewY: obj.skewY || 0,
                flipX: !!obj.flipX,
                flipY: !!obj.flipY,
                width: desiredWidth,
                splitByGrapheme: jsonObj?.splitByGrapheme ?? obj.splitByGrapheme ?? false,
                fontFamily: obj.fontFamily || 'Arial',
                fontSize: obj.fontSize || 20,
                fontWeight: obj.fontWeight || 'normal',
                fontStyle: obj.fontStyle || 'normal',
                textAlign: obj.textAlign || 'left',
                lineHeight: obj.lineHeight || 1.16,
                charSpacing: obj.charSpacing || 0,
                underline: !!obj.underline,
                overline: !!obj.overline,
                linethrough: !!obj.linethrough,
                fill: obj.fill || '#000000',
                stroke: obj.stroke || null,
                strokeWidth: obj.strokeWidth || 0,
                strokeUniform: obj.strokeUniform !== false,
                shadow: obj.shadow || null,
                backgroundColor: obj.backgroundColor || '',
                opacity: obj.opacity ?? 1,
                visible: obj.visible !== false,
                selectable: obj.selectable !== false,
                evented: obj.evented !== false,
                hasControls: obj.hasControls !== false,
                hasBorders: obj.hasBorders !== false,
                lockMovementX: !!obj.lockMovementX,
                lockMovementY: !!obj.lockMovementY,
                lockRotation: !!obj.lockRotation,
                lockScalingX: !!obj.lockScalingX,
                lockScalingY: !!obj.lockScalingY,
                lockSkewingX: !!obj.lockSkewingX,
                lockSkewingY: !!obj.lockSkewingY,
                lockUniScaling: !!obj.lockUniScaling,
                padding: obj.padding || 0
            });

            SERIALIZABLE_PROPS.forEach((key) => {
                const fromJson = jsonObj && jsonObj[key] !== undefined ? jsonObj[key] : undefined;
                const fromObj = obj[key] !== undefined ? obj[key] : undefined;
                const value = fromJson !== undefined ? fromJson : fromObj;
                if (value === undefined || value === null) return;

                try {
                    textbox.set(key, value);
                    textbox[key] = value;
                } catch (e) {
                    // ignore non-settable props
                }
            });

            this.canvas.remove(obj);
            this.canvas.add(textbox);
            this.canvas.moveTo(textbox, index);
            textbox.setCoords?.();

            if (activeObject === obj) {
                this.canvas.setActiveObject(textbox);
            }

            hasChanges = true;
        });

        if (hasChanges) {
            this.canvas.requestRenderAll();
        }
    }

    /**
     * snake_case → camelCase dönüşümü
     * @param {string} str - snake_case string
     * @returns {string} camelCase string
     */
    _resolveLeftTopFromOrigin(obj, baseWidth, baseHeight) {
        const scaleX = Number(obj?.scaleX) || 1;
        const scaleY = Number(obj?.scaleY) || 1;
        const scaledW = (Number(baseWidth) || 0) * scaleX;
        const scaledH = (Number(baseHeight) || 0) * scaleY;

        let left = Number(obj?.left) || 0;
        let top = Number(obj?.top) || 0;

        const originX = String(obj?.originX || 'left').toLowerCase();
        const originY = String(obj?.originY || 'top').toLowerCase();

        if (originX === 'center') left -= scaledW / 2;
        else if (originX === 'right') left -= scaledW;

        if (originY === 'center') top -= scaledH / 2;
        else if (originY === 'bottom') top -= scaledH;

        return { left, top };
    }

    _normalizeTextObjectOrigins() {
        if (!this.canvas) return;

        const objects = this.canvas.getObjects();
        let changed = false;

        objects.forEach((obj) => {
            const type = String(obj?.type || '').toLowerCase();
            if (!['text', 'i-text', 'itext', 'textbox', 'fabrictext'].includes(type)) return;

            const originX = String(obj.originX || 'left').toLowerCase();
            const originY = String(obj.originY || 'top').toLowerCase();
            if (originX === 'left' && originY === 'top') return;

            const pos = this._resolveLeftTopFromOrigin(obj, obj.width || 1, obj.height || 1);
            obj.set({
                left: pos.left,
                top: pos.top,
                originX: 'left',
                originY: 'top'
            });
            obj.setCoords?.();
            changed = true;
        });

        if (changed) {
            this.canvas.requestRenderAll();
        }
    }

    _snakeToCamel(str) {
        return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    }

    /**
     * Dinamik alan key'inden okunabilir label döndür
     * Canvas'ta {{product_name}} yerine "Ürün Adı" gibi gösterim için
     * @param {string} fieldKey - snake_case alan anahtarı (ör: 'product_name')
     * @returns {string} Okunabilir label
     */
    _getFieldLabel(fieldKey) {
        // snake_case → camelCase: product_name → productName
        const camelKey = this._snakeToCamel(fieldKey);
        // i18n lookup: editor.dynamicFields.productName
        const i18nLabel = this.__(`editor.dynamicFields.${camelKey}`);
        // i18n key bulunamazsa (key kendisi dönerse) fallback yap
        if (i18nLabel && i18nLabel !== `editor.dynamicFields.${camelKey}`) {
            return i18nLabel;
        }
        // Fallback: snake_case → Title Case (product_name → Product Name)
        return fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    /**
     * Yüklenen şablondaki dinamik alan objelerinin text değerlerini
     * {{fieldKey}} formatından okunabilir label'a dönüştür.
     * load() sonrasında çağrılmalı.
     */
    _applyFieldDisplayLabels() {
        if (!this.canvas) return;

        this.canvas.getObjects().forEach(obj => {
            if (obj[CUSTOM_PROPS.IS_DATA_FIELD] && obj[CUSTOM_PROPS.DYNAMIC_FIELD]) {
                const fieldKey = obj[CUSTOM_PROPS.DYNAMIC_FIELD];
                const currentText = obj.text || '';
                // Sadece {{fieldKey}} formatındaki text'leri dönüştür
                if (currentText.match(/^\{\{.+\}\}$/)) {
                    obj.set('text', this._getFieldLabel(fieldKey));
                }
            }
        });
    }

    /**
     * Yüklenen multi-product-frame Group objelerinin custom prop'larını onar.
     * Fabric.js v7 loadFromJSON sonrası custom property'ler .set() ile değil
     * plain object property olarak gelebilir. Bu metod bunları .set() ile
     * yeniden atar ve slot objelerinin prop'larını da onarır.
     */
    _repairMultiFrameProps() {
        if (!this.canvas) return;
        // Debug log devre dışı - production'da Logger kullanılıyor

        const propsToRepair = [
            CUSTOM_PROPS.CUSTOM_TYPE,
            CUSTOM_PROPS.OBJECT_ID,
            CUSTOM_PROPS.OBJECT_NAME,
            CUSTOM_PROPS.FRAME_COLS,
            CUSTOM_PROPS.FRAME_ROWS,
            CUSTOM_PROPS.FRAME_WIDTH,
            CUSTOM_PROPS.FRAME_HEIGHT,
            CUSTOM_PROPS.ACTIVE_SLOT_ID,
            CUSTOM_PROPS.SLOTS,
            CUSTOM_PROPS.SLOT_ID,
            CUSTOM_PROPS.IN_MULTI_FRAME,
            CUSTOM_PROPS.PARENT_FRAME_ID,
            CUSTOM_PROPS.IS_SLOT_BACKGROUND,
            CUSTOM_PROPS.IS_SLOT_LABEL,
            CUSTOM_PROPS.IS_DATA_FIELD,
            CUSTOM_PROPS.DYNAMIC_FIELD,
            CUSTOM_PROPS.PLACEHOLDER
        ];

        this.canvas.getObjects().forEach((obj) => {
            // JSON'dan yüklenen Group objeleri: customType prop'u olabilir ama
            // .get() ile erişilemeyebilir. Plain property'den oku ve .set() ile yeniden ata.
            const rawCustomType = obj.customType || obj[CUSTOM_PROPS.CUSTOM_TYPE];

            // Tüm objelerin erişilebilir custom prop'larını .set() ile yeniden ata
            propsToRepair.forEach(propKey => {
                const val = obj[propKey];
                if (val !== undefined && val !== null) {
                    try { obj.set(propKey, val); } catch (e) { /* ignore */ }
                }
            });

            // Group tipi objeler için sub-objects'lerin prop'larını da onar
            // Fabric.js v7: obj.type = 'Group' (capitalized), v5: 'group' (lowercase)
            if ((obj.type === 'group' || obj.type === 'Group') && obj._objects) {
                obj._objects.forEach(subObj => {
                    propsToRepair.forEach(propKey => {
                        const val = subObj[propKey];
                        if (val !== undefined && val !== null) {
                            try { subObj.set(propKey, val); } catch (e) { /* ignore */ }
                        }
                    });
                });
            }

            // Multi-product-frame Group/Rect: JSON'dan gelen customType ama group/rect olarak yüklenen
            // objeleri tanı — frameCols/frameRows varsa bu bir multi-product-frame'dir
            if ((obj.type === 'group' || obj.type === 'Group' || obj.type === 'rect' || obj.type === 'Rect') && !rawCustomType) {
                const fc = obj.frameCols || obj[CUSTOM_PROPS.FRAME_COLS];
                const fr = obj.frameRows || obj[CUSTOM_PROPS.FRAME_ROWS];
                if (fc && fr) {
                    obj.set(CUSTOM_PROPS.CUSTOM_TYPE, 'multi-product-frame');
                    obj.customType = 'multi-product-frame';
                }
            }
            // customType zaten 'multi-product-frame' ise .set() ile de ata (v7 get() desteği için)
            if (rawCustomType === 'multi-product-frame') {
                try { obj.set(CUSTOM_PROPS.CUSTOM_TYPE, 'multi-product-frame'); } catch (e) { /* ignore */ }
                obj.customType = 'multi-product-frame';
            }

            // Multi-product-frame Group boyut onarımı ve sub-object flag'leri
            const isFrame = (obj.customType === 'multi-product-frame') ||
                            ((obj.type === 'group' || obj.type === 'Group' || obj.type === 'rect' || obj.type === 'Rect') && (obj.frameCols || obj.frameRows));
            if (isFrame) {
                // Frame bulundu - debug için Logger kullanılıyor
                const savedW = obj.frameWidth || obj[CUSTOM_PROPS.FRAME_WIDTH];
                const savedH = obj.frameHeight || obj[CUSTOM_PROPS.FRAME_HEIGHT];
                const currentW = obj.width || 0;
                const currentH = obj.height || 0;

                // Sub-objects mevcutsa: runtime flag'leri yeniden ata
                // NOT: excludeFromExport KULLANILMAMALI! Fabric.js v7 Group.toObject()
                // bu flag'e sahip sub-objects'leri serialize sırasında siliyor.
                // isSlotBackground flag'i export sırasında gizleme için kullanılıyor.
                if (obj._objects && obj._objects.length > 0) {
                    obj._objects.forEach(subObj => {
                        subObj.set('selectable', false);
                        subObj.set('evented', false);
                        // IS_SLOT_BACKGROUND yoksa ekle
                        if (!subObj[CUSTOM_PROPS.IS_SLOT_BACKGROUND]) {
                            subObj.set(CUSTOM_PROPS.IS_SLOT_BACKGROUND, true);
                        }
                    });

                    // frameWidth/frameHeight yoksa Group'un mevcut boyutundan kaydet
                    if (!savedW && currentW > 10) {
                        obj.set(CUSTOM_PROPS.FRAME_WIDTH, currentW);
                        obj.frameWidth = currentW;
                    }
                    if (!savedH && currentH > 10) {
                        obj.set(CUSTOM_PROPS.FRAME_HEIGHT, currentH);
                        obj.frameHeight = currentH;
                    }
                }
                // Sub-objects kayıpsa (eski save formatı / Fabric.js v7 bug): boyut bilgisinden yeniden oluştur
                else if (!obj._objects || obj._objects.length === 0) {
                    // Boyut bilgisi: frameWidth/frameHeight veya Group boyutu veya varsayılan 400
                    const rebuildW = savedW || (currentW > 10 ? currentW : 400);
                    const rebuildH = savedH || (currentH > 10 ? currentH : 400);
                    const cols = obj.frameCols || obj[CUSTOM_PROPS.FRAME_COLS] || 2;
                    const rows = obj.frameRows || obj[CUSTOM_PROPS.FRAME_ROWS] || 2;
                    const slotWidth = rebuildW / cols;
                    const slotHeight = rebuildH / rows;

                    // frameWidth/frameHeight'ı kaydet (yoksa)
                    if (!savedW) {
                        obj.set(CUSTOM_PROPS.FRAME_WIDTH, rebuildW);
                        obj.frameWidth = rebuildW;
                    }
                    if (!savedH) {
                        obj.set(CUSTOM_PROPS.FRAME_HEIGHT, rebuildH);
                        obj.frameHeight = rebuildH;
                    }

                    const slotObjects = [];
                    let slotId = 1;
                    for (let row = 0; row < rows; row++) {
                        for (let col = 0; col < cols; col++) {
                            const x = col * slotWidth;
                            const y = row * slotHeight;

                            const slotBg = new Rect({
                                left: x - rebuildW / 2 + slotWidth / 2,
                                top: y - rebuildH / 2 + slotHeight / 2,
                                width: slotWidth - 4,
                                height: slotHeight - 4,
                                fill: '#f5f5f5',
                                stroke: '#cccccc',
                                strokeWidth: 1,
                                selectable: false,
                                evented: false,
                                originX: 'center',
                                originY: 'center'
                            });
                            slotBg.set(CUSTOM_PROPS.IS_SLOT_BACKGROUND, true);
                            slotBg.set(CUSTOM_PROPS.SLOT_ID, slotId);
                            slotObjects.push(slotBg);
                            slotId++;
                        }
                    }

                    slotObjects.forEach(slotBg => {
                        try { obj.add(slotBg); } catch (e) { /* ignore */ }
                    });

                    try { obj.setCoords(); } catch (e) { /* ignore */ }
                }
            }
        });
    }

    /**
     * Seçili nesneyi sil
     */
    deleteSelected() {
        const selected = this.selectionManager?.getSelectedObjects();
        if (!selected || selected.length === 0) return;

        selected.forEach(obj => {
            // Remove associated frame overlay if this object has one
            if (this.frameService?.hasFrame(obj)) {
                this.frameService.removeFrame(obj, this.canvas);
            }
            this.canvas.remove(obj);
        });

        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
        this._saveHistory();
    }

    // ==========================================
    // SELECTION OPERATIONS
    // ==========================================

    /**
     * Tümünü seç
     */
    selectAll() {
        this.selectionManager?.selectAll();
    }

    /**
     * Seçimi temizle
     */
    clearSelection() {
        this.selectionManager?.clearSelection();
    }

    /**
     * Seçili nesneleri al
     * @returns {Array<fabric.Object>}
     */
    getSelected() {
        return this.selectionManager?.getSelectedObjects() || [];
    }

    // ==========================================
    // CLIPBOARD OPERATIONS
    // ==========================================

    /**
     * Kopyala
     */
    copy() {
        this.clipboardManager?.copy();
    }

    /**
     * Kes
     */
    cut() {
        this.clipboardManager?.cut();
    }

    /**
     * Yapıştır
     * @param {Object} [options={}] - Yapıştırma seçenekleri
     */
    async paste(options = {}) {
        await this.clipboardManager?.paste(options);
        this._saveHistory();
    }

    /**
     * Çoğalt
     */
    async duplicate() {
        await this.clipboardManager?.duplicate();
        this._saveHistory();
    }

    // ==========================================
    // HISTORY OPERATIONS
    // ==========================================

    /**
     * Geri al
     */
    undo() {
        this.historyManager?.undo();
    }

    /**
     * İleri al
     */
    redo() {
        this.historyManager?.redo();
    }

    /**
     * History'yi kaydet
     * @private
     */
    _saveHistory() {
        if (this.options.historyEnabled && this.historyManager) {
            this.historyManager.saveState();
        }
    }

    /**
     * Undo/Redo butonlarını güncelle
     * @param {Object} data - History durumu
     * @private
     */
    _updateUndoRedoButtons(data) {
        const undoBtn = this.container?.querySelector('#undo-btn');
        const redoBtn = this.container?.querySelector('#redo-btn');

        if (undoBtn) {
            undoBtn.disabled = !data.canUndo;
            undoBtn.classList.toggle('disabled', !data.canUndo);
        }

        if (redoBtn) {
            redoBtn.disabled = !data.canRedo;
            redoBtn.classList.toggle('disabled', !data.canRedo);
        }
    }

    // ==========================================
    // GRID OPERATIONS
    // ==========================================

    /**
     * Grid'i göster/gizle
     */
    toggleGrid() {
        return this.gridManager?.toggleGrid();
    }

    /**
     * Snap'i aç/kapat
     */
    toggleSnap() {
        this.gridManager?.toggleSnap();
    }

    /**
     * Smart guides'ı aç/kapat
     */
    toggleSmartGuides() {
        if (this.gridManager?.options?.smartGuidesEnabled) {
            this.gridManager.disableSmartGuides();
        } else {
            this.gridManager?.enableSmartGuides();
        }
    }

    /**
     * Grid boyutunu ayarla
     * @param {number} size - Yeni grid boyutu
     */
    setGridSize(size) {
        this.gridManager?.setGridSize(size);
    }

    // ==========================================
    // ZOOM OPERATIONS
    // ==========================================

    /**
     * Yakınlaştır
     * @param {number} [factor=1.1] - Yakınlaştırma faktörü
     */
    zoomIn(factor = 1.1) {
        this._zoom = Math.min(this._zoom * factor, 5);
        this._applyZoom();
    }

    /**
     * Uzaklaştır
     * @param {number} [factor=1.1] - Uzaklaştırma faktörü
     */
    zoomOut(factor = 1.1) {
        this._zoom = Math.max(this._zoom / factor, 0.1);
        this._applyZoom();
    }

    /**
     * Zoom'u sıfırla
     */
    zoomReset() {
        this._zoom = 1;
        this._applyZoom();
    }

    /**
     * Sığdır
     */
    zoomFit() {
        const wrapper = this.container?.querySelector('.canvas-wrapper');
        if (!wrapper || !this.canvas) return;

        const padding = 40;
        const availableWidth = wrapper.clientWidth - padding * 2;
        const availableHeight = wrapper.clientHeight - padding * 2;

        const scaleX = availableWidth / this.canvas.width;
        const scaleY = availableHeight / this.canvas.height;

        this._zoom = Math.min(scaleX, scaleY, 1);
        this._applyZoom();
    }

    /**
     * Zoom'u uygula
     * @private
     *
     * Önemli: Viewport transform KULLANILMIYOR çünkü bu nesneleri sol üst köşeden
     * ölçekler ve zoom küçültüldüğünde nesneler sol üste toplanır.
     * Bunun yerine sadece CSS boyutlandırma kullanılıyor - nesneler koordinatlarında
     * kalır, sadece görsel ölçek değişir.
     */
    _applyZoom() {
        if (!this.canvas) return;

        const zoom = this._zoom;
        const width = this.options.width;
        const height = this.options.height;

        // Viewport transform'u zoom=1 olarak tut (pan yok, zoom yok)
        // Bu sayede nesneler orijinal koordinatlarında kalır
        this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

        // Backstore boyutu (gerçek pixel boyutu) orijinal kalır
        this.canvas.setDimensions({ width, height }, { backstoreOnly: true });

        // CSS boyutu zoom'a göre ölçeklenir - bu sadece görsel ölçekleme yapar
        // Nesneler koordinatlarını korur, sadece ekranda küçük/büyük görünür
        this.canvas.setDimensions(
            { width: Math.round(width * zoom), height: Math.round(height * zoom) },
            { cssOnly: true }
        );

        this.canvas.requestRenderAll();

        // Zoom seviyesini göster
        const zoomDisplay = this.container?.querySelector('#zoom-level');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(zoom * 100)}%`;
        }

        eventBus.emit(EVENTS.CANVAS_ZOOM, { zoom });
    }

    /**
     * Mevcut zoom seviyesini al
     * @returns {number}
     */
    getZoom() {
        return this._zoom;
    }

    // ==========================================
    // CANVAS SIZE OPERATIONS
    // ==========================================

    /**
     * Canvas boyutunu ayarla
     * @param {number} width - Genişlik
     * @param {number} height - Yükseklik
     */
    setCanvasSize(width, height) {
        this.options.width = width;
        this.options.height = height;

        this._templateMeta.width = width;
        this._templateMeta.height = height;

        if (this.canvasManager) {
            this.canvasManager.setDimensions(width, height);
        }

        // GridManager'a da yeni boyutları bildir
        if (this.gridManager) {
            this.gridManager.setCanvasSize(width, height);
        }

        this._applyZoom();

        eventBus.emit(EVENTS.CANVAS_RESIZE, { width, height });
    }

    /**
     * Canvas boyutlarını al
     * @returns {{width: number, height: number}}
     */
    getCanvasSize() {
        return {
            width: this.options.width,
            height: this.options.height
        };
    }

    // ==========================================
    // TEMPLATE I/O OPERATIONS
    // ==========================================

    /**
     * Şablonu kaydet
     * @returns {Promise<Object>}
     */
    async save() {
        if (!this.canvas) {
            throw new Error('Canvas not initialized');
        }
        if (this._isSaving) {
            return null;
        }
        this._isSaving = true;

        try {
        // ==================== FIX: Fabric.js v7 Group.toObject() workaround ====================
        // Fabric.js v7 Group.toObject() sub-objects'lerde excludeFromExport: true olanları
        // otomatik olarak JSON'dan SİLİYOR. Bu multi-product-frame slot background'larını
        // kaybettirir. Çözüm: serialize öncesi geçici olarak flag'i kaldır, sonra geri koy.
        const excludeFromExportRestoreList = [];
        this.canvas.getObjects().forEach(obj => {
            const isMultiFrame = obj.customType === 'multi-product-frame' || (obj.frameCols && obj.frameRows);
            if (isMultiFrame && obj._objects && obj._objects.length > 0) {
                obj._objects.forEach(subObj => {
                    if (subObj.excludeFromExport) {
                        excludeFromExportRestoreList.push(subObj);
                        subObj.excludeFromExport = false;
                    }
                });
            }
        });
        // =======================================================================================

        // JSON serialize et - tüm custom property'leri dahil et (SERIALIZABLE_PROPS merkezi listeden)
        const canvasJson = this.canvas.toJSON([
            ...SERIALIZABLE_PROPS,
            'id',
            'name',
            'excludeFromExport',    // Filtreleme için dahil et
            'isRegionOverlay',      // Filtreleme için dahil et
            'isBackground',         // Filtreleme için dahil et
            'isTransient',          // Filtreleme için dahil et
            'isHelper',             // Filtreleme için dahil et
            'subTargetCheck',       // Group alt nesne seçimi kontrolü
            'interactive'           // Group etkileşim kontrolü
        ]);

        // ==================== Restore: excludeFromExport flag'lerini geri koy ====================
        excludeFromExportRestoreList.forEach(subObj => {
            subObj.excludeFromExport = true;
        });
        // =======================================================================================

        // ==================== FIX: Export edilmemesi gereken nesneleri filtrele ====================
        // GridManager tarafından oluşturulan overlay ve background'lar kaydedilmemeli
        // Çünkü bunlar her yüklemede yeniden oluşturulacak
        const originalObjectCount = canvasJson.objects?.length || 0;
        if (canvasJson.objects) {
            canvasJson.objects = canvasJson.objects.filter(obj => {
                // Frame overlay objeleri render/export için her zaman korunmalı
                if (obj.customType === 'frame-overlay' || obj.custom_type === 'frame-overlay') {
                    return true;
                }
                // Multi-product-frame objeleri her zaman koru (Group veya Rect)
                if (obj.customType === 'multi-product-frame' || (obj.frameCols && obj.frameRows)) {
                    return true;
                }
                // Video placeholder Group'ları her zaman koru
                if (obj.customType === 'video-placeholder' || obj.isVideoPlaceholder) {
                    return true;
                }
                return obj.excludeFromExport !== true &&
                    obj.isRegionOverlay !== true &&
                    obj.isBackground !== true &&
                    obj.isTransient !== true &&
                    obj.isHelper !== true &&
                    obj.isSlotBackground !== true;
            });

            // Multi-product-frame Group'ları: sub-objects'leri KORU (boyut bilgisi için gerekli)
            // Ancak frameWidth/frameHeight'ı kaydet (yedek boyut bilgisi)
            canvasJson.objects.forEach(obj => {
                // Fabric.js v7: serialized type = 'Group' (capitalized)
                if ((obj.type === 'group' || obj.type === 'Group') && obj.objects) {
                    // Multi-product-frame mi kontrol et
                    const isMultiFrame = obj.customType === 'multi-product-frame' ||
                                         (obj.frameCols && obj.frameRows);
                    // Video placeholder Group'ları: sub-objects'leri KORU (play icon + label)
                    const isVideoPlaceholder = obj.customType === 'video-placeholder' || obj.isVideoPlaceholder;

                    if (isMultiFrame || isVideoPlaceholder) {
                        if (isMultiFrame) {
                            // frameWidth/frameHeight yoksa Group'un mevcut boyutundan hesapla
                            if (!obj.frameWidth && obj.width) {
                                obj.frameWidth = obj.width;
                            }
                            if (!obj.frameHeight && obj.height) {
                                obj.frameHeight = obj.height;
                            }
                        }
                        // Sub-objects'leri KORU
                        // Runtime flag'lerini kaldır ki load'da silinmesin
                        obj.objects.forEach(subObj => {
                            delete subObj.excludeFromExport;
                            delete subObj.isTransient;
                            delete subObj.isHelper;
                        });
                    } else {
                        // Diğer Group'lar için eski davranış
                        obj.objects = obj.objects.filter(subObj =>
                            (subObj.customType === 'frame-overlay' || subObj.custom_type === 'frame-overlay') ||
                            subObj.excludeFromExport !== true &&
                            subObj.isSlotBackground !== true &&
                            subObj.isTransient !== true
                        );
                    }
                }
            });
        }
        const filteredCount = originalObjectCount - (canvasJson.objects?.length || 0);
        if (filteredCount > 0) {
        }
        // ==========================================================================================

        // ==================== Responsive: Relative koordinat hesapla ====================
        // Grid layout varsa ve responsive mode aktifse, her objenin bölge-içi
        // yüzde koordinatlarını hesapla (backend ResponsiveScaler için)
        if (canvasJson.objects && this.gridManager) {
            const regions = this.gridManager.getRegions();
            const canvasW = this._templateMeta.width || this.options.width || 800;
            const canvasH = this._templateMeta.height || this.options.height || 1280;

            if (regions && regions.length > 0) {
                canvasJson.objects.forEach(obj => {
                    this._computeRelativeCoords(obj, regions, canvasW, canvasH);
                });
            }
        }
        // ==============================================================================

        // ==================== FIX: Dinamik alan label'larını placeholder'a çevir ====================
        // Canvas'ta okunabilir label gösteriliyor (ör: "Ürün Adı"), kayıtta {{product_name}} olmalı
        if (canvasJson.objects) {
            canvasJson.objects.forEach(obj => {
                if (!(obj[CUSTOM_PROPS.IS_DATA_FIELD] && obj[CUSTOM_PROPS.DYNAMIC_FIELD] && obj[CUSTOM_PROPS.PLACEHOLDER])) {
                    return;
                }
                const fieldKey = String(obj[CUSTOM_PROPS.DYNAMIC_FIELD] || '').trim();
                const placeholderText = String(obj[CUSTOM_PROPS.PLACEHOLDER] || '').trim();
                const currentText = String(obj.text || '').trim();
                const autoLabel = fieldKey ? String(this._getFieldLabel(fieldKey) || '').trim() : '';
                const isPlaceholderText = /^\{\{\s*[^}]+\s*\}\}$/.test(currentText);
                const isAutoGeneratedLabel = !!autoLabel && currentText === autoLabel;
                if (isPlaceholderText || isAutoGeneratedLabel || !currentText) {
                    obj.text = placeholderText;
                }
            });
        }
        // ==========================================================================================

        const saveData = {
            ...this._templateMeta,
            content: JSON.stringify(canvasJson),
            version: '7.0.0'
        };

        // Callback varsa çağır
        if (this.options.onSave) {
            return await this.options.onSave(saveData);
        }

        return saveData;
        } finally {
            this._isSaving = false;
        }
    }

    /**
     * Obje için bölge-içi yüzde (relative) koordinatları hesapla.
     * Backend ResponsiveScaler bu değerleri kullanarak farklı boyuttaki
     * cihazlara uyumlu pozisyonlama yapar.
     *
     * @param {Object} obj - Serialized Fabric.js obje (canvasJson.objects elemanı)
     * @param {Array}  regions - GridManager regions dizisi
     * @param {number} canvasW - Canvas genişliği (px)
     * @param {number} canvasH - Canvas yüksekliği (px)
     * @private
     */
    _computeRelativeCoords(obj, regions, canvasW, canvasH) {
        // regionId olmayan veya export-dışı objeleri atla
        const regionId = obj[CUSTOM_PROPS.REGION_ID];
        if (!regionId || obj.excludeFromExport || obj.isTransient || obj.isHelper) return;

        const region = regions.find(r => r.id === regionId);
        if (!region || !region.config) return;

        // Bölge piksel sınırları (config yüzde bazlı)
        const rx = (region.config.x / 100) * canvasW;
        const ry = (region.config.y / 100) * canvasH;
        const rw = (region.config.widthPercent / 100) * canvasW;
        const rh = (region.config.heightPercent / 100) * canvasH;

        // Sıfır bölünme koruması
        if (rw <= 0 || rh <= 0) return;

        // Fabric.js v7 center-origin: left/top obje merkezini gösterir
        // Bölge sol-üst köşesine göre % pozisyon
        obj[CUSTOM_PROPS.RELATIVE_LEFT] = parseFloat((((obj.left - rx) / rw) * 100).toFixed(4));
        obj[CUSTOM_PROPS.RELATIVE_TOP] = parseFloat((((obj.top - ry) / rh) * 100).toFixed(4));

        // Obje efektif boyutu (scale dahil) / bölge boyutu = %
        const effectiveW = (obj.width || 0) * (obj.scaleX || 1);
        const effectiveH = (obj.height || 0) * (obj.scaleY || 1);
        obj[CUSTOM_PROPS.RELATIVE_WIDTH] = parseFloat(((effectiveW / rw) * 100).toFixed(4));
        obj[CUSTOM_PROPS.RELATIVE_HEIGHT] = parseFloat(((effectiveH / rh) * 100).toFixed(4));
    }

    /**
     * Şablonu yükle
     * @param {Object|string} data - Şablon verisi, canvas JSON veya JSON string
     */
    async load(data) {
        if (!this.canvas) {
            throw new Error('Canvas not initialized');
        }

        let templateData = data;

        // String ise parse et
        if (typeof data === 'string') {
            templateData = JSON.parse(data);
        }

        // Content'i belirle - iki format destekleniyor:
        // 1. Doğrudan canvas JSON (objects dizisi içerir)
        // 2. Template objesi (content property içerir)
        let content;
        if (templateData.objects !== undefined) {
            // Doğrudan canvas JSON formatı (EditorWrapper'dan)
            content = templateData;
        } else if (templateData.content) {
            // Template objesi formatı
            content = templateData.content;
            if (typeof content === 'string') {
                content = JSON.parse(content);
            }

            // Metadata güncelle
            if (templateData.id) this._templateMeta.id = templateData.id;
            if (templateData.name) this._templateMeta.name = templateData.name;
            if (templateData.description) this._templateMeta.description = templateData.description;
            if (templateData.type) this._templateMeta.type = templateData.type;
            if (templateData.width) this._templateMeta.width = templateData.width;
            if (templateData.height) this._templateMeta.height = templateData.height;

            // Canvas boyutunu ayarla
            if (templateData.width && templateData.height) {
                this.setCanvasSize(templateData.width, templateData.height);
            }

        } else {
            console.warn('[TemplateEditorV7] Unknown data format, treating as canvas JSON');
            content = templateData;
        }

        // Legacy format kontrolü ve dönüştürme
        if (this.legacyAdapter && content) {
            const versionInfo = this.legacyAdapter.detectVersion(content);
            const version = templateData.version || versionInfo.version;

            if (version !== '7.0.0' && !version.startsWith('7.')) {
                content = this.legacyAdapter.convertCanvasJSON(content);
            }
        }

        // ==================== FIX: JSON'daki custom property'leri sakla ====================
        // Fabric.js v7 loadFromJSON, custom property'leri objelere ATAMIYOR.
        // JSON'daki orijinal obje property'lerini saklayıp load sonrası elle atayacağız.
        const originalJsonObjects = content?.objects ? [...content.objects] : [];
        // ==========================================================================================

        // Canvas'a yükle - Fabric.js 7: Promise tabanlı API
        return this.canvas.loadFromJSON(content).then(() => {
            // ==================== FIX: Custom property'leri JSON'dan restore et ====================
            // Fabric.js v7 fromObject() custom property'leri objeye atamıyor.
            // JSON'daki orijinal property'leri canvas objelerine elle ata.
            const canvasObjects = this.canvas.getObjects();
            if (originalJsonObjects.length > 0 && canvasObjects.length > 0) {
                const customPropKeys = [...SERIALIZABLE_PROPS];
                const len = Math.min(originalJsonObjects.length, canvasObjects.length);
                for (let i = 0; i < len; i++) {
                    const jsonObj = originalJsonObjects[i];
                    const fabricObj = canvasObjects[i];
                    if (!jsonObj || !fabricObj) continue;

                    customPropKeys.forEach(key => {
                        if (jsonObj[key] !== undefined && jsonObj[key] !== null) {
                            try {
                                fabricObj.set(key, jsonObj[key]);
                                fabricObj[key] = jsonObj[key]; // Direct property de set et
                            } catch (e) { /* ignore */ }
                        }
                    });

                    // Sub-objects (Group) için de aynısını yap
                    if (jsonObj.objects && fabricObj._objects) {
                        const subLen = Math.min(jsonObj.objects.length, fabricObj._objects.length);
                        for (let j = 0; j < subLen; j++) {
                            const jsonSub = jsonObj.objects[j];
                            const fabricSub = fabricObj._objects[j];
                            if (!jsonSub || !fabricSub) continue;

                            customPropKeys.forEach(key => {
                                if (jsonSub[key] !== undefined && jsonSub[key] !== null) {
                                    try {
                                        fabricSub.set(key, jsonSub[key]);
                                        fabricSub[key] = jsonSub[key];
                                    } catch (e) { /* ignore */ }
                                }
                            });
                        }
                    }
                }
                // Custom property restore tamamlandı
            }
            // ==========================================================================================

            // Legacy kayıtlarda Text olarak gelen dynamic/metin kutularını önce dönüştür.
            // Burada index eşleşmesi halen korunur (overlay temizliği yapılmadan önce).
            this._upgradeDynamicTextObjectsToTextbox(originalJsonObjects);

            // ==================== FIX: Yüklenen region overlay'leri temizle ====================
            // NOT: Multi-product-frame Group'ları (customType veya frameCols/frameRows ile tanınır)
            // excludeFromExport olsa bile korunmalı — onlar frame boyutunu tanımlar
            const objectsToRemove = this.canvas.getObjects().filter(obj => {
                // Multi-product-frame Group/Rect'lerini koru
                if (obj.customType === 'multi-product-frame' || obj.frameCols || obj.frameRows) {
                    return false;
                }
                // Fabric.js v7: obj.type = 'Group' (capitalized)
                if ((obj.type === 'group' || obj.type === 'Group') && (obj.customType === 'multi-product-frame' || obj.frameCols || obj.frameRows)) {
                    return false;
                }
                return obj.isRegionOverlay === true ||
                       obj.excludeFromExport === true ||
                       obj.isBackground === true;
            });

            if (objectsToRemove.length > 0) {
                objectsToRemove.forEach(obj => {
                    this.canvas.remove(obj);
                });
            }
            // =================================================================================

            // ==================== FIX: Eksik custom props'ları onar ====================
            // v7 bug döneminde kaydedilen şablonlarda dynamicField/isDataField
            // props eksik olabilir. Text içeriğine bakarak otomatik tamir et.
            this._repairDynamicFieldProps();
            // ===========================================================================

            // Eksik dynamic props onarımından sonra da Text -> Textbox yükseltmesini tekrar dene.
            this._upgradeDynamicTextObjectsToTextbox([]);

            // Metinlerde sol hizalama tutarlılığı için origin'i left/top'a normalize et.
            this._normalizeTextObjectOrigins();

            // ==================== FIX: Multi-product-frame Group props onar ===========
            // Fabric.js v7 loadFromJSON sonrası Group objelerin custom prop'ları
            // .set() ile değil plain property olarak gelir. Bunları .set() ile yeniden ata.
            this._repairMultiFrameProps();
            // ===========================================================================

            // ==================== Dinamik alan label'larını göster ====================
            // {{product_name}} gibi placeholder'ları "Ürün Adı" gibi okunabilir label'a çevir
            this._applyFieldDisplayLabels();
            // =========================================================================

            // Frame overlay'lerini target nesneleriyle yeniden bağla
            if (this.frameService) {
                this.frameService.reconnectFrames(this.canvas);
            }

            // Video placeholder overlay'lerini geri yükle
            this._restoreVideoOverlays();

            // Grid çizgilerini görünürlük state'i ile senkronize et
            // (loadFromJSON mevcut çizgileri silebilir).
            if (this.gridManager) {
                if (typeof this.gridManager.refreshGridVisibility === 'function') {
                    this.gridManager.refreshGridVisibility();
                } else if (this.gridManager.isGridVisible()) {
                    this.gridManager._removeGrid();
                    this.gridManager._createGrid();
                }
            }

            this.canvas.requestRenderAll();
            this._saveHistory();

            eventBus.emit(EVENTS.TEMPLATE_LOAD, {
                template: templateData
            });

            // Panels'leri güncelle
            if (this.layersPanel) {
                this.layersPanel.refresh();
            }

            return templateData;
        });
    }

    /**
     * Canvas'ı temizle
     */
    clear() {
        if (!this.canvas) return;

        this.canvas.clear();
        this.canvas.backgroundColor = this.options.backgroundColor;
        this.canvas.requestRenderAll();
        this._saveHistory();

        eventBus.emit(EVENTS.CANVAS_CLEAR);
    }

    /**
     * Canvas'ı görsel olarak export et
     * V7 için: Grid, overlay ve geçici nesneleri gizleyip, render tamamlandıktan sonra export yap
     * @param {Object} [options={}] - Export seçenekleri
     * @returns {string} - Data URL
     */
    exportAsImage(options = {}) {
        if (!this.canvas) {
            console.warn('[TemplateEditorV7] exportAsImage: Canvas yok');
            return '';
        }

        const {
            format = 'png',
            quality = 1,
            multiplier = 1
        } = options;

        // 1. Mevcut viewport transform'u sakla
        const originalViewport = this.canvas.viewportTransform ? [...this.canvas.viewportTransform] : [1, 0, 0, 1, 0, 0];
        const originalZoom = this.canvas.getZoom ? this.canvas.getZoom() : 1;

        // 2. Grid çizgilerini ve overlay'ları geçici olarak gizle
        const hiddenObjects = [];
        const allObjects = this.canvas.getObjects();

        allObjects.forEach(obj => {
            // Grid çizgilerini, overlay'ları, region indicator'ları ve geçici nesneleri gizle
            const customType = obj.customType || obj.get?.('customType');
            const shouldHide =
                obj.isGridLine ||
                obj.isGridBackground ||
                obj.isRegionOverlay ||
                obj.isRegionIndicator ||
                obj.isSmartGuide ||
                obj.excludeFromExport ||
                obj.isTransient ||
                obj.isHelper ||
                obj.isSlotDivider ||
                obj.isSlotLabel ||
                obj.isSlotBackground ||
                customType === 'grid-line' ||
                customType === 'region-overlay' ||
                customType === 'smart-guide' ||
                customType === 'slot-label' ||
                obj.name === 'grid' ||
                obj.name === 'gridLine' ||
                obj.name === 'regionOverlay';

            if (shouldHide && obj.visible !== false) {
                hiddenObjects.push({ obj, wasVisible: obj.visible });
                obj.visible = false;
            }

            // Group (multi-product-frame) içindeki slot arka plan objelerini de gizle
            // Fabric.js v7: obj.type = 'Group' (capitalized)
            if ((obj.type === 'group' || obj.type === 'Group') && obj._objects) {
                obj._objects.forEach(subObj => {
                    if ((subObj.isSlotBackground || subObj.excludeFromExport || subObj.isTransient) && subObj.visible !== false) {
                        hiddenObjects.push({ obj: subObj, wasVisible: subObj.visible });
                        subObj.visible = false;
                    }
                });
            }
        });

        // 3. Viewport'u sıfırla (zoom/pan etkisini kaldır) - V7 uyumlu
        if (this.canvas.setViewportTransform) {
            this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        } else {
            this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
        }

        // 4. Canvas'ı senkron olarak render et - V7'de requestRenderAll yerine renderAll
        this.canvas.calcOffset && this.canvas.calcOffset();
        this.canvas.renderAll();

        // V7'de render'ın tamamlanması için kısa bir gecikme
        // Bu, GPU'nun render işlemini tamamlamasını sağlar

        // 5. Export yap - V7 uyumlu - Manuel Canvas yaklaşımı
        let dataURL = '';
        try {
            // V7'de en güvenilir yöntem: Manuel canvas oluştur ve nesneleri çiz
            dataURL = this._exportViaManualCanvas(format, quality, multiplier);

            // Manuel yöntem başarısız olduysa Fabric.js toDataURL dene
            if (!dataURL || dataURL === 'data:,' || dataURL.length < 100) {
                // V7'de toDataURL seçenekleri
                const exportOptions = {
                    format: format === 'jpg' ? 'jpeg' : format,
                    quality,
                    multiplier,
                    enableRetinaScaling: false
                };

                // V7'de Fabric.js canvas üzerinden toDataURL çağır
                dataURL = this.canvas.toDataURL(exportOptions);
            }

            // Export sonucu kontrol et
            if (!dataURL || dataURL === 'data:,' || dataURL.length < 100) {
                // Alternatif: lowerCanvasEl üzerinden dene (V7 için)
                const lowerCanvas = this.canvas.lowerCanvasEl || this.canvas.getElement?.();
                if (lowerCanvas && lowerCanvas.toDataURL) {
                    dataURL = lowerCanvas.toDataURL(`image/${format}`, quality);
                }
            }
        } catch (error) {
            console.error('[TemplateEditorV7] exportAsImage hatası:', error);

            // Hata durumunda lowerCanvasEl dene
            try {
                const lowerCanvas = this.canvas.lowerCanvasEl || this.canvas.getElement?.();
                if (lowerCanvas && lowerCanvas.toDataURL) {
                    dataURL = lowerCanvas.toDataURL(`image/${format}`, quality);
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
     * Manuel canvas oluşturarak export
     * V7'de en güvenilir yöntem - lowerCanvasEl'i doğrudan kopyalar
     * @private
     */
    _exportViaManualCanvas(format = 'png', quality = 1, multiplier = 1) {
        try {
            const width = this.canvas.width;
            const height = this.canvas.height;

            // Yeni bir canvas oluştur
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = width * multiplier;
            exportCanvas.height = height * multiplier;
            const ctx = exportCanvas.getContext('2d');

            if (!ctx) {
                console.warn('[TemplateEditorV7] Canvas 2D context oluşturulamadı');
                return '';
            }

            // Multiplier için scale uygula
            if (multiplier !== 1) {
                ctx.scale(multiplier, multiplier);
            }

            // Arka plan rengini çiz
            const bgColor = this.canvas.backgroundColor || '#ffffff';
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);

            // Fabric canvas'ın lowerCanvasEl'inden görüntüyü kopyala
            const lowerCanvas = this.canvas.lowerCanvasEl;
            let hasContent = false;

            if (lowerCanvas && lowerCanvas.width > 0 && lowerCanvas.height > 0) {
                try {
                    ctx.drawImage(lowerCanvas, 0, 0, width, height);
                    hasContent = true;
                } catch (e) {
                    console.warn('[TemplateEditorV7] lowerCanvasEl kopyalanamadı:', e);
                }
            } else {
                console.warn('[TemplateEditorV7] lowerCanvasEl bulunamadı veya boş');
            }

            // lowerCanvasEl başarısız olduysa, nesneleri manuel çiz
            if (!hasContent) {
                const objects = this.canvas.getObjects();
                let drawnCount = 0;

                objects.forEach(obj => {
                    // Export'tan hariç tutulması gereken nesneleri atla
                    const customType = obj.customType || obj.get?.('customType');
                    const shouldExclude =
                        obj.isGridLine ||
                        obj.isGridBackground ||
                        obj.isRegionOverlay ||
                        obj.isRegionIndicator ||
                        obj.isSmartGuide ||
                        obj.excludeFromExport ||
                        obj.isTransient ||
                        obj.isHelper ||
                        obj.isSlotDivider ||
                        obj.isSlotLabel ||
                        obj.isSlotBackground ||
                        customType === 'grid-line' ||
                        customType === 'region-overlay' ||
                        customType === 'smart-guide' ||
                        customType === 'slot-label' ||
                        obj.name === 'grid' ||
                        obj.name === 'gridLine';

                    if (shouldExclude || obj.visible === false) {
                        return;
                    }

                    try {
                        // Nesne tipine göre çiz
                        ctx.save();

                        // Transform uygula
                        const angle = obj.angle || 0;
                        const left = obj.left || 0;
                        const top = obj.top || 0;
                        const scaleX = obj.scaleX || 1;
                        const scaleY = obj.scaleY || 1;

                        ctx.translate(left, top);
                        if (angle) {
                            ctx.rotate(angle * Math.PI / 180);
                        }
                        ctx.scale(scaleX, scaleY);

                        // Nesne tipine göre çizim
                        if (obj.type === 'rect' || obj.type === 'Rect') {
                            const w = obj.width || 0;
                            const h = obj.height || 0;
                            if (obj.fill) {
                                ctx.fillStyle = obj.fill;
                                ctx.fillRect(-w/2, -h/2, w, h);
                            }
                            if (obj.stroke) {
                                ctx.strokeStyle = obj.stroke;
                                ctx.lineWidth = obj.strokeWidth || 1;
                                ctx.strokeRect(-w/2, -h/2, w, h);
                            }
                            drawnCount++;
                        } else if (obj.type === 'text' || obj.type === 'Text' || obj.type === 'IText' || obj.type === 'Textbox' || obj.type === 'i-text' || obj.type === 'textbox') {
                            const text = obj.text || '';
                            const fontSize = obj.fontSize || 16;
                            const fontFamily = obj.fontFamily || 'Arial';
                            const fontWeight = obj.fontWeight || 'normal';
                            const fontStyle = obj.fontStyle || 'normal';

                            ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
                            ctx.fillStyle = obj.fill || '#000000';
                            ctx.textAlign = obj.textAlign || 'left';
                            ctx.textBaseline = 'top';
                            ctx.fillText(text, 0, 0);
                            drawnCount++;
                        } else if (obj.type === 'image' || obj.type === 'Image') {
                            // Image nesneleri için _element kullan
                            const imgElement = obj._element || obj.getElement?.();
                            if (imgElement) {
                                const w = obj.width || imgElement.width || 100;
                                const h = obj.height || imgElement.height || 100;
                                ctx.drawImage(imgElement, -w/2, -h/2, w, h);
                                drawnCount++;
                            }
                        } else if (obj.type === 'circle' || obj.type === 'Circle') {
                            const radius = obj.radius || 0;
                            ctx.beginPath();
                            ctx.arc(0, 0, radius, 0, Math.PI * 2);
                            if (obj.fill) {
                                ctx.fillStyle = obj.fill;
                                ctx.fill();
                            }
                            if (obj.stroke) {
                                ctx.strokeStyle = obj.stroke;
                                ctx.lineWidth = obj.strokeWidth || 1;
                                ctx.stroke();
                            }
                            drawnCount++;
                        } else if (obj.type === 'line' || obj.type === 'Line') {
                            const x1 = obj.x1 || 0;
                            const y1 = obj.y1 || 0;
                            const x2 = obj.x2 || 0;
                            const y2 = obj.y2 || 0;
                            ctx.beginPath();
                            ctx.moveTo(x1, y1);
                            ctx.lineTo(x2, y2);
                            ctx.strokeStyle = obj.stroke || '#000000';
                            ctx.lineWidth = obj.strokeWidth || 1;
                            ctx.stroke();
                            drawnCount++;
                        }

                        ctx.restore();
                    } catch (objError) {
                        console.warn('[TemplateEditorV7] Nesne çizilemedi:', obj.type, objError);
                    }
                });

            }

            // Data URL olarak export et
            const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
            const dataURL = exportCanvas.toDataURL(mimeType, quality);

            // Temizle
            exportCanvas.width = 0;
            exportCanvas.height = 0;

            return dataURL;
        } catch (error) {
            console.error('[TemplateEditorV7] Manuel canvas export hatası:', error);
            return '';
        }
    }

    /**
     * StaticCanvas kullanarak alternatif export
     * V7'de ana canvas export başarısız olursa kullanılır
     * @private
     * @deprecated _exportViaManualCanvas kullanılmalı
     */
    _exportViaStaticCanvas(format = 'png', quality = 1, multiplier = 1) {
        // V7'de StaticCanvas sorunlu olduğu için manuel canvas yöntemini kullan
        return this._exportViaManualCanvas(format, quality, multiplier);
    }

    /**
     * Canvas verilerini JSON olarak al (alias for compatibility)
     * @returns {Object} - Canvas JSON
     */
    toJSON() {
        if (!this.canvas) return {};

        // Fabric.js v7 Group.toObject() workaround: excludeFromExport geçici kaldır
        const restoreList = [];
        this.canvas.getObjects().forEach(obj => {
            const isMultiFrame = obj.customType === 'multi-product-frame' || (obj.frameCols && obj.frameRows);
            if (isMultiFrame && obj._objects && obj._objects.length > 0) {
                obj._objects.forEach(subObj => {
                    if (subObj.excludeFromExport) {
                        restoreList.push(subObj);
                        subObj.excludeFromExport = false;
                    }
                });
            }
        });

        const json = this.canvas.toJSON([
            ...SERIALIZABLE_PROPS,
            'id',
            'name',
            'excludeFromExport',
            'isRegionOverlay',
            'isBackground',
            'isTransient',
            'isHelper'
        ]);

        // Restore excludeFromExport flags
        restoreList.forEach(subObj => {
            subObj.excludeFromExport = true;
        });

        // Dinamik alan label'larını placeholder'a çevir (kayıtta {{fieldKey}} olmalı)
        if (json.objects) {
            json.objects.forEach(obj => {
                if (!(obj[CUSTOM_PROPS.IS_DATA_FIELD] && obj[CUSTOM_PROPS.DYNAMIC_FIELD] && obj[CUSTOM_PROPS.PLACEHOLDER])) {
                    return;
                }
                const fieldKey = String(obj[CUSTOM_PROPS.DYNAMIC_FIELD] || '').trim();
                const placeholderText = String(obj[CUSTOM_PROPS.PLACEHOLDER] || '').trim();
                const currentText = String(obj.text || '').trim();
                const autoLabel = fieldKey ? String(this._getFieldLabel(fieldKey) || '').trim() : '';
                const isPlaceholderText = /^\{\{\s*[^}]+\s*\}\}$/.test(currentText);
                const isAutoGeneratedLabel = !!autoLabel && currentText === autoLabel;
                if (isPlaceholderText || isAutoGeneratedLabel || !currentText) {
                    obj.text = placeholderText;
                }
            });
        }

        return json;
    }

    /**
     * Canvas'ı data URL olarak export et (alias for compatibility)
     * @param {Object} [options={}] - Export seçenekleri
     * @returns {string} - Data URL
     */
    toDataURL(options = {}) {
        return this.exportAsImage(options);
    }

    /**
     * Canvas'ı SVG olarak export et
     * @returns {string} - SVG string
     */
    exportAsSVG() {
        return this.canvas.toSVG();
    }

    // ==========================================
    // TEMPLATE METADATA
    // ==========================================

    /**
     * Template metadata'yı güncelle
     * @param {Object} meta - Yeni metadata
     */
    setTemplateMeta(meta) {
        this._templateMeta = { ...this._templateMeta, ...meta };
    }

    /**
     * Template metadata'yı al
     * @returns {Object}
     */
    getTemplateMeta() {
        return { ...this._templateMeta };
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    /**
     * Canvas nesnesine erişim
     * @returns {fabric.Canvas|null}
     */
    getCanvas() {
        return this.canvas;
    }

    /**
     * Object Factory'ye erişim
     * @returns {ObjectFactory|null}
     */
    getObjectFactory() {
        return this.objectFactory;
    }

    /**
     * Canvas'taki tüm nesneleri al
     * @returns {Array<fabric.Object>}
     */
    getObjects() {
        return this.canvas?.getObjects() || [];
    }

    /**
     * ID'ye göre nesne bul
     * @param {string} id - Nesne ID'si
     * @returns {fabric.Object|null}
     */
    getObjectById(id) {
        return this.getObjects().find(obj => obj.id === id) || null;
    }

    /**
     * Dinamik alana göre nesneleri bul
     * @param {string} fieldKey - Alan anahtarı
     * @returns {Array<fabric.Object>}
     */
    getObjectsByDynamicField(fieldKey) {
        return this.getObjects().filter(
            obj => obj[CUSTOM_PROPS.DYNAMIC_FIELD] === fieldKey
        );
    }

    // ==========================================
    // REGION/LAYOUT CALLBACKS
    // ==========================================

    /**
     * Region seçildiğinde çağrılır
     * @private
     * @param {Object} region - Seçilen region
     */
    _onRegionSelect(region) {
        this._activeRegion = region;

        // Region info elementini güncelle (varsa)
        const regionInfo = this.container?.querySelector('#active-region-info');
        if (regionInfo && region) {
            const regionName = this._i18n?.(`editor.regions.${region.id}`) || region.id;
            regionInfo.innerHTML = `
                <i class="ti ti-layout-grid"></i>
                ${this._i18n?.('editor.regions.regionLabel') || 'Bölge'}: ${regionName}
            `;
        }

        eventBus.emit(EVENTS.LAYOUT_CHANGE, { region, regionId: region?.id });
    }

    /**
     * Layout değiştiğinde çağrılır
     * @private
     * @param {string} layoutId - Layout ID
     * @param {Object} layout - Layout objesi
     */
    _onLayoutChange(layoutId, layout) {
        this._currentLayoutId = layoutId;

        // Grid layout selector'ı güncelle (aktif class)
        const layoutButtons = this.container?.querySelectorAll('[data-grid-layout]');
        layoutButtons?.forEach(btn => {
            if (btn.dataset.gridLayout === layoutId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        eventBus.emit(EVENTS.LAYOUT_CHANGED, { layoutId, layout });
    }

    /**
     * Aktif region'ı getir
     * @returns {Object|null}
     */
    getActiveRegion() {
        return this._activeRegion || this.gridManager?.getActiveRegion() || null;
    }

    /**
     * Mevcut layout ID'sini getir
     * @returns {string}
     */
    getCurrentLayoutId() {
        return this._currentLayoutId || this.gridManager?.getCurrentLayoutId() || 'single';
    }

    // ==========================================
    // CLEANUP
    // ==========================================

    /**
     * Editor'ü dispose et
     */
    dispose() {
        this._closeEditorModals();

        // Event subscriptions temizle
        this._subscriptions.forEach(unsub => {
            if (typeof unsub === 'function') unsub();
        });
        this._subscriptions = [];

        // Keyboard handler kaldır
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
            this._keydownHandler = null;
        }

        // Active region referansını temizle
        this._activeRegion = null;
        this._currentLayoutId = null;

        // Managers dispose
        this.selectionManager?.dispose();
        this.historyManager?.dispose();
        this.clipboardManager?.dispose();
        this.gridManager?.dispose();

        // Frame service dispose
        this.frameService?.dispose();

        // Panels dispose
        this.propertyPanel?.dispose();
        this.layersPanel?.dispose();
        this.dynamicFieldsPanel?.dispose();

        // Inspector panels dispose
        this._inspectorPropertyPanel?.dispose();
        this._inspectorLayersPanel?.dispose();

        // Canvas Manager dispose
        this.canvasManager?.dispose();

        // Referansları temizle
        this.canvas = null;
        this.canvasManager = null;
        this.objectFactory = null;
        this.selectionManager = null;
        this.historyManager = null;
        this.clipboardManager = null;
        this.gridManager = null;
        this.propertyPanel = null;
        this.layersPanel = null;
        this.dynamicFieldsPanel = null;
        this._inspectorPropertyPanel = null;
        this._inspectorLayersPanel = null;
        this._inspectorPanel = null;
        this.legacyAdapter = null;
        this.container = null;

        this._initialized = false;

        eventBus.emit(EVENTS.EDITOR_DISPOSE);
    }

    /**
     * Wrapper/legacy uyumluluğu için destroy alias
     */
    destroy() {
        this.dispose();
    }

    /**
     * Video placeholder üzerine play ikonu ve VIDEO yazısı ekle (görsel overlay)
     * Bu objeler transient (geçici) - kaydedilmez, sadece editörde görsel amaçlı
     * @param {Object} videoRect - Video placeholder Rect objesi
     * @param {string} fieldKey - 'video_url' veya 'videos'
     * @private
     */
    /**
     * Eski şablonlardaki tek rect video placeholder'ı Group'a dönüştür
     * @param {Object} videoRect - Video placeholder Rect objesi
     * @param {string} fieldKey - 'video_url' veya 'videos'
     * @private
     */
    _convertVideoRectToGroup(videoRect, fieldKey) {
        if (!this.canvas || !videoRect) return;

        const w = videoRect.width * (videoRect.scaleX || 1);
        const h = videoRect.height * (videoRect.scaleY || 1);
        const cx = videoRect.left;
        const cy = videoRect.top;

        // Eski rect'i kaldır
        this.canvas.remove(videoRect);

        // Yeni arkaplan rect
        const bgRect = new Rect({
            width: w,
            height: h,
            fill: videoRect.fill || '#1a1a2e',
            stroke: videoRect.stroke || '#e94560',
            strokeWidth: videoRect.strokeWidth || 3,
            strokeDashArray: videoRect.strokeDashArray || [10, 5],
            rx: videoRect.rx || 4,
            ry: videoRect.ry || 4,
            originX: 'center',
            originY: 'center',
            left: 0,
            top: 0
        });

        // Play üçgeni
        const playSize = Math.min(w, h) * 0.2;
        const playIcon = new Triangle({
            width: playSize,
            height: playSize,
            fill: 'rgba(255,255,255,0.7)',
            angle: 90,
            originX: 'center',
            originY: 'center',
            left: 0,
            top: -h * 0.05,
            selectable: false,
            evented: false
        });

        // VIDEO yazısı
        const labelText = new FabricText(fieldKey === 'videos' ? '▶ VIDEOS' : '▶ VIDEO', {
            fontSize: Math.max(14, Math.round(h * 0.07)),
            fontFamily: 'Arial',
            fontWeight: 'bold',
            fill: 'rgba(255,255,255,0.5)',
            originX: 'center',
            originY: 'center',
            left: 0,
            top: h * 0.3,
            selectable: false,
            evented: false
        });

        const videoGroup = new Group([bgRect, playIcon, labelText], {
            originX: 'center',
            originY: 'center',
            left: cx,
            top: cy
        });

        // v7 constructor prop'ları set etmeyebilir, .set() ile garanti et
        videoGroup.set('subTargetCheck', false);
        videoGroup.set('interactive', false);
        videoGroup.getObjects().forEach(child => {
            child.set('selectable', false);
            child.set('evented', false);
        });

        // Eski rect'ten custom prop'ları aktar
        this.objectFactory._applyBaseProperties(videoGroup, CUSTOM_TYPES.VIDEO_PLACEHOLDER, {
            [CUSTOM_PROPS.IS_DATA_FIELD]: true,
            [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey,
            [CUSTOM_PROPS.IS_VIDEO_PLACEHOLDER]: true,
            [CUSTOM_PROPS.IS_MULTIPLE_VIDEOS]: fieldKey === 'videos',
            [CUSTOM_PROPS.PLACEHOLDER]: fieldKey === 'videos' ? '{Videos}' : '{Video}'
        });

        this.canvas.add(videoGroup);
        this.canvas.requestRenderAll();
    }

    /**
     * Yüklenen şablondaki eski rect-based video placeholder'ları Group'a dönüştür
     * Yeni Group-based olanlar zaten doğru formatta yüklenir
     * @private
     */
    _restoreVideoOverlays() {
        if (!this.canvas) return;
        const objects = [...this.canvas.getObjects()];

        // 1. Eski ayrı overlay nesnelerini temizle (v7 constructor bug'ı nedeniyle kaydedilmiş olabilirler)
        const overlaysToRemove = [];
        for (const obj of objects) {
            // Eski overlay: _videoOverlayFor prop'u olan veya isTransient/isHelper ile işaretli Triangle/Text
            if (obj._videoOverlayFor ||
                ((obj.isTransient || obj.isHelper || obj[CUSTOM_PROPS.IS_TRANSIENT] || obj[CUSTOM_PROPS.IS_HELPER]) &&
                 (obj.type === 'triangle' || obj.type === 'Triangle' || obj.type === 'text' || obj.type === 'Text'))) {
                overlaysToRemove.push(obj);
            }
        }
        overlaysToRemove.forEach(obj => this.canvas.remove(obj));

        // 2. Eski rect-based video placeholder'ları Group'a dönüştür
        const currentObjects = [...this.canvas.getObjects()];
        for (const obj of currentObjects) {
            const isVideoPlaceholder = obj[CUSTOM_PROPS.IS_VIDEO_PLACEHOLDER] ||
                obj[CUSTOM_PROPS.CUSTOM_TYPE] === CUSTOM_TYPES.VIDEO_PLACEHOLDER;
            if (!isVideoPlaceholder) continue;

            // Zaten Group ise subTargetCheck/interactive kontrolü yap, dönüştürme gerekmez
            if (obj.type === 'group' || obj.type === 'Group') {
                obj.set('subTargetCheck', false);
                obj.set('interactive', false);
                if (obj.getObjects) {
                    obj.getObjects().forEach(child => {
                        child.set('selectable', false);
                        child.set('evented', false);
                    });
                }
                continue;
            }

            // Eski rect-based placeholder → Group'a dönüştür
            const fieldKey = obj[CUSTOM_PROPS.DYNAMIC_FIELD] || 'video_url';
            this._convertVideoRectToGroup(obj, fieldKey);
        }
    }

    // ==========================================
    // DOUBLE-CLICK EDIT MODALS
    // ==========================================

    _isEditorModalOpen() {
        if (typeof document === 'undefined') return false;
        return !!document.querySelector('.editor-modal-overlay[data-editor-owner="template-editor-v7"]');
    }

    _closeEditorModals() {
        if (typeof document === 'undefined') return;
        document
            .querySelectorAll('.editor-modal-overlay[data-editor-owner="template-editor-v7"]')
            .forEach((node) => node.remove());
    }

    /**
     * Objeye çift tıklandığında uygun düzenleme modalını aç
     * @private
     * @param {Object} target - Fabric.js objesi
     */
    _handleObjectDblClick(target) {
        if (!target) return;
        const now = Date.now();
        if (this._lastObjectDblClickTarget === target && (now - this._lastObjectDblClickAt) < 280) {
            return;
        }
        this._lastObjectDblClickTarget = target;
        this._lastObjectDblClickAt = now;
        if (this._isEditorModalOpen()) return;

        const customType = target[CUSTOM_PROPS.CUSTOM_TYPE] || target.customType || '';

        switch (customType) {
            case 'barcode':
            case CUSTOM_TYPES.BARCODE:
                this._showBarcodeEditModal(target);
                break;

            case 'qrcode':
            case CUSTOM_TYPES.QRCODE:
                this._showQRCodeEditModal(target);
                break;

            case 'image-placeholder':
                if (target.slotId && target.inMultiFrame) {
                    eventBus.emit(EVENTS.PROPERTY_REPLACE_IMAGE, { object: target, source: 'dblclick' });
                } else {
                    this._showImageReplaceDialog(target);
                }
                break;

            case 'slot-image':
            case 'slot-media':
                eventBus.emit(EVENTS.PROPERTY_REPLACE_IMAGE, { object: target, source: 'dblclick' });
                break;

            default:
                // Normal image (medya kütüphanesinden veya dosyadan eklenen)
                if ((target.type === 'image' || target.type === 'Image') && !target[CUSTOM_PROPS.IS_VIDEO_PLACEHOLDER]) {
                    if (target.slotId && target.inMultiFrame) {
                        eventBus.emit(EVENTS.PROPERTY_REPLACE_IMAGE, { object: target, source: 'dblclick' });
                    } else {
                        this._showImageReplaceDialog(target);
                    }
                }
                break;
        }
    }

    /**
     * Barkod düzenleme modalı
     * @private
     * @param {Object} obj - Fabric.js barkod objesi
     */
    _showBarcodeEditModal(obj) {
        if (this._isEditorModalOpen()) return;
        const currentValue = obj[CUSTOM_PROPS.BARCODE_VALUE] || obj.barcodeValue || '8690000000001';
        const currentFormat = obj[CUSTOM_PROPS.BARCODE_FORMAT] || obj.barcodeFormat || 'EAN13';
        const isAutoDetect = currentFormat === 'AUTO' || !!(obj[CUSTOM_PROPS.BARCODE_AUTO_DETECT] || obj.barcodeAutoDetect);
        const currentDisplayValue = obj[CUSTOM_PROPS.BARCODE_DISPLAY_VALUE] !== false;
        const currentLineWidth = obj[CUSTOM_PROPS.BARCODE_LINE_WIDTH] || 2;
        const currentHeight = obj[CUSTOM_PROPS.BARCODE_HEIGHT] || 80;
        const currentBg = obj[CUSTOM_PROPS.BARCODE_BACKGROUND] || '#ffffff';
        const currentLineColor = obj[CUSTOM_PROPS.BARCODE_LINE_COLOR] || '#000000';
        const dynamicField = obj[CUSTOM_PROPS.DYNAMIC_FIELD] || '';

        // Modal overlay oluştur
        const overlay = document.createElement('div');
        overlay.className = 'editor-modal-overlay';
        overlay.setAttribute('data-editor-owner', 'template-editor-v7');
        overlay.setAttribute('data-editor-modal', 'barcode');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

        const previewFormat = isAutoDetect ? 'CODE128' : currentFormat;
        const formatOptions = [
            ...(isAutoDetect ? ['AUTO'] : []),
            'EAN13', 'EAN8', 'CODE128', 'CODE39', 'UPC', 'UPCE', 'ITF14'
        ].map(f => {
            const label = f === 'AUTO' ? 'Otomatik Algıla' : f;
            const selected = (isAutoDetect && f === 'AUTO') || (!isAutoDetect && f === currentFormat);
            return `<option value="${f}" ${selected ? 'selected' : ''}>${label}</option>`;
        }).join('');

        overlay.innerHTML = `
            <div class="editor-modal" style="background:#fff;border-radius:12px;padding:24px;width:420px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                    <h3 style="margin:0;font-size:18px;font-weight:600;"><i class="ti ti-barcode" style="margin-right:8px;"></i>Barkod Düzenle</h3>
                    <button class="modal-close-btn" style="background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px;"><i class="ti ti-x"></i></button>
                </div>

                ${dynamicField ? `<div style="background:#e7f5ff;border:1px solid #a5d8ff;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#1971c2;">
                    <i class="ti ti-link" style="margin-right:6px;"></i>Dinamik alan: <strong>{{${dynamicField}}}</strong>
                    <div style="color:#666;margin-top:4px;font-size:12px;">Baskıda ürün verisi ile değiştirilir. Aşağıdaki değer sadece önizleme içindir.</div>
                </div>` : ''}

                <div style="margin-bottom:14px;">
                    <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:#495057;">Barkod Değeri</label>
                    <input type="text" id="bc-edit-value" value="${currentValue}" style="width:100%;padding:8px 12px;border:1px solid #dee2e6;border-radius:6px;font-size:14px;box-sizing:border-box;" placeholder="Barkod numarası">
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                    <div>
                        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:#495057;">Format</label>
                        <select id="bc-edit-format" style="width:100%;padding:8px 12px;border:1px solid #dee2e6;border-radius:6px;font-size:14px;box-sizing:border-box;">
                            ${formatOptions}
                        </select>
                    </div>
                    <div>
                        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:#495057;">Yükseklik</label>
                        <input type="number" id="bc-edit-height" value="${currentHeight}" min="20" max="200" style="width:100%;padding:8px 12px;border:1px solid #dee2e6;border-radius:6px;font-size:14px;box-sizing:border-box;">
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                    <div>
                        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:#495057;">Çizgi Genişliği</label>
                        <input type="number" id="bc-edit-linewidth" value="${currentLineWidth}" min="1" max="5" step="0.5" style="width:100%;padding:8px 12px;border:1px solid #dee2e6;border-radius:6px;font-size:14px;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:#495057;">Değer Göster</label>
                        <select id="bc-edit-displayvalue" style="width:100%;padding:8px 12px;border:1px solid #dee2e6;border-radius:6px;font-size:14px;box-sizing:border-box;">
                            <option value="true" ${currentDisplayValue ? 'selected' : ''}>Evet</option>
                            <option value="false" ${!currentDisplayValue ? 'selected' : ''}>Hayır</option>
                        </select>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
                    <div>
                        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:#495057;">Çizgi Rengi</label>
                        <input type="color" id="bc-edit-linecolor" value="${currentLineColor}" style="width:100%;height:38px;border:1px solid #dee2e6;border-radius:6px;cursor:pointer;padding:2px;">
                        <input type="text" id="bc-edit-linecolor-hex" value="${currentLineColor}" style="margin-top:6px;width:100%;padding:8px 10px;border:1px solid #dee2e6;border-radius:6px;font-size:13px;box-sizing:border-box;font-family:ui-monospace,Consolas,monospace;text-transform:uppercase;" placeholder="#000000" maxlength="7" spellcheck="false" autocomplete="off">
                    </div>
                    <div>
                        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:#495057;">Arka Plan</label>
                        <input type="color" id="bc-edit-bg" value="${currentBg}" style="width:100%;height:38px;border:1px solid #dee2e6;border-radius:6px;cursor:pointer;padding:2px;">
                        <input type="text" id="bc-edit-bg-hex" value="${currentBg}" style="margin-top:6px;width:100%;padding:8px 10px;border:1px solid #dee2e6;border-radius:6px;font-size:13px;box-sizing:border-box;font-family:ui-monospace,Consolas,monospace;text-transform:uppercase;" placeholder="#000000" maxlength="7" spellcheck="false" autocomplete="off">
                    </div>
                </div>

                <div id="bc-edit-preview" style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:16px;text-align:center;margin-bottom:20px;min-height:80px;">
                    <svg id="bc-edit-preview-svg"></svg>
                </div>

                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button id="bc-edit-cancel" style="padding:8px 20px;border:1px solid #dee2e6;border-radius:6px;background:#fff;cursor:pointer;font-size:14px;color:#495057;">İptal</button>
                    <button id="bc-edit-apply" style="padding:8px 20px;border:none;border-radius:6px;background:#228be6;color:#fff;cursor:pointer;font-size:14px;font-weight:500;">Uygula</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Önizleme güncelle
        const updatePreview = () => {
            const val = overlay.querySelector('#bc-edit-value').value;
            let fmt = overlay.querySelector('#bc-edit-format').value;
            const svg = overlay.querySelector('#bc-edit-preview-svg');
            const h = parseInt(overlay.querySelector('#bc-edit-height').value) || 80;
            const lw = parseFloat(overlay.querySelector('#bc-edit-linewidth').value) || 2;
            const dv = overlay.querySelector('#bc-edit-displayvalue').value === 'true';
            const lc = overlay.querySelector('#bc-edit-linecolor').value;
            const bg = overlay.querySelector('#bc-edit-bg').value;

            // AUTO format: Önizleme için CODE128 kullan
            const renderFmt = fmt === 'AUTO' ? 'CODE128' : fmt;
            try {
                JsBarcode(svg, val, { format: renderFmt, width: lw, height: h, displayValue: dv, lineColor: lc, background: bg, margin: 10, fontSize: 14 });
            } catch (e) {
                try { JsBarcode(svg, val, { format: 'CODE128', width: lw, height: h, displayValue: dv, lineColor: lc, background: bg, margin: 10 }); } catch (e2) {
                    svg.innerHTML = '<text x="10" y="30" fill="red" font-size="12">Geçersiz barkod değeri</text>';
                }
            }
        };
        updatePreview();

        const normalizeHex = (value, fallback = '#000000') => {
            const raw = String(value || '').trim();
            if (!raw) return fallback.toUpperCase();
            const prefixed = raw.startsWith('#') ? raw : `#${raw}`;
            if (/^#[0-9a-fA-F]{3}$/.test(prefixed)) {
                return `#${prefixed[1]}${prefixed[1]}${prefixed[2]}${prefixed[2]}${prefixed[3]}${prefixed[3]}`.toUpperCase();
            }
            if (/^#[0-9a-fA-F]{6}$/.test(prefixed)) {
                return prefixed.toUpperCase();
            }
            return fallback.toUpperCase();
        };

        const bindColorHexPair = (colorId, hexId) => {
            const colorInput = overlay.querySelector(`#${colorId}`);
            const hexInput = overlay.querySelector(`#${hexId}`);
            if (!colorInput || !hexInput) return;

            const syncHex = () => {
                hexInput.value = normalizeHex(colorInput.value, '#000000');
            };
            syncHex();

            colorInput.addEventListener('input', () => {
                syncHex();
                updatePreview();
            });

            hexInput.addEventListener('input', () => {
                let next = hexInput.value.trim().toUpperCase();
                if (next && !next.startsWith('#')) {
                    next = `#${next}`;
                }
                if (!/^#[0-9A-F]{0,6}$/.test(next)) return;
                hexInput.value = next;
                if (/^#[0-9A-F]{6}$/.test(next)) {
                    colorInput.value = next;
                    updatePreview();
                }
            });

            hexInput.addEventListener('blur', () => {
                const normalized = normalizeHex(hexInput.value, colorInput.value || '#000000');
                hexInput.value = normalized;
                colorInput.value = normalized;
            });
        };

        bindColorHexPair('bc-edit-linecolor', 'bc-edit-linecolor-hex');
        bindColorHexPair('bc-edit-bg', 'bc-edit-bg-hex');

        // Event'ler
        overlay.querySelector('#bc-edit-value').addEventListener('input', updatePreview);
        overlay.querySelector('#bc-edit-format').addEventListener('change', updatePreview);
        overlay.querySelector('#bc-edit-height').addEventListener('input', updatePreview);
        overlay.querySelector('#bc-edit-linewidth').addEventListener('input', updatePreview);
        overlay.querySelector('#bc-edit-displayvalue').addEventListener('change', updatePreview);
        // Renk alanlari bindColorHexPair icinde updatePreview ile baglandi.

        const close = () => overlay.remove();
        overlay.querySelector('.modal-close-btn').addEventListener('click', close);
        overlay.querySelector('#bc-edit-cancel').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        // Uygula
        overlay.querySelector('#bc-edit-apply').addEventListener('click', async () => {
            const newValue = overlay.querySelector('#bc-edit-value').value.trim();
            const newFormat = overlay.querySelector('#bc-edit-format').value;
            const newIsAutoDetect = newFormat === 'AUTO';
            const newHeight = parseInt(overlay.querySelector('#bc-edit-height').value) || 80;
            const newLineWidth = parseFloat(overlay.querySelector('#bc-edit-linewidth').value) || 2;
            const newDisplayValue = overlay.querySelector('#bc-edit-displayvalue').value === 'true';
            const newLineColor = overlay.querySelector('#bc-edit-linecolor').value;
            const newBg = overlay.querySelector('#bc-edit-bg').value;

            if (!newValue) return;

            // Eski barkodun pozisyonunu kaydet
            const oldLeft = obj.left;
            const oldTop = obj.top;
            const oldScaleX = obj.scaleX;
            const oldScaleY = obj.scaleY;
            const oldAngle = obj.angle;

            // Eski objeyi sil
            this.canvas.remove(obj);

            // Yeni barkod oluştur - AUTO ise CODE128 ile render et ama AUTO flag'i kaydet
            try {
                const newObj = await this.objectFactory.createBarcode(newValue, {
                    format: newIsAutoDetect ? 'CODE128' : newFormat,
                    lineWidth: newLineWidth,
                    barcodeHeight: newHeight,
                    displayValue: newDisplayValue,
                    background: newBg,
                    lineColor: newLineColor,
                    left: oldLeft,
                    top: oldTop,
                    scaleX: oldScaleX,
                    scaleY: oldScaleY,
                    barcodeAutoDetect: newIsAutoDetect,
                    [CUSTOM_PROPS.IS_DATA_FIELD]: obj[CUSTOM_PROPS.IS_DATA_FIELD] || false,
                    [CUSTOM_PROPS.DYNAMIC_FIELD]: dynamicField
                });

                if (newObj) {
                    newObj.set({ angle: oldAngle });
                    this.canvas.setActiveObject(newObj);
                    this.canvas.requestRenderAll();
                    this._saveHistory();
                }
            } catch (err) {
                console.error('Barkod güncellenemedi:', err);
            }

            close();
        });
    }

    /**
     * QR Kod düzenleme modalı
     * @private
     * @param {Object} obj - Fabric.js QR kod objesi
     */
    _showQRCodeEditModal(obj) {
        if (this._isEditorModalOpen()) return;
        const currentValue = obj[CUSTOM_PROPS.QR_VALUE] || obj.qrValue || 'https://example.com';
        const dynamicField = obj[CUSTOM_PROPS.DYNAMIC_FIELD] || '';

        const overlay = document.createElement('div');
        overlay.className = 'editor-modal-overlay';
        overlay.setAttribute('data-editor-owner', 'template-editor-v7');
        overlay.setAttribute('data-editor-modal', 'qrcode');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

        overlay.innerHTML = `
            <div class="editor-modal" style="background:#fff;border-radius:12px;padding:24px;width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                    <h3 style="margin:0;font-size:18px;font-weight:600;"><i class="ti ti-qrcode" style="margin-right:8px;"></i>QR Kod Düzenle</h3>
                    <button class="modal-close-btn" style="background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px;"><i class="ti ti-x"></i></button>
                </div>

                ${dynamicField ? `<div style="background:#e7f5ff;border:1px solid #a5d8ff;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#1971c2;">
                    <i class="ti ti-link" style="margin-right:6px;"></i>Dinamik alan: <strong>{{${dynamicField}}}</strong>
                </div>` : ''}

                <div style="margin-bottom:20px;">
                    <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:#495057;">QR Kod Değeri</label>
                    <input type="text" id="qr-edit-value" value="${currentValue}" style="width:100%;padding:8px 12px;border:1px solid #dee2e6;border-radius:6px;font-size:14px;box-sizing:border-box;" placeholder="URL veya metin">
                </div>

                <div id="qr-edit-preview" style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:16px;text-align:center;margin-bottom:20px;min-height:120px;"></div>

                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button id="qr-edit-cancel" style="padding:8px 20px;border:1px solid #dee2e6;border-radius:6px;background:#fff;cursor:pointer;font-size:14px;color:#495057;">İptal</button>
                    <button id="qr-edit-apply" style="padding:8px 20px;border:none;border-radius:6px;background:#228be6;color:#fff;cursor:pointer;font-size:14px;font-weight:500;">Uygula</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // QR önizleme
        const updateQRPreview = () => {
            const val = overlay.querySelector('#qr-edit-value').value;
            const container = overlay.querySelector('#qr-edit-preview');
            container.innerHTML = '';
            if (val && typeof QRCode !== 'undefined') {
                try {
                    const qrDiv = document.createElement('div');
                    qrDiv.style.display = 'inline-block';
                    container.appendChild(qrDiv);
                    new QRCode(qrDiv, { text: val, width: 120, height: 120, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.M });
                } catch (e) {
                    container.innerHTML = '<span style="color:#999;font-size:13px;">Önizleme yüklenemedi</span>';
                }
            }
        };
        updateQRPreview();

        overlay.querySelector('#qr-edit-value').addEventListener('input', updateQRPreview);

        const close = () => overlay.remove();
        overlay.querySelector('.modal-close-btn').addEventListener('click', close);
        overlay.querySelector('#qr-edit-cancel').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        overlay.querySelector('#qr-edit-apply').addEventListener('click', async () => {
            const newValue = overlay.querySelector('#qr-edit-value').value.trim();
            if (!newValue) return;

            const oldLeft = obj.left;
            const oldTop = obj.top;
            const oldScaleX = obj.scaleX;
            const oldScaleY = obj.scaleY;
            const oldAngle = obj.angle;
            const oldFrameId = obj[CUSTOM_PROPS.FRAME_ID] || null;
            const frameService = this.frameService;

            if (frameService?.hasFrame(obj)) {
                frameService.removeFrame(obj, this.canvas);
            }

            this.canvas.remove(obj);

            try {
                const newObj = await this.objectFactory.createQRCode(newValue, {
                    width: obj.width || 100,
                    height: obj.height || 100,
                    left: oldLeft,
                    top: oldTop,
                    scaleX: oldScaleX,
                    scaleY: oldScaleY,
                    [CUSTOM_PROPS.IS_DATA_FIELD]: obj[CUSTOM_PROPS.IS_DATA_FIELD] || false,
                    [CUSTOM_PROPS.DYNAMIC_FIELD]: dynamicField
                });
                if (newObj) {
                    newObj.set({ angle: oldAngle });
                    this.canvas.setActiveObject(newObj);
                    if (oldFrameId && frameService) {
                        try {
                            const { getFrameById } = await import('./data/FrameAssetsData.js');
                            const frameDef = getFrameById(oldFrameId);
                            if (frameDef) {
                                await frameService.applyFrame(newObj, frameDef, this.canvas);
                            }
                        } catch (frameErr) {
                            console.warn('[TemplateEditorV7] Image replace frame reapply failed:', frameErr);
                        }
                    }
                    this.canvas.requestRenderAll();
                    this._saveHistory();
                }
            } catch (err) {
                console.error('QR kod güncellenemedi:', err);
            }
            close();
        });
    }

    /**
     * Görsel değiştirme diyalogu (image ve image-placeholder için)
     * @private
     * @param {Object} obj - Fabric.js image objesi
     */
    _showImageReplaceDialog(obj) {
        if (this._isEditorModalOpen()) return;
        const dynamicField = obj[CUSTOM_PROPS.DYNAMIC_FIELD] || '';
        const isPlaceholder = obj[CUSTOM_PROPS.CUSTOM_TYPE] === 'image-placeholder';

        const overlay = document.createElement('div');
        overlay.className = 'editor-modal-overlay';
        overlay.setAttribute('data-editor-owner', 'template-editor-v7');
        overlay.setAttribute('data-editor-modal', 'image');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

        overlay.innerHTML = `
            <div class="editor-modal" style="background:#fff;border-radius:12px;padding:24px;width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                    <h3 style="margin:0;font-size:18px;font-weight:600;"><i class="ti ti-photo" style="margin-right:8px;"></i>${isPlaceholder ? 'Görsel Alanı' : 'Görseli Değiştir'}</h3>
                    <button class="modal-close-btn" style="background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px;"><i class="ti ti-x"></i></button>
                </div>

                ${dynamicField ? `<div style="background:#e7f5ff;border:1px solid #a5d8ff;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#1971c2;">
                    <i class="ti ti-link" style="margin-right:6px;"></i>Dinamik alan: <strong>{{${dynamicField}}}</strong>
                    <div style="color:#666;margin-top:4px;font-size:12px;">Baskıda ürün görseli otomatik yerleştirilir.</div>
                </div>` : ''}

                ${!isPlaceholder ? `
                <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:16px;text-align:center;margin-bottom:16px;">
                    <img src="${obj.src || ''}" style="max-width:100%;max-height:200px;border-radius:6px;" onerror="this.style.display='none'">
                </div>` : ''}

                <div style="margin-bottom:16px;">
                    <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:#495057;">Görsel URL</label>
                    <input type="text" id="img-edit-url" value="" style="width:100%;padding:8px 12px;border:1px solid #dee2e6;border-radius:6px;font-size:14px;box-sizing:border-box;" placeholder="https://... veya dosya seçin">
                </div>

                <div style="display:flex;gap:10px;margin-bottom:20px;">
                    <button id="img-edit-file" style="flex:1;padding:10px;border:2px dashed #dee2e6;border-radius:8px;background:#f8f9fa;cursor:pointer;font-size:14px;color:#495057;display:flex;align-items:center;justify-content:center;gap:8px;">
                        <i class="ti ti-upload"></i> Dosyadan Seç
                    </button>
                </div>

                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button id="img-edit-cancel" style="padding:8px 20px;border:1px solid #dee2e6;border-radius:6px;background:#fff;cursor:pointer;font-size:14px;color:#495057;">İptal</button>
                    <button id="img-edit-apply" style="padding:8px 20px;border:none;border-radius:6px;background:#228be6;color:#fff;cursor:pointer;font-size:14px;font-weight:500;">Uygula</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        let selectedDataUrl = '';

        // Dosya seçici
        overlay.querySelector('#img-edit-file').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    selectedDataUrl = ev.target?.result || '';
                    overlay.querySelector('#img-edit-url').value = file.name;
                };
                reader.readAsDataURL(file);
            };
            input.click();
        });

        const close = () => overlay.remove();
        overlay.querySelector('.modal-close-btn').addEventListener('click', close);
        overlay.querySelector('#img-edit-cancel').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        overlay.querySelector('#img-edit-apply').addEventListener('click', async () => {
            const url = overlay.querySelector('#img-edit-url').value.trim();
            const imageUrl = selectedDataUrl || url;

            if (!imageUrl) {
                close();
                return;
            }

            const oldLeft = obj.left;
            const oldTop = obj.top;
            const oldScaleX = obj.scaleX;
            const oldScaleY = obj.scaleY;
            const oldAngle = obj.angle;

            this.canvas.remove(obj);

            try {
                const newObj = await this.objectFactory.createImage(imageUrl, {
                    left: oldLeft,
                    top: oldTop,
                    scaleX: oldScaleX,
                    scaleY: oldScaleY,
                    [CUSTOM_PROPS.CUSTOM_TYPE]: obj[CUSTOM_PROPS.CUSTOM_TYPE] || '',
                    [CUSTOM_PROPS.IS_DATA_FIELD]: obj[CUSTOM_PROPS.IS_DATA_FIELD] || false,
                    [CUSTOM_PROPS.DYNAMIC_FIELD]: dynamicField,
                    [CUSTOM_PROPS.IMAGE_INDEX]: obj[CUSTOM_PROPS.IMAGE_INDEX] || 0,
                    [CUSTOM_PROPS.IMAGE_FIT]: obj[CUSTOM_PROPS.IMAGE_FIT] || 'cover',
                    [CUSTOM_PROPS.PLACEHOLDER]: obj[CUSTOM_PROPS.PLACEHOLDER] || ''
                });
                if (newObj) {
                    newObj.set({ angle: oldAngle });
                    this.canvas.setActiveObject(newObj);
                    this.canvas.requestRenderAll();
                    this._saveHistory();
                }
            } catch (err) {
                console.error('Görsel güncellenemedi:', err);
            }
            close();
        });
    }
}

/**
 * Default export
 */
export default TemplateEditorV7;
