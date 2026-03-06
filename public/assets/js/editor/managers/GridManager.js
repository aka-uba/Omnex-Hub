/**
 * GridManager - Kılavuz Çizgi, Snap ve Layout Bölge Yönetimi
 *
 * Canvas üzerinde kılavuz çizgilerini (grid), snap-to-grid ve layout bölgelerini yönetir.
 * Ayrıca smart guides (akıllı hizalama çizgileri) desteği sunar.
 *
 * KULLANIM:
 * ```javascript
 * import { GridManager } from './editor/managers/GridManager.js';
 *
 * const gridManager = new GridManager(canvas, {
 *     gridSize: 20,
 *     showGrid: true,
 *     snapToGrid: true
 * });
 *
 * // Grid'i göster/gizle
 * gridManager.toggleGrid();
 *
 * // Snap'i aç/kapat
 * gridManager.toggleSnap();
 *
 * // Grid boyutunu değiştir
 * gridManager.setGridSize(10);
 *
 * // Smart guides'ı aç
 * gridManager.enableSmartGuides();
 *
 * // Layout uygula (bölgelere ayır)
 * gridManager.applyLayout('split-horizontal');
 * ```
 *
 * @version 1.1.0
 * @author Omnex Display Hub
 */

import { eventBus, EVENTS } from '../core/EventBus.js';
import { CUSTOM_PROPS } from '../core/CustomProperties.js';

// ==========================================
// GRID LAYOUT TANIMlARI
// ==========================================

/**
 * Grid layout yapılandırmaları
 * Her layout, canvas'ı bölgelere ayıran region tanımları içerir
 */
const GridLayoutConfigs = {
    'single': {
        id: 'single',
        nameKey: 'single',
        icon: 'ti-square',
        regions: [
            { id: 'main', x: 0, y: 0, widthPercent: 100, heightPercent: 100 }
        ]
    },
    'split-horizontal': {
        id: 'split-horizontal',
        nameKey: 'splitHorizontal',
        icon: 'ti-layout-distribute-horizontal',
        regions: [
            { id: 'left', x: 0, y: 0, widthPercent: 50, heightPercent: 100 },
            { id: 'right', x: 50, y: 0, widthPercent: 50, heightPercent: 100 }
        ]
    },
    'split-vertical': {
        id: 'split-vertical',
        nameKey: 'splitVertical',
        icon: 'ti-layout-distribute-vertical',
        regions: [
            { id: 'top', x: 0, y: 0, widthPercent: 100, heightPercent: 50 },
            { id: 'bottom', x: 0, y: 50, widthPercent: 100, heightPercent: 50 }
        ]
    },
    'split-vertical-60-40': {
        id: 'split-vertical-60-40',
        nameKey: 'splitVertical6040',
        icon: 'ti-layout-distribute-vertical',
        regions: [
            { id: 'top', x: 0, y: 0, widthPercent: 100, heightPercent: 60 },
            { id: 'bottom', x: 0, y: 60, widthPercent: 100, heightPercent: 40 }
        ]
    },
    'split-vertical-40-60': {
        id: 'split-vertical-40-60',
        nameKey: 'splitVertical4060',
        icon: 'ti-layout-distribute-vertical',
        regions: [
            { id: 'top', x: 0, y: 0, widthPercent: 100, heightPercent: 40 },
            { id: 'bottom', x: 0, y: 40, widthPercent: 100, heightPercent: 60 }
        ]
    },
    'top-two-bottom-one': {
        id: 'top-two-bottom-one',
        nameKey: 'topTwoBottomOne',
        icon: 'ti-layout-bottombar',
        regions: [
            { id: 'top-left', x: 0, y: 0, widthPercent: 50, heightPercent: 50 },
            { id: 'top-right', x: 50, y: 0, widthPercent: 50, heightPercent: 50 },
            { id: 'bottom', x: 0, y: 50, widthPercent: 100, heightPercent: 50 }
        ]
    },
    'top-one-bottom-two': {
        id: 'top-one-bottom-two',
        nameKey: 'topOneBottomTwo',
        icon: 'ti-layout-navbar',
        regions: [
            { id: 'top', x: 0, y: 0, widthPercent: 100, heightPercent: 50 },
            { id: 'bottom-left', x: 0, y: 50, widthPercent: 50, heightPercent: 50 },
            { id: 'bottom-right', x: 50, y: 50, widthPercent: 50, heightPercent: 50 }
        ]
    },
    'grid-2x2': {
        id: 'grid-2x2',
        nameKey: 'grid2x2',
        icon: 'ti-grid-dots',
        regions: [
            { id: 'tl', x: 0, y: 0, widthPercent: 50, heightPercent: 50 },
            { id: 'tr', x: 50, y: 0, widthPercent: 50, heightPercent: 50 },
            { id: 'bl', x: 0, y: 50, widthPercent: 50, heightPercent: 50 },
            { id: 'br', x: 50, y: 50, widthPercent: 50, heightPercent: 50 }
        ]
    },
    'grid-3x1': {
        id: 'grid-3x1',
        nameKey: 'grid3x1',
        icon: 'ti-columns-3',
        regions: [
            { id: 'col1', x: 0, y: 0, widthPercent: 33.33, heightPercent: 100 },
            { id: 'col2', x: 33.33, y: 0, widthPercent: 33.33, heightPercent: 100 },
            { id: 'col3', x: 66.66, y: 0, widthPercent: 33.34, heightPercent: 100 }
        ]
    },
    'grid-1x3': {
        id: 'grid-1x3',
        nameKey: 'grid1x3',
        icon: 'ti-layout-rows',
        regions: [
            { id: 'row1', x: 0, y: 0, widthPercent: 100, heightPercent: 33.33 },
            { id: 'row2', x: 0, y: 33.33, widthPercent: 100, heightPercent: 33.33 },
            { id: 'row3', x: 0, y: 66.66, widthPercent: 100, heightPercent: 33.34 }
        ]
    },
    'header-content': {
        id: 'header-content',
        nameKey: 'headerContent',
        icon: 'ti-layout-navbar',
        regions: [
            { id: 'header', x: 0, y: 0, widthPercent: 100, heightPercent: 20 },
            { id: 'content', x: 0, y: 20, widthPercent: 100, heightPercent: 80 }
        ]
    },
    'header-content-footer': {
        id: 'header-content-footer',
        nameKey: 'headerContentFooter',
        icon: 'ti-layout-distribute-vertical',
        regions: [
            { id: 'header', x: 0, y: 0, widthPercent: 100, heightPercent: 15 },
            { id: 'content', x: 0, y: 15, widthPercent: 100, heightPercent: 70 },
            { id: 'footer', x: 0, y: 85, widthPercent: 100, heightPercent: 15 }
        ]
    },
    'sidebar-content': {
        id: 'sidebar-content',
        nameKey: 'sidebarContent',
        icon: 'ti-layout-sidebar-left',
        regions: [
            { id: 'sidebar', x: 0, y: 0, widthPercent: 30, heightPercent: 100 },
            { id: 'content', x: 30, y: 0, widthPercent: 70, heightPercent: 100 }
        ]
    },
    'content-sidebar': {
        id: 'content-sidebar',
        nameKey: 'contentSidebar',
        icon: 'ti-layout-sidebar-right',
        regions: [
            { id: 'content', x: 0, y: 0, widthPercent: 70, heightPercent: 100 },
            { id: 'sidebar', x: 70, y: 0, widthPercent: 30, heightPercent: 100 }
        ]
    }
};

/**
 * Varsayılan ayarlar
 */
const DEFAULT_OPTIONS = {
    gridSize: 20,              // Grid hücre boyutu (px)
    gridColor: '#e0e0e0',      // Grid çizgi rengi
    gridOpacity: 0.5,          // Grid opaklığı
    showGrid: true,            // Başlangıçta grid göster - VARSAYILAN AÇIK
    snapToGrid: false,         // Başlangıçta snap aktif - KAPALI başlıyor
    snapThreshold: 10,         // Snap eşik değeri (px)
    smartGuides: true,         // Akıllı hizalama çizgileri - AÇIK başlıyor
    guideColor: '#ff0000',     // Guide çizgi rengi - KIRMIZI
    guideLineWidth: 1,         // Guide çizgi kalınlığı
    showRulers: false,         // Cetvel göster
    // Region ayarları
    showRegionBorders: true,           // Bölge çizgilerini göster
    regionBorderColor: '#ef4444',      // Bölge çizgi rengi (kırmızı)
    regionBorderColorActive: '#dc2626', // Aktif bölge çizgi rengi (koyu kırmızı)
    regionBorderWidth: 2,              // Bölge çizgi kalınlığı
    regionBorderWidthActive: 3,        // Aktif bölge çizgi kalınlığı
    onRegionSelect: null,              // Bölge seçildiğinde callback
    onLayoutChange: null               // Layout değiştiğinde callback
};

/**
 * GridManager Sınıfı
 */
export class GridManager {
    /**
     * @param {Object} options - Ayarlar
     * @param {Object} options.canvas - Fabric.js Canvas instance
     * @param {number} [options.gridSize] - Grid boyutu
     * @param {boolean} [options.showGrid] - Grid göster
     * @param {boolean} [options.snapEnabled] - Snap aktif
     * @param {boolean} [options.smartGuidesEnabled] - Smart guides aktif
     */
    constructor(options = {}) {
        /**
         * Fabric.js Canvas referansı
         * @type {Object}
         */
        this.canvas = options.canvas;

        /**
         * Orijinal canvas boyutları (zoom'dan etkilenmez)
         * @type {number}
         */
        this._canvasWidth = options.canvasWidth || options.canvas?.width || 800;
        this._canvasHeight = options.canvasHeight || options.canvas?.height || 600;

        /**
         * Ayarlar
         * @type {Object}
         */
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            // Explicit overrides
            gridSize: options.gridSize ?? DEFAULT_OPTIONS.gridSize,
            showGrid: options.showGrid ?? DEFAULT_OPTIONS.showGrid,
            snapToGrid: options.snapEnabled ?? options.snapToGrid ?? DEFAULT_OPTIONS.snapToGrid,
            smartGuides: options.smartGuidesEnabled ?? options.smartGuides ?? DEFAULT_OPTIONS.smartGuides
        };

        /**
         * Grid çizgileri dizisi (v7 - Group kullanmıyor)
         * @type {Array<Object>}
         */
        this._gridLines = [];

        /**
         * Smart guide çizgileri
         * @type {Array<Object>}
         */
        this._guideLines = [];

        /**
         * Grid görünür mü
         * @type {boolean}
         */
        this._gridVisible = this.options.showGrid;

        /**
         * Snap aktif mi
         * @type {boolean}
         */
        this._snapEnabled = this.options.snapToGrid;

        /**
         * Smart guides aktif mi
         * @type {boolean}
         */
        this._smartGuidesEnabled = this.options.smartGuidesEnabled ?? this.options.smartGuides ?? DEFAULT_OPTIONS.smartGuides;

        /**
         * Event handler referansları
         * @type {Object}
         */
        this._eventHandlers = {};

        // ==========================================
        // LAYOUT REGION ÖZELLİKLERİ
        // ==========================================

        /**
         * Mevcut layout
         * @type {Object|null}
         */
        this._currentLayout = null;

        /**
         * Mevcut layout ID
         * @type {string}
         */
        this._currentLayoutId = 'single';

        /**
         * Bölgeler dizisi
         * @type {Array}
         */
        this._regions = [];

        /**
         * Aktif bölge
         * @type {Object|null}
         */
        this._activeRegion = null;

        /**
         * Bölge overlay'leri (çerçeveler)
         * @type {Array}
         */
        this._regionOverlays = [];

        /**
         * Region seçim callback'i
         * @type {Function|null}
         */
        this._onRegionSelect = options.onRegionSelect || null;

        /**
         * Layout değişim callback'i
         * @type {Function|null}
         */
        this._onLayoutChange = options.onLayoutChange || null;

        // Event'leri bağla
        this._bindEvents();

        // Başlangıç grid'i oluştur
        if (this._gridVisible) {
            this._createGrid();
        }
    }

    /**
     * Event'leri bağla
     * @private
     */
    _bindEvents() {
        // Object moving - snap ve smart guides ve sınır kontrolü
        this._eventHandlers.objectMoving = (e) => {
            if (!e.target) return;

            // Canvas sınır kontrolü - nesneler canvas dışına çıkamaz
            this._constrainToBounds(e.target);

            // Snap to grid
            if (this._snapEnabled) {
                this._snapObjectToGrid(e.target);
            }

            // Smart guides
            if (this._smartGuidesEnabled) {
                this._showSmartGuides(e.target);
            }
        };

        // Object scaling - snap ve sınır kontrolü
        this._eventHandlers.objectScaling = (e) => {
            if (!e.target) return;

            // Canvas sınır kontrolü - scaling sırasında nesne boyutu kontrol edilir
            this._constrainScaleToBounds(e.target);

            if (this._snapEnabled) {
                this._snapObjectToGrid(e.target);
            }
        };

        // Object modified - smart guides temizle + regionId ata
        this._eventHandlers.objectModified = (e) => {
            this._clearSmartGuides();
            // Responsive: obje bırakıldığında bölge atamasını güncelle
            if (e?.target) {
                this._autoAssignRegion(e.target);
            }
        };

        // Selection cleared - smart guides temizle
        this._eventHandlers.selectionCleared = () => {
            this._clearSmartGuides();
        };

        // Canvas event'lerini bağla
        if (this.canvas) {
            this.canvas.on('object:moving', this._eventHandlers.objectMoving);
            this.canvas.on('object:scaling', this._eventHandlers.objectScaling);
            this.canvas.on('object:modified', this._eventHandlers.objectModified);
            this.canvas.on('selection:cleared', this._eventHandlers.selectionCleared);
        }
    }

    // ==========================================
    // GRID YÖNETİMİ
    // ==========================================

    /**
     * Grid oluştur
     * @private
     */
    _createGrid() {
        if (!this.canvas) return;

        // Önce mevcut grid'i temizle
        this._removeGrid();

        const gridSize = this.options.gridSize;
        // Orijinal canvas boyutlarını kullan
        const width = this._canvasWidth || this.canvas.width || this.canvas.getWidth();
        const height = this._canvasHeight || this.canvas.height || this.canvas.getHeight();
        const color = this.options.gridColor;
        const opacity = this.options.gridOpacity;

        // Boyutları güncelle (fallback durumunda)
        if (!this._canvasWidth || !this._canvasHeight) {
            this._canvasWidth = width;
            this._canvasHeight = height;
        }

        // Dikey çizgiler (0'dan width'e kadar, gridSize aralıklarla)
        // x <= width kullanarak son çizgiyi de dahil et
        for (let x = gridSize; x <= width; x += gridSize) {
            const line = new fabric.Line([x, 0, x, height], {
                stroke: color,
                strokeWidth: 1,
                opacity: opacity,
                selectable: false,
                evented: false,
                excludeFromExport: true,
                [CUSTOM_PROPS.TYPE]: 'grid-line'
            });
            this.canvas.add(line);
            this._sendToBack(line);
            this._gridLines.push(line);
        }

        // Yatay çizgiler (0'dan height'e kadar, gridSize aralıklarla)
        // y <= height kullanarak son çizgiyi de dahil et
        for (let y = gridSize; y <= height; y += gridSize) {
            const line = new fabric.Line([0, y, width, y], {
                stroke: color,
                strokeWidth: 1,
                opacity: opacity,
                selectable: false,
                evented: false,
                excludeFromExport: true,
                [CUSTOM_PROPS.TYPE]: 'grid-line'
            });
            this.canvas.add(line);
            this._sendToBack(line);
            this._gridLines.push(line);
        }

        this.canvas.requestRenderAll();
    }

    /**
     * Objeyi en arkaya gönder - v7 uyumlu
     * @private
     */
    _sendToBack(obj) {
        if (!obj || !this.canvas) return;

        // Fabric.js v7'de sendObjectToBack kullanılır
        if (typeof this.canvas.sendObjectToBack === 'function') {
            this.canvas.sendObjectToBack(obj);
        } else if (typeof obj.sendToBack === 'function') {
            obj.sendToBack();
        }
    }

    /**
     * Grid'i kaldır
     * @private
     */
    _removeGrid() {
        if (!this.canvas) return;

        this._gridLines.forEach(line => {
            this.canvas.remove(line);
        });
        this._gridLines = [];
    }

    /**
     * Grid'i göster
     */
    showGrid() {
        if (this._gridVisible) return;

        this._gridVisible = true;
        this._createGrid();

        eventBus.emit(EVENTS.GRID_SHOW, { gridSize: this.options.gridSize });
        eventBus.emit(EVENTS.GRID_TOGGLE, { visible: true });
    }

    /**
     * Grid'i gizle
     */
    hideGrid() {
        if (!this._gridVisible) return;

        this._gridVisible = false;
        this._removeGrid();
        this.canvas?.requestRenderAll();

        eventBus.emit(EVENTS.GRID_HIDE, {});
        eventBus.emit(EVENTS.GRID_TOGGLE, { visible: false });
    }

    /**
     * Grid göster/gizle toggle
     * @returns {boolean} Yeni durum
     */
    toggleGrid() {
        if (this._gridVisible) {
            this.hideGrid();
        } else {
            this.showGrid();
        }
        return this._gridVisible;
    }

    /**
     * Grid görünür mü?
     * @returns {boolean}
     */
    isGridVisible() {
        return this._gridVisible;
    }

    /**
     * Grid görünürlük durumunu canvas ile senkronize et.
     * loadFromJSON sonrası çizgiler canvas'tan silinip internal state true kalmış olabilir.
     */
    refreshGridVisibility() {
        if (!this.canvas) return;

        if (!this._gridVisible) {
            if (this._gridLines.length > 0) {
                this._removeGrid();
                this.canvas.requestRenderAll();
            }
            return;
        }

        const canvasObjects = this.canvas.getObjects();
        const hasAttachedGridLine = this._gridLines.some(line => canvasObjects.includes(line));

        if (!hasAttachedGridLine) {
            this._createGrid();
        }
    }

    /**
     * Grid boyutunu değiştir
     * @param {number} size - Yeni grid boyutu (px)
     */
    setGridSize(size) {
        if (size < 5 || size > 200) {
            console.warn('GridManager: Grid boyutu 5-200 arasında olmalı');
            return;
        }

        this.options.gridSize = size;

        // Grid görünürse yeniden oluştur
        if (this._gridVisible) {
            this._createGrid();
        }

        eventBus.emit(EVENTS.GRID_SIZE_CHANGE, { gridSize: size });
    }

    /**
     * Grid boyutunu al
     * @returns {number}
     */
    getGridSize() {
        return this.options.gridSize;
    }

    /**
     * Grid rengini değiştir
     * @param {string} color - Yeni renk
     */
    setGridColor(color) {
        this.options.gridColor = color;

        if (this._gridVisible) {
            this._createGrid();
        }
    }

    /**
     * Canvas boyutunu güncelle (zoom sonrası yeniden çizim için)
     * @param {number} width - Yeni genişlik
     * @param {number} height - Yeni yükseklik
     */
    setCanvasSize(width, height) {
        this._canvasWidth = width;
        this._canvasHeight = height;

        // Grid görünürse yeniden oluştur
        if (this._gridVisible) {
            this._createGrid();
        }
    }

    // ==========================================
    // SNAP YÖNETİMİ
    // ==========================================

    /**
     * Snap'i aç
     */
    enableSnap() {
        this._snapEnabled = true;
        eventBus.emit(EVENTS.SNAP_ENABLE, {});
    }

    /**
     * Snap'i kapat
     */
    disableSnap() {
        this._snapEnabled = false;
        eventBus.emit(EVENTS.SNAP_DISABLE, {});
    }

    /**
     * Snap aç/kapa toggle
     * @returns {boolean} Yeni durum
     */
    toggleSnap() {
        this._snapEnabled = !this._snapEnabled;

        // Toggle eventi - Toolbar butonu için
        eventBus.emit(EVENTS.SNAP_TOGGLE, { enabled: this._snapEnabled });

        // Enable/Disable eventleri - diğer dinleyiciler için
        if (this._snapEnabled) {
            eventBus.emit(EVENTS.SNAP_ENABLE, {});
        } else {
            eventBus.emit(EVENTS.SNAP_DISABLE, {});
        }

        return this._snapEnabled;
    }

    /**
     * Snap aktif mi?
     * @returns {boolean}
     */
    isSnapEnabled() {
        return this._snapEnabled;
    }

    /**
     * Nesneyi grid'e snap et
     * Snap aktifken nesne her zaman en yakın grid çizgisine yapışır
     * @private
     * @param {Object} obj - Fabric.js nesnesi
     */
    _snapObjectToGrid(obj) {
        const gridSize = this.options.gridSize;

        // Sol kenar - en yakın grid çizgisine snap et
        const left = obj.left;
        const snapLeft = Math.round(left / gridSize) * gridSize;
        obj.set('left', snapLeft);

        // Üst kenar - en yakın grid çizgisine snap et
        const top = obj.top;
        const snapTop = Math.round(top / gridSize) * gridSize;
        obj.set('top', snapTop);
    }

    /**
     * Nesneyi canvas sınırları içinde tut
     * @private
     * @param {Object} obj - Fabric.js nesnesi
     */
    _constrainToBounds(obj) {
        if (!this.canvas || !obj) return;

        // Grid çizgileri ve smart guide'lar için sınır kontrolü yapma
        const objType = obj.get?.(CUSTOM_PROPS.TYPE) || obj[CUSTOM_PROPS.TYPE];
        if (objType === 'grid-line' ||
            objType === 'smart-guide' ||
            obj.excludeFromExport) {
            return;
        }

        // Orijinal canvas boyutlarını kullan (zoom'dan etkilenmez)
        const canvasWidth = this._canvasWidth || this.canvas.width || this.canvas.getWidth();
        const canvasHeight = this._canvasHeight || this.canvas.height || this.canvas.getHeight();

        // Nesnenin gerçek sınırlarını hesapla (döndürme dahil)
        // Fabric.js v7'de getBoundingRect() absolute=true kullanılmalı
        const boundingRect = obj.getBoundingRect(true);
        const objWidth = boundingRect.width;
        const objHeight = boundingRect.height;

        // Nesnenin origin point'ine göre offset hesapla
        const offsetX = boundingRect.left - obj.left;
        const offsetY = boundingRect.top - obj.top;

        let newLeft = obj.left;
        let newTop = obj.top;

        // Sol sınır (0'dan küçük olamaz)
        if (boundingRect.left < 0) {
            newLeft = -offsetX;
        }

        // Üst sınır (0'dan küçük olamaz)
        if (boundingRect.top < 0) {
            newTop = -offsetY;
        }

        // Sağ sınır (canvas genişliğini aşamaz)
        if (boundingRect.left + objWidth > canvasWidth) {
            newLeft = canvasWidth - objWidth - offsetX;
        }

        // Alt sınır (canvas yüksekliğini aşamaz)
        if (boundingRect.top + objHeight > canvasHeight) {
            newTop = canvasHeight - objHeight - offsetY;
        }

        // Değerleri uygula
        obj.set({
            left: newLeft,
            top: newTop
        });

        // Koordinatları güncelle
        obj.setCoords();
    }

    /**
     * Nesne boyutlandırılırken canvas sınırları içinde tut
     * @private
     * @param {Object} obj - Fabric.js nesnesi
     */
    _constrainScaleToBounds(obj) {
        if (!this.canvas || !obj) return;

        // Grid çizgileri ve smart guide'lar için kontrol yapma
        const objType = obj.get?.(CUSTOM_PROPS.TYPE) || obj[CUSTOM_PROPS.TYPE];
        if (objType === 'grid-line' ||
            objType === 'smart-guide' ||
            obj.excludeFromExport) {
            return;
        }

        // Orijinal canvas boyutlarını kullan
        const canvasWidth = this._canvasWidth || this.canvas.width || this.canvas.getWidth();
        const canvasHeight = this._canvasHeight || this.canvas.height || this.canvas.getHeight();

        // Nesnenin sınırlarını al
        const boundingRect = obj.getBoundingRect(true);

        // Sağ kenar canvas dışına çıkıyorsa
        if (boundingRect.left + boundingRect.width > canvasWidth) {
            // Nesneyi sola kaydır veya ölçeği sınırla
            const maxWidth = canvasWidth - boundingRect.left;
            if (maxWidth > 0 && boundingRect.width > maxWidth) {
                const ratio = maxWidth / boundingRect.width;
                obj.set({
                    scaleX: obj.scaleX * ratio,
                    scaleY: obj.scaleY * ratio
                });
            }
        }

        // Alt kenar canvas dışına çıkıyorsa
        if (boundingRect.top + boundingRect.height > canvasHeight) {
            const maxHeight = canvasHeight - boundingRect.top;
            if (maxHeight > 0 && boundingRect.height > maxHeight) {
                const ratio = maxHeight / boundingRect.height;
                obj.set({
                    scaleX: obj.scaleX * ratio,
                    scaleY: obj.scaleY * ratio
                });
            }
        }

        // Koordinatları güncelle
        obj.setCoords();

        // Taşıma kontrolünü de uygula
        this._constrainToBounds(obj);
    }

    // ==========================================
    // SMART GUIDES
    // ==========================================

    /**
     * Smart guides'ı aç
     */
    enableSmartGuides() {
        this._smartGuidesEnabled = true;
    }

    /**
     * Smart guides'ı kapat
     */
    disableSmartGuides() {
        this._smartGuidesEnabled = false;
        this._clearSmartGuides();
    }

    /**
     * Smart guides toggle
     * @returns {boolean} Yeni durum
     */
    toggleSmartGuides() {
        this._smartGuidesEnabled = !this._smartGuidesEnabled;

        if (!this._smartGuidesEnabled) {
            this._clearSmartGuides();
        }

        return this._smartGuidesEnabled;
    }

    /**
     * Smart guides aktif mi?
     * @returns {boolean}
     */
    isSmartGuidesEnabled() {
        return this._smartGuidesEnabled;
    }

    /**
     * Smart guides göster
     * @private
     * @param {Object} target - Hareket eden nesne
     */
    _showSmartGuides(target) {
        if (!this.canvas) return;

        // Mevcut guide'ları temizle
        this._clearSmartGuides();

        const threshold = this.options.snapThreshold;
        const objects = this.canvas.getObjects().filter(obj =>
            obj !== target &&
            obj.get(CUSTOM_PROPS.TYPE) !== 'grid-line' &&
            obj.get(CUSTOM_PROPS.TYPE) !== 'smart-guide' &&
            obj.selectable !== false
        );

        // Target'ın bound'larını al
        const targetBounds = this._getObjectBounds(target);

        objects.forEach(obj => {
            const objBounds = this._getObjectBounds(obj);

            // Dikey hizalama kontrolleri - SADECE çizgi göster, pozisyon DEĞİŞTİRME
            // Sol kenar
            if (Math.abs(targetBounds.left - objBounds.left) < threshold) {
                this._addVerticalGuide(objBounds.left);
            }
            // Sağ kenar
            if (Math.abs(targetBounds.right - objBounds.right) < threshold) {
                this._addVerticalGuide(objBounds.right);
            }
            // Merkez X
            if (Math.abs(targetBounds.centerX - objBounds.centerX) < threshold) {
                this._addVerticalGuide(objBounds.centerX);
            }

            // Yatay hizalama kontrolleri - SADECE çizgi göster, pozisyon DEĞİŞTİRME
            // Üst kenar
            if (Math.abs(targetBounds.top - objBounds.top) < threshold) {
                this._addHorizontalGuide(objBounds.top);
            }
            // Alt kenar
            if (Math.abs(targetBounds.bottom - objBounds.bottom) < threshold) {
                this._addHorizontalGuide(objBounds.bottom);
            }
            // Merkez Y
            if (Math.abs(targetBounds.centerY - objBounds.centerY) < threshold) {
                this._addHorizontalGuide(objBounds.centerY);
            }
        });

        // Canvas merkezi kontrolleri - SADECE çizgi göster
        // Orijinal canvas boyutlarını kullan
        const canvasCenterX = this._canvasWidth / 2;
        const canvasCenterY = this._canvasHeight / 2;

        if (Math.abs(targetBounds.centerX - canvasCenterX) < threshold) {
            this._addVerticalGuide(canvasCenterX);
        }
        if (Math.abs(targetBounds.centerY - canvasCenterY) < threshold) {
            this._addHorizontalGuide(canvasCenterY);
        }

        this.canvas.requestRenderAll();
    }

    /**
     * Nesnenin bound'larını al
     * @private
     * @param {Object} obj - Fabric.js nesnesi
     * @returns {Object} Bound değerleri
     */
    _getObjectBounds(obj) {
        const bound = obj.getBoundingRect();
        return {
            left: bound.left,
            top: bound.top,
            right: bound.left + bound.width,
            bottom: bound.top + bound.height,
            centerX: bound.left + bound.width / 2,
            centerY: bound.top + bound.height / 2,
            width: bound.width,
            height: bound.height
        };
    }

    /**
     * Dikey guide çizgisi ekle
     * @private
     * @param {number} x - X koordinatı
     */
    _addVerticalGuide(x) {
        if (!this.canvas) return;

        // Orijinal canvas boyutlarını kullan
        const height = this._canvasHeight;

        const line = new fabric.Line([x, 0, x, height], {
            stroke: this.options.guideColor,
            strokeWidth: this.options.guideLineWidth,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            [CUSTOM_PROPS.TYPE]: 'smart-guide',
            excludeFromExport: true
        });

        this.canvas.add(line);
        this._guideLines.push(line);
    }

    /**
     * Yatay guide çizgisi ekle
     * @private
     * @param {number} y - Y koordinatı
     */
    _addHorizontalGuide(y) {
        if (!this.canvas) return;

        // Orijinal canvas boyutlarını kullan
        const width = this._canvasWidth;

        const line = new fabric.Line([0, y, width, y], {
            stroke: this.options.guideColor,
            strokeWidth: this.options.guideLineWidth,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            [CUSTOM_PROPS.TYPE]: 'smart-guide',
            excludeFromExport: true
        });

        this.canvas.add(line);
        this._guideLines.push(line);
    }

    /**
     * Smart guide'ları temizle
     * @private
     */
    _clearSmartGuides() {
        if (!this.canvas) return;

        this._guideLines.forEach(line => {
            this.canvas.remove(line);
        });
        this._guideLines = [];
        this.canvas.requestRenderAll();
    }

    // ==========================================
    // CANVAS YENİDEN BOYUTLANDIRMA
    // ==========================================

    /**
     * Canvas boyutu değiştiğinde grid'i güncelle
     */
    updateGrid() {
        if (this._gridVisible) {
            this._createGrid();
        }
    }

    // ==========================================
    // LAYOUT BÖLGE YÖNETİMİ (Region Management)
    // ==========================================

    /**
     * Grid layout'u uygula - canvas'ı bölgelere ayır
     * @param {string} layoutId - Layout ID'si
     */
    applyLayout(layoutId) {
        const layout = GridLayoutConfigs[layoutId];
        if (!layout) {
            console.warn(`[GridManager] Grid layout bulunamadı: ${layoutId}`);
            return;
        }


        // Mevcut overlay'leri temizle
        this.clearRegionOverlays();

        this._currentLayout = layout;
        this._currentLayoutId = layoutId;
        this._regions = [];

        // Canvas boyutlarını al
        const canvasWidth = this._canvasWidth || this.canvas?.width || 800;
        const canvasHeight = this._canvasHeight || this.canvas?.height || 1280;

        // Bölgeleri oluştur (sadece bounds bilgisi)
        layout.regions.forEach((regionConfig) => {
            const region = this._createRegion(regionConfig, canvasWidth, canvasHeight);
            this._regions.push(region);
        });

        // Ayırıcı çizgileri oluştur (Fabric Line nesneleri - zoom ile ölçeklenir)
        this._createDividerLines(layout, canvasWidth, canvasHeight);

        // İlk bölgeyi aktif yap
        if (this._regions.length > 0) {
            this._activeRegion = this._regions[0];
            // Callback çağır
            if (this._onRegionSelect) {
                this._onRegionSelect(this._activeRegion);
            }
        }

        // Canvas seviyesinde region seçimi için event listener kur
        this._setupCanvasRegionSelection();

        if (this.canvas) {
            this.canvas.requestRenderAll();
        }

        // Layout değişim callback'i çağır
        if (this._onLayoutChange) {
            this._onLayoutChange(layoutId, layout);
        }

        eventBus.emit(EVENTS.LAYOUT_CHANGE, { layoutId, layout });
    }

    /**
     * Bölge oluştur - sadece bounds bilgisi, çizgi yok
     * @private
     * @param {Object} config - Bölge yapılandırması
     * @param {number} canvasWidth - Canvas genişliği
     * @param {number} canvasHeight - Canvas yüksekliği
     * @returns {Object} Region objesi
     */
    _createRegion(config, canvasWidth, canvasHeight) {
        // Bölgenin koordinatları (yüzde -> piksel)
        const x = (config.x / 100) * canvasWidth;
        const y = (config.y / 100) * canvasHeight;
        const width = (config.widthPercent / 100) * canvasWidth;
        const height = (config.heightPercent / 100) * canvasHeight;


        return {
            id: config.id,
            config: config,
            rect: null, // Artık rect kullanmıyoruz
            bounds: { x, y, width, height },
            objects: [],
            background: {
                type: 'none',
                value: null,
                gradient: null
            },
            backgroundObject: null
        };
    }

    /**
     * Layout için ayırıcı çizgileri oluştur (Fabric.js Line nesneleri)
     * Nesnelerle birlikte zoom'lanır
     * @private
     * @param {Object} layout - Layout objesi
     * @param {number} canvasWidth - Canvas genişliği
     * @param {number} canvasHeight - Canvas yüksekliği
     */
    _createDividerLines(layout, canvasWidth, canvasHeight) {
        if (!this.canvas || !layout || !layout.regions) return;

        const strokeWidth = this.options.regionBorderWidth || 2;
        const dashArray = [8, 4];
        const strokeColor = this.options.regionBorderColor || '#ef4444';

        // Benzersiz dikey ve yatay çizgi pozisyonlarını topla
        // (canvas kenarları hariç - 0 ve 100%)
        const verticalLines = new Set();
        const horizontalLines = new Set();

        layout.regions.forEach(region => {
            // Sol kenar (0 değilse)
            if (region.x > 0) {
                verticalLines.add(region.x);
            }
            // Sağ kenar (100 değilse)
            const rightEdge = region.x + region.widthPercent;
            if (rightEdge < 100) {
                verticalLines.add(rightEdge);
            }
            // Üst kenar (0 değilse)
            if (region.y > 0) {
                horizontalLines.add(region.y);
            }
            // Alt kenar (100 değilse)
            const bottomEdge = region.y + region.heightPercent;
            if (bottomEdge < 100) {
                horizontalLines.add(bottomEdge);
            }
        });


        // Dikey çizgileri oluştur
        verticalLines.forEach(percent => {
            const x = (percent / 100) * canvasWidth;

            const line = new fabric.Line([x, 0, x, canvasHeight], {
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                strokeDashArray: dashArray,
                selectable: false,
                evented: false,
                excludeFromExport: true,
                isTransient: true,
                [CUSTOM_PROPS.TYPE]: 'region-divider',
                isRegionOverlay: true
            });

            this.canvas.add(line);
            this._sendToBack(line);
            this._regionOverlays.push(line);
        });

        // Yatay çizgileri oluştur
        horizontalLines.forEach(percent => {
            const y = (percent / 100) * canvasHeight;

            const line = new fabric.Line([0, y, canvasWidth, y], {
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                strokeDashArray: dashArray,
                selectable: false,
                evented: false,
                excludeFromExport: true,
                isTransient: true,
                [CUSTOM_PROPS.TYPE]: 'region-divider',
                isRegionOverlay: true
            });

            this.canvas.add(line);
            this._sendToBack(line);
            this._regionOverlays.push(line);
        });
    }

    /**
     * Bölge seç
     * @param {string} regionId - Bölge ID'si
     */
    selectRegion(regionId) {
        // Yeni seçimi işaretle
        const region = this._regions.find(r => r.id === regionId);
        if (region) {
            this._activeRegion = region;

            // Callback çağır
            if (this._onRegionSelect) {
                this._onRegionSelect(region);
            }

        }
    }

    /**
     * Aktif bölgeyi getir
     * @returns {Object|null}
     */
    getActiveRegion() {
        return this._activeRegion;
    }

    /**
     * Tüm bölgeleri getir
     * @returns {Array}
     */
    getRegions() {
        return this._regions;
    }

    /**
     * Mevcut layout ID'sini getir
     * @returns {string}
     */
    getCurrentLayoutId() {
        return this._currentLayoutId;
    }

    /**
     * Bölge sınırlarını getir
     * @param {Object} region - Region objesi
     * @returns {Object} Bounds objesi
     */
    getRegionBounds(region) {
        const canvasWidth = this._canvasWidth || this.canvas?.width || 800;
        const canvasHeight = this._canvasHeight || this.canvas?.height || 1280;
        const config = region.config;

        return {
            x: (config.x / 100) * canvasWidth,
            y: (config.y / 100) * canvasHeight,
            width: (config.widthPercent / 100) * canvasWidth,
            height: (config.heightPercent / 100) * canvasHeight
        };
    }

    /**
     * Objenin merkez noktasına göre hangi bölgeye düştüğünü tespit edip regionId ata.
     * object:modified event'inde otomatik çağrılır.
     *
     * @param {Object} obj - Fabric.js canvas objesi
     * @private
     */
    _autoAssignRegion(obj) {
        if (!this._regions?.length) return;
        if (obj.excludeFromExport || obj.isTransient || obj.isHelper) return;

        // Obje merkez noktası (Fabric.js v7 center-origin)
        const cx = obj.left;
        const cy = obj.top;

        for (const region of this._regions) {
            const bounds = this.getRegionBounds(region);
            if (cx >= bounds.x && cx < bounds.x + bounds.width &&
                cy >= bounds.y && cy < bounds.y + bounds.height) {
                obj[CUSTOM_PROPS.REGION_ID] = region.id;
                return;
            }
        }
        // Hiçbir bölgeye düşmüyorsa mevcut regionId'yi koru
    }

    /**
     * Bölge overlay'lerini temizle
     */
    clearRegionOverlays() {
        // Fabric nesnelerini temizle
        if (this.canvas) {
            this._regionOverlays.forEach(overlay => {
                this.canvas.remove(overlay);
            });
        }
        this._regionOverlays = [];
        this._regions = [];
        this._activeRegion = null;

        // Canvas'ı yeniden çiz
        if (this.canvas) {
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Region overlay'leri göster/gizle
     * @param {boolean} visible - Görünürlük durumu
     */
    setRegionOverlaysVisible(visible) {
        this._regionOverlays.forEach(overlay => {
            overlay.set('visible', visible);
        });
        if (this.canvas) {
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Canvas seviyesinde region seçimi için event listener kur
     * @private
     */
    _setupCanvasRegionSelection() {
        if (!this.canvas) return;

        // Önceki listener'ı temizle
        if (this._canvasMouseDownHandler) {
            this.canvas.off('mouse:down', this._canvasMouseDownHandler);
            this._canvasMouseDownHandler = null;
        }

        // Yeni handler oluştur
        this._canvasMouseDownHandler = (options) => {
            // Bir nesne tıklandıysa region seçimi yapma
            if (options.target && !options.target.isRegionOverlay && !options.target.isBackground) {
                return;
            }

            // Bölge yoksa çık
            if (!this._regions || this._regions.length === 0) {
                return;
            }

            // Tıklanan koordinatları al (Fabric.js v7 uyumlu)
            const pointer = options.scenePoint || this.canvas.getScenePoint(options.e);
            const clickX = pointer.x;
            const clickY = pointer.y;

            // Canvas boyutlarını al
            const canvasWidth = this._canvasWidth || this.canvas.width;
            const canvasHeight = this._canvasHeight || this.canvas.height;

            // Hangi region'a tıklandığını bul
            for (const region of this._regions) {
                const bounds = {
                    x: (region.config.x / 100) * canvasWidth,
                    y: (region.config.y / 100) * canvasHeight,
                    width: (region.config.widthPercent / 100) * canvasWidth,
                    height: (region.config.heightPercent / 100) * canvasHeight
                };

                if (clickX >= bounds.x && clickX < bounds.x + bounds.width &&
                    clickY >= bounds.y && clickY < bounds.y + bounds.height) {
                    this.selectRegion(region.id);
                    break;
                }
            }
        };

        this.canvas.on('mouse:down', this._canvasMouseDownHandler);
    }

    /**
     * Canvas region seçim event listener'ını kaldır
     * @private
     */
    _removeCanvasRegionSelection() {
        if (this.canvas && this._canvasMouseDownHandler) {
            this.canvas.off('mouse:down', this._canvasMouseDownHandler);
            this._canvasMouseDownHandler = null;
        }
    }

    /**
     * Canvas boyutu değiştiğinde bölgeleri güncelle
     */
    updateRegionBounds() {
        if (!this._currentLayoutId) return;

        // Mevcut arkaplan ayarlarını kaydet
        const backgroundConfigs = {};
        this._regions.forEach(region => {
            if (region.background && region.background.type !== 'none') {
                backgroundConfigs[region.id] = { ...region.background };
            }
        });

        // Aktif region ID'sini kaydet
        const activeRegionId = this._activeRegion?.id;

        // Grid düzenini tamamen yeniden uygula
        this.applyLayout(this._currentLayoutId);

        // Aktif region'ı geri seç
        if (activeRegionId) {
            this.selectRegion(activeRegionId);
        }
    }

    /**
     * Yapılandırmayı dışa aktar
     * @returns {Object} Export objesi
     */
    exportConfig() {
        const canvasWidth = this._canvasWidth || this.canvas?.width || 800;
        const canvasHeight = this._canvasHeight || this.canvas?.height || 1280;

        return {
            layoutId: this._currentLayoutId,
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
            regions: this._regions.map(r => {
                const x = Math.round((r.config.x / 100) * canvasWidth);
                const y = Math.round((r.config.y / 100) * canvasHeight);
                const width = Math.round((r.config.widthPercent / 100) * canvasWidth);
                const height = Math.round((r.config.heightPercent / 100) * canvasHeight);

                return {
                    id: r.id,
                    config: r.config,
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    background: r.background
                };
            })
        };
    }

    /**
     * Yapılandırmayı içe aktar
     * @param {Object} config - Import objesi
     */
    importConfig(config) {
        if (config.layoutId) {
            this.applyLayout(config.layoutId);
        }
    }

    /**
     * Tüm layout'ları temizle
     */
    clearAllLayouts() {
        this._removeCanvasRegionSelection();
        this.clearRegionOverlays();
        this._currentLayout = null;
        this._currentLayoutId = 'single';
        if (this.canvas) {
            this.canvas.requestRenderAll();
        }
    }

    // ==========================================
    // TEMİZLİK
    // ==========================================

    /**
     * Canvas referansını güncelle
     * @param {Object} canvas - Yeni canvas instance
     */
    setCanvas(canvas) {
        // Eski event'leri kaldır
        if (this.canvas) {
            this.canvas.off('object:moving', this._eventHandlers.objectMoving);
            this.canvas.off('object:scaling', this._eventHandlers.objectScaling);
            this.canvas.off('object:modified', this._eventHandlers.objectModified);
            this.canvas.off('selection:cleared', this._eventHandlers.selectionCleared);
        }

        this.canvas = canvas;

        // Yeni event'leri bağla
        this._bindEvents();

        // Grid'i yeniden oluştur
        if (this._gridVisible) {
            this._createGrid();
        }
    }

    /**
     * Manager'ı dispose et
     */
    dispose() {
        // Grid ve guide'ları temizle
        this._removeGrid();
        this._clearSmartGuides();

        // Region overlay'leri temizle
        this._removeCanvasRegionSelection();
        this.clearRegionOverlays();

        // Canvas event'lerini kaldır
        if (this.canvas) {
            this.canvas.off('object:moving', this._eventHandlers.objectMoving);
            this.canvas.off('object:scaling', this._eventHandlers.objectScaling);
            this.canvas.off('object:modified', this._eventHandlers.objectModified);
            this.canvas.off('selection:cleared', this._eventHandlers.selectionCleared);
        }

        // Referansları temizle
        this._eventHandlers = {};
        this._regions = [];
        this._regionOverlays = [];
        this._activeRegion = null;
        this._currentLayout = null;
        this._currentLayoutId = 'single';
        this._onRegionSelect = null;
        this._onLayoutChange = null;
        this.canvas = null;
    }
}

// ==========================================
// EXPORT'LAR
// ==========================================

/**
 * Grid layout yapılandırmalarını dışa aktar
 */
export { GridLayoutConfigs };

/**
 * Grid layout'u ID'ye göre getir
 * @param {string} layoutId - Layout ID
 * @returns {Object|undefined}
 */
export function getGridLayout(layoutId) {
    return GridLayoutConfigs[layoutId];
}

/**
 * Tüm grid layout'ları getir
 * @returns {Array}
 */
export function getAllGridLayouts() {
    return Object.values(GridLayoutConfigs);
}

/**
 * Default export
 */
export default GridManager;
