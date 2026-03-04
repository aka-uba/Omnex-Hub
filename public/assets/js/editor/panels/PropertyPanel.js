/**
 * PropertyPanel - Özellikler Paneli
 *
 * Seçili nesnenin özelliklerini düzenleme paneli.
 * Pozisyon, boyut, renk, font vb. özellikleri yönetir.
 *
 * KULLANIM:
 * ```javascript
 * import { PropertyPanel } from './editor/panels/PropertyPanel.js';
 *
 * const propertyPanel = new PropertyPanel({
 *     container: '#right-panel',
 *     canvas: fabricCanvas,
 *     i18n: (key) => translate(key)
 * });
 *
 * propertyPanel.mount();
 *
 * // Seçili nesne değiştiğinde
 * propertyPanel.setSelectedObject(object);
 * ```
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

import { PanelBase } from './PanelBase.js';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { CUSTOM_PROPS, CUSTOM_TYPES } from '../core/CustomProperties.js';
import { Rect } from '../core/FabricExports.js';

/**
 * PropertyPanel Sınıfı
 */
export class PropertyPanel extends PanelBase {
    /**
     * @param {Object} options - Panel ayarları
     * @param {Object} options.canvas - Fabric.js Canvas instance
     */
    constructor(options = {}) {
        super({
            panelId: 'property-panel',
            title: 'editor.properties.title',
            icon: 'ti ti-adjustments',
            ...options
        });

        /**
         * Fabric.js Canvas referansı
         * @type {Object}
         */
        this.canvas = options.canvas;

        /**
         * Seçili nesne
         * @type {Object|null}
         */
        this._selectedObject = null;

        /**
         * Güncelleme debounce timer
         * @type {number|null}
         */
        this._updateTimer = null;

        /**
         * Event handler referansları
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

        this._canvasHandlers.selectionCreated = (e) => {
            this.setSelectedObject(e.selected?.[0] || null);
        };

        this._canvasHandlers.selectionUpdated = (e) => {
            this.setSelectedObject(e.selected?.[0] || null);
        };

        this._canvasHandlers.selectionCleared = () => {
            this.setSelectedObject(null);
        };

        this._canvasHandlers.objectModified = (e) => {
            if (e.target === this._selectedObject) {
                this._updatePropertyValues();
            }
        };

        this.canvas.on('selection:created', this._canvasHandlers.selectionCreated);
        this.canvas.on('selection:updated', this._canvasHandlers.selectionUpdated);
        this.canvas.on('selection:cleared', this._canvasHandlers.selectionCleared);
        this.canvas.on('object:modified', this._canvasHandlers.objectModified);
    }

    /**
     * Seçili nesneyi ayarla
     * @param {Object|null} object - Fabric.js nesnesi
     */
    setSelectedObject(object) {
        this._selectedObject = object;
        this.refresh();
    }

    /**
     * Panel içeriğini render et
     * @returns {string} HTML string
     */
    renderContent() {
        if (!this._selectedObject) {
            return this._renderNoSelection();
        }

        const objectType = this._selectedObject.type;
        // Fabric.js v7: .get() custom prop'ları güvenilir döndürmeyebilir, direct access da dene
        const customType = this._selectedObject[CUSTOM_PROPS.CUSTOM_TYPE] || this._selectedObject.get(CUSTOM_PROPS.TYPE);

        // Nesne tipine göre panel içeriği
        let sections = [];

        // Nesne tanımlayıcı başlık (en üste)
        sections.push(this._renderObjectHeader());

        // Pozisyon & Boyut (tüm nesneler)
        sections.push(this._renderPositionSection());

        // Metin özellikleri
        if (this._isTextObject()) {
            sections.push(this._renderTextSection());
        }

        // Şekil özellikleri
        if (this._isShapeObject()) {
            sections.push(this._renderShapeSection());
        }

        // Dinamik Görsel özellikleri (image-placeholder veya slot-image seçildiğinde)
        const isDynamicImage = customType === 'image-placeholder' || customType === CUSTOM_TYPES.DYNAMIC_IMAGE || customType === CUSTOM_TYPES.SLOT_IMAGE;
        // Fallback: dynamicField = image_url olan non-text nesneler de dinamik görseldir
        const dynamicFieldValue = this._selectedObject[CUSTOM_PROPS.DYNAMIC_FIELD] || this._selectedObject.get(CUSTOM_PROPS.DYNAMIC_FIELD);
        const isImageFieldFallback = dynamicFieldValue === 'image_url' && !this._isTextObject();
        if (isDynamicImage || isImageFieldFallback) {
            sections.push(this._renderDynamicImageSection());
        }

        // Barkod/QR düzenleme
        if (customType === CUSTOM_TYPES.BARCODE || customType === CUSTOM_TYPES.QRCODE) {
            sections.push(this._renderBarcodeSection());
        }
        // Görsel özellikleri (barkod/QR hariç - onlar image tipinde ama kendi bölümleri var)
        else if (objectType === 'image' || objectType === 'Image') {
            sections.push(this._renderImageSection());
        }

        // Kenarlık & Köşe Yuvarlaklığı (tüm nesneler)
        sections.push(this._renderBorderSection());

        // Gölge (tüm nesneler)
        sections.push(this._renderShadowSection());

        // Genel özellikler (tüm nesneler)
        sections.push(this._renderGeneralSection());

        // Responsive ayarları (anchor, text fit) - tüm nesneler
        sections.push(this._renderResponsiveSection());

        return `
            <div class="property-panel-content">
                ${sections.join('')}
            </div>
        `;
    }

    /**
     * Seçim yok mesajı
     * @private
     * @returns {string}
     */
    _renderNoSelection() {
        return `
            <div class="property-no-selection">
                <i class="ti ti-click"></i>
                <p>${this.__('editor.properties.noSelection')}</p>
            </div>
        `;
    }

    /**
     * Nesne tanımlayıcı başlık
     * @private
     * @returns {string}
     */
    _renderObjectHeader() {
        const obj = this._selectedObject;
        if (!obj) return '';

        // Fabric.js v7: direct property access ile fallback
        const customType = obj[CUSTOM_PROPS.CUSTOM_TYPE] || obj.get(CUSTOM_PROPS.TYPE) || obj.type;
        const dynamicField = obj[CUSTOM_PROPS.DYNAMIC_FIELD] || obj.get(CUSTOM_PROPS.DYNAMIC_FIELD);
        const placeholder = obj[CUSTOM_PROPS.PLACEHOLDER] || obj.get(CUSTOM_PROPS.PLACEHOLDER);
        const objectName = obj[CUSTOM_PROPS.OBJECT_NAME] || obj.get(CUSTOM_PROPS.OBJECT_NAME);

        // İkon belirle
        const icon = this._getObjectHeaderIcon(customType);

        // Nesne adını belirle (öncelik sırası)
        let displayName = '';
        let typeBadge = '';

        if (dynamicField) {
            // Dinamik alan: placeholder metnini göster (ör. "{Eski Fiyat}")
            displayName = placeholder || `{${dynamicField}}`;
            // Süslü parantezleri temizle
            displayName = displayName.replace(/^\{|\}$/g, '');
            typeBadge = this.__('editor.elements.dynamicText');
        } else if (customType === CUSTOM_TYPES.BARCODE) {
            const barcodeValue = obj[CUSTOM_PROPS.BARCODE_VALUE] || obj.get(CUSTOM_PROPS.BARCODE_VALUE) || '';
            displayName = objectName || barcodeValue || (this.__('editor.elements.barcode'));
            typeBadge = this.__('editor.elements.barcode');
        } else if (customType === CUSTOM_TYPES.QRCODE) {
            displayName = objectName || (this.__('editor.elements.qrcode'));
            typeBadge = this.__('editor.elements.qrcode');
        } else if (customType === CUSTOM_TYPES.MULTI_PRODUCT_FRAME) {
            displayName = objectName || (this.__('editor.elements.multiProductFrame'));
            typeBadge = this.__('editor.elements.multiProductFrame');
        } else if (this._isTextObject()) {
            const text = obj.text || '';
            displayName = text.length > 30 ? text.substring(0, 30) + '...' : text;
            displayName = displayName || objectName || (this.__('editor.elements.text'));
            typeBadge = this._getTypeDisplayName(customType);
        } else if (obj.type === 'image' || obj.type === 'Image') {
            displayName = objectName || (this.__('editor.elements.image'));
            typeBadge = this.__('editor.elements.image');
        } else {
            displayName = objectName || this._getTypeDisplayName(customType);
            typeBadge = this._getTypeDisplayName(customType);
        }

        // Eğer displayName ve typeBadge aynıysa badge gösterme
        const showBadge = typeBadge && typeBadge !== displayName;

        return `
            <div class="property-object-header">
                <div class="property-object-icon">
                    <i class="${icon}"></i>
                </div>
                <div class="property-object-info">
                    <span class="property-object-name">${displayName}</span>
                    ${showBadge ? `<span class="property-object-type">${typeBadge}</span>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Nesne başlığı için ikon
     * @private
     * @param {string} type - Custom type
     * @returns {string}
     */
    _getObjectHeaderIcon(type) {
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
            'Rect': 'ti ti-square',
            'Circle': 'ti ti-circle',
            'Image': 'ti ti-photo',
            'Group': 'ti ti-stack',
            'Text': 'ti ti-text-size',
            'Textbox': 'ti ti-text-resize'
        };
        return icons[type] || 'ti ti-shape';
    }

    /**
     * Tip gösterim adı
     * @private
     * @param {string} type - Custom type
     * @returns {string}
     */
    _getTypeDisplayName(type) {
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
            'video-placeholder': 'Video'
        };
        return names[type] || type;
    }

    /**
     * Pozisyon & Boyut bölümü
     * @private
     * @returns {string}
     */
    _renderPositionSection() {
        const obj = this._selectedObject;
        const left = Math.round(obj.left || 0);
        const top = Math.round(obj.top || 0);
        const width = Math.round((obj.width || 0) * (obj.scaleX || 1));
        const height = Math.round((obj.height || 0) * (obj.scaleY || 1));
        const angle = Math.round(obj.angle || 0);

        return `
            <div class="property-section">
                <div class="property-section-header">
                    <i class="ti ti-dimensions"></i>
                    <span>${this.__('editor.properties.position')}</span>
                </div>
                <div class="property-section-body">
                    <div class="property-grid-2">
                        <div class="property-item">
                            <label>X</label>
                            <input type="number" class="form-input" data-property="left" value="${left}">
                        </div>
                        <div class="property-item">
                            <label>Y</label>
                            <input type="number" class="form-input" data-property="top" value="${top}">
                        </div>
                        <div class="property-item">
                            <label>${this.__('editor.properties.width')}</label>
                            <input type="number" class="form-input" data-property="width" value="${width}" min="1">
                        </div>
                        <div class="property-item">
                            <label>${this.__('editor.properties.height')}</label>
                            <input type="number" class="form-input" data-property="height" value="${height}" min="1">
                        </div>
                    </div>
                    <div class="property-item">
                        <label>${this.__('editor.properties.rotation')}</label>
                        <div class="property-input-group">
                            <input type="range" class="form-range" data-property="angle" value="${angle}" min="0" max="360">
                            <input type="number" class="form-input form-input-sm" data-property="angle" value="${angle}" min="0" max="360">
                            <span>°</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Metin özellikleri bölümü
     * @private
     * @returns {string}
     */
    _renderTextSection() {
        const obj = this._selectedObject;
        const fontFamily = obj.fontFamily || 'Arial';
        const fontSize = obj.fontSize || 16;
        const fontWeight = obj.fontWeight || 'normal';
        const fontStyle = obj.fontStyle || 'normal';
        const underline = obj.underline || false;
        const linethrough = obj.linethrough || false;
        const textAlign = obj.textAlign || 'left';
        const fill = obj.fill || '#000000';
        const lineHeight = obj.lineHeight || 1.16;
        const charSpacing = obj.charSpacing || 0;

        const fonts = ['Arial', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Poppins', 'Oswald', 'Raleway'];

        return `
            <div class="property-section">
                <div class="property-section-header">
                    <i class="ti ti-typography"></i>
                    <span>${this.__('editor.properties.text')}</span>
                </div>
                <div class="property-section-body">
                    <div class="property-item">
                        <label>${this.__('editor.properties.fontFamily')}</label>
                        <select class="form-select" data-property="fontFamily">
                            ${fonts.map(f => `<option value="${f}" ${fontFamily === f ? 'selected' : ''}>${f}</option>`).join('')}
                        </select>
                    </div>
                    <div class="property-grid-2">
                        <div class="property-item">
                            <label>${this.__('editor.properties.fontSize')}</label>
                            <input type="number" class="form-input" data-property="fontSize" value="${fontSize}" min="8" max="200">
                        </div>
                        <div class="property-item">
                            <label>${this.__('editor.properties.color')}</label>
                            <input type="color" class="form-color" data-property="fill" value="${fill}">
                        </div>
                    </div>
                    <div class="property-item">
                        <label>${this.__('editor.properties.style')}</label>
                        <div class="property-btn-group">
                            <button type="button" class="prop-style-btn ${fontWeight === 'bold' ? 'active' : ''}" data-action="toggle-bold" title="Bold">
                                <i class="ti ti-bold"></i>
                            </button>
                            <button type="button" class="prop-style-btn ${fontStyle === 'italic' ? 'active' : ''}" data-action="toggle-italic" title="Italic">
                                <i class="ti ti-italic"></i>
                            </button>
                            <button type="button" class="prop-style-btn ${underline ? 'active' : ''}" data-action="toggle-underline" title="Underline">
                                <i class="ti ti-underline"></i>
                            </button>
                            <button type="button" class="prop-style-btn ${linethrough ? 'active' : ''}" data-action="toggle-linethrough" title="Strikethrough">
                                <i class="ti ti-strikethrough"></i>
                            </button>
                        </div>
                    </div>
                    <div class="property-item">
                        <label>${this.__('editor.properties.alignment')}</label>
                        <div class="property-btn-group">
                            <button type="button" class="prop-align-btn ${textAlign === 'left' ? 'active' : ''}" data-action="align" data-value="left" title="Left">
                                <i class="ti ti-align-left"></i>
                            </button>
                            <button type="button" class="prop-align-btn ${textAlign === 'center' ? 'active' : ''}" data-action="align" data-value="center" title="Center">
                                <i class="ti ti-align-center"></i>
                            </button>
                            <button type="button" class="prop-align-btn ${textAlign === 'right' ? 'active' : ''}" data-action="align" data-value="right" title="Right">
                                <i class="ti ti-align-right"></i>
                            </button>
                            <button type="button" class="prop-align-btn ${textAlign === 'justify' ? 'active' : ''}" data-action="align" data-value="justify" title="Justify">
                                <i class="ti ti-align-justified"></i>
                            </button>
                        </div>
                    </div>
                    <div class="property-grid-2">
                        <div class="property-item">
                            <label>${this.__('editor.properties.lineHeight')}</label>
                            <input type="number" class="form-input" data-property="lineHeight" value="${lineHeight}" min="0.5" max="3" step="0.1">
                        </div>
                        <div class="property-item">
                            <label>${this.__('editor.properties.charSpacing')}</label>
                            <input type="number" class="form-input" data-property="charSpacing" value="${charSpacing}" min="-100" max="500">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Şekil özellikleri bölümü
     * @private
     * @returns {string}
     */
    _renderShapeSection() {
        const obj = this._selectedObject;
        const fill = obj.fill || '#ffffff';

        return `
            <div class="property-section">
                <div class="property-section-header">
                    <i class="ti ti-shape"></i>
                    <span>${this.__('editor.properties.shape')}</span>
                </div>
                <div class="property-section-body">
                    <div class="property-item">
                        <label>${this.__('editor.properties.fill')}</label>
                        <input type="color" class="form-color" data-property="fill" value="${fill}">
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Görsel özellikleri bölümü
     * @private
     * @returns {string}
     */
    _renderImageSection() {
        const obj = this._selectedObject;
        const opacity = Math.round((obj.opacity || 1) * 100);

        return `
            <div class="property-section">
                <div class="property-section-header">
                    <i class="ti ti-photo"></i>
                    <span>${this.__('editor.properties.image')}</span>
                </div>
                <div class="property-section-body">
                    <div class="property-item">
                        <label>${this.__('editor.properties.opacity')}</label>
                        <div class="property-input-group">
                            <input type="range" class="form-range" data-property="opacity" value="${opacity}" min="0" max="100">
                            <input type="number" class="form-input form-input-sm" data-property="opacity" value="${opacity}" min="0" max="100">
                            <span>%</span>
                        </div>
                    </div>
                    <div class="property-item">
                        <button type="button" class="btn btn-outline btn-sm btn-block" data-action="replace-image">
                            <i class="ti ti-replace"></i>
                            ${this.__('editor.properties.replaceImage')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Dinamik Görsel özellikleri bölümü (image-placeholder / slot-image)
     * Görsel indeks seçimi ve fit modu ayarları
     * @private
     * @returns {string}
     */
    _renderDynamicImageSection() {
        const obj = this._selectedObject;
        // Fabric.js v7: direct property access ile fallback
        const currentIndex = parseInt(obj[CUSTOM_PROPS.IMAGE_INDEX] ?? obj.get(CUSTOM_PROPS.IMAGE_INDEX) ?? 0) || 0;
        const currentFit = obj[CUSTOM_PROPS.IMAGE_FIT] || obj.get(CUSTOM_PROPS.IMAGE_FIT) || 'cover';

        return `
            <div class="property-section">
                <div class="property-section-header">
                    <i class="ti ti-photo-search"></i>
                    <span>${this.__('editor.properties.dynamicImage')}</span>
                </div>
                <div class="property-section-body">
                    <div class="property-item">
                        <label>${this.__('editor.properties.imageIndex')}</label>
                        <select class="form-input form-input-sm" data-property="imageIndex">
                            <option value="0" ${currentIndex === 0 ? 'selected' : ''}>${this.__('editor.properties.coverImage')} (1.)</option>
                            <option value="1" ${currentIndex === 1 ? 'selected' : ''}>2. ${this.__('editor.properties.image')}</option>
                            <option value="2" ${currentIndex === 2 ? 'selected' : ''}>3. ${this.__('editor.properties.image')}</option>
                            <option value="3" ${currentIndex === 3 ? 'selected' : ''}>4. ${this.__('editor.properties.image')}</option>
                        </select>
                    </div>
                    <div class="property-item">
                        <label>${this.__('editor.properties.imageFit')}</label>
                        <select class="form-input form-input-sm" data-property="imageFit">
                            <option value="cover" ${currentFit === 'cover' ? 'selected' : ''}>Cover</option>
                            <option value="contain" ${currentFit === 'contain' ? 'selected' : ''}>Contain</option>
                            <option value="fill" ${currentFit === 'fill' ? 'selected' : ''}>Fill</option>
                        </select>
                    </div>
                    <div class="property-item">
                        <button type="button" class="btn btn-outline btn-sm btn-block" data-action="replace-image">
                            <i class="ti ti-replace"></i>
                            ${this.__('editor.properties.replaceImage')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Barkod/QR düzenleme bölümü
     * @private
     * @returns {string}
     */
    _renderBarcodeSection() {
        const obj = this._selectedObject;
        const customType = obj[CUSTOM_PROPS.CUSTOM_TYPE] || obj.get(CUSTOM_PROPS.TYPE);
        const isQR = customType === CUSTOM_TYPES.QRCODE;
        const icon = isQR ? 'ti-qrcode' : 'ti-barcode';
        const label = isQR
            ? (this.__('editor.properties.editQrcode'))
            : (this.__('editor.properties.editBarcode'));

        return `
            <div class="property-section">
                <div class="property-section-header">
                    <i class="ti ${icon}"></i>
                    <span>${isQR ? (this.__('editor.elements.qrcode')) : (this.__('editor.elements.barcode'))}</span>
                </div>
                <div class="property-section-body">
                    <div class="property-item">
                        <button type="button" class="btn btn-outline btn-sm btn-block" data-action="edit-barcode">
                            <i class="ti ti-edit"></i>
                            ${label}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Kenarlık & Köşe Yuvarlaklığı bölümü (tüm nesneler için)
     * @private
     * @returns {string}
     */
    _renderBorderSection() {
        const obj = this._selectedObject;
        const stroke = obj.stroke || '';
        const strokeWidth = obj.strokeWidth || 0;
        const rx = obj.rx || obj.clipPath?.rx || 0;
        const type = obj.type;

        // Stroke rengi - boş veya null ise transparan göster
        const strokeColor = stroke && stroke !== 'transparent' ? stroke : '#000000';
        const hasStroke = stroke && stroke !== 'transparent' && strokeWidth > 0;

        // Köşe yuvarlaklığı sadece rect türü nesneler için geçerli
        const isRect = type === 'rect' || type === 'Rect';
        // Görseller için clipPath ile rx etkisi verilemez ama Fabric.js image'larda
        // stroke ve shadow çalışır
        const isImage = type === 'image' || type === 'Image';

        return `
            <div class="property-section">
                <div class="property-section-header">
                    <i class="ti ti-border-style-2"></i>
                    <span>${this.__('editor.properties.border')}</span>
                </div>
                <div class="property-section-body">
                    <div class="property-grid-2">
                        <div class="property-item">
                            <label>${this.__('editor.properties.stroke')}</label>
                            <div class="property-color-row">
                                <input type="color" class="form-color" data-property="stroke" value="${strokeColor}">
                                <button type="button" class="btn-icon btn-clear-stroke ${!hasStroke ? 'active' : ''}" data-action="clear-stroke" title="${this.__('editor.properties.noStroke')}">
                                    <i class="ti ti-circle-off"></i>
                                </button>
                            </div>
                        </div>
                        <div class="property-item">
                            <label>${this.__('editor.properties.strokeWidth')}</label>
                            <input type="number" class="form-input" data-property="strokeWidth" value="${strokeWidth}" min="0" max="50" step="1">
                        </div>
                    </div>
                    ${(isRect || isImage) ? `
                    <div class="property-item">
                        <label>${this.__('editor.properties.cornerRadius')}</label>
                        <div class="property-input-group">
                            <input type="range" class="form-range" data-property="rx" value="${rx}" min="0" max="100">
                            <input type="number" class="form-input form-input-sm" data-property="rx" value="${rx}" min="0" max="100">
                            <span>px</span>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Gölge bölümü (tüm nesneler için)
     * @private
     * @returns {string}
     */
    _renderShadowSection() {
        const obj = this._selectedObject;

        // Fabric.js shadow nesnesi
        const shadow = obj.shadow;
        const hasShadow = shadow && (shadow.color || shadow.offsetX || shadow.offsetY || shadow.blur);

        const shadowColor = shadow?.color || '#000000';
        const shadowOffsetX = shadow?.offsetX || 0;
        const shadowOffsetY = shadow?.offsetY || 0;
        const shadowBlur = shadow?.blur || 0;

        // Shadow color'ı hex'e dönüştür (rgba olabilir)
        const hexColor = this._shadowColorToHex(shadowColor);

        return `
            <div class="property-section">
                <div class="property-section-header">
                    <i class="ti ti-shadow"></i>
                    <span>${this.__('editor.properties.shadow')}</span>
                </div>
                <div class="property-section-body">
                    <div class="property-item property-checkbox">
                        <label>
                            <input type="checkbox" data-action="toggle-shadow" ${hasShadow ? 'checked' : ''}>
                            ${this.__('editor.properties.enableShadow')}
                        </label>
                    </div>
                    <div class="shadow-controls ${hasShadow ? '' : 'hidden'}">
                        <div class="property-item">
                            <label>${this.__('editor.properties.shadowColor')}</label>
                            <input type="color" class="form-color" data-property="shadow-color" value="${hexColor}">
                        </div>
                        <div class="property-grid-2">
                            <div class="property-item">
                                <label>${this.__('editor.properties.shadowOffsetX')}</label>
                                <input type="number" class="form-input" data-property="shadow-offsetX" value="${shadowOffsetX}" min="-50" max="50">
                            </div>
                            <div class="property-item">
                                <label>${this.__('editor.properties.shadowOffsetY')}</label>
                                <input type="number" class="form-input" data-property="shadow-offsetY" value="${shadowOffsetY}" min="-50" max="50">
                            </div>
                        </div>
                        <div class="property-item">
                            <label>${this.__('editor.properties.shadowBlur')}</label>
                            <div class="property-input-group">
                                <input type="range" class="form-range" data-property="shadow-blur" value="${shadowBlur}" min="0" max="50">
                                <input type="number" class="form-input form-input-sm" data-property="shadow-blur" value="${shadowBlur}" min="0" max="50">
                                <span>px</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Shadow rengini hex'e dönüştür
     * @private
     * @param {string} color - Renk değeri (rgba, hex, named)
     * @returns {string} Hex renk
     */
    _shadowColorToHex(color) {
        if (!color) return '#000000';

        // Zaten hex ise
        if (color.startsWith('#')) {
            // 3 haneli hex'i 6 haneliye dönüştür
            if (color.length === 4) {
                return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
            }
            return color.substring(0, 7); // alpha kısmını kes
        }

        // rgba() formatı
        const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgbaMatch) {
            const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
            const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
            const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        }

        return '#000000';
    }

    /**
     * Shadow özelliğini güncelle
     * @private
     * @param {string} property - shadow-color, shadow-offsetX, shadow-offsetY, shadow-blur
     * @param {*} value - Yeni değer
     */
    _updateShadowProperty(property, value) {
        if (!this._selectedObject) return;

        let shadow = this._selectedObject.shadow;
        if (!shadow) {
            // Fabric.js v7 Shadow nesnesi oluştur
            const ShadowClass = window.fabric?.Shadow;
            if (ShadowClass) {
                shadow = new ShadowClass({
                    color: '#000000',
                    offsetX: 0,
                    offsetY: 0,
                    blur: 0
                });
            } else {
                // Fallback: plain object
                shadow = { color: '#000000', offsetX: 0, offsetY: 0, blur: 0 };
            }
        }

        const prop = property.replace('shadow-', '');
        switch (prop) {
            case 'color':
                shadow.color = value;
                break;
            case 'offsetX':
                shadow.offsetX = parseFloat(value);
                break;
            case 'offsetY':
                shadow.offsetY = parseFloat(value);
                break;
            case 'blur':
                shadow.blur = parseFloat(value);
                break;
        }

        this._selectedObject.set('shadow', shadow);
    }

    /**
     * Shadow toggle
     * @private
     * @param {boolean} enable - Gölge aktif/pasif
     */
    _toggleShadow(enable) {
        if (!this._selectedObject) return;

        if (enable) {
            const ShadowClass = window.fabric?.Shadow;
            const shadowOpts = { color: '#00000066', offsetX: 4, offsetY: 4, blur: 8 };
            const shadow = ShadowClass ? new ShadowClass(shadowOpts) : shadowOpts;
            this._selectedObject.set('shadow', shadow);
        } else {
            this._selectedObject.set('shadow', null);
        }

        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    /**
     * Stroke temizle
     * @private
     */
    _clearStroke() {
        if (!this._selectedObject) return;

        this._selectedObject.set('stroke', null);
        this._selectedObject.set('strokeWidth', 0);
        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    /**
     * Genel özellikler bölümü
     * @private
     * @returns {string}
     */
    _renderGeneralSection() {
        const obj = this._selectedObject;
        const opacity = Math.round((obj.opacity || 1) * 100);
        const visible = obj.visible !== false;

        return `
            <div class="property-section">
                <div class="property-section-header">
                    <i class="ti ti-settings"></i>
                    <span>${this.__('editor.properties.general')}</span>
                </div>
                <div class="property-section-body">
                    ${!this._isTextObject() && obj.type !== 'image' && obj.type !== 'Image' ? `
                    <div class="property-item">
                        <label>${this.__('editor.properties.opacity')}</label>
                        <div class="property-input-group">
                            <input type="range" class="form-range" data-property="opacity" value="${opacity}" min="0" max="100">
                            <input type="number" class="form-input form-input-sm" data-property="opacity" value="${opacity}" min="0" max="100">
                            <span>%</span>
                        </div>
                    </div>
                    ` : ''}
                    <div class="property-item property-checkbox">
                        <label>
                            <input type="checkbox" data-property="visible" ${visible ? 'checked' : ''}>
                            ${this.__('editor.properties.visible')}
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Responsive özellikleri bölümü (anchor, text fit)
     * @private
     * @returns {string}
     */
    _renderResponsiveSection() {
        const obj = this._selectedObject;
        const anchorX = obj[CUSTOM_PROPS.ANCHOR_X] || 'left';
        const anchorY = obj[CUSTOM_PROPS.ANCHOR_Y] || 'top';
        const textFit = obj[CUSTOM_PROPS.TEXT_FIT] || 'none';
        const minFontSize = obj[CUSTOM_PROPS.MIN_FONT_SIZE] || 8;
        const maxLines = obj[CUSTOM_PROPS.MAX_LINES] || 0;
        const isText = this._isTextObject();

        return `
            <div class="property-section property-section-responsive">
                <div class="property-section-header">
                    <i class="ti ti-arrows-maximize"></i>
                    <span>${this.__('editor.properties.responsive') || 'Responsive'}</span>
                </div>
                <div class="property-section-body">
                    <div class="property-item">
                        <label>${this.__('editor.properties.anchorX') || 'Yatay Çapa'}</label>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-icon ${anchorX === 'left' ? 'active' : ''}" data-property="anchorX" data-value="left" title="Sol">
                                <i class="ti ti-align-left"></i>
                            </button>
                            <button class="btn btn-icon ${anchorX === 'center' ? 'active' : ''}" data-property="anchorX" data-value="center" title="Orta">
                                <i class="ti ti-align-center"></i>
                            </button>
                            <button class="btn btn-icon ${anchorX === 'right' ? 'active' : ''}" data-property="anchorX" data-value="right" title="Sağ">
                                <i class="ti ti-align-right"></i>
                            </button>
                        </div>
                    </div>
                    <div class="property-item">
                        <label>${this.__('editor.properties.anchorY') || 'Dikey Çapa'}</label>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-icon ${anchorY === 'top' ? 'active' : ''}" data-property="anchorY" data-value="top" title="Üst">
                                <i class="ti ti-align-box-top-center"></i>
                            </button>
                            <button class="btn btn-icon ${anchorY === 'center' ? 'active' : ''}" data-property="anchorY" data-value="center" title="Orta">
                                <i class="ti ti-align-box-center-middle"></i>
                            </button>
                            <button class="btn btn-icon ${anchorY === 'bottom' ? 'active' : ''}" data-property="anchorY" data-value="bottom" title="Alt">
                                <i class="ti ti-align-box-bottom-center"></i>
                            </button>
                        </div>
                    </div>
                    ${isText ? `
                    <div class="property-item">
                        <label>${this.__('editor.properties.textFit') || 'Metin Uyumu'}</label>
                        <select class="form-select form-select-sm" data-property="textFit">
                            <option value="none" ${textFit === 'none' ? 'selected' : ''}>${this.__('editor.properties.textFitNone') || 'Yok'}</option>
                            <option value="shrink" ${textFit === 'shrink' ? 'selected' : ''}>${this.__('editor.properties.textFitShrink') || 'Küçült'}</option>
                            <option value="ellipsis" ${textFit === 'ellipsis' ? 'selected' : ''}>${this.__('editor.properties.textFitEllipsis') || 'Üç Nokta (...)'}</option>
                        </select>
                    </div>
                    <div class="property-item" ${textFit === 'shrink' ? '' : 'style="display:none"'} data-show-for-textfit="shrink">
                        <label>${this.__('editor.properties.minFontSize') || 'Min Font'}</label>
                        <input type="number" class="form-input form-input-sm" data-property="minFontSize" value="${minFontSize}" min="4" max="72">
                    </div>
                    <div class="property-item" ${textFit === 'ellipsis' ? '' : 'style="display:none"'} data-show-for-textfit="ellipsis">
                        <label>${this.__('editor.properties.maxLines') || 'Max Satır'}</label>
                        <input type="number" class="form-input form-input-sm" data-property="maxLines" value="${maxLines}" min="0" max="20">
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Event'leri bağla
     */
    bindEvents() {
        if (!this.element) return;

        // Input değişiklikleri
        this.$$('input[data-property], select[data-property]').forEach(input => {
            this._addEventListener(input, 'input', (e) => this._handlePropertyChange(e));
            this._addEventListener(input, 'change', (e) => this._handlePropertyChange(e));
        });

        // Style butonları
        this.$$('[data-action="toggle-bold"]').forEach(btn => {
            this._addEventListener(btn, 'click', () => this._toggleBold());
        });

        this.$$('[data-action="toggle-italic"]').forEach(btn => {
            this._addEventListener(btn, 'click', () => this._toggleItalic());
        });

        this.$$('[data-action="toggle-underline"]').forEach(btn => {
            this._addEventListener(btn, 'click', () => this._toggleUnderline());
        });

        this.$$('[data-action="toggle-linethrough"]').forEach(btn => {
            this._addEventListener(btn, 'click', () => this._toggleLinethrough());
        });

        // Alignment butonları
        this.$$('[data-action="align"]').forEach(btn => {
            this._addEventListener(btn, 'click', (e) => {
                const value = e.currentTarget.dataset.value;
                this._setTextAlign(value);
            });
        });

        // Replace image
        this.$$('[data-action="replace-image"]').forEach(btn => {
            this._addEventListener(btn, 'click', () => this._replaceImage());
        });

        // Edit barcode/QR
        this.$$('[data-action="edit-barcode"]').forEach(btn => {
            this._addEventListener(btn, 'click', () => this._editBarcode());
        });

        // Shadow toggle
        this.$$('[data-action="toggle-shadow"]').forEach(cb => {
            this._addEventListener(cb, 'change', (e) => {
                this._toggleShadow(e.target.checked);
            });
        });

        // Clear stroke (kenarlık yok butonu)
        this.$$('[data-action="clear-stroke"]').forEach(btn => {
            this._addEventListener(btn, 'click', () => this._clearStroke());
        });

        // Responsive: Anchor butonları (data-property="anchorX/Y" data-value="left/center/right")
        this.$$('.btn-group .btn-icon[data-property]').forEach(btn => {
            this._addEventListener(btn, 'click', (e) => {
                const prop = btn.dataset.property;
                const val = btn.dataset.value;
                if (!prop || !val || !this._selectedObject) return;

                this._selectedObject.set(prop, val);
                this.canvas?.requestRenderAll();
                this._emitModified();

                // Active state güncelle
                btn.closest('.btn-group')?.querySelectorAll('.btn-icon').forEach(b => {
                    b.classList.toggle('active', b.dataset.value === val);
                });
            });
        });

        // Responsive: textFit değiştiğinde min font / max lines görünürlüğü
        this.$$('select[data-property="textFit"]').forEach(sel => {
            this._addEventListener(sel, 'change', () => {
                const val = sel.value;
                this.$$('[data-show-for-textfit]').forEach(el => {
                    el.style.display = el.dataset.showForTextfit === val ? '' : 'none';
                });
            });
        });
    }

    /**
     * Özellik değişikliğini işle
     * @private
     * @param {Event} e - Input event
     */
    _handlePropertyChange(e) {
        if (!this._selectedObject || !this.canvas) return;

        const input = e.target;
        const property = input.dataset.property;
        let value = input.type === 'checkbox' ? input.checked : input.value;

        // Sayısal değerleri dönüştür
        if (input.type === 'number' || input.type === 'range') {
            value = parseFloat(value);
        }

        // Özel işlemler
        const objType = (this._selectedObject.type || '').toLowerCase();
        const isTextObject = ['text', 'i-text', 'itext', 'textbox'].includes(objType);

        switch (property) {
            case 'width':
                if (isTextObject) {
                    // Metin nesneleri için doğrudan width set et (scaleX kullanma, stretch olur)
                    this._selectedObject.set({ width: value, scaleX: 1 });
                    if (this._selectedObject.initDimensions) this._selectedObject.initDimensions();
                } else {
                    // Diğer nesneler için scale ile boyutlandır
                    const currentWidth = this._selectedObject.width * this._selectedObject.scaleX;
                    if (currentWidth !== value) {
                        this._selectedObject.set('scaleX', value / this._selectedObject.width);
                    }
                }
                break;

            case 'height':
                if (isTextObject) {
                    // Metin nesneleri için height scaleY üzerinden değil, doğrudan set
                    this._selectedObject.set({ scaleY: 1 });
                    // Textbox'ta height metin içeriğine göre otomatik hesaplanır
                } else {
                    const currentHeight = this._selectedObject.height * this._selectedObject.scaleY;
                    if (currentHeight !== value) {
                        this._selectedObject.set('scaleY', value / this._selectedObject.height);
                    }
                }
                break;

            case 'opacity':
                // Yüzdeyi 0-1 aralığına dönüştür
                this._selectedObject.set('opacity', value / 100);
                break;

            case 'imageIndex':
                // Görsel indeksini integer olarak ayarla (both .set() and direct for v7 compat)
                {
                    const idx = parseInt(value) || 0;
                    this._selectedObject.set(CUSTOM_PROPS.IMAGE_INDEX, idx);
                    this._selectedObject[CUSTOM_PROPS.IMAGE_INDEX] = idx;
                }
                break;

            case 'imageFit':
                this._selectedObject.set(CUSTOM_PROPS.IMAGE_FIT, value);
                this._selectedObject[CUSTOM_PROPS.IMAGE_FIT] = value;
                break;

            case 'rx':
                if (objType === 'image') {
                    this._applyImageCornerRadius(value);
                } else {
                    this._selectedObject.set('rx', value);
                    this._selectedObject.set('ry', value);
                }
                break;

            case 'shadow-color':
            case 'shadow-offsetX':
            case 'shadow-offsetY':
            case 'shadow-blur':
                this._updateShadowProperty(property, value);
                break;

            default:
                this._selectedObject.set(property, value);
        }

        this.canvas.requestRenderAll();

        // Range-Number sync: aynı property'li diğer input'u güncelle
        if (input.type === 'range' || input.type === 'number') {
            const siblings = this.$$(`input[data-property="${property}"]`);
            siblings.forEach(sib => {
                if (sib !== input) {
                    sib.value = input.value;
                }
            });
        }

        // Debounced canvas modified event
        this._emitModified();
    }

    /**
     * Görsel nesnelerde köşe yuvarlama (clipPath ile)
     * @private
     * @param {number} radius - Köşe yarıçapı
     */
    _applyImageCornerRadius(radius) {
        if (!this._selectedObject) return;

        const imageObj = this._selectedObject;
        const safeRadius = Math.max(0, Number(radius) || 0);
        const baseWidth = imageObj.width || 0;
        const baseHeight = imageObj.height || 0;

        imageObj.set('rx', safeRadius);
        imageObj.set('ry', safeRadius);

        if (safeRadius <= 0 || baseWidth <= 0 || baseHeight <= 0) {
            imageObj.set('clipPath', null);
            return;
        }

        const maxRadius = Math.min(safeRadius, baseWidth / 2, baseHeight / 2);
        imageObj.set('clipPath', new Rect({
            left: 0,
            top: 0,
            originX: 'center',
            originY: 'center',
            width: baseWidth,
            height: baseHeight,
            rx: maxRadius,
            ry: maxRadius
        }));
    }

    /**
     * Bold toggle
     * @private
     */
    _toggleBold() {
        if (!this._selectedObject) return;

        const current = this._selectedObject.fontWeight;
        this._selectedObject.set('fontWeight', current === 'bold' ? 'normal' : 'bold');
        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    /**
     * Italic toggle
     * @private
     */
    _toggleItalic() {
        if (!this._selectedObject) return;

        const current = this._selectedObject.fontStyle;
        this._selectedObject.set('fontStyle', current === 'italic' ? 'normal' : 'italic');
        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    /**
     * Underline toggle
     * @private
     */
    _toggleUnderline() {
        if (!this._selectedObject) return;

        const current = this._selectedObject.underline;
        this._selectedObject.set('underline', !current);
        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    /**
     * Linethrough toggle
     * @private
     */
    _toggleLinethrough() {
        if (!this._selectedObject) return;

        const current = this._selectedObject.linethrough;
        this._selectedObject.set('linethrough', !current);
        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    /**
     * Text alignment ayarla
     * @private
     * @param {string} align - Hizalama değeri
     */
    _setTextAlign(align) {
        if (!this._selectedObject) return;

        this._selectedObject.set('textAlign', align);
        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    /**
     * Görsel değiştir
     * @private
     */
    _replaceImage() {
        eventBus.emit(EVENTS.PROPERTY_REPLACE_IMAGE, {
            object: this._selectedObject
        });
    }

    /**
     * Barkod/QR düzenle
     * @private
     */
    _editBarcode() {
        eventBus.emit(EVENTS.PROPERTY_EDIT_BARCODE, {
            object: this._selectedObject
        });
    }

    /**
     * Özellik değerlerini güncelle (canvas'tan oku)
     * @private
     */
    _updatePropertyValues() {
        // Debounce ile yeniden render
        if (this._updateTimer) {
            clearTimeout(this._updateTimer);
        }

        this._updateTimer = setTimeout(() => {
            this.refresh();
            this._updateTimer = null;
        }, 50);
    }

    /**
     * Modified event emit et (debounced)
     * @private
     */
    _emitModified() {
        eventBus.emit(EVENTS.CANVAS_MODIFIED, { source: 'property-panel' });
    }

    /**
     * Nesne metin mi?
     * @private
     * @returns {boolean}
     */
    _isTextObject() {
        if (!this._selectedObject) return false;
        const type = this._selectedObject.type;
        return type === 'text' || type === 'i-text' || type === 'textbox' ||
               type === 'Text' || type === 'FabricText' || type === 'Textbox' || type === 'IText';
    }

    /**
     * Nesne şekil mi?
     * @private
     * @returns {boolean}
     */
    _isShapeObject() {
        if (!this._selectedObject) return false;
        const type = this._selectedObject.type;
        return type === 'rect' || type === 'circle' || type === 'ellipse' ||
               type === 'triangle' || type === 'polygon' || type === 'line' ||
               type === 'Rect' || type === 'Circle' || type === 'Ellipse' ||
               type === 'Triangle' || type === 'Polygon' || type === 'Line';
    }

    /**
     * Canvas referansını ayarla
     * @param {Object} canvas - Fabric.js Canvas
     */
    setCanvas(canvas) {
        // Eski event'leri kaldır
        if (this.canvas) {
            this.canvas.off('selection:created', this._canvasHandlers.selectionCreated);
            this.canvas.off('selection:updated', this._canvasHandlers.selectionUpdated);
            this.canvas.off('selection:cleared', this._canvasHandlers.selectionCleared);
            this.canvas.off('object:modified', this._canvasHandlers.objectModified);
        }

        this.canvas = canvas;
        this._selectedObject = null;

        // Yeni event'leri bağla
        this._bindCanvasEvents();
        this.refresh();
    }

    /**
     * Panel'i dispose et
     */
    dispose() {
        // Update timer temizle
        if (this._updateTimer) {
            clearTimeout(this._updateTimer);
        }

        // Canvas event'lerini kaldır
        if (this.canvas) {
            this.canvas.off('selection:created', this._canvasHandlers.selectionCreated);
            this.canvas.off('selection:updated', this._canvasHandlers.selectionUpdated);
            this.canvas.off('selection:cleared', this._canvasHandlers.selectionCleared);
            this.canvas.off('object:modified', this._canvasHandlers.objectModified);
        }

        this._canvasHandlers = {};
        this._selectedObject = null;
        this.canvas = null;

        super.dispose();
    }
}

/**
 * Default export
 */
export default PropertyPanel;
