/**
 * SelectionManager - Seçim Yönetimi
 *
 * Canvas'taki nesne seçim işlemlerini yönetir.
 * Multi-select, grup seçimi ve seçim event'lerini yönetir.
 *
 * KULLANIM:
 * ```javascript
 * import { SelectionManager } from './editor/managers/SelectionManager.js';
 *
 * const selectionManager = new SelectionManager(canvas);
 *
 * // Tek nesne seç
 * selectionManager.selectObject(object);
 *
 * // Çoklu seçim
 * selectionManager.selectObjects([obj1, obj2, obj3]);
 *
 * // Tümünü seç
 * selectionManager.selectAll();
 *
 * // Seçimi dinle
 * selectionManager.onSelectionChange((objects) => {
 *     console.log('Seçilen nesneler:', objects);
 * });
 * ```
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

import { eventBus, EVENTS } from '../core/EventBus.js';
import { CUSTOM_PROPS, isTransient } from '../core/CustomProperties.js';
import { ActiveSelection, Group } from '../core/FabricExports.js';

/**
 * SelectionManager Sınıfı
 */
export class SelectionManager {
    /**
     * @param {Object} options - Ayarlar
     * @param {Object} options.canvas - Fabric.js Canvas instance
     */
    constructor(options = {}) {
        /**
         * Fabric.js Canvas referansı
         * @type {Object}
         */
        this.canvas = options.canvas || options;

        /**
         * Seçili nesneler listesi
         * @type {Object[]}
         */
        this._selectedObjects = [];

        /**
         * Seçim değişikliği callback'leri
         * @type {Function[]}
         */
        this._selectionCallbacks = [];

        /**
         * Event handler referansları
         * @type {Object}
         */
        this._eventHandlers = {};

        // Event'leri bağla
        this._bindEvents();
    }

    /**
     * Event'leri bağla
     * @private
     */
    _bindEvents() {
        // Canvas selection events
        this._eventHandlers.selectionCreated = (e) => {
            this._updateSelection(e.selected || [e.target]);
        };

        this._eventHandlers.selectionUpdated = (e) => {
            this._updateSelection(e.selected || []);
        };

        this._eventHandlers.selectionCleared = () => {
            this._updateSelection([]);
        };

        if (this.canvas) {
            this.canvas.on('selection:created', this._eventHandlers.selectionCreated);
            this.canvas.on('selection:updated', this._eventHandlers.selectionUpdated);
            this.canvas.on('selection:cleared', this._eventHandlers.selectionCleared);
        }

        // EventBus events
        this._eventHandlers.objectRemoved = (data) => {
            // Silinen nesne seçili ise seçimden çıkar
            const index = this._selectedObjects.indexOf(data.object);
            if (index > -1) {
                this._selectedObjects.splice(index, 1);
                this._notifySelectionChange();
            }
        };
        eventBus.on(EVENTS.OBJECT_REMOVED, this._eventHandlers.objectRemoved, this);
    }

    /**
     * Seçimi güncelle
     * @private
     * @param {Object[]} objects - Seçilen nesneler
     */
    _updateSelection(objects) {
        // Transient nesneleri filtrele
        this._selectedObjects = objects.filter(obj => !isTransient(obj));
        this._notifySelectionChange();
    }

    /**
     * Seçim değişikliğini bildir
     * @private
     */
    _notifySelectionChange() {
        // Callback'leri çağır
        this._selectionCallbacks.forEach(callback => {
            try {
                callback([...this._selectedObjects]);
            } catch (err) {
                console.error('SelectionManager: Callback hatası:', err);
            }
        });

        // EventBus'a bildir
        if (this._selectedObjects.length > 0) {
            eventBus.emit(EVENTS.OBJECT_SELECTED, {
                objects: [...this._selectedObjects],
                count: this._selectedObjects.length
            });
        } else {
            eventBus.emit(EVENTS.OBJECT_DESELECTED, {});
        }
    }

    // ==========================================
    // SEÇİM İŞLEMLERİ
    // ==========================================

    /**
     * Tek nesne seç
     * @param {Object} object - Seçilecek nesne
     * @param {boolean} [addToSelection=false] - Mevcut seçime ekle
     */
    selectObject(object, addToSelection = false) {
        if (!this.canvas || !object) return;

        if (addToSelection && this._selectedObjects.length > 0) {
            // Mevcut seçime ekle
            const objects = [...this._selectedObjects, object];
            this.selectObjects(objects);
        } else {
            // Yeni seçim
            this.canvas.setActiveObject(object);
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Çoklu nesne seç
     * @param {Object[]} objects - Seçilecek nesneler
     */
    selectObjects(objects) {
        if (!this.canvas || !objects || objects.length === 0) return;

        // Transient nesneleri filtrele
        const validObjects = objects.filter(obj => !isTransient(obj) && obj.selectable !== false);

        if (validObjects.length === 0) return;

        if (validObjects.length === 1) {
            this.canvas.setActiveObject(validObjects[0]);
        } else {
            this.canvas.discardActiveObject();
            const selection = new ActiveSelection(validObjects, { canvas: this.canvas });
            this.canvas.setActiveObject(selection);
        }

        this.canvas.requestRenderAll();
    }

    /**
     * Tüm nesneleri seç
     */
    selectAll() {
        if (!this.canvas) return;

        const objects = this.canvas.getObjects().filter(obj =>
            !isTransient(obj) && obj.selectable !== false
        );

        this.selectObjects(objects);
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
     * Belirli nesneyi seçimden çıkar
     * @param {Object} object - Seçimden çıkarılacak nesne
     */
    deselectObject(object) {
        if (!this.canvas || !object) return;

        const activeObject = this.canvas.getActiveObject();
        if (!activeObject) return;

        if (activeObject === object) {
            // Tek seçim ise tamamen kaldır
            this.deselectAll();
        } else if (this._isActiveSelectionObject(activeObject)) {
            // Çoklu seçimden çıkar
            const remainingObjects = activeObject.getObjects().filter(obj => obj !== object);
            if (remainingObjects.length === 0) {
                this.deselectAll();
            } else if (remainingObjects.length === 1) {
                this.canvas.discardActiveObject();
                this.canvas.setActiveObject(remainingObjects[0]);
                this.canvas.requestRenderAll();
            } else {
                this.selectObjects(remainingObjects);
            }
        }
    }

    /**
     * ID'ye göre nesne seç
     * @param {string} objectId - Nesne ID'si
     */
    selectById(objectId) {
        if (!this.canvas) return;

        const object = this.canvas.getObjects().find(obj =>
            obj.get(CUSTOM_PROPS.OBJECT_ID) === objectId
        );

        if (object) {
            this.selectObject(object);
        }
    }

    /**
     * Custom type'a göre nesneleri seç
     * @param {string} customType - Custom type değeri
     */
    selectByType(customType) {
        if (!this.canvas) return;

        const objects = this.canvas.getObjects().filter(obj =>
            obj.get(CUSTOM_PROPS.CUSTOM_TYPE) === customType &&
            !isTransient(obj) &&
            obj.selectable !== false
        );

        this.selectObjects(objects);
    }

    /**
     * Bölgeye göre nesneleri seç (rectangular selection)
     * @param {{left: number, top: number, width: number, height: number}} bounds - Seçim bölgesi
     */
    selectByBounds(bounds) {
        if (!this.canvas) return;

        const objects = this.canvas.getObjects().filter(obj => {
            if (isTransient(obj) || obj.selectable === false) return false;

            const objBounds = obj.getBoundingRect();

            // Intersection kontrolü
            return !(
                objBounds.left > bounds.left + bounds.width ||
                objBounds.left + objBounds.width < bounds.left ||
                objBounds.top > bounds.top + bounds.height ||
                objBounds.top + objBounds.height < bounds.top
            );
        });

        this.selectObjects(objects);
    }

    // ==========================================
    // SEÇİM SORGULAMA
    // ==========================================

    /**
     * Seçili nesneleri al
     * @returns {Object[]}
     */
    getSelectedObjects() {
        return [...this._selectedObjects];
    }

    /**
     * İlk seçili nesneyi al
     * @returns {Object|null}
     */
    getFirstSelected() {
        return this._selectedObjects[0] || null;
    }

    /**
     * Seçili nesne sayısını al
     * @returns {number}
     */
    getSelectionCount() {
        return this._selectedObjects.length;
    }

    /**
     * Nesne seçili mi?
     * @param {Object} object - Kontrol edilecek nesne
     * @returns {boolean}
     */
    isSelected(object) {
        return this._selectedObjects.includes(object);
    }

    /**
     * Herhangi bir nesne seçili mi?
     * @returns {boolean}
     */
    hasSelection() {
        return this._selectedObjects.length > 0;
    }

    /**
     * Çoklu seçim var mı?
     * @returns {boolean}
     */
    hasMultipleSelection() {
        return this._selectedObjects.length > 1;
    }

    /**
     * Seçim bounds'unu al
     * @returns {{left: number, top: number, width: number, height: number}|null}
     */
    getSelectionBounds() {
        if (!this.canvas || this._selectedObjects.length === 0) return null;

        const activeObject = this.canvas.getActiveObject();
        if (!activeObject) return null;

        return activeObject.getBoundingRect();
    }

    // ==========================================
    // SEÇİM FİLTRELEME
    // ==========================================

    /**
     * Seçili nesneleri filtrele
     * @param {Function} filterFn - Filtre fonksiyonu (obj => boolean)
     * @returns {Object[]}
     */
    filterSelected(filterFn) {
        return this._selectedObjects.filter(filterFn);
    }

    /**
     * Seçili dinamik alanları al
     * @returns {Object[]}
     */
    getSelectedDynamicFields() {
        return this._selectedObjects.filter(obj =>
            obj.get(CUSTOM_PROPS.IS_DATA_FIELD) === true
        );
    }

    /**
     * Seçili locked nesneleri al
     * @returns {Object[]}
     */
    getSelectedLocked() {
        return this._selectedObjects.filter(obj =>
            obj.get(CUSTOM_PROPS.LOCKED) === true
        );
    }

    /**
     * Seçili grupları al
     * @returns {Object[]}
     */
    getSelectedGroups() {
        return this._selectedObjects.filter(obj => this._isGroupObject(obj));
    }

    // ==========================================
    // SEÇİM DEĞİŞİKLİĞİ DİNLEME
    // ==========================================

    /**
     * Seçim değişikliğini dinle
     * @param {Function} callback - Callback fonksiyonu (selectedObjects => void)
     * @returns {Function} Unsubscribe fonksiyonu
     */
    onSelectionChange(callback) {
        if (typeof callback !== 'function') {
            console.error('SelectionManager: callback must be a function');
            return () => {};
        }

        this._selectionCallbacks.push(callback);

        // Unsubscribe fonksiyonu döndür
        return () => {
            const index = this._selectionCallbacks.indexOf(callback);
            if (index > -1) {
                this._selectionCallbacks.splice(index, 1);
            }
        };
    }

    // ==========================================
    // GRUPLAMA
    // ==========================================

    /**
     * Seçili nesneleri grupla
     * @returns {Object|null} Oluşturulan grup
     */
    groupSelected() {
        if (!this.canvas) return null;

        const activeObject = this.canvas.getActiveObject();
        if (!this._isActiveSelectionObject(activeObject)) {
            return null;
        }

        const selectionObjects = typeof activeObject.getObjects === 'function' ? activeObject.getObjects() : [];
        if (!Array.isArray(selectionObjects) || selectionObjects.length < 2) {
            return null;
        }

        // Fabric 7: manuel group akışı
        const group = this._groupSelectionManually(selectionObjects);
        if (!group) return null;

        // Custom properties ekle
        group.set(CUSTOM_PROPS.CUSTOM_TYPE, 'group');
        group.set(CUSTOM_PROPS.OBJECT_ID, this._generateUUID());

        this.canvas.requestRenderAll();
        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'group' });

        return group;
    }

    /**
     * Seçili grubu çöz
     * @returns {Object[]|null} Çözülen nesneler
     */
    ungroupSelected() {
        if (!this.canvas) return null;

        const activeObject = this.canvas.getActiveObject();
        if (!this._isGroupObject(activeObject)) {
            return null;
        }

        // Fabric 7: manuel ungroup akışı
        const objects = this._ungroupManually(activeObject);

        this.canvas.requestRenderAll();
        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'ungroup' });

        return Array.isArray(objects) ? objects : null;
    }

    // ==========================================
    // HIZALAMA
    // ==========================================

    /**
     * Seçili nesneleri hizala
     * @param {'left'|'center'|'right'|'top'|'middle'|'bottom'} alignment - Hizalama tipi
     */
    alignSelected(alignment) {
        if (!this.canvas || this._selectedObjects.length < 2) return;

        const bounds = this.getSelectionBounds();
        if (!bounds) return;

        this._selectedObjects.forEach(obj => {
            const objBounds = obj.getBoundingRect();

            switch (alignment) {
                case 'left':
                    obj.set('left', obj.left + (bounds.left - objBounds.left));
                    break;
                case 'center':
                    obj.set('left', obj.left + (bounds.left + bounds.width / 2 - (objBounds.left + objBounds.width / 2)));
                    break;
                case 'right':
                    obj.set('left', obj.left + (bounds.left + bounds.width - (objBounds.left + objBounds.width)));
                    break;
                case 'top':
                    obj.set('top', obj.top + (bounds.top - objBounds.top));
                    break;
                case 'middle':
                    obj.set('top', obj.top + (bounds.top + bounds.height / 2 - (objBounds.top + objBounds.height / 2)));
                    break;
                case 'bottom':
                    obj.set('top', obj.top + (bounds.top + bounds.height - (objBounds.top + objBounds.height)));
                    break;
            }

            obj.setCoords();
        });

        this.canvas.requestRenderAll();
        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'align', alignment });
    }

    /**
     * Seçili nesneleri eşit aralıkla dağıt
     * @param {'horizontal'|'vertical'} direction - Dağıtım yönü
     */
    distributeSelected(direction) {
        if (!this.canvas || this._selectedObjects.length < 3) return;

        // Nesneleri pozisyona göre sırala
        const sorted = [...this._selectedObjects].sort((a, b) => {
            const aBounds = a.getBoundingRect();
            const bBounds = b.getBoundingRect();
            return direction === 'horizontal'
                ? aBounds.left - bBounds.left
                : aBounds.top - bBounds.top;
        });

        const first = sorted[0].getBoundingRect();
        const last = sorted[sorted.length - 1].getBoundingRect();

        const totalSpace = direction === 'horizontal'
            ? (last.left + last.width) - first.left
            : (last.top + last.height) - first.top;

        const totalObjectSize = sorted.reduce((sum, obj) => {
            const bounds = obj.getBoundingRect();
            return sum + (direction === 'horizontal' ? bounds.width : bounds.height);
        }, 0);

        const gap = (totalSpace - totalObjectSize) / (sorted.length - 1);

        let currentPos = direction === 'horizontal' ? first.left : first.top;

        sorted.forEach((obj, index) => {
            if (index === 0) {
                currentPos += direction === 'horizontal'
                    ? obj.getBoundingRect().width + gap
                    : obj.getBoundingRect().height + gap;
                return;
            }

            const bounds = obj.getBoundingRect();

            if (direction === 'horizontal') {
                obj.set('left', obj.left + (currentPos - bounds.left));
                currentPos += bounds.width + gap;
            } else {
                obj.set('top', obj.top + (currentPos - bounds.top));
                currentPos += bounds.height + gap;
            }

            obj.setCoords();
        });

        this.canvas.requestRenderAll();
        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'distribute', direction });
    }

    // ==========================================
    // YARDIMCI METODLAR
    // ==========================================

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
     * ActiveSelection tip kontrolü (Fabric 7 farklı type casing varyantları)
     * @private
     * @param {Object|null} obj
     * @returns {boolean}
     */
    _isActiveSelectionObject(obj) {
        const t = String(obj?.type || '').toLowerCase();
        return t === 'activeselection';
    }

    /**
     * Group tip kontrolü (Fabric 7 farklı type casing varyantları)
     * @private
     * @param {Object|null} obj
     * @returns {boolean}
     */
    _isGroupObject(obj) {
        const t = String(obj?.type || '').toLowerCase();
        return t === 'group';
    }

    /**
     * ActiveSelection -> Group manuel fallback (toGroup olmayan sürümler için)
     * @private
     * @param {Object[]} selectionObjects
     * @returns {Object|null}
     */
    _groupSelectionManually(selectionObjects) {
        if (!this.canvas || !Array.isArray(selectionObjects) || selectionObjects.length < 2) return null;

        const canvas = this.canvas;
        const canvasObjects = canvas.getObjects();
        const indexed = selectionObjects
            .map(obj => ({ obj, idx: canvasObjects.indexOf(obj) }))
            .filter(x => x.idx >= 0)
            .sort((a, b) => a.idx - b.idx);
        const orderedObjects = indexed.map(x => x.obj);
        if (orderedObjects.length < 2) return null;

        const insertIndex = indexed[0].idx;
        canvas.discardActiveObject();
        orderedObjects.forEach(obj => canvas.remove(obj));

        const group = new Group(orderedObjects, {});
        canvas.add(group);
        if (typeof canvas.moveTo === 'function') {
            canvas.moveTo(group, insertIndex);
        }
        canvas.setActiveObject(group);
        group.setCoords?.();
        return group;
    }

    /**
     * Group çözme manuel fallback (toActiveSelection olmayan sürümler için)
     * @private
     * @param {Object} groupObj
     * @returns {Object[]|null}
     */
    _ungroupManually(groupObj) {
        if (!this.canvas || !groupObj || typeof groupObj.getObjects !== 'function') return null;

        const canvas = this.canvas;
        const groupIndex = canvas.getObjects().indexOf(groupObj);
        const members = groupObj.getObjects().slice();
        if (members.length === 0) return [];

        canvas.discardActiveObject();

        // Fabric 7: Objeleri gruptan remove ederek çıkar (absolute pozisyonu korur)
        if (typeof groupObj.remove === 'function') {
            members.forEach((obj) => groupObj.remove(obj));
        } else if (typeof groupObj._restoreObjectsState === 'function') {
            // Beklenmeyen durumda son çare fallback
            groupObj._restoreObjectsState();
        }

        canvas.remove(groupObj);
        members.forEach((obj, i) => {
            obj.group = null;
            canvas.add(obj);
            if (typeof canvas.moveTo === 'function' && groupIndex >= 0) {
                canvas.moveTo(obj, groupIndex + i);
            }
            obj.setCoords?.();
        });

        if (members.length > 1) {
            const selection = new ActiveSelection(members, { canvas });
            canvas.setActiveObject(selection);
        } else {
            canvas.setActiveObject(members[0]);
        }

        return members;
    }

    /**
     * Canvas referansını güncelle
     * @param {Object} canvas - Yeni canvas instance
     */
    setCanvas(canvas) {
        // Eski event'leri kaldır
        if (this.canvas) {
            this.canvas.off('selection:created', this._eventHandlers.selectionCreated);
            this.canvas.off('selection:updated', this._eventHandlers.selectionUpdated);
            this.canvas.off('selection:cleared', this._eventHandlers.selectionCleared);
        }

        this.canvas = canvas;
        this._selectedObjects = [];

        // Yeni event'leri bağla
        if (canvas) {
            canvas.on('selection:created', this._eventHandlers.selectionCreated);
            canvas.on('selection:updated', this._eventHandlers.selectionUpdated);
            canvas.on('selection:cleared', this._eventHandlers.selectionCleared);
        }
    }

    /**
     * Manager'ı dispose et
     */
    dispose() {
        // Canvas event'lerini kaldır
        if (this.canvas) {
            this.canvas.off('selection:created', this._eventHandlers.selectionCreated);
            this.canvas.off('selection:updated', this._eventHandlers.selectionUpdated);
            this.canvas.off('selection:cleared', this._eventHandlers.selectionCleared);
        }

        // EventBus'tan kaldır
        eventBus.offAll(this);

        // Referansları temizle
        this._selectedObjects = [];
        this._selectionCallbacks = [];
        this._eventHandlers = {};
        this.canvas = null;
    }
}

/**
 * Default export
 */
export default SelectionManager;
