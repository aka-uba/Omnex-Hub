/**
 * DevicePresets - Cihaz boyut presetleri (v7)
 *
 * Fabric.js v7.1.0 için cihaz türü bazlı canvas boyutlandırma presetleri.
 * Farklı cihaz türleri için önceden tanımlanmış ekran boyutları.
 *
 * @version 7.0.0
 */

// i18n helper
const __ = (key, params = {}) => {
    return window.__?.(key, params) || key;
};

/**
 * Device preset tanımları
 */
export const DevicePresets = {
    // Barkod Yazıcı (Thermal Label) - 96 DPI bazlı piksel değerleri
    'label_60x40': {
        id: 'label_60x40',
        name: '60x40mm Etiket',
        type: 'label_printer',
        deviceType: 'label_printer',
        width: 227,
        height: 151,
        orientation: 'landscape',
        icon: 'ti-barcode',
        category: 'label_printer',
        recommended: true
    },
    'label_58x40': {
        id: 'label_58x40',
        name: '58x40mm Etiket',
        type: 'label_printer',
        deviceType: 'label_printer',
        width: 219,
        height: 151,
        orientation: 'landscape',
        icon: 'ti-barcode',
        category: 'label_printer'
    },
    'label_40x30': {
        id: 'label_40x30',
        name: '40x30mm Etiket',
        type: 'label_printer',
        deviceType: 'label_printer',
        width: 151,
        height: 113,
        orientation: 'landscape',
        icon: 'ti-barcode',
        category: 'label_printer'
    },
    'label_50x30': {
        id: 'label_50x30',
        name: '50x30mm Etiket',
        type: 'label_printer',
        deviceType: 'label_printer',
        width: 189,
        height: 113,
        orientation: 'landscape',
        icon: 'ti-barcode',
        category: 'label_printer'
    },
    'label_100x50': {
        id: 'label_100x50',
        name: '100x50mm Etiket',
        type: 'label_printer',
        deviceType: 'label_printer',
        width: 378,
        height: 189,
        orientation: 'landscape',
        icon: 'ti-barcode',
        category: 'label_printer'
    },
    'label_100x70': {
        id: 'label_100x70',
        name: '100x70mm Etiket',
        type: 'label_printer',
        deviceType: 'label_printer',
        width: 378,
        height: 265,
        orientation: 'landscape',
        icon: 'ti-barcode',
        category: 'label_printer'
    },

    // ESL Cihazları - Küçük
    'esl_29': {
        id: 'esl_29',
        name: '2.9" ESL',
        type: 'esl',
        deviceType: 'esl',
        width: 296,
        height: 128,
        orientation: 'landscape',
        icon: 'ti-device-mobile',
        category: 'esl'
    },
    'esl_42': {
        id: 'esl_42',
        name: '4.2" ESL',
        type: 'esl',
        deviceType: 'esl',
        width: 400,
        height: 300,
        orientation: 'landscape',
        icon: 'ti-device-mobile',
        category: 'esl'
    },

    // ESL Cihazları - Orta
    'esl_75': {
        id: 'esl_75',
        name: '7.5" ESL',
        type: 'esl',
        deviceType: 'esl',
        width: 800,
        height: 480,
        orientation: 'landscape',
        icon: 'ti-device-tablet',
        category: 'esl'
    },
    'esl_75_portrait': {
        id: 'esl_75_portrait',
        name: '7.5" ESL Dikey',
        type: 'esl',
        deviceType: 'esl',
        width: 480,
        height: 800,
        orientation: 'portrait',
        icon: 'ti-device-tablet',
        category: 'esl'
    },

    // ESL Cihazları - Büyük (PavoDisplay)
    'esl_101_portrait': {
        id: 'esl_101_portrait',
        name: '10.1" ESL Dikey',
        type: 'esl',
        deviceType: 'esl',
        width: 800,
        height: 1280,
        orientation: 'portrait',
        icon: 'ti-device-tablet',
        category: 'esl',
        recommended: true
    },
    'esl_101_landscape': {
        id: 'esl_101_landscape',
        name: '10.1" ESL Yatay',
        type: 'esl',
        deviceType: 'esl',
        width: 1280,
        height: 800,
        orientation: 'landscape',
        icon: 'ti-device-tablet',
        category: 'esl'
    },

    // Signage / TV
    'signage_hd': {
        id: 'signage_hd',
        name: 'HD (1920x1080)',
        type: 'signage',
        deviceType: 'android_tv',
        width: 1920,
        height: 1080,
        orientation: 'landscape',
        icon: 'ti-device-tv',
        category: 'signage',
        recommended: true
    },
    'signage_hd_portrait': {
        id: 'signage_hd_portrait',
        name: 'HD Dikey (1080x1920)',
        type: 'signage',
        deviceType: 'android_tv',
        width: 1080,
        height: 1920,
        orientation: 'portrait',
        icon: 'ti-device-tv',
        category: 'signage'
    },
    'signage_4k': {
        id: 'signage_4k',
        name: '4K (3840x2160)',
        type: 'signage',
        deviceType: 'android_tv',
        width: 3840,
        height: 2160,
        orientation: 'landscape',
        icon: 'ti-device-tv',
        category: 'signage'
    },

    // Panel / Web Display
    'panel_hd': {
        id: 'panel_hd',
        name: 'Panel HD',
        type: 'panel',
        deviceType: 'panel',
        width: 1920,
        height: 1080,
        orientation: 'landscape',
        icon: 'ti-presentation',
        category: 'panel'
    },
    'web_display': {
        id: 'web_display',
        name: 'Web Display',
        type: 'web_display',
        deviceType: 'web_display',
        width: 1280,
        height: 720,
        orientation: 'landscape',
        icon: 'ti-browser',
        category: 'web'
    },

    // Poster / Print
    'poster_a4_portrait': {
        id: 'poster_a4_portrait',
        name: 'A4 Dikey',
        type: 'poster',
        deviceType: 'print',
        width: 595,
        height: 842,
        orientation: 'portrait',
        icon: 'ti-file',
        category: 'print'
    },
    'poster_a4_landscape': {
        id: 'poster_a4_landscape',
        name: 'A4 Yatay',
        type: 'poster',
        deviceType: 'print',
        width: 842,
        height: 595,
        orientation: 'landscape',
        icon: 'ti-file',
        category: 'print'
    },
    'poster_a3_portrait': {
        id: 'poster_a3_portrait',
        name: 'A3 Dikey',
        type: 'poster',
        deviceType: 'print',
        width: 842,
        height: 1191,
        orientation: 'portrait',
        icon: 'ti-file',
        category: 'print'
    },

    // Özel
    'custom': {
        id: 'custom',
        name: 'Özel Boyut',
        type: 'custom',
        deviceType: 'custom',
        width: 800,
        height: 600,
        orientation: 'landscape',
        icon: 'ti-adjustments',
        category: 'custom'
    }
};

/**
 * Kategori grupları
 */
export const PresetCategories = {
    'label_printer': {
        id: 'label_printer',
        name: 'Barkod Yazıcı',
        icon: 'ti-barcode',
        presets: ['label_60x40', 'label_58x40', 'label_40x30', 'label_50x30', 'label_100x50', 'label_100x70']
    },
    'esl': {
        id: 'esl',
        name: 'ESL (Elektronik Raf Etiketi)',
        icon: 'ti-tag',
        presets: ['esl_29', 'esl_42', 'esl_75', 'esl_75_portrait', 'esl_101_portrait', 'esl_101_landscape']
    },
    'signage': {
        id: 'signage',
        name: 'Signage / TV',
        icon: 'ti-device-tv',
        presets: ['signage_hd', 'signage_hd_portrait', 'signage_4k']
    },
    'panel': {
        id: 'panel',
        name: 'Panel / Web',
        icon: 'ti-presentation',
        presets: ['panel_hd', 'web_display']
    },
    'print': {
        id: 'print',
        name: 'Poster / Baskı',
        icon: 'ti-printer',
        presets: ['poster_a4_portrait', 'poster_a4_landscape', 'poster_a3_portrait']
    },
    'custom': {
        id: 'custom',
        name: 'Özel',
        icon: 'ti-adjustments',
        presets: ['custom']
    }
};

/**
 * Grid düzen tanımları
 */
export const GridLayouts = {
    'single': {
        id: 'single',
        name: 'Tek Alan',
        icon: 'ti-square',
        cols: 1,
        rows: 1,
        regions: [
            { id: 'main', x: 0, y: 0, widthPercent: 100, heightPercent: 100 }
        ]
    },
    'split-horizontal': {
        id: 'split-horizontal',
        name: 'Yatay İkili',
        icon: 'ti-layout-columns',
        cols: 2,
        rows: 1,
        regions: [
            { id: 'left', x: 0, y: 0, widthPercent: 50, heightPercent: 100 },
            { id: 'right', x: 50, y: 0, widthPercent: 50, heightPercent: 100 }
        ]
    },
    'split-vertical': {
        id: 'split-vertical',
        name: 'Dikey İkili',
        icon: 'ti-layout-rows',
        cols: 1,
        rows: 2,
        regions: [
            { id: 'top', x: 0, y: 0, widthPercent: 100, heightPercent: 50 },
            { id: 'bottom', x: 0, y: 50, widthPercent: 100, heightPercent: 50 }
        ]
    },
    'grid-2x2': {
        id: 'grid-2x2',
        name: '2x2 Grid',
        icon: 'ti-layout-grid',
        cols: 2,
        rows: 2,
        regions: [
            { id: 'top-left', x: 0, y: 0, widthPercent: 50, heightPercent: 50 },
            { id: 'top-right', x: 50, y: 0, widthPercent: 50, heightPercent: 50 },
            { id: 'bottom-left', x: 0, y: 50, widthPercent: 50, heightPercent: 50 },
            { id: 'bottom-right', x: 50, y: 50, widthPercent: 50, heightPercent: 50 }
        ]
    },
    'header-content': {
        id: 'header-content',
        name: 'Başlık + İçerik',
        icon: 'ti-layout-navbar',
        cols: 1,
        rows: 2,
        regions: [
            { id: 'header', x: 0, y: 0, widthPercent: 100, heightPercent: 20 },
            { id: 'content', x: 0, y: 20, widthPercent: 100, heightPercent: 80 }
        ]
    },
    'header-content-footer': {
        id: 'header-content-footer',
        name: 'Başlık + İçerik + Alt',
        icon: 'ti-layout-bottombar',
        cols: 1,
        rows: 3,
        regions: [
            { id: 'header', x: 0, y: 0, widthPercent: 100, heightPercent: 15 },
            { id: 'content', x: 0, y: 15, widthPercent: 100, heightPercent: 70 },
            { id: 'footer', x: 0, y: 85, widthPercent: 100, heightPercent: 15 }
        ]
    },
    'sidebar-content': {
        id: 'sidebar-content',
        name: 'Kenar + İçerik',
        icon: 'ti-layout-sidebar',
        cols: 2,
        rows: 1,
        regions: [
            { id: 'sidebar', x: 0, y: 0, widthPercent: 30, heightPercent: 100 },
            { id: 'content', x: 30, y: 0, widthPercent: 70, heightPercent: 100 }
        ]
    },
    'top-two-bottom-one': {
        id: 'top-two-bottom-one',
        name: 'Üst 2 Alt 1',
        icon: 'ti-layout-distribute-vertical',
        cols: 2,
        rows: 2,
        regions: [
            { id: 'top-left', x: 0, y: 0, widthPercent: 50, heightPercent: 50 },
            { id: 'top-right', x: 50, y: 0, widthPercent: 50, heightPercent: 50 },
            { id: 'bottom', x: 0, y: 50, widthPercent: 100, heightPercent: 50 }
        ]
    },
    'top-one-bottom-two': {
        id: 'top-one-bottom-two',
        name: 'Üst 1 Alt 2',
        icon: 'ti-layout-distribute-horizontal',
        cols: 2,
        rows: 2,
        regions: [
            { id: 'top', x: 0, y: 0, widthPercent: 100, heightPercent: 50 },
            { id: 'bottom-left', x: 0, y: 50, widthPercent: 50, heightPercent: 50 },
            { id: 'bottom-right', x: 50, y: 50, widthPercent: 50, heightPercent: 50 }
        ]
    },
    'grid-3x1': {
        id: 'grid-3x1',
        name: '3 Sütun',
        icon: 'ti-columns-3',
        cols: 3,
        rows: 1,
        regions: [
            { id: 'left', x: 0, y: 0, widthPercent: 33.33, heightPercent: 100 },
            { id: 'center', x: 33.33, y: 0, widthPercent: 33.33, heightPercent: 100 },
            { id: 'right', x: 66.66, y: 0, widthPercent: 33.34, heightPercent: 100 }
        ]
    }
};

/**
 * Preset'e göre cihaz bilgilerini döndür
 * @param {string} presetId - Preset ID
 * @returns {Object} Preset bilgileri
 */
export function getPreset(presetId) {
    return DevicePresets[presetId] || DevicePresets['custom'];
}

/**
 * Kategoriye göre presetleri döndür
 * @param {string} categoryId - Kategori ID
 * @returns {Array} Preset listesi
 */
export function getPresetsByCategory(categoryId) {
    const category = PresetCategories[categoryId];
    if (!category) return [];
    return category.presets.map(id => DevicePresets[id]).filter(Boolean);
}

/**
 * Cihaz türüne göre uygun presetleri döndür
 * @param {string} deviceType - Cihaz türü
 * @returns {Array} Preset listesi
 */
export function getPresetsByDeviceType(deviceType) {
    return Object.values(DevicePresets).filter(p => p.deviceType === deviceType);
}

/**
 * Tüm presetleri kategorilere göre gruplandır
 * @returns {Array} Gruplandırılmış preset listesi
 */
export function getGroupedPresets() {
    return Object.entries(PresetCategories).map(([id, category]) => ({
        ...category,
        items: category.presets.map(presetId => DevicePresets[presetId]).filter(Boolean)
    }));
}

/**
 * Grid layout döndür
 * @param {string} layoutId - Layout ID
 * @returns {Object} Layout bilgileri
 */
export function getGridLayout(layoutId) {
    return GridLayouts[layoutId] || GridLayouts['single'];
}

/**
 * Tüm grid layoutları döndür
 * @returns {Array} Layout listesi
 */
export function getAllGridLayouts() {
    return Object.values(GridLayouts);
}

export default DevicePresets;
