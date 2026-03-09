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
 * // Seçili nesne deðiþtiðinde
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
 * PropertyPanel Sýnýfý
 */
export class PropertyPanel extends PanelBase {
    /**
     * @param {Object} options - Panel ayarlarý
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
         * Fabric.js Canvas referansý
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
         * Event handler referanslarý
         * @type {Object}
         */
        this._canvasHandlers = {};
        this._fontCatalog = [
            { family: 'Arial', source: 'system' },
            { family: 'Inter', source: 'google' },
            { family: 'Roboto', source: 'google' },
            { family: 'Montserrat', source: 'google' },
            { family: 'Poppins', source: 'google' },
            { family: 'Noto Sans', source: 'google' },
            { family: 'Open Sans', source: 'google' },
            { family: 'Lato', source: 'google' },
            { family: 'Oswald', source: 'google' },
            { family: 'Raleway', source: 'google' },
            { family: 'Segoe UI', source: 'system' }
        ];
        this._fontLoadPromises = new Map();
        this._fontStylesheetInjected = false;
        this._fontStylesheetReadyPromise = this._ensureEditorFontStylesheet();
        this._preloadEditorFonts();
        this._framePreviewPopupEl = null;

        // Canvas event'lerini baðla
        this._bindCanvasEvents();
    }

    /**
     * Canvas event'lerini baðla
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
        this._hideFramePreviewPopup();
        this._selectedObject = object;
        this._applyPriceFormattingToTargets(this._getTextTargets());
        this.refresh();
    }

    /**
     * Panel içeriðini render et
     * @returns {string} HTML string
     */
    renderContent() {
        if (!this._selectedObject) {
            return this._renderNoSelection();
        }

        const objectType = this._selectedObject.type;
        // Fabric.js v7: .get() custom prop'larý güvenilir döndürmeyebilir, direct access da dene
        const customType = this._selectedObject[CUSTOM_PROPS.CUSTOM_TYPE] || this._selectedObject.get(CUSTOM_PROPS.TYPE);

        // Nesne tipine göre panel içeriði
        let sections = [];

        // Nesne tanýmlayýcý baþlýk (en üste)
        sections.push(this._renderObjectHeader());

        // Pozisyon & Boyut (tüm nesneler)
        sections.push(this._renderPositionSection());

        // Metin özellikleri
        if (this._isTextObject()) {
            sections.push(this._renderTextSection());
        }

        // Þekil özellikleri
        if (this._isShapeObject()) {
            sections.push(this._renderShapeSection());
        }

        // Dinamik Görsel özellikleri (image-placeholder veya slot-image seçildiðinde)
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

        // Kenarlýk & Köþe Yuvarlaklýðý (tüm nesneler)
        sections.push(this._renderBorderSection());

        // Gölge (tüm nesneler)
        sections.push(this._renderShadowSection());

        // Çerçeve (frame overlay) - overlay seçili olsa da hedef nesneye yönlenerek göster
        sections.push(this._renderFrameSection());

        // Genel özellikler (tüm nesneler)
        sections.push(this._renderGeneralSection());

        // Responsive ayarlarý (anchor, text fit) - tüm nesneler
        sections.push(this._renderResponsiveSection());

        return `
            <div class="property-panel-content">
                ${sections.join('')}
            </div>
        `;
    }

    /**
     * Seçim yok mesajý
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
     * Nesne tanýmlayýcý baþlýk
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

        // Ýkon belirle
        const icon = this._getObjectHeaderIcon(customType);

        // Nesne adýný belirle (öncelik sýrasý)
        let displayName = '';
        let typeBadge = '';

        if (dynamicField) {
            // Dinamik alanlarda üst satýr: tasarým adý (objectName) öncelikli
            // Alt satýr: alan etiketi (örn. description -> Açýklama/Ürün Açýklama)
            const dynamicLabel = this._getDynamicFieldDisplayName(dynamicField, placeholder);
            displayName = objectName || dynamicLabel || `{${dynamicField}}`;
            typeBadge = dynamicLabel || this.__('editor.elements.dynamicText');
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
            const textTarget = this._getPrimaryTextTarget() || obj;
            const text = textTarget.text || '';
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

        // Eðer displayName ve typeBadge aynýysa badge gösterme
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

    _getDynamicFieldDisplayName(dynamicField, placeholder = '') {
        const fieldKey = String(dynamicField || '').trim().replace(/^\{\{|\}\}$/g, '');
        if (!fieldKey) return '';

        const placeholderText = String(placeholder || '').trim().replace(/^\{+|\}+$/g, '');
        if (placeholderText && !/\{\{[^}]+\}\}/.test(placeholderText)) {
            return placeholderText;
        }

        const camelKey = fieldKey.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        const i18nKey = `editor.dynamicFields.${camelKey}`;
        const translated = this.__(i18nKey);
        if (translated && translated !== i18nKey) {
            return translated;
        }

        return fieldKey
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    /**
     * Nesne baþlýðý için ikon
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
            'shape': 'ti ti-shape',
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
     * Tip gösterim adý
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
            'video-placeholder': 'Video',
            'shape': this.__('editor.elements.shape')
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
        const textTarget = this._getPrimaryTextTarget() || this._selectedObject;
        const fontFamily = textTarget?.fontFamily || 'Arial';
        const fontSize = textTarget?.fontSize || 16;
        const normalizedFontWeight = this._normalizeFontWeight(textTarget?.fontWeight || 'normal');
        const fontStyle = textTarget?.fontStyle || 'normal';
        const underline = textTarget?.underline || false;
        const linethrough = textTarget?.linethrough || false;
        const textAlign = textTarget?.textAlign || 'left';
        const fill = textTarget?.fill || '#000000';
        const lineHeight = textTarget?.lineHeight || 1.16;
        const charSpacing = textTarget?.charSpacing || 0;
        const textValue = String(textTarget?.text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const fonts = this._getFontOptions(fontFamily);

        return `
            <div class="property-section">
                <div class="property-section-header">
                    <i class="ti ti-typography"></i>
                    <span>${this.__('editor.properties.text')}</span>
                </div>
                <div class="property-section-body">
                    <div class="property-item">
                        <label>${this.__('editor.properties.content') || 'Metin Ýçeriði'}</label>
                        <textarea class="form-input" data-property="text" rows="3">${textValue}</textarea>
                    </div>
                    <div class="property-item">
                        <label>${this.__('editor.properties.fontFamily')}</label>
                        <select class="form-select" data-property="fontFamily">
                            ${fonts.map(f => `<option value="${f}" ${this._isSameFontFamily(fontFamily, f) ? 'selected' : ''}>${f}</option>`).join('')}
                        </select>
                    </div>
                    <div class="property-grid-2">
                        <div class="property-item">
                            <label>${this.__('editor.properties.fontSize')}</label>
                            <input type="number" class="form-input" data-property="fontSize" value="${fontSize}" min="8" max="200">
                        </div>
                        <div class="property-item">
                            <label>${this.__('editor.properties.fontWeight') || 'Font Weight'}</label>
                            <select class="form-select" data-property="fontWeight">
                                <option value="300" ${normalizedFontWeight === '300' ? 'selected' : ''}>Light (300)</option>
                                <option value="400" ${normalizedFontWeight === '400' ? 'selected' : ''}>Regular (400)</option>
                                <option value="500" ${normalizedFontWeight === '500' ? 'selected' : ''}>Medium (500)</option>
                                <option value="600" ${normalizedFontWeight === '600' ? 'selected' : ''}>SemiBold (600)</option>
                                <option value="700" ${normalizedFontWeight === '700' ? 'selected' : ''}>Bold (700)</option>
                            </select>
                        </div>
                    </div>
                    <div class="property-item">
                        <label>${this.__('editor.properties.color')}</label>
                        ${this._renderColorInput('fill', fill)}
                    </div>
                    <div class="property-item">
                        <label>${this.__('editor.properties.style')}</label>
                        <div class="property-btn-group">
                            <button type="button" class="prop-style-btn ${this._isBoldWeight(normalizedFontWeight) ? 'active' : ''}" data-action="toggle-bold" title="Bold">
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
     * Þekil özellikleri bölümü
     * @private
     * @returns {string}
     */
    _renderShapeSection() {
        const obj = this._selectedObject;
        const { fill, stroke, strokeWidth } = this._getShapeStyleSnapshot(obj);
        const isLine = this._isLinePrimitive(obj);
        const lineStyle = this._linePresetFromDashArray(obj?.strokeDashArray);
        const lineCap = String(obj?.strokeLineCap || 'round').toLowerCase();

        return `
            <div class="property-section">
                <div class="property-section-header">
                    <i class="ti ti-shape"></i>
                    <span>${this.__('editor.properties.shape')}</span>
                </div>
                <div class="property-section-body">
                    ${!isLine ? `
                    <div class="property-item">
                        <label>${this.__('editor.properties.fill')}</label>
                        <div class="property-color-row property-color-input with-action">
                            <input type="color" class="form-color" data-property="fill" value="${this._normalizeColorHex(fill)}">
                            <input type="text" class="form-input form-color-hex" data-color-hex-for="fill" value="${this._normalizeColorHex(fill)}" placeholder="#000000" maxlength="7" spellcheck="false" autocomplete="off">
                            <button type="button" class="btn-icon btn-clear-fill" data-action="clear-fill" title="${this.__('editor.properties.noFill') || 'Ýç Dolgu Yok'}">
                                <i class="ti ti-ban"></i>
                            </button>
                        </div>
                    </div>
                    ` : ''}
                    <div class="property-item">
                        <label>${this.__('editor.properties.stroke')}</label>
                        ${this._renderColorInput('stroke', stroke)}
                    </div>
                    <div class="property-item">
                        <label>${this.__('editor.properties.strokeWidth')}</label>
                        <input type="number" class="form-input" data-property="strokeWidth" value="${strokeWidth}" min="0" max="50" step="1">
                    </div>
                    ${isLine ? `
                    <div class="property-item">
                        <label>${this.__('editor.properties.lineStyle') || 'Cizgi Stili'}</label>
                        <select class="form-input form-input-sm" data-property="lineDashPreset">
                            <option value="solid" ${lineStyle === 'solid' ? 'selected' : ''}>${this.__('editor.properties.solid') || 'Duz'}</option>
                            <option value="dashed" ${lineStyle === 'dashed' ? 'selected' : ''}>${this.__('editor.properties.dashed') || 'Kesik'}</option>
                            <option value="longDashed" ${lineStyle === 'longDashed' ? 'selected' : ''}>${this.__('editor.properties.longDashed') || 'Uzun Kesik'}</option>
                            <option value="dotted" ${lineStyle === 'dotted' ? 'selected' : ''}>${this.__('editor.properties.dotted') || 'Nokta'}</option>
                            <option value="dashDot" ${lineStyle === 'dashDot' ? 'selected' : ''}>${this.__('editor.properties.dashDot') || 'Kesik-Nokta'}</option>
                            <option value="dashDotDot" ${lineStyle === 'dashDotDot' ? 'selected' : ''}>Dash Dot Dot</option>
                            <option value="denseDash" ${lineStyle === 'denseDash' ? 'selected' : ''}>Dense Dash</option>
                            <option value="sparseDot" ${lineStyle === 'sparseDot' ? 'selected' : ''}>Sparse Dot</option>
                        </select>
                    </div>
                    <div class="property-item">
                        <label>Line Cap</label>
                        <select class="form-input form-input-sm" data-property="strokeLineCap">
                            <option value="butt" ${lineCap === 'butt' ? 'selected' : ''}>Butt</option>
                            <option value="round" ${lineCap === 'round' ? 'selected' : ''}>Round</option>
                            <option value="square" ${lineCap === 'square' ? 'selected' : ''}>Square</option>
                        </select>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    _isLinePrimitive(obj) {
        return this._isLineLikeObject(obj);
    }

    _isLineLikeObject(obj) {
        const type = String(obj?.type || '').toLowerCase();
        const customType = String(
            obj?.[CUSTOM_PROPS.CUSTOM_TYPE] ||
            obj?.customType ||
            obj?.get?.(CUSTOM_PROPS.CUSTOM_TYPE) ||
            ''
        ).toLowerCase();
        return type === 'line' || type === 'path' || type === 'polyline' || customType === CUSTOM_TYPES.LINE;
    }

    _linePresetFromDashArray(dashArray) {
        if (!Array.isArray(dashArray) || dashArray.length === 0) return 'solid';
        const key = dashArray.join(',');
        if (key === '14,6' || key === '10,6') return 'dashed';
        if (key === '26,12' || key === '20,10') return 'longDashed';
        if (key === '1,11' || key === '2,10') return 'dotted';
        if (key === '20,8,2,8' || key === '16,6,2,6') return 'dashDot';
        if (key === '20,8,2,8,2,8' || key === '16,6,2,6,2,6') return 'dashDotDot';
        if (key === '8,4' || key === '6,4') return 'denseDash';
        if (key === '1,17' || key === '2,14') return 'sparseDot';
        if (key === '30,6,4,6') return 'rail';
        if (key === '4,4,12,4,4,10') return 'pulse';
        return 'dashed';
    }

    _dashArrayFromLinePreset(style) {
        switch (String(style || 'solid')) {
            case 'dashed':
                return [14, 6];
            case 'longDashed':
                return [26, 12];
            case 'dotted':
                return [1, 11];
            case 'dashDot':
                return [20, 8, 2, 8];
            case 'dashDotDot':
                return [20, 8, 2, 8, 2, 8];
            case 'denseDash':
                return [8, 4];
            case 'sparseDot':
                return [1, 17];
            case 'rail':
                return [30, 6, 4, 6];
            case 'pulse':
                return [4, 4, 12, 4, 4, 10];
            default:
                return null;
        }
    }

    _isLibraryShapeObject(obj) {
        if (!obj) return false;
        const customType = String(
            obj[CUSTOM_PROPS.CUSTOM_TYPE] ||
            obj.customType ||
            obj.get?.(CUSTOM_PROPS.CUSTOM_TYPE) ||
            obj.get?.('customType') ||
            ''
        ).toLowerCase();
        if (customType === CUSTOM_TYPES.SHAPE || customType === 'shape') return true;
        return !!(obj[CUSTOM_PROPS.SHAPE_LIBRARY_ID] || obj.get?.(CUSTOM_PROPS.SHAPE_LIBRARY_ID));
    }

    _getShapeDrawableTargets(obj) {
        if (!obj) return [];
        const targets = [];
        const stack = [obj];
        const drawableTypes = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'line', 'polyline']);

        while (stack.length > 0) {
            const current = stack.pop();
            if (!current) continue;

            const children = this._getObjectChildren(current);
            if (children.length > 0) {
                children.forEach(child => stack.push(child));
                continue;
            }

            const type = String(current.type || '').toLowerCase();
            if (drawableTypes.has(type)) {
                targets.push(current);
            }
        }

        return targets;
    }

    _getShapeStyleSnapshot(obj) {
        const fallback = { fill: '#ffffff', stroke: '#1f2937', strokeWidth: 1 };
        if (!obj) return fallback;

        const target = this._isLibraryShapeObject(obj)
            ? (this._getShapeDrawableTargets(obj)[0] || obj)
            : obj;

        const fill = target.fill || fallback.fill;
        const strokeRaw = target.stroke;
        const stroke = (typeof strokeRaw === 'string' && strokeRaw !== '' && strokeRaw !== 'transparent')
            ? strokeRaw
            : fallback.stroke;
        const strokeWidth = Math.max(0, Number(target.strokeWidth || 0));

        return { fill, stroke, strokeWidth };
    }

    _applyShapeProperty(property, value) {
        if (!this._selectedObject) return false;
        if (!this._isLibraryShapeObject(this._selectedObject)) return false;

        const targets = this._getShapeDrawableTargets(this._selectedObject);
        if (!targets.length) return false;

        const normalizedColor = (fallback = '#000000') => this._normalizeColorHex(String(value), fallback);

        switch (property) {
            case 'fill': {
                const nextFill = normalizedColor('#000000');
                targets.forEach(target => target.set('fill', nextFill));
                return true;
            }
            case 'stroke': {
                const nextStroke = normalizedColor('#000000');
                targets.forEach(target => {
                    target.set('stroke', nextStroke);
                    if ((target.strokeWidth || 0) <= 0) {
                        target.set('strokeWidth', 1);
                    }
                });
                return true;
            }
            case 'strokeWidth': {
                const safeWidth = Math.max(0, Number(value) || 0);
                targets.forEach(target => {
                    target.set('strokeWidth', safeWidth);
                    if (safeWidth > 0) {
                        const currentStroke = target.stroke;
                        const hasVisibleStroke = typeof currentStroke === 'string' && currentStroke !== '' && currentStroke !== 'transparent';
                        if (!hasVisibleStroke) {
                            target.set('stroke', '#000000');
                        }
                    }
                });
                return true;
            }
            default:
                return false;
        }
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
     * Görsel indeks seçimi ve fit modu ayarlarý
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
     * Kenarlýk & Köþe Yuvarlaklýðý bölümü (tüm nesneler için)
     * @private
     * @returns {string}
     */
    _renderBorderSection() {
        const obj = this._selectedObject;
        const stroke = obj.stroke || '';
        const strokeWidth = obj.strokeWidth || 0;
        const rx = obj.rx || obj.clipPath?.rx || 0;
        const type = obj.type;
        const isLine = this._isLineLikeObject(obj);
        const lineStyle = this._linePresetFromDashArray(obj?.strokeDashArray);
        const lineCap = String(obj?.strokeLineCap || 'round').toLowerCase();

        // Stroke rengi - boþ veya null ise transparan göster
        const strokeColor = stroke && stroke !== 'transparent' ? stroke : '#000000';
        const hasStroke = stroke && stroke !== 'transparent' && strokeWidth > 0;

        // Köþe yuvarlaklýðý sadece rect türü nesneler için geçerli
        const isRect = type === 'rect' || type === 'Rect';
        // Görseller için clipPath ile rx etkisi verilemez ama Fabric.js image'larda
        // stroke ve shadow çalýþýr
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
                            <div class="property-color-row property-color-input with-action">
                                <input type="color" class="form-color" data-property="stroke" value="${this._normalizeColorHex(strokeColor)}">
                                <input type="text" class="form-input form-color-hex" data-color-hex-for="stroke" value="${this._normalizeColorHex(strokeColor)}" placeholder="#000000" maxlength="7" spellcheck="false" autocomplete="off">
                                <button type="button" class="btn-icon btn-clear-stroke ${!hasStroke ? 'active' : ''}" data-action="clear-stroke" title="${this.__('editor.properties.noStroke')}">
                                    <i class="ti ti-ban"></i>
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
                    ${isLine ? `
                    <div class="property-item">
                        <label>${this.__('editor.properties.lineStyle') || 'Cizgi Stili'}</label>
                        <select class="form-input form-input-sm" data-property="lineDashPreset">
                            <option value="solid" ${lineStyle === 'solid' ? 'selected' : ''}>${this.__('editor.properties.solid') || 'Duz'}</option>
                            <option value="dashed" ${lineStyle === 'dashed' ? 'selected' : ''}>${this.__('editor.properties.dashed') || 'Kesik'}</option>
                            <option value="longDashed" ${lineStyle === 'longDashed' ? 'selected' : ''}>${this.__('editor.properties.longDashed') || 'Uzun Kesik'}</option>
                            <option value="dotted" ${lineStyle === 'dotted' ? 'selected' : ''}>${this.__('editor.properties.dotted') || 'Nokta'}</option>
                            <option value="dashDot" ${lineStyle === 'dashDot' ? 'selected' : ''}>${this.__('editor.properties.dashDot') || 'Kesik-Nokta'}</option>
                            <option value="dashDotDot" ${lineStyle === 'dashDotDot' ? 'selected' : ''}>Dash Dot Dot</option>
                            <option value="denseDash" ${lineStyle === 'denseDash' ? 'selected' : ''}>Dense Dash</option>
                            <option value="sparseDot" ${lineStyle === 'sparseDot' ? 'selected' : ''}>Sparse Dot</option>
                            <option value="rail" ${lineStyle === 'rail' ? 'selected' : ''}>Rail</option>
                            <option value="pulse" ${lineStyle === 'pulse' ? 'selected' : ''}>Pulse</option>
                        </select>
                    </div>
                    <div class="property-item">
                        <label>Line Cap</label>
                        <select class="form-input form-input-sm" data-property="strokeLineCap">
                            <option value="butt" ${lineCap === 'butt' ? 'selected' : ''}>Butt</option>
                            <option value="round" ${lineCap === 'round' ? 'selected' : ''}>Round</option>
                            <option value="square" ${lineCap === 'square' ? 'selected' : ''}>Square</option>
                        </select>
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

        // Shadow color'ý hex'e dönüþtür (rgba olabilir)
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
                            ${this._renderColorInput('shadow-color', hexColor)}
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
     * Shadow rengini hex'e dönüþtür
     * @private
     * @param {string} color - Renk deðeri (rgba, hex, named)
     * @returns {string} Hex renk
     */
    _shadowColorToHex(color) {
        if (!color) return '#000000';

        // Zaten hex ise
        if (color.startsWith('#')) {
            // 3 haneli hex'i 6 haneliye dönüþtür
            if (color.length === 4) {
                return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
            }
            return color.substring(0, 7); // alpha kýsmýný kes
        }

        // rgba() formatý
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
     * Çerçeve (Frame Overlay) bölümü
     * @private
     * @returns {string}
     */
    _renderFrameSection() {
        const obj = this._resolveFrameTargetObject() || this._selectedObject;
        if (!obj) return '';

        const frameId = obj[CUSTOM_PROPS.FRAME_ID] || obj.get?.(CUSTOM_PROPS.FRAME_ID);

        if (frameId) {
            // Frame applied - show preview + change/remove buttons
            const basePath = window.OmnexConfig?.basePath || '';
            const safeFrameId = String(frameId || '').replace(/"/g, '&quot;');
            const fallbackThumbPath = `${basePath}/assets/frames/_thumbs/${safeFrameId}.png`;
            let thumbHtml = `
                <div class="frame-preview-thumb">
                    <div class="frame-preview-thumb-inner">
                        <img src="${fallbackThumbPath}" alt="${safeFrameId}" loading="lazy">
                    </div>
                </div>
            `;
            let frameName = frameId;
            const frameColor = this._normalizeColorHex(
                obj[CUSTOM_PROPS.FRAME_COLOR] || obj.get?.(CUSTOM_PROPS.FRAME_COLOR) || '#000000'
            );

            // Try to get frame details (will be populated after async load)
            return `
                <div class="frame-section">
                    <div class="frame-section-header">
                        <i class="ti ti-frame"></i>
                        <span>${this.__('editor.frame.title')}</span>
                    </div>
                    <div class="frame-preview-row" id="frame-preview-row" data-frame-id="${frameId}">
                        ${thumbHtml}
                        <div class="frame-preview-info">
                            <div class="frame-preview-name">${frameName}</div>
                            <div class="frame-preview-type"></div>
                        </div>
                    </div>
                    <div class="property-item">
                        <label>${this.__('editor.frame.color') || 'Çerçeve Rengi'}</label>
                        ${this._renderColorInput('frameColor', frameColor)}
                    </div>
                    <div class="frame-actions">
                        <button class="btn btn-sm btn-outline" data-action="pick-frame">
                            <i class="ti ti-refresh"></i> ${this.__('editor.frame.change')}
                        </button>
                        <button class="btn btn-sm btn-outline text-red-500" data-action="remove-frame">
                            <i class="ti ti-trash"></i> ${this.__('editor.frame.remove')}
                        </button>
                    </div>
                </div>
            `;
        } else {
            // No frame - show add button
            return `
                <div class="frame-section">
                    <div class="frame-section-header">
                        <i class="ti ti-frame"></i>
                        <span>${this.__('editor.frame.title')}</span>
                    </div>
                    <button class="btn-add-frame" data-action="pick-frame">
                        <i class="ti ti-plus"></i>
                        ${this.__('editor.frame.add')}
                    </button>
                </div>
            `;
        }
    }

    /**
     * Populate frame preview with actual data (async, called after render)
     * @private
     */
    async _populateFramePreview() {
        this._hideFramePreviewPopup();
        const row = this._container?.querySelector('#frame-preview-row');
        if (!row) return;

        const frameId = row.dataset.frameId;
        if (!frameId) return;

        try {
            const { getFrameById, getFrameThumbPath } = await import('../data/FrameAssetsData.js');
            const frameDef = getFrameById(frameId);
            if (!frameDef) return;

            const thumb = row.querySelector('.frame-preview-thumb');
            if (thumb) {
                const thumbPath = getFrameThumbPath(frameDef);
                thumb.innerHTML = `
                    <div class="frame-preview-thumb-inner">
                        <img src="${thumbPath}" alt="${frameDef.title}">
                    </div>
                `;
                this._bindFramePreviewHover(thumb, thumbPath, frameDef.title || frameId);
            }
            const nameEl = row.querySelector('.frame-preview-name');
            if (nameEl) nameEl.textContent = frameDef.title;
            const typeEl = row.querySelector('.frame-preview-type');
            if (typeEl) typeEl.textContent = frameDef.frameType;
        } catch (e) {
            // Silently ignore - preview is a nice-to-have
        }
    }

    _bindFramePreviewHover(thumbEl, imageSrc, title = '') {
        if (!thumbEl || !imageSrc) return;

        this._addEventListener(thumbEl, 'mouseenter', (e) => {
            this._showFramePreviewPopup(imageSrc, title, e.clientX, e.clientY);
        });
        this._addEventListener(thumbEl, 'mousemove', (e) => {
            this._moveFramePreviewPopup(e.clientX, e.clientY);
        });
        this._addEventListener(thumbEl, 'mouseleave', () => {
            this._hideFramePreviewPopup();
        });
    }

    _showFramePreviewPopup(imageSrc, title, x, y) {
        this._hideFramePreviewPopup();

        const el = document.createElement('div');
        el.className = 'frame-preview-floating';
        el.innerHTML = `
            <div class="frame-preview-floating-title">${String(title || '')}</div>
            <div class="frame-preview-floating-image">
                <img src="${imageSrc}" alt="${String(title || '')}">
            </div>
        `;

        document.body.appendChild(el);
        this._framePreviewPopupEl = el;
        this._moveFramePreviewPopup(x, y);
        requestAnimationFrame(() => {
            if (this._framePreviewPopupEl) {
                this._framePreviewPopupEl.classList.add('show');
            }
        });
    }

    _moveFramePreviewPopup(x, y) {
        const el = this._framePreviewPopupEl;
        if (!el) return;

        const margin = 14;
        const popupW = 190;
        const popupH = 220;
        let left = (Number(x) || 0) + margin;
        let top = (Number(y) || 0) + margin;

        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        const vh = window.innerHeight || document.documentElement.clientHeight || 0;

        if (left + popupW > vw - 8) left = Math.max(8, (Number(x) || 0) - popupW - margin);
        if (top + popupH > vh - 8) top = Math.max(8, vh - popupH - 8);

        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    }

    _hideFramePreviewPopup() {
        if (this._framePreviewPopupEl?.parentNode) {
            this._framePreviewPopupEl.parentNode.removeChild(this._framePreviewPopupEl);
        }
        this._framePreviewPopupEl = null;
    }

    /**
     * Color input + hex text input ortak renderer
     * @private
     * @param {string} property
     * @param {string} color
     * @returns {string}
     */
    _renderColorInput(property, color) {
        const hex = this._normalizeColorHex(color);
        return `
            <div class="property-color-input">
                <input type="color" class="form-color" data-property="${property}" value="${hex}">
                <input type="text" class="form-input form-color-hex" data-color-hex-for="${property}" value="${hex}" placeholder="#000000" maxlength="7" spellcheck="false" autocomplete="off">
            </div>
        `;
    }

    /**
     * Font weight degerini normalize et
     * @private
     * @param {string|number} weight
     * @returns {string}
     */
    _normalizeFontWeight(weight) {
        const raw = String(weight ?? '').trim().toLowerCase();
        if (raw === 'bold') return '700';
        if (raw === 'normal' || raw === '') return '400';

        const parsed = parseInt(raw, 10);
        if (!Number.isFinite(parsed)) return '400';

        if (parsed < 350) return '300';
        if (parsed < 450) return '400';
        if (parsed < 550) return '500';
        if (parsed < 650) return '600';
        return '700';
    }

    /**
     * Bold butonunun aktiflik kontrolu
     * @private
     * @param {string|number} weight
     * @returns {boolean}
     */
    _isBoldWeight(weight) {
        return parseInt(this._normalizeFontWeight(weight), 10) >= 700;
    }

    /**
     * Renk degerini #RRGGBB formatina normalize et
     * @private
     * @param {string} value
     * @param {string} fallback
     * @returns {string}
     */
    _normalizeColorHex(value, fallback = '#000000') {
        const fallbackHex = (fallback || '#000000').toUpperCase();
        if (!value || typeof value !== 'string') return fallbackHex;

        let normalized = value.trim();
        if (normalized === '') return fallbackHex;

        if (normalized.startsWith('rgb')) {
            return this._shadowColorToHex(normalized).toUpperCase();
        }

        if (!normalized.startsWith('#')) {
            normalized = `#${normalized}`;
        }

        if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
            return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toUpperCase();
        }

        if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
            return normalized.toUpperCase();
        }

        return fallbackHex;
    }

    /**
     * Hex renk dogrulamasi
     * @private
     * @param {string} value
     * @returns {boolean}
     */
    _isHexColor(value) {
        return /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim());
    }

    /**
     * Shadow özelliðini güncelle
     * @private
     * @param {string} property - shadow-color, shadow-offsetX, shadow-offsetY, shadow-blur
     * @param {*} value - Yeni deðer
     */
    _updateShadowProperty(property, value) {
        if (!this._selectedObject) return;

        let shadow = this._selectedObject.shadow;
        if (!shadow) {
            // Fabric.js v7 Shadow nesnesi oluþtur
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

        if (this._isLibraryShapeObject(this._selectedObject)) {
            const targets = this._getShapeDrawableTargets(this._selectedObject);
            targets.forEach(target => {
                target.set('stroke', null);
                target.set('strokeWidth', 0);
            });
        } else {
            this._selectedObject.set('stroke', null);
            this._selectedObject.set('strokeWidth', 0);
        }
        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    _clearFill() {
        if (!this._selectedObject) return;

        if (this._isLibraryShapeObject(this._selectedObject)) {
            const targets = this._getShapeDrawableTargets(this._selectedObject);
            targets.forEach(target => target.set('fill', 'rgba(0,0,0,0)'));
        } else {
            this._selectedObject.set('fill', 'rgba(0,0,0,0)');
        }

        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }


    /**
     * Open frame picker and apply selected frame
     * @private
     */
    async _pickFrame() {
        if (!this.canvas) return;
        const targetObj = this._resolveFrameTargetObject();
        if (!targetObj) return;

        const { FramePicker } = await import('../components/FramePicker.js');

        FramePicker.open({
            __: (key) => this.__(`editor.${key}`),
            onSelect: async (frameDef) => {
                if (!this.canvas) return;
                const liveTarget = this._resolveFrameTargetObject() || targetObj;
                if (!liveTarget) return;

                // Use frameService from editor if available
                const frameService = this._frameService || this.editor?.frameService;
                if (!frameService) {
                    console.warn('[PropertyPanel] No frameService available');
                    return;
                }

                await frameService.applyFrame(liveTarget, frameDef, this.canvas);
                this.refresh();
                this._emitModified();
            }
        });
    }

    /**
     * Remove frame from selected object
     * @private
     */
    _removeFrame() {
        if (!this.canvas) return;
        const targetObj = this._resolveFrameTargetObject();
        if (!targetObj) return;

        const frameService = this._frameService || this.editor?.frameService;
        if (!frameService) return;

        frameService.removeFrame(targetObj, this.canvas);
        this.refresh();
        this._emitModified();
    }

    _resolveFrameTargetObject() {
        if (!this.canvas) return null;

        const activeObj = this._selectedObject || this.canvas.getActiveObject?.() || null;
        if (!activeObj) return null;

        const activeType = String(activeObj.type || '').toLowerCase();
        if (activeType === 'activeselection' && typeof activeObj.getObjects === 'function') {
            const members = activeObj.getObjects();
            return members.find((obj) =>
                String(
                    obj?.[CUSTOM_PROPS.CUSTOM_TYPE] ||
                    obj?.custom_type ||
                    obj?.get?.(CUSTOM_PROPS.CUSTOM_TYPE) ||
                    ''
                ).toLowerCase() !== CUSTOM_TYPES.FRAME_OVERLAY
            ) || null;
        }

        const customType = String(
            activeObj?.[CUSTOM_PROPS.CUSTOM_TYPE] ||
            activeObj?.custom_type ||
            activeObj?.get?.(CUSTOM_PROPS.CUSTOM_TYPE) ||
            ''
        ).toLowerCase();
        if (customType === CUSTOM_TYPES.FRAME_OVERLAY) {
            const targetId =
                activeObj?.[CUSTOM_PROPS.FRAME_TARGET_ID] ||
                activeObj?.frameTargetId ||
                activeObj?.get?.(CUSTOM_PROPS.FRAME_TARGET_ID);
            if (!targetId) return null;
            return this.canvas.getObjects().find((obj) =>
                (obj?.[CUSTOM_PROPS.OBJECT_ID] || obj?.get?.(CUSTOM_PROPS.OBJECT_ID)) === targetId
            ) || null;
        }

        return activeObj;
    }

    /**
     * Set frame service reference
     * @param {FrameService} service
     */
    setFrameService(service) {
        this._frameService = service;
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
        const textTarget = this._getPrimaryTextTarget() || obj;
        const anchorX = obj[CUSTOM_PROPS.ANCHOR_X] || 'left';
        const anchorY = obj[CUSTOM_PROPS.ANCHOR_Y] || 'top';
        const textFit = obj[CUSTOM_PROPS.TEXT_FIT] || 'none';
        const minFontSize = obj[CUSTOM_PROPS.MIN_FONT_SIZE] || 8;
        const maxLines = obj[CUSTOM_PROPS.MAX_LINES] || 0;
        const isText = this._isTextObject();
        const rawTextValue = String(textTarget?.text ?? textTarget?.get?.('text') ?? '');
        const dynamicPlaceholderMatch = rawTextValue.match(/\{\{\s*([^}\s]+)\s*\}\}/);
        const dynamicField =
            textTarget?.[CUSTOM_PROPS.DYNAMIC_FIELD] ||
            textTarget?.get?.(CUSTOM_PROPS.DYNAMIC_FIELD) ||
            textTarget?.dynamic_field ||
            dynamicPlaceholderMatch?.[1] ||
            '';
        const customType = textTarget?.[CUSTOM_PROPS.CUSTOM_TYPE] || textTarget?.get?.(CUSTOM_PROPS.CUSTOM_TYPE) || '';
        const isPriceText = isText && this._isPriceLikeField(dynamicField, customType);

        const fractionScaleRaw =
            textTarget?.[CUSTOM_PROPS.PRICE_FRACTION_SCALE] ??
            textTarget?.get?.(CUSTOM_PROPS.PRICE_FRACTION_SCALE) ??
            1;
        const fractionScalePercent = Math.max(30, Math.min(100, Math.round((Number(fractionScaleRaw) || 1) * 100)));

        const fractionDigitsRaw =
            textTarget?.[CUSTOM_PROPS.PRICE_FRACTION_DIGITS] ??
            textTarget?.get?.(CUSTOM_PROPS.PRICE_FRACTION_DIGITS) ??
            -1;
        const fractionDigits = [-1, 1, 2].includes(Number(fractionDigitsRaw)) ? Number(fractionDigitsRaw) : -1;

        const midlineEnabledRaw =
            textTarget?.[CUSTOM_PROPS.PRICE_MIDLINE_ENABLED] ??
            textTarget?.get?.(CUSTOM_PROPS.PRICE_MIDLINE_ENABLED) ??
            false;
        const midlineEnabled = !!midlineEnabledRaw;

        const midlineThicknessRaw =
            textTarget?.[CUSTOM_PROPS.PRICE_MIDLINE_THICKNESS] ??
            textTarget?.get?.(CUSTOM_PROPS.PRICE_MIDLINE_THICKNESS) ??
            1;
        const midlineThickness = Math.max(1, Math.min(8, Number(midlineThicknessRaw) || 1));

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
                            <button class="btn btn-icon ${anchorX === 'right' ? 'active' : ''}" data-property="anchorX" data-value="right" title="Sað">
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
                        <label>${this.__('editor.properties.maxLines') || 'Max Satýr'}</label>
                        <input type="number" class="form-input form-input-sm" data-property="maxLines" value="${maxLines}" min="0" max="20">
                    </div>
                    ${isPriceText ? `
                    <div class="property-item">
                        <label>Fiyat Ondalýk Hane</label>
                        <select class="form-select form-select-sm" data-property="priceFractionDigits">
                            <option value="-1" ${fractionDigits === -1 ? 'selected' : ''}>Otomatik</option>
                            <option value="1" ${fractionDigits === 1 ? 'selected' : ''}>1 Hane</option>
                            <option value="2" ${fractionDigits === 2 ? 'selected' : ''}>2 Hane</option>
                        </select>
                    </div>
                    <div class="property-item">
                        <label>Ondalýk Boyut (%)</label>
                        <input type="number" class="form-input form-input-sm" data-property="priceFractionScalePercent" value="${fractionScalePercent}" min="30" max="100">
                    </div>
                    <div class="property-item property-checkbox">
                        <label>
                            <input type="checkbox" data-property="priceMidlineEnabled" ${midlineEnabled ? 'checked' : ''}>
                            Fiyat Orta Çizgi
                        </label>
                    </div>
                    <div class="property-item">
                        <label>Çizgi Kalýnlýðý</label>
                        <input type="number" class="form-input form-input-sm" data-property="priceMidlineThickness" value="${midlineThickness}" min="1" max="8">
                    </div>
                    ` : ''}
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Event'leri baðla
     */
    bindEvents() {
        if (!this.element) return;

        // Input deðiþiklikleri
        this.$$('input[data-property], select[data-property], textarea[data-property]').forEach(input => {
            this._addEventListener(input, 'input', (e) => this._handlePropertyChange(e));
            this._addEventListener(input, 'change', (e) => this._handlePropertyChange(e));
        });

        // Color picker yanindaki #hex text alanlari
        this.$$('[data-color-hex-for]').forEach(hexInput => {
            const property = hexInput.dataset.colorHexFor;
            const colorInput = hexInput
                .closest('.property-color-input, .property-color-row')
                ?.querySelector(`input[type="color"][data-property="${property}"]`);

            if (!property || !colorInput) return;

            const syncHexFromColor = () => {
                hexInput.value = this._normalizeColorHex(colorInput.value);
            };

            syncHexFromColor();

            this._addEventListener(colorInput, 'input', syncHexFromColor);
            this._addEventListener(colorInput, 'change', syncHexFromColor);

            this._addEventListener(hexInput, 'input', () => {
                let next = hexInput.value.trim().toUpperCase();
                if (next && !next.startsWith('#')) {
                    next = `#${next}`;
                }

                // Yazarken sadece # + 0..6 hex karaktere izin ver
                if (!/^#[0-9A-F]{0,6}$/.test(next)) {
                    return;
                }

                hexInput.value = next;
                if (this._isHexColor(next)) {
                    colorInput.value = next;
                    colorInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });

            this._addEventListener(hexInput, 'blur', () => {
                const normalized = this._normalizeColorHex(hexInput.value, colorInput.value || '#000000');
                hexInput.value = normalized;
                if (colorInput.value !== normalized) {
                    colorInput.value = normalized;
                    colorInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        });

        // Style butonlarý
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

        // Alignment butonlarý
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

        // Clear stroke (kenarlýk yok butonu)
        this.$$('[data-action="clear-stroke"]').forEach(btn => {
            this._addEventListener(btn, 'click', () => this._clearStroke());
        });

        // Clear fill (iç dolgu yok)
        this.$$('[data-action="clear-fill"]').forEach(btn => {
            this._addEventListener(btn, 'click', () => this._clearFill());
        });

        // Responsive: Anchor butonlarý (data-property="anchorX/Y" data-value="left/center/right")
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

        // Responsive: textFit deðiþtiðinde min font / max lines görünürlüðü
        this.$$('select[data-property="textFit"]').forEach(sel => {
            this._addEventListener(sel, 'change', () => {
                const val = sel.value;
                this.$$('[data-show-for-textfit]').forEach(el => {
                    el.style.display = el.dataset.showForTextfit === val ? '' : 'none';
                });
            });
        });

        // Frame: Pick frame (add or change)
        this.$$('[data-action="pick-frame"]').forEach(btn => {
            this._addEventListener(btn, 'click', () => this._pickFrame());
        });

        // Frame: Remove frame
        this.$$('[data-action="remove-frame"]').forEach(btn => {
            this._addEventListener(btn, 'click', () => this._removeFrame());
        });

        // Frame: Populate preview thumbnail (async)
        this._populateFramePreview();
    }

    /**
     * Özellik deðiþikliðini iþle
     * @private
     * @param {Event} e - Input event
     */
    _handlePropertyChange(e) {
        if (!this._selectedObject || !this.canvas) return;

        const input = e.target;
        const property = input.dataset.property;
        let value = input.type === 'checkbox' ? input.checked : input.value;

        // Sayýsal deðerleri dönüþtür
        if (input.type === 'number' || input.type === 'range') {
            value = parseFloat(value);
        }

        // Özel iþlemler
        const objType = (this._selectedObject.type || '').toLowerCase();
        const isTextObject = this._isDirectTextObject(this._selectedObject);
        const textTargets = this._getTextTargets();
        const hasTextTargets = textTargets.length > 0;
        let shouldApplyPriceFormatting = false;
        const applyCustomTextProperty = (propName, propValue) => {
            this._applyCustomTextProperty(propName, propValue, textTargets, hasTextTargets);
        };

        switch (property) {
            case 'width':
                if (isTextObject) {
                    // Metin nesneleri için doðrudan width set et (scaleX kullanma, stretch olur)
                    this._selectedObject.set({ width: value, scaleX: 1 });
                    if (this._selectedObject.initDimensions) this._selectedObject.initDimensions();
                    this._markTextWidthManual(this._selectedObject);
                } else {
                    // Diðer nesneler için scale ile boyutlandýr
                    const currentWidth = this._selectedObject.width * this._selectedObject.scaleX;
                    if (currentWidth !== value) {
                        this._selectedObject.set('scaleX', value / this._selectedObject.width);
                    }
                }
                break;

            case 'height':
                if (isTextObject) {
                    // Metin nesneleri için height scaleY üzerinden deðil, doðrudan set
                    this._selectedObject.set({ scaleY: 1 });
                    // Textbox'ta height metin içeriðine göre otomatik hesaplanýr
                } else {
                    const currentHeight = this._selectedObject.height * this._selectedObject.scaleY;
                    if (currentHeight !== value) {
                        this._selectedObject.set('scaleY', value / this._selectedObject.height);
                    }
                }
                break;

            case 'opacity':
                // Yüzdeyi 0-1 aralýðýna dönüþtür
                this._selectedObject.set('opacity', value / 100);
                this._selectedObject.dirty = true;
                this._getObjectChildren(this._selectedObject).forEach((child) => {
                    child.dirty = true;
                });
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

            case 'fill': {
                if (!this._applyShapeProperty('fill', value)) {
                    const normalizedFill = this._normalizeColorHex(String(value), '#000000');
                    if (hasTextTargets) {
                        textTargets.forEach(target => target.set('fill', normalizedFill));
                    } else {
                        this._selectedObject.set('fill', normalizedFill);
                    }
                }
                break;
            }

            case 'stroke':
                if (!this._applyShapeProperty('stroke', value)) {
                    this._selectedObject.set('stroke', this._normalizeColorHex(String(value), '#000000'));
                    if ((this._selectedObject.strokeWidth || 0) <= 0) {
                        this._selectedObject.set('strokeWidth', 1);
                    }
                }
                break;

            case 'strokeWidth': {
                if (!this._applyShapeProperty('strokeWidth', value)) {
                    const safeWidth = Math.max(0, Number(value) || 0);
                    this._selectedObject.set('strokeWidth', safeWidth);
                    if (safeWidth > 0) {
                        const currentStroke = this._selectedObject.stroke;
                        const hasVisibleStroke = typeof currentStroke === 'string' && currentStroke !== '' && currentStroke !== 'transparent';
                        if (!hasVisibleStroke) {
                            const strokePicker = this.$('input[type="color"][data-property="stroke"]');
                            const fallbackStroke = this._normalizeColorHex(strokePicker?.value || '#000000');
                            this._selectedObject.set('stroke', fallbackStroke);
                        }
                    }
                }
                break;
            }

            case 'lineDashPreset': {
                this._selectedObject.set('strokeDashArray', this._dashArrayFromLinePreset(value));
                break;
            }

            case 'strokeLineCap': {
                const nextCap = String(value || 'round');
                this._selectedObject.set('strokeLineCap', nextCap);
                break;
            }

            case 'frameColor': {
                const targetObj = this._resolveFrameTargetObject();
                if (!targetObj) break;
                const nextColor = this._normalizeColorHex(String(value), '#000000');
                targetObj[CUSTOM_PROPS.FRAME_COLOR] = nextColor;
                try {
                    targetObj.set?.(CUSTOM_PROPS.FRAME_COLOR, nextColor);
                } catch (err) {
                    // ignore
                }
                const frameService = this._frameService || this.editor?.frameService;
                frameService?.updateFrame(targetObj, this.canvas);
                break;
            }

            case 'text':
                if (hasTextTargets) {
                    textTargets.forEach(target => {
                        target.set('text', String(value ?? ''));
                        this._applyAutoTextboxWidthIfEnabled(target);
                        target.initDimensions?.();
                        target.setCoords?.();
                    });
                } else {
                    this._selectedObject.set('text', String(value ?? ''));
                    this._applyAutoTextboxWidthIfEnabled(this._selectedObject);
                    this._selectedObject.initDimensions?.();
                    this._selectedObject.setCoords?.();
                }
                shouldApplyPriceFormatting = true;
                break;

            case 'fontFamily': {
                const nextFontFamily = String(value || '').trim();
                if (hasTextTargets) {
                    textTargets.forEach(target => {
                        target.set('fontFamily', nextFontFamily);
                        this._applyAutoTextboxWidthIfEnabled(target);
                        target.initDimensions?.();
                        target.setCoords?.();
                    });
                } else {
                    this._selectedObject.set('fontFamily', nextFontFamily);
                    this._applyAutoTextboxWidthIfEnabled(this._selectedObject);
                }
                break;
            }
            case 'fontSize':
            case 'fontStyle':
            case 'underline':
            case 'linethrough':
            case 'textAlign':
            case 'lineHeight':
            case 'charSpacing':
                if (hasTextTargets) {
                    textTargets.forEach(target => {
                        target.set(property, value);
                        this._applyAutoTextboxWidthIfEnabled(target);
                        target.initDimensions?.();
                        target.setCoords?.();
                    });
                } else {
                    this._selectedObject.set(property, value);
                    this._applyAutoTextboxWidthIfEnabled(this._selectedObject);
                }
                if (property === 'fontSize') {
                    shouldApplyPriceFormatting = true;
                }
                break;

            case 'fontWeight':
                if (hasTextTargets) {
                    const nextWeight = this._normalizeFontWeight(value);
                    textTargets.forEach(target => {
                        target.set('fontWeight', nextWeight);
                        this._applyAutoTextboxWidthIfEnabled(target);
                        target.initDimensions?.();
                        target.setCoords?.();
                    });
                } else {
                    this._selectedObject.set('fontWeight', this._normalizeFontWeight(value));
                    this._applyAutoTextboxWidthIfEnabled(this._selectedObject);
                }
                break;

            case 'priceFractionDigits': {
                const digits = parseInt(value, 10);
                const safeDigits = [-1, 1, 2].includes(digits) ? digits : -1;
                applyCustomTextProperty(CUSTOM_PROPS.PRICE_FRACTION_DIGITS, safeDigits);
                shouldApplyPriceFormatting = true;
                break;
            }

            case 'priceFractionScalePercent': {
                const safePercent = Math.max(30, Math.min(100, Number(value) || 100));
                const scale = safePercent / 100;
                applyCustomTextProperty(CUSTOM_PROPS.PRICE_FRACTION_SCALE, scale);
                shouldApplyPriceFormatting = true;
                break;
            }

            case 'priceMidlineEnabled':
                applyCustomTextProperty(CUSTOM_PROPS.PRICE_MIDLINE_ENABLED, !!value);
                shouldApplyPriceFormatting = true;
                break;

            case 'priceMidlineThickness': {
                const safeThickness = Math.max(1, Math.min(8, Number(value) || 1));
                applyCustomTextProperty(CUSTOM_PROPS.PRICE_MIDLINE_THICKNESS, safeThickness);
                shouldApplyPriceFormatting = true;
                break;
            }

            default:
                this._selectedObject.set(property, value);
        }

        if (shouldApplyPriceFormatting) {
            const priceTargets = hasTextTargets
                ? textTargets
                : (isTextObject ? [this._selectedObject] : []);
            this._applyPriceFormattingToTargets(priceTargets);
        }

        this.canvas.requestRenderAll();

        if (property === 'fontFamily') {
            const nextFontFamily = String(value || '').trim();
            this._loadFontFamily(nextFontFamily).then(() => {
                const reloadTargets = this._getTextTargets();
                if (reloadTargets.length > 0) {
                    reloadTargets.forEach((target) => {
                        target.initDimensions?.();
                        target.setCoords?.();
                    });
                } else if (this._isDirectTextObject(this._selectedObject)) {
                    this._selectedObject.initDimensions?.();
                    this._selectedObject.setCoords?.();
                }
                this.canvas?.requestRenderAll?.();
            });
        }

        // Range-Number sync: ayný property'li diðer input'u güncelle
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
     * Görsel nesnelerde köþe yuvarlama (clipPath ile)
     * @private
     * @param {number} radius - Köþe yarýçapý
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
        const targets = this._getTextTargets();
        if (targets.length === 0) return;

        const current = this._normalizeFontWeight(targets[0].fontWeight);
        const nextWeight = this._isBoldWeight(current) ? '400' : '700';
        targets.forEach(target => {
            target.set('fontWeight', nextWeight);
            target.initDimensions?.();
            target.setCoords?.();
        });
        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    /**
     * Italic toggle
     * @private
     */
    _toggleItalic() {
        const targets = this._getTextTargets();
        if (targets.length === 0) return;

        const current = targets[0].fontStyle;
        const nextStyle = current === 'italic' ? 'normal' : 'italic';
        targets.forEach(target => {
            target.set('fontStyle', nextStyle);
            target.setCoords?.();
        });
        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    /**
     * Underline toggle
     * @private
     */
    _toggleUnderline() {
        const targets = this._getTextTargets();
        if (targets.length === 0) return;

        const current = !!targets[0].underline;
        targets.forEach(target => {
            target.set('underline', !current);
            target.setCoords?.();
        });
        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    /**
     * Linethrough toggle
     * @private
     */
    _toggleLinethrough() {
        const targets = this._getTextTargets();
        if (targets.length === 0) return;

        const current = !!targets[0].linethrough;
        targets.forEach(target => {
            target.set('linethrough', !current);
            target.setCoords?.();
        });
        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    /**
     * Text alignment ayarla
     * @private
     * @param {string} align - Hizalama deðeri
     */
    _setTextAlign(align) {
        if (!this._selectedObject) return;

        const targets = this._getTextTargets();
        if (targets.length > 0) {
            targets.forEach(target => {
                target.set('textAlign', align);
                target.setCoords?.();
            });
        } else {
            this._selectedObject.set('textAlign', align);
        }
        this.canvas?.requestRenderAll();
        this.refresh();
        this._emitModified();
    }

    /**
     * Görsel deðiþtir
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
     * Özellik deðerlerini güncelle (canvas'tan oku)
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
        return this._getTextTargets().length > 0;
    }

    /**
     * Nesne doÄŸrudan metin mi?
     * @private
     * @param {Object|null} obj
     * @returns {boolean}
     */
    _isDirectTextObject(obj) {
        if (!obj) return false;
        const type = String(obj.type || '').toLowerCase();
        return type === 'text' || type === 'i-text' || type === 'itext' || type === 'textbox' || type === 'fabrictext';
    }

    /**
     * Group/selection iÃ§indeki child nesneleri al
     * @private
     * @param {Object} obj
     * @returns {Array}
     */
    _getObjectChildren(obj) {
        if (!obj) return [];
        if (typeof obj.getObjects === 'function') {
            const children = obj.getObjects();
            if (Array.isArray(children)) return children;
        }
        if (Array.isArray(obj._objects)) return obj._objects;
        if (Array.isArray(obj.objects)) return obj.objects;
        return [];
    }

    /**
     * SeÃ§ili nesnede dÃ¼zenlenebilir metin hedeflerini al
     * @private
     * @returns {Array}
     */
    _getTextTargets() {
        if (!this._selectedObject) return [];

        const targets = [];
        const visited = new Set();
        const stack = [this._selectedObject];

        while (stack.length > 0) {
            const current = stack.pop();
            if (!current || visited.has(current)) continue;
            visited.add(current);

            if (this._isDirectTextObject(current)) {
                targets.push(current);
                continue;
            }

            const children = this._getObjectChildren(current);
            children.forEach(child => stack.push(child));
        }

        return targets;
    }

    /**
     * Birincil metin hedefi
     * @private
     * @returns {Object|null}
     */
    _getPrimaryTextTarget() {
        const targets = this._getTextTargets();
        return targets.length > 0 ? targets[0] : null;
    }

    _isTextboxObject(obj) {
        if (!obj) return false;
        return String(obj.type || '').toLowerCase() === 'textbox';
    }

    _getTextAutoWidthFlag(obj) {
        if (!obj) return false;
        const directValue = obj[CUSTOM_PROPS.TEXT_AUTO_WIDTH];
        const getterValue = typeof obj.get === 'function' ? obj.get(CUSTOM_PROPS.TEXT_AUTO_WIDTH) : undefined;
        const resolved = getterValue !== undefined ? getterValue : directValue;
        return resolved === true;
    }

    _setTextAutoWidthFlag(obj, enabled) {
        if (!obj) return;
        const flag = !!enabled;
        try {
            obj.set(CUSTOM_PROPS.TEXT_AUTO_WIDTH, flag);
        } catch (e) {
            // ignore
        }
        obj[CUSTOM_PROPS.TEXT_AUTO_WIDTH] = flag;
    }

    _markTextWidthManual(obj) {
        if (!this._isTextboxObject(obj)) return;
        this._setTextAutoWidthFlag(obj, false);
    }

    _applyAutoTextboxWidthIfEnabled(obj) {
        if (!this._isTextboxObject(obj)) return;
        if (!this._getTextAutoWidthFlag(obj)) return;

        const nextWidth = this._computeAutoTextboxWidth(obj);
        if (!Number.isFinite(nextWidth) || nextWidth <= 0) return;

        const currentWidth = Number(obj.width) || 0;
        if (Math.abs(currentWidth - nextWidth) < 1) return;

        obj.set({
            width: nextWidth,
            scaleX: 1
        });
    }

    _getTextMeasureContext() {
        if (this._measureCtx) return this._measureCtx;
        if (typeof document === 'undefined' || !document.createElement) return null;

        const probeCanvas = document.createElement('canvas');
        const ctx = probeCanvas.getContext('2d');
        this._measureCtx = ctx || null;
        return this._measureCtx;
    }

    _computeAutoTextboxWidth(obj) {
        const textValue = String(obj?.text ?? '');
        const lines = textValue.split(/\r?\n/);
        const safeLines = lines.length > 0 ? lines : [''];
        const fontSize = Math.max(8, Number(obj?.fontSize) || 16);
        const fontFamily = String(obj?.fontFamily || 'Arial');
        const fontStyle = String(obj?.fontStyle || 'normal');
        const fontWeight = String(this._normalizeFontWeight(obj?.fontWeight || '400'));
        const charSpacing = Number(obj?.charSpacing) || 0;

        const minWidth = Math.max(80, Math.round(fontSize * 2.8));
        const padding = Math.max(16, Math.round(fontSize * 0.6));
        const canvasWidth = Number(this.canvas?.width || this.canvas?.getWidth?.() || 800);
        const maxWidth = Math.max(minWidth + 20, Math.floor(canvasWidth * 0.9));

        const ctx = this._getTextMeasureContext();
        let measured = minWidth;

        if (ctx) {
            ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px \"${fontFamily}\"`;
            safeLines.forEach((line) => {
                const safeLine = line || ' ';
                const baseWidth = ctx.measureText(safeLine).width;
                const spacingWidth = Math.max(0, safeLine.length - 1) * ((charSpacing * fontSize) / 1000);
                measured = Math.max(measured, Math.ceil(baseWidth + spacingWidth));
            });
        } else {
            const longest = safeLines.reduce((max, line) => Math.max(max, String(line || '').length), 1);
            measured = Math.max(minWidth, Math.ceil(longest * fontSize * 0.6));
        }

        return Math.min(maxWidth, Math.max(minWidth, measured + padding));
    }

    _isPriceLikeField(fieldName, customType) {
        const normalizedField = String(fieldName || '').trim().toLowerCase();
        const normalizedType = String(customType || '').trim().toLowerCase();
        if (normalizedType === 'price') return true;

        return [
            'current_price',
            'currentprice',
            'previous_price',
            'previousprice',
            'old_price',
            'oldprice',
            'price_with_currency',
            'price',
            'alis_fiyati',
            'bundle_total_price',
            'bundle_final_price'
        ].includes(normalizedField);
    }

    _readObjectProp(obj, key, defaultValue = undefined) {
        if (!obj || typeof obj !== 'object') return defaultValue;
        if (obj[key] !== undefined) return obj[key];
        if (typeof obj.get === 'function') {
            const fromGetter = obj.get(key);
            if (fromGetter !== undefined) return fromGetter;
        }
        return defaultValue;
    }

    _findPriceFractionRange(text) {
        const raw = String(text ?? '');
        const match = raw.match(/([,.])(\d+)(?=\D*$)/);
        if (!match || typeof match.index !== 'number') return null;

        const digits = String(match[2] || '');
        const start = match.index + String(match[1] || '').length;
        const end = start + digits.length;
        if (!digits || end <= start) return null;

        return { start, end, digits };
    }

    _applyPriceDisplayFormatting(target) {
        if (!target || !this._isDirectTextObject(target)) return;

        const dynamicField = String(this._readObjectProp(target, CUSTOM_PROPS.DYNAMIC_FIELD, '')).trim().toLowerCase();
        const customType = String(this._readObjectProp(target, CUSTOM_PROPS.CUSTOM_TYPE, '')).trim().toLowerCase();
        if (!this._isPriceLikeField(dynamicField, customType)) return;

        let text = String(this._readObjectProp(target, 'text', '') ?? '');
        if (!text || /\{\{\s*[^}]+\s*\}\}/.test(text)) {
            text = '24,89 ?';
        }

        const digitsRaw = Number(this._readObjectProp(target, CUSTOM_PROPS.PRICE_FRACTION_DIGITS, -1));
        const digits = [1, 2].includes(digitsRaw) ? digitsRaw : -1;

        let fractionRange = this._findPriceFractionRange(text);
        let shrinkEnd = fractionRange ? fractionRange.end : 0;
        if (digits > 0 && fractionRange) {
            const nextDigits = fractionRange.digits.padEnd(digits, '0').slice(0, digits);
            text = `${text.slice(0, fractionRange.start)}${nextDigits}${text.slice(fractionRange.end)}`;
            fractionRange = {
                start: fractionRange.start,
                end: fractionRange.start + nextDigits.length,
                digits: nextDigits
            };
            shrinkEnd = fractionRange.end;
        }
        const trailing = text.slice(shrinkEnd);
        if (trailing && trailing.trim()) {
            shrinkEnd = text.length;
        }

        const scaleRaw = Number(this._readObjectProp(target, CUSTOM_PROPS.PRICE_FRACTION_SCALE, 1));
        const fractionScale = Number.isFinite(scaleRaw) ? Math.max(0.3, Math.min(1, scaleRaw)) : 1;
        const baseFontSize = Number(this._readObjectProp(target, 'fontSize', 24)) || 24;

        let styles = {};
        if (fractionRange && fractionScale < 0.999) {
            const scaledFontSize = Math.max(1, Number((baseFontSize * fractionScale).toFixed(2)));
            const deltaY = -Math.max(0, Number(((baseFontSize - scaledFontSize) * 0.7).toFixed(2)));
            const lineStyles = {};
            for (let charIndex = fractionRange.start; charIndex < shrinkEnd; charIndex++) {
                lineStyles[charIndex] = {
                    fontSize: scaledFontSize,
                    deltaY
                };
            }
            styles = { 0: lineStyles };
        }

        const midlineEnabled = !!this._readObjectProp(target, CUSTOM_PROPS.PRICE_MIDLINE_ENABLED, false);
        const midlineThicknessRaw = Number(this._readObjectProp(target, CUSTOM_PROPS.PRICE_MIDLINE_THICKNESS, 1));
        const midlineThickness = Math.max(1, Math.min(8, Number.isFinite(midlineThicknessRaw) ? midlineThicknessRaw : 1));
        const currentOffsets = this._readObjectProp(target, 'offsets', {});
        const safeOffsets = (currentOffsets && typeof currentOffsets === 'object') ? currentOffsets : {};
        const priceMidlineOffsets = {
            ...safeOffsets,
            linethrough: -0.40
        };

        target.set('text', text);
        target.text = text;
        target.set('styles', styles);
        target.styles = styles;
        target.set('linethrough', midlineEnabled);
        target.linethrough = midlineEnabled;
        target.set('offsets', priceMidlineOffsets);
        target.offsets = priceMidlineOffsets;
        // Fabric.js v7 formula: textDecorationThickness * scaleY / 10
        // So multiply by 10 to get actual pixel values (1-8 › 10-80)
        const fabricThickness = midlineThickness * 6;
        target.set('textDecorationThickness', fabricThickness);
        target.textDecorationThickness = fabricThickness;
        target.initDimensions?.();
        target.setCoords?.();
    }

    _applyPriceFormattingToTargets(targets = []) {
        if (!Array.isArray(targets) || targets.length === 0) return;
        targets.forEach((target) => this._applyPriceDisplayFormatting(target));
    }

    _applyCustomTextProperty(propName, propValue, textTargets, hasTextTargets) {
        if (hasTextTargets) {
            textTargets.forEach(target => {
                target.set(propName, propValue);
                target[propName] = propValue;
                target.setCoords?.();
            });
            return;
        }

        this._selectedObject.set(propName, propValue);
        this._selectedObject[propName] = propValue;
        this._selectedObject.setCoords?.();
    }

    _getFontOptions(currentFontFamily = '') {
        const options = this._fontCatalog.map(item => item.family);
        const normalizedCurrent = this._normalizeFontFamilyName(currentFontFamily);
        const hasCurrent = options.some(f => this._isSameFontFamily(f, normalizedCurrent));
        if (normalizedCurrent && !hasCurrent) {
            options.unshift(normalizedCurrent);
        }
        return options;
    }

    _normalizeFontFamilyName(fontFamily) {
        return String(fontFamily || '')
            .trim()
            .replace(/^['"]+|['"]+$/g, '');
    }

    _isSameFontFamily(left, right) {
        return this._normalizeFontFamilyName(left).toLowerCase() === this._normalizeFontFamilyName(right).toLowerCase();
    }

    _ensureEditorFontStylesheet() {
        if (typeof document === 'undefined') return Promise.resolve();
        if (this._fontStylesheetReadyPromise) return this._fontStylesheetReadyPromise;

        const googleFonts = this._fontCatalog.filter(f => f.source === 'google').map(f => f.family);
        if (googleFonts.length === 0) {
            this._fontStylesheetInjected = true;
            this._fontStylesheetReadyPromise = Promise.resolve();
            return this._fontStylesheetReadyPromise;
        }

        const baseHref = 'https://fonts.googleapis.com/css2';
        const families = googleFonts
            .map(name => `family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@300;400;500;600;700`)
            .join('&');
        const href = `${baseHref}?${families}&display=swap`;

        const selector = 'link[data-editor-fonts="property-panel"]';
        let link = document.querySelector(selector);
        if (!link) {
            const newLink = document.createElement('link');
            newLink.rel = 'stylesheet';
            newLink.href = href;
            newLink.setAttribute('data-editor-fonts', 'property-panel');
            document.head?.appendChild(newLink);
            link = newLink;
        }

        this._fontStylesheetInjected = true;
        this._fontStylesheetReadyPromise = new Promise((resolve) => {
            if (!link) {
                resolve();
                return;
            }

            const done = () => {
                link.setAttribute('data-loaded', '1');
                resolve();
            };

            if (link.getAttribute('data-loaded') === '1' || link.sheet) {
                done();
                return;
            }

            link.addEventListener('load', done, { once: true });
            link.addEventListener('error', done, { once: true });
        });

        return this._fontStylesheetReadyPromise;
    }

    _loadFontFamily(fontFamily) {
        const family = this._normalizeFontFamilyName(fontFamily);
        if (!family) return Promise.resolve();
        if (!document?.fonts?.load) return Promise.resolve();

        if (this._fontLoadPromises.has(family)) {
            return this._fontLoadPromises.get(family);
        }

        const waitForStyles = this._isGoogleFontFamily(family)
            ? (this._fontStylesheetReadyPromise || this._ensureEditorFontStylesheet())
            : Promise.resolve();

        const loadPromise = waitForStyles
            .then(() => document.fonts.load(`16px "${family}"`))
            .then(() => {})
            .catch(() => {})
            .finally(() => {
                this._fontLoadPromises.delete(family);
            });

        this._fontLoadPromises.set(family, loadPromise);
        return loadPromise;
    }

    _preloadEditorFonts() {
        if (!document?.fonts?.load) return;

        const preloadFamilies = this._fontCatalog
            .filter(item => item.source === 'google')
            .map(item => item.family);
        const preloadWeights = ['300', '400', '500', '600', '700'];

        (this._fontStylesheetReadyPromise || this._ensureEditorFontStylesheet())
            .then(() => {
                preloadFamilies.forEach((family) => {
                    this._loadFontFamily(family);
                    preloadWeights.forEach((weight) => {
                        document.fonts.load(`${weight} 16px "${family}"`).catch(() => {});
                    });
                });
            });
    }

    _isGoogleFontFamily(fontFamily) {
        const family = this._normalizeFontFamilyName(fontFamily);
        return this._fontCatalog.some(
            item => item.source === 'google' && this._isSameFontFamily(item.family, family)
        );
    }

    /**
     * Nesne þekil mi?
     * @private
     * @returns {boolean}
     */
    _isShapeObject() {
        if (!this._selectedObject) return false;
        const obj = this._selectedObject;
        const type = obj.type;
        const customType = obj.customType || obj.get?.('customType');
        if (customType === 'shape') return true;
        return type === 'rect' || type === 'circle' || type === 'ellipse' ||
               type === 'triangle' || type === 'polygon' || type === 'line' ||
               type === 'path' || type === 'group' ||
               type === 'Rect' || type === 'Circle' || type === 'Ellipse' ||
               type === 'Triangle' || type === 'Polygon' || type === 'Line' ||
               type === 'Path' || type === 'Group';
    }

    /**
     * Canvas referansýný ayarla
     * @param {Object} canvas - Fabric.js Canvas
     */
    setCanvas(canvas) {
        // Eski event'leri kaldýr
        if (this.canvas) {
            this.canvas.off('selection:created', this._canvasHandlers.selectionCreated);
            this.canvas.off('selection:updated', this._canvasHandlers.selectionUpdated);
            this.canvas.off('selection:cleared', this._canvasHandlers.selectionCleared);
            this.canvas.off('object:modified', this._canvasHandlers.objectModified);
        }

        this.canvas = canvas;
        this._selectedObject = null;

        // Yeni event'leri baðla
        this._bindCanvasEvents();
        this.refresh();
    }

    /**
     * Panel'i dispose et
     */
    dispose() {
        this._hideFramePreviewPopup();

        // Update timer temizle
        if (this._updateTimer) {
            clearTimeout(this._updateTimer);
        }

        // Canvas event'lerini kaldýr
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
