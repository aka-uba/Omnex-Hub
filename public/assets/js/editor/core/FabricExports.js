/**
 * FabricExports - Fabric.js Import Alias ve Wrapper
 *
 * Fabric.js v7 class'larını merkezi bir noktadan export eder.
 * UMD (Universal Module Definition) global'den okur.
 *
 * NOT: Fabric.js UMD build olarak yüklenir ve window.fabric olarak erişilir.
 * Bu modül, ES Module syntax ile kullanım kolaylığı sağlar.
 *
 * ÖNEMLİ: Tüm class export'ları lazy getter kullanır.
 * Module import edildiğinde değil, erişildiğinde fabric global'den okunur.
 * Bu sayede Fabric.js daha sonra yüklense bile çalışır.
 *
 * KULLANIM:
 * ```javascript
 * import { waitForFabric, Canvas, FabricImage } from './FabricExports.js';
 *
 * // Önce Fabric.js'in yüklenmesini bekle
 * await waitForFabric();
 *
 * // Sonra class'ları kullan
 * const canvas = new Canvas('canvas-id');
 * ```
 *
 * @version 2.0.0
 * @author Omnex Display Hub
 */

// ==========================================
// FABRIC.JS CHECK FUNCTIONS
// ==========================================

/**
 * Fabric.js yüklenmiş mi kontrol et
 * @returns {boolean}
 */
export function isFabricLoaded() {
    return typeof window !== 'undefined' && typeof window.fabric !== 'undefined';
}

/**
 * Fabric.js yüklenene kadar bekle
 * Eğer yüklü değilse CDN'den dinamik olarak yükler
 * @param {number} [timeout=15000] - Maksimum bekleme süresi (ms)
 * @returns {Promise<void>}
 */
export function waitForFabric(timeout = 15000) {
    return new Promise((resolve, reject) => {
        if (isFabricLoaded()) {
            resolve();
            return;
        }

        // Dinamik yükleme için script kontrolü
        const existingScript = document.querySelector('script[src*="fabric"]');
        if (!existingScript) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/fabric@7.1.0/dist/index.min.js';
            script.async = true;
            document.head.appendChild(script);
        }

        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            if (isFabricLoaded()) {
                clearInterval(checkInterval);
                resolve();
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                reject(new Error('Fabric.js yüklenemedi: Timeout (15 saniye). Sayfayı yenileyin.'));
            }
        }, 100);
    });
}

// ==========================================
// LAZY GETTER EXPORTS
// ==========================================

/**
 * Lazy exports objesi
 * Her property erişildiğinde window.fabric'den okur
 */
const lazyExports = {};

// Property descriptor factory
function defineLazyGetter(name, getter) {
    Object.defineProperty(lazyExports, name, {
        get: getter,
        enumerable: true,
        configurable: true
    });
}

// Canvas
defineLazyGetter('Canvas', () => window.fabric?.Canvas);
defineLazyGetter('StaticCanvas', () => window.fabric?.StaticCanvas);

// Objects
defineLazyGetter('FabricObject', () => window.fabric?.FabricObject || window.fabric?.Object);
defineLazyGetter('FabricImage', () => window.fabric?.FabricImage || window.fabric?.Image);
defineLazyGetter('FabricText', () => window.fabric?.FabricText || window.fabric?.Text);
defineLazyGetter('IText', () => window.fabric?.IText);
defineLazyGetter('Textbox', () => window.fabric?.Textbox);
defineLazyGetter('Rect', () => window.fabric?.Rect);
defineLazyGetter('Circle', () => window.fabric?.Circle);
defineLazyGetter('Ellipse', () => window.fabric?.Ellipse);
defineLazyGetter('Triangle', () => window.fabric?.Triangle);
defineLazyGetter('Line', () => window.fabric?.Line);
defineLazyGetter('Polyline', () => window.fabric?.Polyline);
defineLazyGetter('Polygon', () => window.fabric?.Polygon);
defineLazyGetter('Path', () => window.fabric?.Path);
defineLazyGetter('Group', () => window.fabric?.Group);
defineLazyGetter('ActiveSelection', () => window.fabric?.ActiveSelection);

// Styles
defineLazyGetter('Gradient', () => window.fabric?.Gradient);
defineLazyGetter('Pattern', () => window.fabric?.Pattern);
defineLazyGetter('Color', () => window.fabric?.Color);

// Utility
defineLazyGetter('util', () => window.fabric?.util);
defineLazyGetter('Point', () => window.fabric?.Point);
defineLazyGetter('Control', () => window.fabric?.Control);

// SVG
defineLazyGetter('loadSVGFromString', () => window.fabric?.loadSVGFromString);
defineLazyGetter('loadSVGFromURL', () => window.fabric?.loadSVGFromURL);

// Meta
defineLazyGetter('version', () => window.fabric?.version || 'unknown');
defineLazyGetter('config', () => window.fabric?.config || {});

// ==========================================
// NAMED EXPORTS (Lazy Getter Wrappers)
// ==========================================

// Canvas - function bazlı Proxy (constructor olarak çalışabilmesi için)
export const Canvas = new Proxy(function() {}, {
    get: (_, prop) => {
        const cls = lazyExports.Canvas;
        return cls?.[prop];
    },
    construct: (_, args) => {
        const cls = lazyExports.Canvas;
        if (!cls) {
            throw new Error('FabricExports: Canvas henüz yüklenmedi. waitForFabric() kullanın.');
        }
        const instance = new cls(...args);
        return instance;
    },
    apply: (_, thisArg, args) => {
        const cls = lazyExports.Canvas;
        return cls?.apply(thisArg, args);
    }
});

export const StaticCanvas = new Proxy(function() {}, {
    get: (_, prop) => {
        const cls = lazyExports.StaticCanvas;
        return cls?.[prop];
    },
    construct: (_, args) => {
        const cls = lazyExports.StaticCanvas;
        if (!cls) {
            throw new Error('FabricExports: StaticCanvas henüz yüklenmedi. waitForFabric() kullanın.');
        }
        return new cls(...args);
    }
});

// Objects - Proxy factory
function createClassProxy(name) {
    return new Proxy(function() {}, {
        get: (_, prop) => {
            const cls = lazyExports[name];
            return cls?.[prop];
        },
        construct: (_, args) => {
            const cls = lazyExports[name];
            if (!cls) {
                throw new Error(`FabricExports: ${name} henüz yüklenmedi. waitForFabric() kullanın.`);
            }
            return new cls(...args);
        },
        apply: (_, thisArg, args) => {
            const cls = lazyExports[name];
            return cls?.apply(thisArg, args);
        }
    });
}

export const FabricObject = createClassProxy('FabricObject');
export const FabricImage = createClassProxy('FabricImage');
export const FabricText = createClassProxy('FabricText');
export const IText = createClassProxy('IText');
export const Textbox = createClassProxy('Textbox');
export const Rect = createClassProxy('Rect');
export const Circle = createClassProxy('Circle');
export const Ellipse = createClassProxy('Ellipse');
export const Triangle = createClassProxy('Triangle');
export const Line = createClassProxy('Line');
export const Polyline = createClassProxy('Polyline');
export const Polygon = createClassProxy('Polygon');
export const Path = createClassProxy('Path');
export const Group = createClassProxy('Group');
export const ActiveSelection = createClassProxy('ActiveSelection');

// Styles
export const Gradient = createClassProxy('Gradient');
export const Pattern = createClassProxy('Pattern');
export const Color = createClassProxy('Color');

// Utility - Plain getter (class değil)
export const util = new Proxy({}, {
    get: (_, prop) => lazyExports.util?.[prop]
});

export const Point = createClassProxy('Point');
export const Control = createClassProxy('Control');

// SVG Functions
export const loadSVGFromString = (...args) => lazyExports.loadSVGFromString?.(...args);
export const loadSVGFromURL = (...args) => lazyExports.loadSVGFromURL?.(...args);

// Meta
export const version = new Proxy({}, {
    get: () => lazyExports.version
});

export const config = new Proxy({}, {
    get: (_, prop) => lazyExports.config?.[prop]
});

// ==========================================
// V7 ORIGIN DEĞİŞİKLİĞİ HELPER'LARI
// ==========================================

/**
 * v7 Origin Sabitleri
 * v7'de origin varsayılan olarak 'center'
 * v5'te varsayılan 'left'/'top' idi
 */
export const ORIGIN = {
    LEFT: 'left',
    CENTER: 'center',
    RIGHT: 'right',
    TOP: 'top',
    BOTTOM: 'bottom'
};

/**
 * v5 uyumlu origin ayarları
 * Legacy şablonlar için kullanılır
 */
export const V5_ORIGIN = {
    originX: ORIGIN.LEFT,
    originY: ORIGIN.TOP
};

/**
 * v7 varsayılan origin ayarları
 */
export const V7_ORIGIN = {
    originX: ORIGIN.CENTER,
    originY: ORIGIN.CENTER
};

/**
 * Origin'i v5'ten v7'ye dönüştür
 * Pozisyonu koruyarak origin'i değiştirir
 *
 * @param {Object} obj - Fabric.js objesi
 * @param {Object} [targetOrigin=V7_ORIGIN] - Hedef origin
 */
export function convertOriginV5toV7(obj, targetOrigin = V7_ORIGIN) {
    if (!obj) return;

    const currentOriginX = obj.originX || ORIGIN.LEFT;
    const currentOriginY = obj.originY || ORIGIN.TOP;

    // Zaten hedef origin'deyse işlem yapma
    if (currentOriginX === targetOrigin.originX && currentOriginY === targetOrigin.originY) {
        return;
    }

    // Mevcut pozisyonu al
    const point = obj.getPointByOrigin(currentOriginX, currentOriginY);

    // Yeni origin'i ayarla
    obj.set({
        originX: targetOrigin.originX,
        originY: targetOrigin.originY
    });

    // Pozisyonu yeni origin'e göre ayarla
    obj.setPositionByOrigin(point, targetOrigin.originX, targetOrigin.originY);

    obj.setCoords();
}

/**
 * Origin'i v7'den v5'e dönüştür (export için)
 *
 * @param {Object} obj - Fabric.js objesi
 */
export function convertOriginV7toV5(obj) {
    convertOriginV5toV7(obj, V5_ORIGIN);
}

// ==========================================
// GET ALL EXPORTS (after fabric loaded)
// ==========================================

/**
 * Tüm Fabric.js export'larını al
 * Fabric.js yüklendikten sonra çağırın
 *
 * @returns {Object|null}
 */
export function getExports() {
    if (!isFabricLoaded()) {
        console.warn('FabricExports.getExports(): Fabric.js henüz yüklenmedi');
        return null;
    }

    const f = window.fabric;

    return {
        // Canvas
        Canvas: f.Canvas,
        StaticCanvas: f.StaticCanvas,

        // Objects
        FabricObject: f.FabricObject || f.Object,
        FabricImage: f.FabricImage || f.Image,
        FabricText: f.FabricText || f.Text,
        IText: f.IText,
        Textbox: f.Textbox,
        Rect: f.Rect,
        Circle: f.Circle,
        Ellipse: f.Ellipse,
        Triangle: f.Triangle,
        Line: f.Line,
        Polyline: f.Polyline,
        Polygon: f.Polygon,
        Path: f.Path,
        Group: f.Group,
        ActiveSelection: f.ActiveSelection,

        // Styles
        Gradient: f.Gradient,
        Pattern: f.Pattern,
        Color: f.Color,

        // Utility
        util: f.util,
        Point: f.Point,
        Control: f.Control,

        // SVG
        loadSVGFromString: f.loadSVGFromString,
        loadSVGFromURL: f.loadSVGFromURL,

        // Meta
        version: f.version,
        config: f.config
    };
}

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default {
    isFabricLoaded,
    waitForFabric,
    getExports,

    // Constants
    ORIGIN,
    V5_ORIGIN,
    V7_ORIGIN,

    // Helpers
    convertOriginV5toV7,
    convertOriginV7toV5
};
