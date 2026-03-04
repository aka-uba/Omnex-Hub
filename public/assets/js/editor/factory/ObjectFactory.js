/**
 * ObjectFactory - Fabric.js Nesne Oluşturma Fabrikası
 *
 * Tüm Fabric.js nesnelerini merkezi bir noktadan oluşturur.
 * v7 origin normalizasyonu otomatik uygulanır.
 *
 * KULLANIM:
 * ```javascript
 * import { ObjectFactory } from './editor/factory/ObjectFactory.js';
 *
 * const factory = new ObjectFactory(canvas);
 *
 * // Metin oluştur
 * const text = await factory.createText('Hello', { left: 100, top: 100 });
 *
 * // Dinamik alan oluştur
 * const dynamicText = await factory.createDynamicText('product_name', {
 *     left: 100, top: 100, placeholder: '{Ürün Adı}'
 * });
 *
 * // Barkod oluştur
 * const barcode = await factory.createBarcode('8690000000001', { left: 100, top: 200 });
 * ```
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

import { eventBus, EVENTS } from '../core/EventBus.js';
import { CUSTOM_PROPS, CUSTOM_TYPES, DYNAMIC_FIELDS, BARCODE_FORMATS, SERIALIZABLE_PROPS } from '../core/CustomProperties.js';
import {
    FabricText,
    Textbox,
    Rect,
    Circle,
    Ellipse,
    Triangle,
    Line,
    Path,
    Group,
    FabricImage,
    Polygon,
    Polyline,
    V7_ORIGIN,
    util
} from '../core/FabricExports.js';

/**
 * Benzersiz ID üreteci
 * @returns {string} UUID formatında benzersiz ID
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Varsayılan nesne özellikleri
 */
const DEFAULT_OBJECT_OPTIONS = {
    // v7 origin (merkez)
    originX: V7_ORIGIN.originX,
    originY: V7_ORIGIN.originY,

    // Varsayılan pozisyon - canvas merkezinde oluşsun
    left: 200,
    top: 200,

    // Seçim ve interaksiyon
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    lockMovementX: false,
    lockMovementY: false,
    lockRotation: false,
    lockScalingX: false,
    lockScalingY: false,

    // Görsel
    opacity: 1,
    visible: true,

    // Padding
    padding: 0
};

/**
 * Varsayılan metin özellikleri
 */
const DEFAULT_TEXT_OPTIONS = {
    ...DEFAULT_OBJECT_OPTIONS,
    fontFamily: 'Arial',
    fontSize: 24,
    fontWeight: 'normal',
    fontStyle: 'normal',
    fill: '#000000',
    textAlign: 'left',
    lineHeight: 1.16,
    charSpacing: 0,
    underline: false,
    overline: false,
    linethrough: false
};

/**
 * Varsayılan şekil özellikleri
 */
const DEFAULT_SHAPE_OPTIONS = {
    ...DEFAULT_OBJECT_OPTIONS,
    fill: '#e0e0e0',
    stroke: '#333333',
    strokeWidth: 1,
    strokeUniform: true
};

/**
 * ObjectFactory Sınıfı
 */
export class ObjectFactory {
    /**
     * @param {Object|fabric.Canvas} canvasOrOptions - Fabric.js Canvas instance veya options objesi
     * @param {fabric.Canvas} [canvasOrOptions.canvas] - Options kullanılıyorsa canvas
     * @param {Object} [canvasOrOptions.defaultStyles] - Varsayılan stiller
     */
    constructor(canvasOrOptions) {
        // Options object mi yoksa doğrudan canvas mi kontrol et
        if (canvasOrOptions && typeof canvasOrOptions === 'object') {
            // canvas.add metodu varsa doğrudan canvas'tır
            if (typeof canvasOrOptions.add === 'function') {
                this.canvas = canvasOrOptions;
                this.defaultStyles = {};
            } else {
                // Options object
                this.canvas = canvasOrOptions.canvas;
                this.defaultStyles = canvasOrOptions.defaultStyles || {};
            }
        } else {
            this.canvas = null;
            this.defaultStyles = {};
        }

        /**
         * Nesne sayaçları (otomatik isimlendirme için)
         * @type {Object<string, number>}
         */
        this.counters = {};
    }

    /**
     * Sonraki nesne numarasını al
     * @param {string} type - Nesne tipi
     * @returns {number}
     */
    _getNextCounter(type) {
        if (!this.counters[type]) {
            this.counters[type] = 0;
        }
        return ++this.counters[type];
    }

    /**
     * Otomatik nesne adı oluştur
     * @param {string} type - Nesne tipi
     * @returns {string}
     */
    _generateObjectName(type) {
        const counter = this._getNextCounter(type);
        const typeNames = {
            text: 'Metin',
            textbox: 'Metin Kutusu',
            rect: 'Dikdörtgen',
            circle: 'Daire',
            ellipse: 'Elips',
            triangle: 'Üçgen',
            line: 'Çizgi',
            polygon: 'Çokgen',
            path: 'Yol',
            image: 'Görsel',
            barcode: 'Barkod',
            qrcode: 'QR Kod',
            'dynamic-text': 'Dinamik Alan',
            'dynamic-image': 'Dinamik Görsel',
            'video-placeholder': 'Video',
            group: 'Grup'
        };
        const name = typeNames[type] || type;
        return `${name} ${counter}`;
    }

    /**
     * Temel nesne özelliklerini uygula
     * @param {Object} obj - Fabric.js nesnesi
     * @param {string} customType - Custom type değeri
     * @param {Object} [extraProps={}] - Ek özellikler
     */
    _applyBaseProperties(obj, customType, extraProps = {}) {
        // Benzersiz ID
        obj.set(CUSTOM_PROPS.OBJECT_ID, generateUUID());

        // Custom type
        obj.set(CUSTOM_PROPS.CUSTOM_TYPE, customType);

        // Otomatik isim
        if (!extraProps[CUSTOM_PROPS.OBJECT_NAME]) {
            obj.set(CUSTOM_PROPS.OBJECT_NAME, this._generateObjectName(customType));
        }

        // Ek özellikler
        Object.entries(extraProps).forEach(([key, value]) => {
            obj.set(key, value);
        });
    }

    /**
     * Options objesinden custom prop'ları ayır
     * Fabric.js v7'de constructor'a geçirilen custom prop'lar objeye set edilmiyor,
     * bu yüzden bunları ayrı çıkarıp _applyBaseProperties ile elle set etmemiz gerekiyor.
     *
     * @param {Object} options - Tüm seçenekler (fabric + custom karışık)
     * @param {Object} defaults - Varsayılan fabric özellikleri
     * @returns {{ fabricProps: Object, customProps: Object }}
     */
    _extractCustomProps(options, defaults = {}) {
        const customProps = {};
        const fabricProps = { ...defaults };

        // Bilinen custom property key'leri (SERIALIZABLE_PROPS + alias'lar)
        const customKeySet = new Set(SERIALIZABLE_PROPS);
        // isDynamicField alias'ı (EditorWrapper bu ismi kullanıyor)
        customKeySet.add('isDynamicField');

        for (const [key, value] of Object.entries(options)) {
            if (customKeySet.has(key)) {
                customProps[key] = value;
            } else {
                fabricProps[key] = value;
            }
        }

        return { fabricProps, customProps };
    }

    // ==========================================
    // METİN OLUŞTURMA
    // ==========================================

    /**
     * Basit metin oluştur
     * @param {string} text - Metin içeriği
     * @param {Object} [options={}] - Fabric.js metin özellikleri
     * @returns {Promise<Object>} Fabric.js Text nesnesi
     */
    async createText(text, options = {}) {
        const { fabricProps, customProps } = this._extractCustomProps(options, DEFAULT_TEXT_OPTIONS);
        const textObj = new FabricText(text, fabricProps);

        // Custom prop'lara göre customType belirle
        const customType = customProps[CUSTOM_PROPS.IS_DATA_FIELD] || customProps.isDynamicField
            ? CUSTOM_TYPES.DYNAMIC_TEXT
            : CUSTOM_TYPES.TEXT;

        // isDynamicField alias'ını standart prop'a çevir
        if (customProps.isDynamicField && !customProps[CUSTOM_PROPS.IS_DATA_FIELD]) {
            customProps[CUSTOM_PROPS.IS_DATA_FIELD] = true;
        }
        delete customProps.isDynamicField;

        this._applyBaseProperties(textObj, customType, customProps);

        if (this.canvas) {
            this.canvas.add(textObj);
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: textObj });
        }

        return textObj;
    }

    /**
     * Çok satırlı metin kutusu oluştur
     * @param {string} text - Metin içeriği
     * @param {Object} [options={}] - Fabric.js textbox özellikleri
     * @returns {Promise<Object>} Fabric.js Textbox nesnesi
     */
    async createTextbox(text, options = {}) {
        const defaultTextboxOptions = {
            ...DEFAULT_TEXT_OPTIONS,
            width: 200,
            splitByGrapheme: true
        };
        const { fabricProps, customProps } = this._extractCustomProps(options, defaultTextboxOptions);
        const textbox = new Textbox(text, fabricProps);

        const customType = customProps[CUSTOM_PROPS.IS_DATA_FIELD] || customProps.isDynamicField
            ? CUSTOM_TYPES.DYNAMIC_TEXT
            : CUSTOM_TYPES.TEXT;

        if (customProps.isDynamicField && !customProps[CUSTOM_PROPS.IS_DATA_FIELD]) {
            customProps[CUSTOM_PROPS.IS_DATA_FIELD] = true;
        }
        delete customProps.isDynamicField;

        this._applyBaseProperties(textbox, customType, customProps);

        if (this.canvas) {
            this.canvas.add(textbox);
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: textbox });
        }

        return textbox;
    }

    /**
     * Dinamik alan metni oluştur
     * @param {string} fieldKey - Dinamik alan anahtarı (DYNAMIC_FIELDS'den)
     * @param {Object} [options={}] - Metin özellikleri
     * @returns {Promise<Object>} Fabric.js Textbox nesnesi
     */
    async createDynamicText(fieldKey, options = {}) {
        // Placeholder metni
        const placeholder = options.placeholder || `{${fieldKey}}`;

        const dynamicOptions = {
            ...DEFAULT_TEXT_OPTIONS,
            width: 200,
            fill: '#1565C0',
            ...options
        };

        const textbox = new Textbox(placeholder, dynamicOptions);

        this._applyBaseProperties(textbox, CUSTOM_TYPES.DYNAMIC_TEXT, {
            [CUSTOM_PROPS.IS_DATA_FIELD]: true,
            [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey,
            [CUSTOM_PROPS.PLACEHOLDER]: placeholder
        });

        if (this.canvas) {
            this.canvas.add(textbox);
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: textbox });
            eventBus.emit(EVENTS.FIELD_ADDED, { object: textbox, fieldKey });
        }

        return textbox;
    }

    // ==========================================
    // ŞEKİL OLUŞTURMA
    // ==========================================

    /**
     * Dikdörtgen oluştur
     * @param {Object} [options={}] - Dikdörtgen özellikleri
     * @returns {Promise<Object>} Fabric.js Rect nesnesi
     */
    async createRect(options = {}) {
        const defaultRectOptions = {
            ...DEFAULT_SHAPE_OPTIONS,
            width: 100,
            height: 100,
            rx: 0,
            ry: 0
        };
        const { fabricProps, customProps } = this._extractCustomProps(options, defaultRectOptions);
        const rect = new Rect(fabricProps);

        const customType = customProps[CUSTOM_PROPS.CUSTOM_TYPE] || CUSTOM_TYPES.RECT;

        if (customProps.isDynamicField && !customProps[CUSTOM_PROPS.IS_DATA_FIELD]) {
            customProps[CUSTOM_PROPS.IS_DATA_FIELD] = true;
        }
        delete customProps.isDynamicField;

        this._applyBaseProperties(rect, customType, customProps);

        if (this.canvas) {
            this.canvas.add(rect);
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: rect });
        }

        return rect;
    }

    /**
     * Daire oluştur
     * @param {Object} [options={}] - Daire özellikleri
     * @returns {Promise<Object>} Fabric.js Circle nesnesi
     */
    async createCircle(options = {}) {
        const defaultCircleOptions = {
            ...DEFAULT_SHAPE_OPTIONS,
            radius: 50
        };
        const { fabricProps, customProps } = this._extractCustomProps(options, defaultCircleOptions);
        const circle = new Circle(fabricProps);

        if (customProps.isDynamicField && !customProps[CUSTOM_PROPS.IS_DATA_FIELD]) {
            customProps[CUSTOM_PROPS.IS_DATA_FIELD] = true;
        }
        delete customProps.isDynamicField;

        this._applyBaseProperties(circle, CUSTOM_TYPES.CIRCLE, customProps);

        if (this.canvas) {
            this.canvas.add(circle);
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: circle });
        }

        return circle;
    }

    /**
     * Elips oluştur
     * @param {Object} [options={}] - Elips özellikleri
     * @returns {Promise<Object>} Fabric.js Ellipse nesnesi
     */
    async createEllipse(options = {}) {
        const defaultEllipseOptions = {
            ...DEFAULT_SHAPE_OPTIONS,
            rx: 75,
            ry: 50
        };
        const { fabricProps, customProps } = this._extractCustomProps(options, defaultEllipseOptions);
        const ellipse = new Ellipse(fabricProps);

        delete customProps.isDynamicField;
        this._applyBaseProperties(ellipse, 'ellipse', customProps);

        if (this.canvas) {
            this.canvas.add(ellipse);
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: ellipse });
        }

        return ellipse;
    }

    /**
     * Üçgen oluştur
     * @param {Object} [options={}] - Üçgen özellikleri
     * @returns {Promise<Object>} Fabric.js Triangle nesnesi
     */
    async createTriangle(options = {}) {
        const defaultTriangleOptions = {
            ...DEFAULT_SHAPE_OPTIONS,
            width: 100,
            height: 100
        };
        const { fabricProps, customProps } = this._extractCustomProps(options, defaultTriangleOptions);
        const triangle = new Triangle(fabricProps);

        delete customProps.isDynamicField;
        this._applyBaseProperties(triangle, 'triangle', customProps);

        if (this.canvas) {
            this.canvas.add(triangle);
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: triangle });
        }

        return triangle;
    }

    /**
     * Çizgi oluştur
     * @param {number[]} [points=[0,0,100,100]] - [x1, y1, x2, y2]
     * @param {Object} [options={}] - Çizgi özellikleri
     * @returns {Promise<Object>} Fabric.js Line nesnesi
     */
    async createLine(points = [0, 0, 100, 100], options = {}) {
        const defaultLineOptions = {
            ...DEFAULT_SHAPE_OPTIONS,
            fill: null,
            stroke: '#333333',
            strokeWidth: 2
        };
        const { fabricProps, customProps } = this._extractCustomProps(options, defaultLineOptions);
        const line = new Line(points, fabricProps);

        delete customProps.isDynamicField;
        this._applyBaseProperties(line, CUSTOM_TYPES.LINE, customProps);

        if (this.canvas) {
            this.canvas.add(line);
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: line });
        }

        return line;
    }

    /**
     * Çokgen oluştur
     * @param {Array<{x: number, y: number}>} points - Köşe noktaları
     * @param {Object} [options={}] - Çokgen özellikleri
     * @returns {Promise<Object>} Fabric.js Polygon nesnesi
     */
    async createPolygon(points, options = {}) {
        const { fabricProps, customProps } = this._extractCustomProps(options, DEFAULT_SHAPE_OPTIONS);
        const polygon = new Polygon(points, fabricProps);

        delete customProps.isDynamicField;
        this._applyBaseProperties(polygon, 'polygon', customProps);

        if (this.canvas) {
            this.canvas.add(polygon);
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: polygon });
        }

        return polygon;
    }

    // ==========================================
    // GÖRSEL OLUŞTURMA
    // ==========================================

    /**
     * URL'den görsel oluştur
     * @param {string} url - Görsel URL'si
     * @param {Object} [options={}] - Görsel özellikleri
     * @returns {Promise<Object>} Fabric.js Image nesnesi
     */
    async createImage(url, options = {}) {
        const { fabricProps, customProps } = this._extractCustomProps(options, DEFAULT_OBJECT_OPTIONS);

        return new Promise((resolve, reject) => {
            FabricImage.fromURL(url, {
                crossOrigin: 'anonymous'
            }).then((img) => {
                img.set(fabricProps);

                const customType = customProps[CUSTOM_PROPS.CUSTOM_TYPE] || CUSTOM_TYPES.IMAGE;

                if (customProps.isDynamicField && !customProps[CUSTOM_PROPS.IS_DATA_FIELD]) {
                    customProps[CUSTOM_PROPS.IS_DATA_FIELD] = true;
                }
                delete customProps.isDynamicField;

                // Original src'yi ekle
                if (!customProps[CUSTOM_PROPS.ORIGINAL_SRC]) {
                    customProps[CUSTOM_PROPS.ORIGINAL_SRC] = url;
                }

                this._applyBaseProperties(img, customType, customProps);

                if (this.canvas) {
                    this.canvas.add(img);
                    this.canvas.requestRenderAll();
                    eventBus.emit(EVENTS.OBJECT_ADDED, { object: img });
                }

                resolve(img);
            }).catch((err) => {
                console.error('ObjectFactory: Görsel yüklenemedi:', url, err);
                reject(err);
            });
        });
    }

    /**
     * Base64'den görsel oluştur
     * @param {string} base64Data - Base64 encoded görsel
     * @param {Object} [options={}] - Görsel özellikleri
     * @returns {Promise<Object>} Fabric.js Image nesnesi
     */
    async createImageFromBase64(base64Data, options = {}) {
        return this.createImage(base64Data, options);
    }

    /**
     * Dinamik görsel alanı oluştur (placeholder)
     * @param {string} fieldKey - Dinamik alan anahtarı
     * @param {Object} [options={}] - Görsel özellikleri
     * @returns {Promise<Object>} Fabric.js Rect placeholder
     */
    async createDynamicImage(fieldKey, options = {}) {
        // Placeholder dikdörtgen oluştur
        const placeholderOptions = {
            ...DEFAULT_SHAPE_OPTIONS,
            width: options.width || 150,
            height: options.height || 150,
            fill: '#f0f0f0',
            stroke: '#1565C0',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            ...options
        };

        const placeholder = new Rect(placeholderOptions);

        this._applyBaseProperties(placeholder, CUSTOM_TYPES.DYNAMIC_IMAGE, {
            [CUSTOM_PROPS.IS_DATA_FIELD]: true,
            [CUSTOM_PROPS.DYNAMIC_FIELD]: fieldKey,
            [CUSTOM_PROPS.PLACEHOLDER]: `{${fieldKey}}`,
            [CUSTOM_PROPS.IMAGE_INDEX]: options.imageIndex ?? 0
        });

        if (this.canvas) {
            this.canvas.add(placeholder);
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: placeholder });
            eventBus.emit(EVENTS.FIELD_ADDED, { object: placeholder, fieldKey });
        }

        return placeholder;
    }

    // ==========================================
    // BARKOD VE QR KOD
    // ==========================================

    /**
     * Barkod oluştur (JsBarcode ile)
     * @param {string} value - Barkod değeri
     * @param {Object} [options={}] - Barkod özellikleri
     * @returns {Promise<Object>} Fabric.js Image nesnesi (SVG render)
     */
    async createBarcode(value, options = {}) {
        // Custom prop'ları ayır (isDataField, dynamicField vb.)
        const { customProps } = this._extractCustomProps(options, {});

        const barcodeOptions = {
            format: options.format || BARCODE_FORMATS.EAN13,
            width: options.lineWidth || 2,
            height: options.barcodeHeight || 80,
            displayValue: options.displayValue !== false,
            fontSize: options.fontSize || 14,
            background: options.background || '#ffffff',
            lineColor: options.lineColor || '#000000',
            margin: options.margin || 10
        };

        return new Promise((resolve, reject) => {
            // JsBarcode global olarak yüklü olmalı
            if (typeof JsBarcode === 'undefined') {
                console.error('ObjectFactory: JsBarcode yüklenmemiş');
                reject(new Error('JsBarcode not loaded'));
                return;
            }

            try {
                // SVG element oluştur
                const svgNS = 'http://www.w3.org/2000/svg';
                const svg = document.createElementNS(svgNS, 'svg');

                JsBarcode(svg, value, {
                    format: barcodeOptions.format,
                    width: barcodeOptions.width,
                    height: barcodeOptions.height,
                    displayValue: barcodeOptions.displayValue,
                    fontSize: barcodeOptions.fontSize,
                    background: barcodeOptions.background,
                    lineColor: barcodeOptions.lineColor,
                    margin: barcodeOptions.margin
                });

                // SVG'yi data URL'e dönüştür
                const svgData = new XMLSerializer().serializeToString(svg);
                const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));

                // Fabric Image oluştur
                FabricImage.fromURL(dataUrl).then((img) => {
                    const imageOptions = { ...DEFAULT_OBJECT_OPTIONS };
                    if (options.left !== undefined) imageOptions.left = options.left;
                    if (options.top !== undefined) imageOptions.top = options.top;
                    if (options.scaleX !== undefined) imageOptions.scaleX = options.scaleX;
                    if (options.scaleY !== undefined) imageOptions.scaleY = options.scaleY;

                    img.set(imageOptions);

                    // isDynamicField alias'ını dönüştür
                    if (customProps.isDynamicField && !customProps[CUSTOM_PROPS.IS_DATA_FIELD]) {
                        customProps[CUSTOM_PROPS.IS_DATA_FIELD] = true;
                    }
                    delete customProps.isDynamicField;

                    // Barkod-specific + dışarıdan gelen custom prop'ları birleştir
                    const allCustomProps = {
                        [CUSTOM_PROPS.BARCODE_VALUE]: value,
                        [CUSTOM_PROPS.BARCODE_FORMAT]: options.barcodeAutoDetect ? 'AUTO' : barcodeOptions.format,
                        [CUSTOM_PROPS.BARCODE_DISPLAY_VALUE]: barcodeOptions.displayValue,
                        [CUSTOM_PROPS.BARCODE_LINE_WIDTH]: barcodeOptions.width,
                        [CUSTOM_PROPS.BARCODE_HEIGHT]: barcodeOptions.height,
                        [CUSTOM_PROPS.BARCODE_BACKGROUND]: barcodeOptions.background,
                        [CUSTOM_PROPS.BARCODE_LINE_COLOR]: barcodeOptions.lineColor,
                        [CUSTOM_PROPS.BARCODE_AUTO_DETECT]: !!options.barcodeAutoDetect,
                        ...customProps
                    };

                    this._applyBaseProperties(img, CUSTOM_TYPES.BARCODE, allCustomProps);

                    if (this.canvas) {
                        this.canvas.add(img);
                        this.canvas.requestRenderAll();
                        eventBus.emit(EVENTS.OBJECT_ADDED, { object: img });
                    }

                    resolve(img);
                }).catch(reject);
            } catch (err) {
                console.error('ObjectFactory: Barkod oluşturulamadı:', err);
                reject(err);
            }
        });
    }

    /**
     * QR Kod oluştur (qrcodejs ile)
     * @param {string} value - QR kod değeri
     * @param {Object} [options={}] - QR kod özellikleri
     * @returns {Promise<Object>} Fabric.js Image nesnesi
     */
    async createQRCode(value, options = {}) {
        // Custom prop'ları ayır (isDataField, dynamicField vb.)
        const { customProps } = this._extractCustomProps(options, {});

        const qrOptions = {
            width: options.width || 128,
            height: options.height || 128,
            colorDark: options.foreground || '#000000',
            colorLight: options.background || '#ffffff',
            correctLevel: options.errorLevel || 'M'
        };

        return new Promise((resolve, reject) => {
            // QRCode global olarak yüklü olmalı (qrcodejs)
            if (typeof QRCode === 'undefined') {
                console.error('ObjectFactory: QRCode (qrcodejs) yüklenmemiş');
                reject(new Error('QRCode not loaded'));
                return;
            }

            try {
                // Geçici div oluştur
                const tempDiv = document.createElement('div');
                tempDiv.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
                document.body.appendChild(tempDiv);

                // QR kod oluştur
                const qr = new QRCode(tempDiv, {
                    text: value,
                    width: qrOptions.width,
                    height: qrOptions.height,
                    colorDark: qrOptions.colorDark,
                    colorLight: qrOptions.colorLight,
                    correctLevel: QRCode.CorrectLevel[qrOptions.correctLevel] || QRCode.CorrectLevel.M
                });

                // Canvas'tan data URL al
                setTimeout(() => {
                    const canvas = tempDiv.querySelector('canvas');
                    if (!canvas) {
                        document.body.removeChild(tempDiv);
                        reject(new Error('QR canvas not found'));
                        return;
                    }

                    const dataUrl = canvas.toDataURL('image/png');
                    document.body.removeChild(tempDiv);

                    // Fabric Image oluştur
                    FabricImage.fromURL(dataUrl).then((img) => {
                        const imageOptions = { ...DEFAULT_OBJECT_OPTIONS };
                        if (options.left !== undefined) imageOptions.left = options.left;
                        if (options.top !== undefined) imageOptions.top = options.top;

                        img.set(imageOptions);

                        // isDynamicField alias'ını dönüştür
                        if (customProps.isDynamicField && !customProps[CUSTOM_PROPS.IS_DATA_FIELD]) {
                            customProps[CUSTOM_PROPS.IS_DATA_FIELD] = true;
                        }
                        delete customProps.isDynamicField;

                        // QR-specific + dışarıdan gelen custom prop'ları birleştir
                        const allCustomProps = {
                            [CUSTOM_PROPS.QR_VALUE]: value,
                            [CUSTOM_PROPS.QR_ERROR_LEVEL]: qrOptions.correctLevel,
                            [CUSTOM_PROPS.QR_FOREGROUND]: qrOptions.colorDark,
                            [CUSTOM_PROPS.QR_BACKGROUND]: qrOptions.colorLight,
                            ...customProps
                        };

                        this._applyBaseProperties(img, CUSTOM_TYPES.QRCODE, allCustomProps);

                        if (this.canvas) {
                            this.canvas.add(img);
                            this.canvas.requestRenderAll();
                            eventBus.emit(EVENTS.OBJECT_ADDED, { object: img });
                        }

                        resolve(img);
                    }).catch(reject);
                }, 100);
            } catch (err) {
                console.error('ObjectFactory: QR kod oluşturulamadı:', err);
                reject(err);
            }
        });
    }

    // ==========================================
    // GRUP OLUŞTURMA
    // ==========================================

    /**
     * Grup oluştur
     * @param {Object[]} objects - Gruplanacak nesneler
     * @param {Object} [options={}] - Grup özellikleri
     * @returns {Promise<Object>} Fabric.js Group nesnesi
     */
    async createGroup(objects, options = {}) {
        const mergedOptions = { ...DEFAULT_OBJECT_OPTIONS, ...options };
        const group = new Group(objects, mergedOptions);

        this._applyBaseProperties(group, 'group');

        if (this.canvas) {
            // Önceki nesneleri canvas'tan kaldır
            objects.forEach(obj => {
                this.canvas.remove(obj);
            });

            this.canvas.add(group);
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: group });
        }

        return group;
    }

    // ==========================================
    // MULTI-PRODUCT FRAME
    // ==========================================

    /**
     * Çoklu ürün çerçevesi oluştur
     * @param {number} cols - Sütun sayısı
     * @param {number} rows - Satır sayısı
     * @param {Object} [options={}] - Çerçeve özellikleri
     * @returns {Promise<Object>} Fabric.js Group nesnesi
     */
    async createMultiProductFrame(cols, rows, options = {}) {
        const frameWidth = options.width || 400;
        const frameHeight = options.height || 400;
        const slotWidth = frameWidth / cols;
        const slotHeight = frameHeight / rows;

        const slots = [];
        const slotObjects = [];
        let slotId = 1;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * slotWidth;
                const y = row * slotHeight;

                // Slot bilgisi
                slots.push({
                    id: slotId,
                    x: x,
                    y: y,
                    width: slotWidth,
                    height: slotHeight,
                    fields: []
                });

                // Slot arkaplanı (görsel ayırıcı)
                const slotBg = new Rect({
                    left: x - frameWidth / 2 + slotWidth / 2,
                    top: y - frameHeight / 2 + slotHeight / 2,
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
                // NOT: excludeFromExport KULLANILMAMALI! Fabric.js v7 Group.toObject()
                // bu flag'e sahip sub-objects'leri serialize sırasında siliyor.
                // Bunun yerine isSlotBackground flag'i ile export sırasında gizleme yapılıyor.
                slotObjects.push(slotBg);

                slotId++;
            }
        }

        // Ana çerçeve grubu
        const frameGroup = new Group(slotObjects, {
            ...DEFAULT_OBJECT_OPTIONS,
            left: options.left || 200,
            top: options.top || 200,
            ...options
        });

        this._applyBaseProperties(frameGroup, CUSTOM_TYPES.MULTI_PRODUCT_FRAME, {
            [CUSTOM_PROPS.FRAME_COLS]: cols,
            [CUSTOM_PROPS.FRAME_ROWS]: rows,
            [CUSTOM_PROPS.FRAME_WIDTH]: frameWidth,
            [CUSTOM_PROPS.FRAME_HEIGHT]: frameHeight,
            [CUSTOM_PROPS.SLOTS]: slots,
            [CUSTOM_PROPS.ACTIVE_SLOT_ID]: 1
        });

        if (this.canvas) {
            this.canvas.add(frameGroup);
            this.canvas.requestRenderAll();
            eventBus.emit(EVENTS.OBJECT_ADDED, { object: frameGroup });
            eventBus.emit(EVENTS.FRAME_SELECTED, { frame: frameGroup, slotId: 1 });
        }

        return frameGroup;
    }

    // ==========================================
    // SLOT İÇİ ELEMAN OLUŞTURMA
    // ==========================================

    /**
     * Slot içine metin ekle
     * @param {string} text - Metin içeriği
     * @param {number} slotId - Slot ID
     * @param {string} frameId - Frame object ID
     * @param {Object} [options={}] - Metin özellikleri
     * @returns {Promise<Object>} Fabric.js Textbox nesnesi
     */
    async createSlotText(text, slotId, frameId, options = {}) {
        const textbox = await this.createTextbox(text, options);

        // Slot özellikleri ekle
        textbox.set(CUSTOM_PROPS.CUSTOM_TYPE, CUSTOM_TYPES.SLOT_TEXT);
        textbox.set(CUSTOM_PROPS.SLOT_ID, slotId);
        textbox.set(CUSTOM_PROPS.PARENT_FRAME_ID, frameId);
        textbox.set(CUSTOM_PROPS.IN_MULTI_FRAME, true);

        eventBus.emit(EVENTS.SLOT_UPDATED, { frameId, slotId, object: textbox });

        return textbox;
    }

    /**
     * Slot içine barkod ekle
     * @param {string} value - Barkod değeri
     * @param {number} slotId - Slot ID
     * @param {string} frameId - Frame object ID
     * @param {Object} [options={}] - Barkod özellikleri
     * @returns {Promise<Object>} Fabric.js Image nesnesi
     */
    async createSlotBarcode(value, slotId, frameId, options = {}) {
        const barcode = await this.createBarcode(value, options);

        // Slot özellikleri ekle
        barcode.set(CUSTOM_PROPS.CUSTOM_TYPE, CUSTOM_TYPES.SLOT_BARCODE);
        barcode.set(CUSTOM_PROPS.SLOT_ID, slotId);
        barcode.set(CUSTOM_PROPS.PARENT_FRAME_ID, frameId);
        barcode.set(CUSTOM_PROPS.IN_MULTI_FRAME, true);

        eventBus.emit(EVENTS.SLOT_UPDATED, { frameId, slotId, object: barcode });

        return barcode;
    }

    /**
     * Slot içine QR kod ekle
     * @param {string} value - QR kod değeri
     * @param {number} slotId - Slot ID
     * @param {string} frameId - Frame object ID
     * @param {Object} [options={}] - QR kod özellikleri
     * @returns {Promise<Object>} Fabric.js Image nesnesi
     */
    async createSlotQRCode(value, slotId, frameId, options = {}) {
        const qrcode = await this.createQRCode(value, options);

        // Slot özellikleri ekle
        qrcode.set(CUSTOM_PROPS.CUSTOM_TYPE, CUSTOM_TYPES.SLOT_QRCODE);
        qrcode.set(CUSTOM_PROPS.SLOT_ID, slotId);
        qrcode.set(CUSTOM_PROPS.PARENT_FRAME_ID, frameId);
        qrcode.set(CUSTOM_PROPS.IN_MULTI_FRAME, true);

        eventBus.emit(EVENTS.SLOT_UPDATED, { frameId, slotId, object: qrcode });

        return qrcode;
    }

    // ==========================================
    // JSON'DAN NESNE OLUŞTURMA
    // ==========================================

    /**
     * JSON verisinden nesne oluştur
     * @param {Object} jsonData - Fabric.js JSON formatında nesne verisi
     * @returns {Promise<Object>} Oluşturulan Fabric.js nesnesi
     */
    async createFromJSON(jsonData) {
        return new Promise((resolve, reject) => {
            if (!util || !util.enlivenObjects) {
                reject(new Error('Fabric.js util.enlivenObjects not available'));
                return;
            }

            util.enlivenObjects([jsonData]).then((objects) => {
                if (objects && objects.length > 0) {
                    const obj = objects[0];

                    if (this.canvas) {
                        this.canvas.add(obj);
                        this.canvas.requestRenderAll();
                        eventBus.emit(EVENTS.OBJECT_ADDED, { object: obj });
                    }

                    resolve(obj);
                } else {
                    reject(new Error('No object created from JSON'));
                }
            }).catch(reject);
        });
    }

    // ==========================================
    // HELPER METODLAR
    // ==========================================

    /**
     * Canvas referansını güncelle
     * @param {Object} canvas - Yeni Fabric.js Canvas instance
     */
    setCanvas(canvas) {
        this.canvas = canvas;
    }

    /**
     * Sayaçları sıfırla
     */
    resetCounters() {
        this.counters = {};
    }

    /**
     * Belirli tip için sayacı ayarla
     * @param {string} type - Nesne tipi
     * @param {number} value - Sayaç değeri
     */
    setCounter(type, value) {
        this.counters[type] = value;
    }
}

/**
 * Default export
 */
export default ObjectFactory;
