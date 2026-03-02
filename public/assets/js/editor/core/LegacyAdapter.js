/**
 * LegacyAdapter - Fabric.js v5 JSON Uyumluluk Adaptörü
 *
 * Mevcut v5 formatındaki şablon JSON'larını v7 formatına dönüştürür.
 * Geriye dönük uyumluluk sağlar.
 *
 * ÖNEMLİ DEĞİŞİKLİKLER v5 -> v7:
 * 1. originX/originY varsayılan: 'left'/'top' -> 'center'/'center'
 * 2. Image -> FabricImage
 * 3. Text -> FabricText
 * 4. Event pointer: e.pointer -> e.scenePoint / e.viewportPoint
 * 5. Object.prototype.toObject includeDefaultValues kaldırıldı
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

import {
    CUSTOM_PROPS,
    SERIALIZABLE_PROPS,
    isTransient
} from './CustomProperties.js';

import {
    ORIGIN,
    V5_ORIGIN,
    V7_ORIGIN,
    isFabricLoaded,
    waitForFabric
} from './FabricExports.js';

/**
 * v5 -> v7 type mapping
 */
const TYPE_MAP = {
    // v5 type -> v7 type
    'image': 'image',       // FabricImage kullanılacak ama type 'image' kalır
    'text': 'text',         // FabricText kullanılacak ama type 'text' kalır
    'i-text': 'i-text',
    'textbox': 'textbox',
    'rect': 'rect',
    'circle': 'circle',
    'ellipse': 'ellipse',
    'triangle': 'triangle',
    'line': 'line',
    'polyline': 'polyline',
    'polygon': 'polygon',
    'path': 'path',
    'group': 'group',
    'activeSelection': 'activeSelection'
};

/**
 * Pozisyon hesaplama: origin değişikliğinde koordinatları düzelt
 *
 * v5'te origin 'left'/'top' idi, v7'de 'center'/'center'
 * Bu değişikliğe göre left/top değerlerini düzeltmek gerekir
 *
 * @param {Object} objData - Obje JSON verisi
 * @param {string} fromOriginX - Kaynak originX
 * @param {string} fromOriginY - Kaynak originY
 * @param {string} toOriginX - Hedef originX
 * @param {string} toOriginY - Hedef originY
 * @returns {Object} Düzeltilmiş obje verisi
 */
function adjustPositionForOrigin(objData, fromOriginX, fromOriginY, toOriginX, toOriginY) {
    // Origin aynıysa değişiklik yok
    if (fromOriginX === toOriginX && fromOriginY === toOriginY) {
        return objData;
    }

    const width = objData.width || 0;
    const height = objData.height || 0;
    const scaleX = objData.scaleX || 1;
    const scaleY = objData.scaleY || 1;

    const scaledWidth = width * scaleX;
    const scaledHeight = height * scaleY;

    let left = objData.left || 0;
    let top = objData.top || 0;

    // X ekseni düzeltmesi
    if (fromOriginX === 'left' && toOriginX === 'center') {
        left = left + scaledWidth / 2;
    } else if (fromOriginX === 'center' && toOriginX === 'left') {
        left = left - scaledWidth / 2;
    } else if (fromOriginX === 'left' && toOriginX === 'right') {
        left = left + scaledWidth;
    } else if (fromOriginX === 'right' && toOriginX === 'left') {
        left = left - scaledWidth;
    } else if (fromOriginX === 'center' && toOriginX === 'right') {
        left = left + scaledWidth / 2;
    } else if (fromOriginX === 'right' && toOriginX === 'center') {
        left = left - scaledWidth / 2;
    }

    // Y ekseni düzeltmesi
    if (fromOriginY === 'top' && toOriginY === 'center') {
        top = top + scaledHeight / 2;
    } else if (fromOriginY === 'center' && toOriginY === 'top') {
        top = top - scaledHeight / 2;
    } else if (fromOriginY === 'top' && toOriginY === 'bottom') {
        top = top + scaledHeight;
    } else if (fromOriginY === 'bottom' && toOriginY === 'top') {
        top = top - scaledHeight;
    } else if (fromOriginY === 'center' && toOriginY === 'bottom') {
        top = top + scaledHeight / 2;
    } else if (fromOriginY === 'bottom' && toOriginY === 'center') {
        top = top - scaledHeight / 2;
    }

    return {
        ...objData,
        left,
        top,
        originX: toOriginX,
        originY: toOriginY
    };
}

/**
 * Tek bir objeyi v5'ten v7'ye dönüştür
 *
 * @param {Object} objData - v5 formatında obje verisi
 * @param {Object} [options={}] - Dönüşüm seçenekleri
 * @param {boolean} [options.preserveOrigin=false] - Origin'i koru (değiştirme)
 * @param {boolean} [options.markAsConverted=true] - Dönüştürüldü olarak işaretle
 * @returns {Object} v7 formatında obje verisi
 */
function convertObject(objData, options = {}) {
    const {
        preserveOrigin = false,
        markAsConverted = true
    } = options;

    if (!objData) return null;

    // Zaten dönüştürülmüş mü kontrol et
    if (objData[CUSTOM_PROPS.LEGACY_CONVERTED] === true) {
        return objData;
    }

    // Kopyasını al
    let converted = { ...objData };

    // Type mapping (v7'de type isimleri aynı, sadece class isimleri değişti)
    // Type'ı değiştirmeye gerek yok, fabric.js type'a göre class seçer

    // Origin dönüşümü
    if (!preserveOrigin) {
        const currentOriginX = objData.originX || ORIGIN.LEFT;
        const currentOriginY = objData.originY || ORIGIN.TOP;

        // Sadece v5 varsayılanlarıysa dönüştür
        if (currentOriginX === ORIGIN.LEFT && currentOriginY === ORIGIN.TOP) {
            // Legacy origin'i sakla (geri dönüşüm için)
            converted[CUSTOM_PROPS.LEGACY_ORIGIN_X] = currentOriginX;
            converted[CUSTOM_PROPS.LEGACY_ORIGIN_Y] = currentOriginY;

            // v7 origin'e dönüştür
            converted = adjustPositionForOrigin(
                converted,
                currentOriginX,
                currentOriginY,
                V7_ORIGIN.originX,
                V7_ORIGIN.originY
            );
        }
    }

    // Group içindeki objeleri recursive dönüştür
    // Fabric.js v7: type = 'Group' (capitalized), v5: 'group' (lowercase)
    if ((objData.type === 'group' || objData.type === 'Group') && Array.isArray(objData.objects)) {
        converted.objects = objData.objects.map(child =>
            convertObject(child, options)
        );
    }

    // Dönüştürüldü olarak işaretle
    if (markAsConverted) {
        converted[CUSTOM_PROPS.LEGACY_CONVERTED] = true;
    }

    return converted;
}

/**
 * Canvas JSON'unu v5'ten v7'ye dönüştür
 *
 * @param {Object|string} canvasData - Canvas JSON verisi (object veya string)
 * @param {Object} [options={}] - Dönüşüm seçenekleri
 * @returns {Object} v7 formatında canvas verisi
 */
export function convertCanvasJSON(canvasData, options = {}) {
    // String ise parse et
    let data = canvasData;
    if (typeof canvasData === 'string') {
        try {
            data = JSON.parse(canvasData);
        } catch (e) {
            console.error('LegacyAdapter: JSON parse hatası', e);
            return null;
        }
    }

    if (!data) return null;

    // Version kontrolü
    const fabricVersion = data.version || 'unknown';
    const isV5 = fabricVersion.startsWith('5.') || fabricVersion === 'unknown';

    if (!isV5 && !options.forceConvert) {
        // v7 veya üstü, dönüşüm gerekmiyor
        console.log(`LegacyAdapter: v${fabricVersion} formatı, dönüşüm gerekmiyor`);
        return data;
    }

    console.log(`LegacyAdapter: v${fabricVersion} -> v7 dönüşümü başlatılıyor...`);

    // Canvas özelliklerini kopyala
    const converted = {
        ...data,
        version: '7.0.0', // v7 olarak işaretle
        _legacyVersion: fabricVersion // Orijinal versiyonu sakla
    };

    // Objeleri dönüştür
    if (Array.isArray(data.objects)) {
        converted.objects = data.objects.map(obj => convertObject(obj, options));
    }

    // Background image varsa dönüştür
    if (data.backgroundImage) {
        converted.backgroundImage = convertObject(data.backgroundImage, options);
    }

    // Overlay image varsa dönüştür
    if (data.overlayImage) {
        converted.overlayImage = convertObject(data.overlayImage, options);
    }

    console.log(`LegacyAdapter: ${converted.objects?.length || 0} obje dönüştürüldü`);

    return converted;
}

/**
 * Canvas JSON'unu v7'den v5'e dönüştür (export için)
 *
 * @param {Object|string} canvasData - Canvas JSON verisi
 * @param {Object} [options={}] - Dönüşüm seçenekleri
 * @returns {Object} v5 uyumlu canvas verisi
 */
export function convertToV5Format(canvasData, options = {}) {
    let data = canvasData;
    if (typeof canvasData === 'string') {
        try {
            data = JSON.parse(canvasData);
        } catch (e) {
            console.error('LegacyAdapter: JSON parse hatası', e);
            return null;
        }
    }

    if (!data) return null;

    // Canvas özelliklerini kopyala
    const converted = {
        ...data,
        version: '5.3.1' // v5 olarak işaretle
    };

    // Objeleri v5 formatına dönüştür
    if (Array.isArray(data.objects)) {
        converted.objects = data.objects.map(obj => convertObjectToV5(obj, options));
    }

    return converted;
}

/**
 * Tek bir objeyi v7'den v5'e dönüştür
 *
 * @param {Object} objData - v7 formatında obje verisi
 * @param {Object} [options={}] - Dönüşüm seçenekleri
 * @returns {Object} v5 formatında obje verisi
 */
function convertObjectToV5(objData, options = {}) {
    if (!objData) return null;

    let converted = { ...objData };

    // Legacy origin değerlerini kullan (varsa)
    const legacyOriginX = objData[CUSTOM_PROPS.LEGACY_ORIGIN_X] || ORIGIN.LEFT;
    const legacyOriginY = objData[CUSTOM_PROPS.LEGACY_ORIGIN_Y] || ORIGIN.TOP;

    const currentOriginX = objData.originX || ORIGIN.CENTER;
    const currentOriginY = objData.originY || ORIGIN.CENTER;

    // v5 origin'e dönüştür
    if (currentOriginX !== legacyOriginX || currentOriginY !== legacyOriginY) {
        converted = adjustPositionForOrigin(
            converted,
            currentOriginX,
            currentOriginY,
            legacyOriginX,
            legacyOriginY
        );
    }

    // Legacy flag'leri temizle
    delete converted[CUSTOM_PROPS.LEGACY_CONVERTED];
    delete converted[CUSTOM_PROPS.LEGACY_ORIGIN_X];
    delete converted[CUSTOM_PROPS.LEGACY_ORIGIN_Y];

    // Group içindeki objeleri recursive dönüştür (v7: 'Group', v5: 'group')
    if ((objData.type === 'group' || objData.type === 'Group') && Array.isArray(objData.objects)) {
        converted.objects = objData.objects.map(child =>
            convertObjectToV5(child, options)
        );
    }

    return converted;
}

/**
 * Şablon veritabanı verisini v7'ye dönüştür
 *
 * @param {Object} template - Veritabanından gelen şablon verisi
 * @param {Object} [options={}] - Dönüşüm seçenekleri
 * @returns {Object} v7 uyumlu şablon verisi
 */
export function convertTemplate(template, options = {}) {
    if (!template) return null;

    const converted = { ...template };

    // design_data veya content alanını dönüştür
    const contentField = template.design_data || template.content;

    if (contentField) {
        const contentData = typeof contentField === 'string'
            ? JSON.parse(contentField)
            : contentField;

        const convertedContent = convertCanvasJSON(contentData, options);

        if (template.design_data) {
            converted.design_data = convertedContent;
        }
        if (template.content) {
            converted.content = JSON.stringify(convertedContent);
        }
    }

    return converted;
}

/**
 * Canvas'ı async olarak v7 formatına yükle
 *
 * @param {Object} canvas - Fabric.js canvas instance
 * @param {Object|string} jsonData - v5 veya v7 JSON verisi
 * @param {Object} [options={}] - Yükleme seçenekleri
 * @returns {Promise<void>}
 */
export async function loadCanvasWithAdapter(canvas, jsonData, options = {}) {
    if (!canvas) {
        throw new Error('LegacyAdapter: Canvas instance gerekli');
    }

    // Fabric.js yüklenmiş mi kontrol et
    if (!isFabricLoaded()) {
        await waitForFabric();
    }

    // JSON'u v7'ye dönüştür
    const convertedData = convertCanvasJSON(jsonData, options);

    if (!convertedData) {
        throw new Error('LegacyAdapter: JSON dönüşümü başarısız');
    }

    // Canvas'a yükle - Fabric.js 7: Promise tabanlı API
    return canvas.loadFromJSON(convertedData).then(() => {
        canvas.renderAll();
    });
}

/**
 * Canvas'tan v5 uyumlu JSON export et
 *
 * @param {Object} canvas - Fabric.js canvas instance
 * @param {Object} [options={}] - Export seçenekleri
 * @returns {Object} v5 uyumlu JSON
 */
export function exportAsV5(canvas, options = {}) {
    if (!canvas) return null;

    // Custom property'leri dahil et
    const jsonData = canvas.toJSON(SERIALIZABLE_PROPS);

    // v5 formatına dönüştür
    return convertToV5Format(jsonData, options);
}

/**
 * JSON formatını tespit et (v5 mi v7 mi)
 *
 * @param {Object|string} jsonData - Canvas JSON verisi
 * @returns {{version: string, isV5: boolean, isV7: boolean}}
 */
export function detectVersion(jsonData) {
    let data = jsonData;
    if (typeof jsonData === 'string') {
        try {
            data = JSON.parse(jsonData);
        } catch (e) {
            return { version: 'unknown', isV5: false, isV7: false };
        }
    }

    const version = data?.version || 'unknown';

    return {
        version,
        isV5: version.startsWith('5.') || version === 'unknown',
        isV7: version.startsWith('7.') || version.startsWith('6.')
    };
}

/**
 * Objenin legacy origin kullanıp kullanmadığını kontrol et
 *
 * @param {Object} obj - Fabric.js objesi veya JSON verisi
 * @returns {boolean}
 */
export function hasLegacyOrigin(obj) {
    if (!obj) return false;

    const originX = obj.originX || ORIGIN.LEFT;
    const originY = obj.originY || ORIGIN.TOP;

    // v5 varsayılanları kullanıyorsa legacy
    return originX === ORIGIN.LEFT && originY === ORIGIN.TOP;
}

/**
 * Tüm objelerin origin'ini kontrol et ve raporla
 *
 * @param {Object} canvasData - Canvas JSON verisi
 * @returns {{total: number, legacy: number, v7: number, mixed: number}}
 */
export function analyzeOrigins(canvasData) {
    let data = canvasData;
    if (typeof canvasData === 'string') {
        data = JSON.parse(canvasData);
    }

    const result = { total: 0, legacy: 0, v7: 0, mixed: 0 };

    if (!data?.objects) return result;

    function analyzeObject(obj) {
        result.total++;

        const originX = obj.originX;
        const originY = obj.originY;

        if (originX === ORIGIN.LEFT && originY === ORIGIN.TOP) {
            result.legacy++;
        } else if (originX === ORIGIN.CENTER && originY === ORIGIN.CENTER) {
            result.v7++;
        } else {
            result.mixed++;
        }

        // Group içindeki objeleri analiz et
        // Fabric.js v7: type = 'Group' (capitalized), v5: 'group' (lowercase)
        if ((obj.type === 'group' || obj.type === 'Group') && Array.isArray(obj.objects)) {
            obj.objects.forEach(analyzeObject);
        }
    }

    data.objects.forEach(analyzeObject);

    return result;
}

// Default export
export default {
    convertCanvasJSON,
    convertToV5Format,
    convertTemplate,
    convertObject,
    loadCanvasWithAdapter,
    exportAsV5,
    detectVersion,
    hasLegacyOrigin,
    analyzeOrigins,
    adjustPositionForOrigin
};
