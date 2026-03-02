/**
 * Editor v7 Feature Flags
 *
 * Feature flag'ler ile v5/v7 editor arasında geçiş kontrolü.
 *
 * KULLANIM:
 * ```javascript
 * import { FeatureFlags, isV7EditorEnabled } from './editor/config/FeatureFlags.js';
 *
 * if (isV7EditorEnabled()) {
 *     // v7 editor kullan
 * } else {
 *     // v5 editor kullan
 * }
 * ```
 *
 * AYAR YÖNTEMLERI:
 * 1. localStorage: 'omnex_editor_v7' = 'true'/'false'
 * 2. URL param: ?editor=v7 veya ?editor=v5
 * 3. Config: FeatureFlags.EDITOR_V7_ENABLED
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

// ==========================================
// FEATURE FLAGS
// ==========================================

export const FeatureFlags = {
    /**
     * v7 Editor varsayılan durumu
     * v7 migration tamamlandıktan sonra true yapıldı
     */
    EDITOR_V7_ENABLED: true,

    /**
     * v7 Editor deneysel özellikler
     */
    EXPERIMENTAL_FEATURES: {
        // Multi-product frame desteği
        MULTI_FRAME_ENABLED: true,

        // Otomatik origin dönüşümü
        AUTO_ORIGIN_CONVERSION: true,

        // History WebWorker (deneysel)
        HISTORY_WORKER: false,

        // Real-time collaboration (gelecek)
        REALTIME_COLLAB: false
    },

    /**
     * Debug modları
     */
    DEBUG: {
        // Canvas debug overlay
        CANVAS_DEBUG: false,

        // Event logging
        EVENT_LOGGING: false,

        // Performance metrics
        PERFORMANCE_METRICS: false,

        // Legacy format warnings
        LEGACY_WARNINGS: true
    }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * v7 Editor aktif mi kontrol et
 * Öncelik: URL param > localStorage > FeatureFlags default
 *
 * @returns {boolean}
 */
export function isV7EditorEnabled() {
    // 1. URL parametresi kontrol
    const urlParams = new URLSearchParams(window.location.search);
    const editorParam = urlParams.get('editor');

    if (editorParam === 'v7') return true;
    if (editorParam === 'v5') return false;

    // 2. localStorage kontrol
    const storedValue = localStorage.getItem('omnex_editor_v7');
    if (storedValue !== null) {
        return storedValue === 'true';
    }

    // 3. Feature flag default
    return FeatureFlags.EDITOR_V7_ENABLED;
}

/**
 * v7 Editor'ü etkinleştir/devre dışı bırak
 *
 * @param {boolean} enabled
 */
export function setV7EditorEnabled(enabled) {
    localStorage.setItem('omnex_editor_v7', enabled ? 'true' : 'false');
}

/**
 * v7 Editor ayarını sıfırla (default'a dön)
 */
export function resetV7EditorSetting() {
    localStorage.removeItem('omnex_editor_v7');
}

/**
 * Deneysel özellik aktif mi
 *
 * @param {string} featureName - EXPERIMENTAL_FEATURES key'i
 * @returns {boolean}
 */
export function isExperimentalFeatureEnabled(featureName) {
    return FeatureFlags.EXPERIMENTAL_FEATURES[featureName] === true;
}

/**
 * Debug modu aktif mi
 *
 * @param {string} debugName - DEBUG key'i
 * @returns {boolean}
 */
export function isDebugEnabled(debugName) {
    // Development ortamında localStorage override
    const storageKey = `omnex_debug_${debugName.toLowerCase()}`;
    const storedValue = localStorage.getItem(storageKey);

    if (storedValue !== null) {
        return storedValue === 'true';
    }

    return FeatureFlags.DEBUG[debugName] === true;
}

/**
 * Tüm feature flag durumlarını al
 *
 * @returns {Object}
 */
export function getAllFlags() {
    return {
        v7EditorEnabled: isV7EditorEnabled(),
        experimentalFeatures: { ...FeatureFlags.EXPERIMENTAL_FEATURES },
        debug: { ...FeatureFlags.DEBUG }
    };
}

/**
 * Feature flags'ı konsola yazdır (debug için)
 */
export function logFeatureFlags() {
    console.group('[Editor v7] Feature Flags');
    console.log('v7 Editor Enabled:', isV7EditorEnabled());
    console.log('Experimental Features:', FeatureFlags.EXPERIMENTAL_FEATURES);
    console.log('Debug Flags:', FeatureFlags.DEBUG);
    console.groupEnd();
}

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default {
    FeatureFlags,
    isV7EditorEnabled,
    setV7EditorEnabled,
    resetV7EditorSetting,
    isExperimentalFeatureEnabled,
    isDebugEnabled,
    getAllFlags,
    logFeatureFlags
};
