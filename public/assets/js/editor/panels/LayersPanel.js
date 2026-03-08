/**
 * LayersPanel - Katmanlar Paneli
 *
 * Canvas nesnelerinin katman sıralamasını yönetir.
 * Drag & drop ile sıralama, görünürlük, kilitleme özellikleri.
 *
 * KULLANIM:
 * ```javascript
 * import { LayersPanel } from './editor/panels/LayersPanel.js';
 *
 * const layersPanel = new LayersPanel({
 *     container: '#right-panel',
 *     canvas: fabricCanvas,
 *     i18n: (key) => translate(key)
 * });
 *
 * layersPanel.mount();
 * ```
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

import { PanelBase } from './PanelBase.js';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { CUSTOM_PROPS, shouldExcludeFromHistory } from '../core/CustomProperties.js';

/**
 * LayersPanel Sınıfı
 */
export class LayersPanel extends PanelBase {
    /**
     * @param {Object} options - Panel ayarları
     * @param {Object} options.canvas - Fabric.js Canvas instance
     */
    constructor(options = {}) {
        super({
            panelId: 'layers-panel',
            title: 'editor.layers.title',
            icon: 'ti ti-stack-2',
            ...options
        });

        /**
         * Fabric.js Canvas referansı
         * @type {Object}
         */
        this.canvas = options.canvas;
        this.selectionManager = options.selectionManager || null;

        /**
         * Seçili katman ID'si
         * @type {string|null}
         */
        this._selectedLayerId = null;

        /**
         * Drag state
         * @type {Object|null}
         */
        this._dragState = null;

        /**
         * Canvas event handler referansları
         * @type {Object}
         */
        this._canvasHandlers = {};

        // Canvas event'lerini bağla
        this._bindCanvasEvents();
    }

    /**
     * Canvas event'lerini bağla
     * @private
     */
    _bindCanvasEvents() {
        if (!this.canvas) return;

        this._canvasHandlers.objectAdded = () => this.refresh();
        this._canvasHandlers.objectRemoved = () => this.refresh();
        this._canvasHandlers.selectionCreated = (e) => {
            const obj = e.selected?.[0];
            if (obj) {
                this._selectedLayerId = obj.get(CUSTOM_PROPS.OBJECT_ID) || null;
                this._updateLayerSelection();
            }
        };
        this._canvasHandlers.selectionUpdated = (e) => {
            const obj = e.selected?.[0];
            if (obj) {
                this._selectedLayerId = obj.get(CUSTOM_PROPS.OBJECT_ID) || null;
                this._updateLayerSelection();
            }
        };
        this._canvasHandlers.selectionCleared = () => {
            this._selectedLayerId = null;
            this._updateLayerSelection();
        };

        this.canvas.on('object:added', this._canvasHandlers.objectAdded);
        this.canvas.on('object:removed', this._canvasHandlers.objectRemoved);
        this.canvas.on('selection:created', this._canvasHandlers.selectionCreated);
        this.canvas.on('selection:updated', this._canvasHandlers.selectionUpdated);
        this.canvas.on('selection:cleared', this._canvasHandlers.selectionCleared);
    }

    /**
     * Panel içeriğini render et
     * @returns {string} HTML string
     */
    renderContent() {
        const objects = this._getLayerObjects();

        if (objects.length === 0) {
            return `
                <div class="layers-empty">
                    <i class="ti ti-stack-2"></i>
                    <p>${this.__('editor.layers.empty')}</p>
                </div>
            `;
        }

        // Nesneleri ters sırada göster (üstteki nesne üstte)
        const reversedObjects = [...objects].reverse();

        const layerItems = reversedObjects.map((obj, index) => {
            return this._renderLayerItem(obj, objects.length - 1 - index);
        }).join('');

        // Çoklu seçim kontrolü
        const activeObj = this.canvas?.getActiveObject();
        const isMultiSelect = this._isActiveSelectionObject(activeObj);
        const isGroup = this._isGroupObject(activeObj);
        const multiClass = isMultiSelect ? '' : 'disabled';
        const groupClass = isMultiSelect ? '' : 'disabled';
        const ungroupClass = isGroup ? '' : 'disabled';

        return `
            <div class="layers-toolbar">
                <button type="button" class="btn-icon" data-action="bring-front" title="${this.__('editor.layers.bringToFront')}">
                    <i class="ti ti-arrow-bar-to-up"></i>
                </button>
                <button type="button" class="btn-icon" data-action="bring-forward" title="${this.__('editor.layers.bringForward')}">
                    <i class="ti ti-arrow-up"></i>
                </button>
                <button type="button" class="btn-icon" data-action="send-backward" title="${this.__('editor.layers.sendBackward')}">
                    <i class="ti ti-arrow-down"></i>
                </button>
                <button type="button" class="btn-icon" data-action="send-back" title="${this.__('editor.layers.sendToBack')}">
                    <i class="ti ti-arrow-bar-to-down"></i>
                </button>
                <span class="layers-toolbar-separator"></span>
                <button type="button" class="btn-icon ${groupClass}" data-action="group-objects" title="${this.__('editor.layers.groupObjects')}">
                    <i class="ti ti-box-multiple"></i>
                </button>
                <button type="button" class="btn-icon ${ungroupClass}" data-action="ungroup-objects" title="${this.__('editor.layers.ungroupObjects')}">
                    <i class="ti ti-arrows-split-2"></i>
                </button>
                <span class="layers-toolbar-separator"></span>
                <button type="button" class="btn-icon ${multiClass}" data-action="align-left" title="${this.__('editor.layers.alignLeft')}">
                    <i class="ti ti-align-left"></i>
                </button>
                <button type="button" class="btn-icon ${multiClass}" data-action="align-center-h" title="${this.__('editor.layers.alignCenterH')}">
                    <i class="ti ti-align-center"></i>
                </button>
                <button type="button" class="btn-icon ${multiClass}" data-action="align-right" title="${this.__('editor.layers.alignRight')}">
                    <i class="ti ti-align-right"></i>
                </button>
                <button type="button" class="btn-icon ${multiClass}" data-action="align-top" title="${this.__('editor.layers.alignTop')}">
                    <i class="ti ti-align-box-top-center"></i>
                </button>
                <button type="button" class="btn-icon ${multiClass}" data-action="align-center-v" title="${this.__('editor.layers.alignCenterV')}">
                    <i class="ti ti-align-box-center-middle"></i>
                </button>
                <button type="button" class="btn-icon ${multiClass}" data-action="align-bottom" title="${this.__('editor.layers.alignBottom')}">
                    <i class="ti ti-align-box-bottom-center"></i>
                </button>
                <span class="layers-toolbar-separator"></span>
                <button type="button" class="btn-icon ${multiClass}" data-action="distribute-h" title="${this.__('editor.layers.distributeH')}">
                    <i class="ti ti-spacing-horizontal"></i>
                </button>
                <button type="button" class="btn-icon ${multiClass}" data-action="distribute-v" title="${this.__('editor.layers.distributeV')}">
                    <i class="ti ti-spacing-vertical"></i>
                </button>
            </div>
            <div class="layers-list" data-sortable="true">
                ${layerItems}
            </div>
        `;
    }

    /**
     * Katman öğesini render et
     * @private
     * @param {Object} obj - Fabric.js nesnesi
     * @param {number} index - Katman indeksi
     * @returns {string} HTML string
     */
    _renderLayerItem(obj, index) {
        const id = obj.get(CUSTOM_PROPS.OBJECT_ID) || `layer-${index}`;
        const type = obj.type;
        const customType = obj.get(CUSTOM_PROPS.TYPE) || type;
        const visible = obj.visible !== false;
        const locked = obj.lockMovementX && obj.lockMovementY;
        const selected = this._selectedLayerId === id;

        // Nesne adını belirle
        let name = obj.get(CUSTOM_PROPS.OBJECT_NAME) || this._getObjectTypeName(customType);

        // Metin nesneleri için içeriği göster
        if (this._isTextObject(obj)) {
            const text = obj.text || '';
            name = text.length > 20 ? text.substring(0, 20) + '...' : text || name;
        }

        // İkon
        const icon = this._getObjectIcon(customType);

        return `
            <div class="layer-item ${selected ? 'selected' : ''} ${locked ? 'locked' : ''}"
                 data-layer-id="${id}"
                 data-index="${index}"
                 draggable="true">
                <div class="layer-drag-handle">
                    <i class="ti ti-grip-vertical"></i>
                </div>
                <div class="layer-icon">
                    <i class="${icon}"></i>
                </div>
                <div class="layer-name" data-action="select">
                    ${name}
                </div>
                <div class="layer-actions">
                    <button type="button" class="layer-btn ${visible ? 'active' : ''}"
                            data-action="toggle-visibility" title="${this.__('editor.layers.visibility')}">
                        <i class="ti ti-eye${visible ? '' : '-off'}"></i>
                    </button>
                    <button type="button" class="layer-btn ${locked ? 'active' : ''}"
                            data-action="toggle-lock" title="${this.__('editor.layers.lock')}">
                        <i class="ti ti-lock${locked ? '' : '-open'}"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Katman nesnelerini al (grid ve guide hariç)
     * @private
     * @returns {Array<Object>}
     */
    _getLayerObjects() {
        if (!this.canvas) return [];

        return this.canvas.getObjects().filter(obj => {
            // Grid ve guide çizgilerini hariç tut
            if (shouldExcludeFromHistory(obj)) return false;

            const customType = obj.get(CUSTOM_PROPS.TYPE) || obj[CUSTOM_PROPS.CUSTOM_TYPE];
            if (customType === 'grid-line' || customType === 'grid-group' || customType === 'smart-guide' || customType === 'frame-overlay') {
                return false;
            }

            return true;
        });
    }

    /**
     * Nesne tipi için ikon al
     * @private
     * @param {string} type - Nesne tipi
     * @returns {string} Icon class
     */
    _getObjectIcon(type) {
        const icons = {
            'text': 'ti ti-typography',
            'i-text': 'ti ti-typography',
            'textbox': 'ti ti-text-resize',
            'dynamic-text': 'ti ti-braces',
            'rect': 'ti ti-square',
            'circle': 'ti ti-circle',
            'ellipse': 'ti ti-oval',
            'triangle': 'ti ti-triangle',
            'line': 'ti ti-line',
            'polygon': 'ti ti-polygon',
            'image': 'ti ti-photo',
            'dynamic-image': 'ti ti-photo-search',
            'barcode': 'ti ti-barcode',
            'qrcode': 'ti ti-qrcode',
            'group': 'ti ti-stack',
            'multi-product-frame': 'ti ti-layout-grid',
            'video-placeholder': 'ti ti-video',
            'activeSelection': 'ti ti-select',
            // Fabric.js v7 capitalized type variants
            'Rect': 'ti ti-square',
            'Circle': 'ti ti-circle',
            'Ellipse': 'ti ti-oval',
            'Triangle': 'ti ti-triangle',
            'Line': 'ti ti-line',
            'Polygon': 'ti ti-polygon',
            'Image': 'ti ti-photo',
            'Group': 'ti ti-stack',
            'ActiveSelection': 'ti ti-select',
            'Text': 'ti ti-text-size',
            'IText': 'ti ti-text-size',
            'Textbox': 'ti ti-text-size',
            'Path': 'ti ti-vector',
            'Polyline': 'ti ti-line'
        };

        return icons[type] || 'ti ti-shape';
    }

    /**
     * Nesne tipi adını al
     * @private
     * @param {string} type - Nesne tipi
     * @returns {string}
     */
    _getObjectTypeName(type) {
        const names = {
            'text': this.__('editor.elements.text'),
            'i-text': this.__('editor.elements.text'),
            'textbox': this.__('editor.elements.textbox'),
            'dynamic-text': this.__('editor.elements.dynamicText'),
            'rect': this.__('editor.elements.rectangle'),
            'circle': this.__('editor.elements.circle'),
            'ellipse': this.__('editor.elements.ellipse'),
            'triangle': this.__('editor.elements.triangle'),
            'line': this.__('editor.elements.line'),
            'polygon': this.__('editor.elements.polygon'),
            'image': this.__('editor.elements.image'),
            'dynamic-image': this.__('editor.elements.dynamicImage'),
            'barcode': this.__('editor.elements.barcode'),
            'qrcode': this.__('editor.elements.qrcode'),
            'group': this.__('editor.elements.group'),
            'multi-product-frame': this.__('editor.elements.multiProductFrame'),
            'video-placeholder': 'Video',
            // Fabric.js v7 capitalized type variants
            'Rect': this.__('editor.elements.rectangle'),
            'Circle': this.__('editor.elements.circle'),
            'Ellipse': this.__('editor.elements.ellipse'),
            'Triangle': this.__('editor.elements.triangle'),
            'Line': this.__('editor.elements.line'),
            'Polygon': this.__('editor.elements.polygon'),
            'Image': this.__('editor.elements.image'),
            'Group': this.__('editor.elements.group'),
            'Text': this.__('editor.elements.text'),
            'IText': this.__('editor.elements.text'),
            'Textbox': this.__('editor.elements.textbox'),
            'Path': 'Path',
            'Polyline': 'Polyline'
        };

        return names[type] || type;
    }

    /**
     * Nesne metin mi?
     * @private
     * @param {Object} obj - Fabric.js nesnesi
     * @returns {boolean}
     */
    _isTextObject(obj) {
        const type = obj.type;
        return type === 'text' || type === 'i-text' || type === 'textbox' ||
               type === 'Text' || type === 'FabricText' || type === 'Textbox' || type === 'IText';
    }

    /**
     * Event'leri bağla
     */
    bindEvents() {
        if (!this.element) return;

        // Katman seçimi
        this.$$('[data-action="select"]').forEach(el => {
            this._addEventListener(el, 'click', (e) => {
                const layerItem = e.target.closest('.layer-item');
                const layerId = layerItem?.dataset.layerId;
                if (layerId) {
                    this._selectLayer(layerId);
                }
            });
        });

        // Görünürlük toggle
        this.$$('[data-action="toggle-visibility"]').forEach(btn => {
            this._addEventListener(btn, 'click', (e) => {
                e.stopPropagation();
                const layerItem = e.target.closest('.layer-item');
                const layerId = layerItem?.dataset.layerId;
                if (layerId) {
                    this._toggleVisibility(layerId);
                }
            });
        });

        // Kilit toggle
        this.$$('[data-action="toggle-lock"]').forEach(btn => {
            this._addEventListener(btn, 'click', (e) => {
                e.stopPropagation();
                const layerItem = e.target.closest('.layer-item');
                const layerId = layerItem?.dataset.layerId;
                if (layerId) {
                    this._toggleLock(layerId);
                }
            });
        });

        // Toolbar butonları - Sıralama
        this.$('[data-action="bring-front"]')?.addEventListener('click', () => this._bringToFront());
        this.$('[data-action="bring-forward"]')?.addEventListener('click', () => this._bringForward());
        this.$('[data-action="send-backward"]')?.addEventListener('click', () => this._sendBackward());
        this.$('[data-action="send-back"]')?.addEventListener('click', () => this._sendToBack());

        // Toolbar butonları - Gruplama
        this.$('[data-action="group-objects"]')?.addEventListener('click', () => this._groupObjects());
        this.$('[data-action="ungroup-objects"]')?.addEventListener('click', () => this._ungroupObjects());

        // Toolbar butonları - Hizalama
        this.$('[data-action="align-left"]')?.addEventListener('click', () => this._alignObjects('left'));
        this.$('[data-action="align-center-h"]')?.addEventListener('click', () => this._alignObjects('centerH'));
        this.$('[data-action="align-right"]')?.addEventListener('click', () => this._alignObjects('right'));
        this.$('[data-action="align-top"]')?.addEventListener('click', () => this._alignObjects('top'));
        this.$('[data-action="align-center-v"]')?.addEventListener('click', () => this._alignObjects('centerV'));
        this.$('[data-action="align-bottom"]')?.addEventListener('click', () => this._alignObjects('bottom'));

        // Toolbar butonları - Dağıtma
        this.$('[data-action="distribute-h"]')?.addEventListener('click', () => this._distributeObjects('horizontal'));
        this.$('[data-action="distribute-v"]')?.addEventListener('click', () => this._distributeObjects('vertical'));

        // Drag & drop
        this._bindDragEvents();
    }

    /**
     * Drag & drop event'lerini bağla
     * @private
     */
    _bindDragEvents() {
        const list = this.$('.layers-list');
        if (!list) return;

        this.$$('.layer-item').forEach(item => {
            this._addEventListener(item, 'dragstart', (e) => this._handleDragStart(e));
            this._addEventListener(item, 'dragover', (e) => this._handleDragOver(e));
            this._addEventListener(item, 'dragend', (e) => this._handleDragEnd(e));
            this._addEventListener(item, 'drop', (e) => this._handleDrop(e));
        });
    }

    /**
     * Drag start
     * @private
     * @param {DragEvent} e
     */
    _handleDragStart(e) {
        const item = e.target.closest('.layer-item');
        if (!item) return;

        this._dragState = {
            layerId: item.dataset.layerId,
            startIndex: parseInt(item.dataset.index, 10)
        };

        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    /**
     * Drag over
     * @private
     * @param {DragEvent} e
     */
    _handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const item = e.target.closest('.layer-item');
        if (!item || !this._dragState) return;

        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        // Üst veya alt yarısına göre indicator göster
        item.classList.remove('drag-over-top', 'drag-over-bottom');
        if (e.clientY < midY) {
            item.classList.add('drag-over-top');
        } else {
            item.classList.add('drag-over-bottom');
        }
    }

    /**
     * Drag end
     * @private
     * @param {DragEvent} e
     */
    _handleDragEnd(e) {
        const item = e.target.closest('.layer-item');
        if (item) {
            item.classList.remove('dragging');
        }

        // Tüm indicator'ları temizle
        this.$$('.layer-item').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        this._dragState = null;
    }

    /**
     * Drop
     * @private
     * @param {DragEvent} e
     */
    _handleDrop(e) {
        e.preventDefault();

        const item = e.target.closest('.layer-item');
        if (!item || !this._dragState) return;

        const targetIndex = parseInt(item.dataset.index, 10);
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midY;

        // Nesneyi bul ve sırasını değiştir
        this._reorderLayer(this._dragState.layerId, targetIndex, insertBefore);
    }

    /**
     * Katmanı seç
     * @private
     * @param {string} layerId - Katman ID
     */
    _selectLayer(layerId) {
        if (!this.canvas) return;

        const obj = this._findObjectById(layerId);
        if (obj) {
            this.canvas.setActiveObject(obj);
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Görünürlük toggle
     * @private
     * @param {string} layerId - Katman ID
     */
    _toggleVisibility(layerId) {
        const obj = this._findObjectById(layerId);
        if (!obj) return;

        obj.set('visible', !obj.visible);
        this.canvas?.requestRenderAll();
        this.refresh();

        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'layers-visibility' });
    }

    /**
     * Kilit toggle
     * @private
     * @param {string} layerId - Katman ID
     */
    _toggleLock(layerId) {
        const obj = this._findObjectById(layerId);
        if (!obj) return;

        const isLocked = obj.lockMovementX && obj.lockMovementY;
        const newLockState = !isLocked;

        obj.set({
            lockMovementX: newLockState,
            lockMovementY: newLockState,
            lockRotation: newLockState,
            lockScalingX: newLockState,
            lockScalingY: newLockState,
            selectable: !newLockState
        });

        this.canvas?.requestRenderAll();
        this.refresh();

        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'layers-lock' });
    }

    /**
     * En öne getir
     * @private
     */
    _bringToFront() {
        const activeObject = this.canvas?.getActiveObject();
        if (!activeObject || !this.canvas) return;

        // Fabric.js v7: Canvas üzerinde metod çağrılır
        if (typeof this.canvas.bringObjectToFront === 'function') {
            this.canvas.bringObjectToFront(activeObject);
        } else if (typeof activeObject.bringToFront === 'function') {
            // v5 fallback
            activeObject.bringToFront();
        }
        this.canvas.requestRenderAll();
        this.refresh();

        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'layers-order' });
    }

    /**
     * Bir öne getir
     * @private
     */
    _bringForward() {
        const activeObject = this.canvas?.getActiveObject();
        if (!activeObject || !this.canvas) return;

        // Fabric.js v7: Canvas üzerinde metod çağrılır
        if (typeof this.canvas.bringObjectForward === 'function') {
            this.canvas.bringObjectForward(activeObject);
        } else if (typeof activeObject.bringForward === 'function') {
            // v5 fallback
            activeObject.bringForward();
        }
        this.canvas.requestRenderAll();
        this.refresh();

        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'layers-order' });
    }

    /**
     * Bir arkaya gönder
     * @private
     */
    _sendBackward() {
        const activeObject = this.canvas?.getActiveObject();
        if (!activeObject || !this.canvas) return;

        // Fabric.js v7: Canvas üzerinde metod çağrılır
        if (typeof this.canvas.sendObjectBackwards === 'function') {
            this.canvas.sendObjectBackwards(activeObject);
        } else if (typeof activeObject.sendBackwards === 'function') {
            // v5 fallback
            activeObject.sendBackwards();
        }
        this.canvas.requestRenderAll();
        this.refresh();

        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'layers-order' });
    }

    /**
     * En arkaya gönder
     * @private
     */
    _sendToBack() {
        const activeObject = this.canvas?.getActiveObject();
        if (!activeObject || !this.canvas) return;

        // Fabric.js v7: Canvas üzerinde metod çağrılır
        if (typeof this.canvas.sendObjectToBack === 'function') {
            this.canvas.sendObjectToBack(activeObject);
        } else if (typeof activeObject.sendToBack === 'function') {
            // v5 fallback
            activeObject.sendToBack();
        }
        this.canvas.requestRenderAll();
        this.refresh();

        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'layers-order' });
    }

    // ==========================================
    // GRUPLAMA
    // ==========================================

    /**
     * Seçili nesneleri grupla
     * @private
     */
    _groupObjects() {
        if (!this.canvas) return;

        if (!this.selectionManager || typeof this.selectionManager.groupSelected !== 'function') return;

        const grouped = this.selectionManager.groupSelected();
        if (!grouped) return;
        this.refresh();
    }

    /**
     * Seçili grubu çöz
     * @private
     */
    _ungroupObjects() {
        if (!this.canvas) return;
        if (!this.selectionManager || typeof this.selectionManager.ungroupSelected !== 'function') return;

        const ungrouped = this.selectionManager.ungroupSelected();
        if (!ungrouped) return;
        this.refresh();
    }

    // ==========================================
    // HİZALAMA & DAĞITMA
    // ==========================================

    /**
     * Seçili nesnelerin listesini al (ActiveSelection içinden)
     * @private
     * @returns {Object[]|null} Fabric.js nesneleri
     */
    _getSelectedObjects() {
        const activeObj = this.canvas?.getActiveObject();
        if (!activeObj) return null;

        // ActiveSelection (çoklu seçim)
        if (this._isActiveSelectionObject(activeObj)) {
            const objects = activeObj.getObjects();
            return objects && objects.length >= 2 ? objects : null;
        }
        return null;
    }

    /**
     * Nesneleri hizala
     * @private
     * @param {'left'|'centerH'|'right'|'top'|'centerV'|'bottom'} direction
     */
    _alignObjects(direction) {
        const objects = this._getSelectedObjects();
        if (!objects || !this.canvas) return;

        const activeSelection = this.canvas.getActiveObject();
        const hasRotatedObject = objects.some(obj => Math.abs(Number(obj?.angle || 0)) > 0.01);

        if (hasRotatedObject) {
            // Rotasyonlu nesnelerde mevcut boundingRect hizalama daha güvenli
            const objectBounds = objects.map(obj => this._getEffectiveBoundingRect(obj));
            const groupLeft = Math.min(...objectBounds.map(b => b.left));
            const groupTop = Math.min(...objectBounds.map(b => b.top));
            const groupRight = Math.max(...objectBounds.map(b => b.left + b.width));
            const groupBottom = Math.max(...objectBounds.map(b => b.top + b.height));
            const groupBound = {
                left: groupLeft,
                top: groupTop,
                width: groupRight - groupLeft,
                height: groupBottom - groupTop
            };
            objects.forEach(obj => {
                const objBound = this._getEffectiveBoundingRect(obj);
                switch (direction) {
                    case 'left':
                        obj.set('left', obj.left + (groupBound.left - objBound.left));
                        break;
                    case 'centerH': {
                        const groupCenterX = groupBound.left + groupBound.width / 2;
                        const objCenterX = objBound.left + objBound.width / 2;
                        obj.set('left', obj.left + (groupCenterX - objCenterX));
                        break;
                    }
                    case 'right': {
                        const groupRight = groupBound.left + groupBound.width;
                        const objRight = objBound.left + objBound.width;
                        obj.set('left', obj.left + (groupRight - objRight));
                        break;
                    }
                    case 'top':
                        obj.set('top', obj.top + (groupBound.top - objBound.top));
                        break;
                    case 'centerV': {
                        const groupCenterY = groupBound.top + groupBound.height / 2;
                        const objCenterY = objBound.top + objBound.height / 2;
                        obj.set('top', obj.top + (groupCenterY - objCenterY));
                        break;
                    }
                    case 'bottom': {
                        const groupBottom = groupBound.top + groupBound.height;
                        const objBottom = objBound.top + objBound.height;
                        obj.set('top', obj.top + (groupBottom - objBottom));
                        break;
                    }
                }
                obj.setCoords();
            });
        } else {
            // Rotasyonsuz nesnelerde origin/anchor bazlı hizalama:
            // Text/Textbox iç girinti farklarından etkilenmez, kutu başlangıcını eşitler.
            const anchorBounds = objects.map(obj => this._getEffectiveBounds(obj));
            const minLeft = Math.min(...anchorBounds.map(b => b.left));
            const maxRight = Math.max(...anchorBounds.map(b => b.right));
            const minTop = Math.min(...anchorBounds.map(b => b.top));
            const maxBottom = Math.max(...anchorBounds.map(b => b.bottom));
            const centerX = (minLeft + maxRight) / 2;
            const centerY = (minTop + maxBottom) / 2;

            objects.forEach(obj => {
                switch (direction) {
                    case 'left':
                        this._setObjectXByAnchor(obj, 'left', minLeft);
                        break;
                    case 'centerH':
                        this._setObjectXByAnchor(obj, 'center', centerX);
                        break;
                    case 'right':
                        this._setObjectXByAnchor(obj, 'right', maxRight);
                        break;
                    case 'top':
                        this._setObjectYByAnchor(obj, 'top', minTop);
                        break;
                    case 'centerV':
                        this._setObjectYByAnchor(obj, 'center', centerY);
                        break;
                    case 'bottom':
                        this._setObjectYByAnchor(obj, 'bottom', maxBottom);
                        break;
                }
                obj.setCoords();
            });
        }

        activeSelection.setCoords();
        this.canvas.requestRenderAll();
        this._emitObjectsModified(objects, 'align');
        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'align' });
    }

    /**
     * Objenin origin'e göre anchor sınırlarını hesapla (rotasyonsuz varsayım).
     * @private
     * @param {Object} obj
     * @returns {{left:number,right:number,top:number,bottom:number}}
     */
    _getAnchorBounds(obj) {
        const scaleX = Number(obj?.scaleX) || 1;
        const scaleY = Number(obj?.scaleY) || 1;
        const contentW = Math.max(0, (Number(obj?.width) || 0) * scaleX);
        const contentH = Math.max(0, (Number(obj?.height) || 0) * scaleY);

        // strokeUniform=true → stroke doesn't scale, adds fixed px on each side
        const sw = Number(obj?.strokeWidth) || 0;
        const strokeExtra = obj?.strokeUniform ? sw : sw * Math.max(scaleX, scaleY);
        const width = contentW + strokeExtra;
        const height = contentH + strokeExtra;

        const originX = String(obj?.originX || 'left').toLowerCase();
        const originY = String(obj?.originY || 'top').toLowerCase();

        const rawLeft = Number(obj?.left) || 0;
        const rawTop = Number(obj?.top) || 0;

        let left = rawLeft - (strokeExtra / 2);
        if (originX === 'center') left = rawLeft - (width / 2);
        else if (originX === 'right') left = rawLeft - width + (strokeExtra / 2);

        let top = rawTop - (strokeExtra / 2);
        if (originY === 'center') top = rawTop - (height / 2);
        else if (originY === 'bottom') top = rawTop - height + (strokeExtra / 2);

        return {
            left,
            right: left + width,
            top,
            bottom: top + height
        };
    }

    /**
     * Frame varsa frame overlay'i; yoksa nesnenin kendi anchor bounds'unu dÃ¶ndÃ¼r.
     * @private
     * @param {Object} obj
     * @returns {{left:number,right:number,top:number,bottom:number,width:number,height:number,isFrameBounds:boolean}}
     */
    _getEffectiveBounds(obj) {
        const frameObj = this._getFrameOverlayObject(obj);
        if (frameObj) {
            const rect = frameObj.getBoundingRect(true);
            const left = rect.left;
            const top = rect.top;
            const width = rect.width;
            const height = rect.height;
            return {
                left,
                right: left + width,
                top,
                bottom: top + height,
                width,
                height,
                isFrameBounds: true
            };
        }

        const anchorBounds = this._getAnchorBounds(obj);
        return {
            ...anchorBounds,
            width: anchorBounds.right - anchorBounds.left,
            height: anchorBounds.bottom - anchorBounds.top,
            isFrameBounds: false
        };
    }

    /**
     * Rotasyonlu akÄ±ÅŸlarda kullanÄ±lan etkin boundingRect.
     * @private
     * @param {Object} obj
     * @returns {{left:number,top:number,width:number,height:number}}
     */
    _getEffectiveBoundingRect(obj) {
        const frameObj = this._getFrameOverlayObject(obj);
        if (frameObj) {
            return frameObj.getBoundingRect(true);
        }
        return obj.getBoundingRect(true);
    }

    /**
     * Hedef nesneye baÄŸlÄ± frame overlay nesnesini bul.
     * @private
     * @param {Object} obj
     * @returns {Object|null}
     */
    _getFrameOverlayObject(obj) {
        if (!obj || !this.canvas) return null;

        const overlayId = obj[CUSTOM_PROPS.FRAME_OVERLAY_ID];
        if (!overlayId) return null;

        const objects = this.canvas.getObjects();
        for (let i = 0; i < objects.length; i++) {
            const candidate = objects[i];
            const customType = candidate.get(CUSTOM_PROPS.CUSTOM_TYPE) || candidate[CUSTOM_PROPS.CUSTOM_TYPE];
            if (candidate[CUSTOM_PROPS.OBJECT_ID] === overlayId && customType === 'frame-overlay') {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Objenin X konumunu hedef anchor'a göre ayarla.
     * @private
     * @param {Object} obj
     * @param {'left'|'center'|'right'} anchor
     * @param {number} value
     */
    _setObjectXByAnchor(obj, anchor, value) {
        const effective = this._getEffectiveBounds(obj);
        if (effective.isFrameBounds) {
            let targetLeft = value;
            if (anchor === 'center') targetLeft = value - (effective.width / 2);
            else if (anchor === 'right') targetLeft = value - effective.width;
            const deltaX = targetLeft - effective.left;
            obj.set('left', (Number(obj?.left) || 0) + deltaX);
            return;
        }

        const scaleX = Number(obj?.scaleX) || 1;
        const contentW = Math.max(0, (Number(obj?.width) || 0) * scaleX);
        const sw = Number(obj?.strokeWidth) || 0;
        const strokeExtra = obj?.strokeUniform ? sw : sw * scaleX;
        const width = contentW + strokeExtra;
        const originX = String(obj?.originX || 'left').toLowerCase();

        let centerX = value;
        if (anchor === 'left') centerX = value + (width / 2);
        else if (anchor === 'right') centerX = value - (width / 2);

        let nextLeft = centerX;
        if (originX === 'left') nextLeft = centerX - (contentW / 2);
        else if (originX === 'center') nextLeft = centerX;
        else if (originX === 'right') nextLeft = centerX + (contentW / 2);

        obj.set('left', nextLeft);
    }

    /**
     * Objenin Y konumunu hedef anchor'a göre ayarla.
     * @private
     * @param {Object} obj
     * @param {'top'|'center'|'bottom'} anchor
     * @param {number} value
     */
    _setObjectYByAnchor(obj, anchor, value) {
        const effective = this._getEffectiveBounds(obj);
        if (effective.isFrameBounds) {
            let targetTop = value;
            if (anchor === 'center') targetTop = value - (effective.height / 2);
            else if (anchor === 'bottom') targetTop = value - effective.height;
            const deltaY = targetTop - effective.top;
            obj.set('top', (Number(obj?.top) || 0) + deltaY);
            return;
        }

        const scaleY = Number(obj?.scaleY) || 1;
        const contentH = Math.max(0, (Number(obj?.height) || 0) * scaleY);
        const sw = Number(obj?.strokeWidth) || 0;
        const strokeExtra = obj?.strokeUniform ? sw : sw * scaleY;
        const height = contentH + strokeExtra;
        const originY = String(obj?.originY || 'top').toLowerCase();

        let centerY = value;
        if (anchor === 'top') centerY = value + (height / 2);
        else if (anchor === 'bottom') centerY = value - (height / 2);

        let nextTop = centerY;
        if (originY === 'top') nextTop = centerY - (contentH / 2);
        else if (originY === 'center') nextTop = centerY;
        else if (originY === 'bottom') nextTop = centerY + (contentH / 2);

        obj.set('top', nextTop);
    }

    /**
     * Nesneleri eşit aralıklarla dağıt
     * @private
     * @param {'horizontal'|'vertical'} direction
     */
    _distributeObjects(direction) {
        const objects = this._getSelectedObjects();
        if (!objects || objects.length < 3 || !this.canvas) return;

        const activeSelection = this.canvas.getActiveObject();
        const hasRotatedObject = objects.some(obj => Math.abs(Number(obj?.angle || 0)) > 0.01);

        if (hasRotatedObject) {
            if (direction === 'horizontal') {
                // Nesneleri sol kenarlarına göre sırala
                const sorted = [...objects].sort((a, b) => {
                    return this._getEffectiveBoundingRect(a).left - this._getEffectiveBoundingRect(b).left;
                });

                const bounds = sorted.map(obj => this._getEffectiveBoundingRect(obj));
                const firstLeft = bounds[0].left;
                const lastRight = bounds[bounds.length - 1].left + bounds[bounds.length - 1].width;
                const totalObjWidth = bounds.reduce((sum, b) => sum + b.width, 0);
                const totalSpace = (lastRight - firstLeft) - totalObjWidth;
                const gap = totalSpace / (sorted.length - 1);

                let currentX = firstLeft;
                sorted.forEach((obj, i) => {
                    const bound = bounds[i];
                    if (i > 0) {
                        obj.set('left', obj.left + (currentX - bound.left));
                        obj.setCoords();
                    }
                    currentX = currentX + bound.width + gap;
                });
            } else {
                // Nesneleri üst kenarlarına göre sırala
                const sorted = [...objects].sort((a, b) => {
                    return this._getEffectiveBoundingRect(a).top - this._getEffectiveBoundingRect(b).top;
                });

                const bounds = sorted.map(obj => this._getEffectiveBoundingRect(obj));
                const firstTop = bounds[0].top;
                const lastBottom = bounds[bounds.length - 1].top + bounds[bounds.length - 1].height;
                const totalObjHeight = bounds.reduce((sum, b) => sum + b.height, 0);
                const totalSpace = (lastBottom - firstTop) - totalObjHeight;
                const gap = totalSpace / (sorted.length - 1);

                let currentY = firstTop;
                sorted.forEach((obj, i) => {
                    const bound = bounds[i];
                    if (i > 0) {
                        obj.set('top', obj.top + (currentY - bound.top));
                        obj.setCoords();
                    }
                    currentY = currentY + bound.height + gap;
                });
            }
        } else if (direction === 'horizontal') {
            const items = objects
                .map(obj => ({ obj, bounds: this._getEffectiveBounds(obj) }))
                .sort((a, b) => a.bounds.left - b.bounds.left);

            const firstLeft = items[0].bounds.left;
            const lastRight = items[items.length - 1].bounds.right;
            const totalObjWidth = items.reduce((sum, item) => sum + (item.bounds.right - item.bounds.left), 0);
            const totalSpace = (lastRight - firstLeft) - totalObjWidth;
            const gap = totalSpace / (items.length - 1);

            let currentLeft = firstLeft;
            items.forEach((item, idx) => {
                const width = item.bounds.right - item.bounds.left;
                if (idx > 0) {
                    this._setObjectXByAnchor(item.obj, 'left', currentLeft);
                    item.obj.setCoords();
                }
                currentLeft += width + gap;
            });
        } else {
            const items = objects
                .map(obj => ({ obj, bounds: this._getEffectiveBounds(obj) }))
                .sort((a, b) => a.bounds.top - b.bounds.top);

            const firstTop = items[0].bounds.top;
            const lastBottom = items[items.length - 1].bounds.bottom;
            const totalObjHeight = items.reduce((sum, item) => sum + (item.bounds.bottom - item.bounds.top), 0);
            const totalSpace = (lastBottom - firstTop) - totalObjHeight;
            const gap = totalSpace / (items.length - 1);

            let currentTop = firstTop;
            items.forEach((item, idx) => {
                const height = item.bounds.bottom - item.bounds.top;
                if (idx > 0) {
                    this._setObjectYByAnchor(item.obj, 'top', currentTop);
                    item.obj.setCoords();
                }
                currentTop += height + gap;
            });
        }

        activeSelection.setCoords();
        this.canvas.requestRenderAll();
        this._emitObjectsModified(objects, 'distribute');
        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'distribute' });
    }

    /**
     * Katman sırasını değiştir
     * @private
     * @param {string} layerId - Taşınan katman ID
     * @param {number} targetIndex - Hedef indeks
     * @param {boolean} insertBefore - Önüne mi eklenecek
     */
    _emitObjectsModified(objects, action) {
        if (!Array.isArray(objects)) return;
        objects.forEach((obj) => {
            if (!obj) return;
            eventBus.emit(EVENTS.OBJECT_MODIFIED, {
                target: obj,
                action
            });
        });
    }

    _reorderLayer(layerId, targetIndex, insertBefore) {
        if (!this.canvas) return;

        const objects = this._getLayerObjects();
        const obj = this._findObjectById(layerId);
        if (!obj) return;

        const currentIndex = objects.indexOf(obj);
        if (currentIndex === -1) return;

        // Hedef indeksi hesapla (UI'da ters sırada gösterildiği için)
        let newIndex = targetIndex;
        if (!insertBefore) {
            newIndex = Math.max(0, targetIndex - 1);
        }

        // Aynı pozisyonsa bir şey yapma
        if (currentIndex === newIndex) return;

        // moveTo kullan
        this.canvas.moveTo(obj, newIndex);
        this.canvas.requestRenderAll();
        this.refresh();

        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'layers-reorder' });
    }

    /**
     * ID'ye göre nesne bul
     * @private
     * @param {string} id - Nesne ID
     * @returns {Object|null}
     */
    _findObjectById(id) {
        if (!this.canvas) return null;

        return this.canvas.getObjects().find(obj => {
            return obj.get(CUSTOM_PROPS.OBJECT_ID) === id;
        }) || null;
    }

    /**
     * Katman seçim görünümünü güncelle
     * @private
     */
    _updateLayerSelection() {
        this.$$('.layer-item').forEach(item => {
            const isSelected = item.dataset.layerId === this._selectedLayerId;
            item.classList.toggle('selected', isSelected);
        });

        // Hizalama/dağıtma toolbar butonlarının durumunu güncelle
        this._updateAlignToolbarState();
    }

    /**
     * Hizalama ve dağıtma toolbar butonlarının aktif/pasif durumunu güncelle
     * @private
     */
    _updateAlignToolbarState() {
        if (!this.element) return;

        const activeObj = this.canvas?.getActiveObject();
        const isMultiSelect = this._isActiveSelectionObject(activeObj);
        const isGroup = this._isGroupObject(activeObj);

        const alignActions = [
            'align-left', 'align-center-h', 'align-right',
            'align-top', 'align-center-v', 'align-bottom',
            'distribute-h', 'distribute-v'
        ];

        alignActions.forEach(action => {
            const btn = this.$(`[data-action="${action}"]`);
            if (btn) {
                if (isMultiSelect) {
                    btn.classList.remove('disabled');
                } else {
                    btn.classList.add('disabled');
                }
            }
        });

        const groupBtn = this.$('[data-action="group-objects"]');
        if (groupBtn) {
            groupBtn.classList.toggle('disabled', !isMultiSelect);
        }

        const ungroupBtn = this.$('[data-action="ungroup-objects"]');
        if (ungroupBtn) {
            ungroupBtn.classList.toggle('disabled', !isGroup);
        }
    }

    /**
     * ActiveSelection tip kontrolü (Fabric 7 farklı casing varyantları)
     * @private
     * @param {Object|null} obj
     * @returns {boolean}
     */
    _isActiveSelectionObject(obj) {
        return String(obj?.type || '').toLowerCase() === 'activeselection';
    }

    /**
     * Group tip kontrolü (Fabric 7 farklı casing varyantları)
     * @private
     * @param {Object|null} obj
     * @returns {boolean}
     */
    _isGroupObject(obj) {
        return String(obj?.type || '').toLowerCase() === 'group';
    }

    /**
     * Canvas referansını ayarla
     * @param {Object} canvas - Fabric.js Canvas
     */
    setCanvas(canvas) {
        // Eski event'leri kaldır
        if (this.canvas) {
            this.canvas.off('object:added', this._canvasHandlers.objectAdded);
            this.canvas.off('object:removed', this._canvasHandlers.objectRemoved);
            this.canvas.off('selection:created', this._canvasHandlers.selectionCreated);
            this.canvas.off('selection:updated', this._canvasHandlers.selectionUpdated);
            this.canvas.off('selection:cleared', this._canvasHandlers.selectionCleared);
        }

        this.canvas = canvas;
        this._selectedLayerId = null;

        // Yeni event'leri bağla
        this._bindCanvasEvents();
        this.refresh();
    }

    /**
     * Panel'i dispose et
     */
    dispose() {
        // Canvas event'lerini kaldır
        if (this.canvas) {
            this.canvas.off('object:added', this._canvasHandlers.objectAdded);
            this.canvas.off('object:removed', this._canvasHandlers.objectRemoved);
            this.canvas.off('selection:created', this._canvasHandlers.selectionCreated);
            this.canvas.off('selection:updated', this._canvasHandlers.selectionUpdated);
            this.canvas.off('selection:cleared', this._canvasHandlers.selectionCleared);
        }

        this._canvasHandlers = {};
        this._dragState = null;
        this.canvas = null;

        super.dispose();
    }
}

/**
 * Default export
 */
export default LayersPanel;
