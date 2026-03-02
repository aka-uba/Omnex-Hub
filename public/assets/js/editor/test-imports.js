/**
 * Editor v7 Import Test
 *
 * Bu dosya tüm modüllerin doğru export/import yapısına sahip olduğunu doğrular.
 * Tarayıcı konsolunda hata yoksa tüm import'lar çalışıyor demektir.
 *
 * TEST:
 * 1. Bu dosyayı bir HTML sayfasında import edin
 * 2. Konsolu açın
 * 3. "All imports successful!" mesajını görmelisiniz
 *
 * @version 1.0.0
 */

// ==========================================
// MAIN EXPORTS TEST
// ==========================================

import {
    // Main Editor
    TemplateEditorV7,

    // Core - EventBus
    eventBus,
    EventBus,
    EVENTS,

    // Core - CustomProperties
    CUSTOM_PROPS,
    CUSTOM_TYPES,
    DYNAMIC_FIELDS,
    BARCODE_FORMATS,
    SERIALIZABLE_PROPS,
    HISTORY_EXCLUDED_PROPS,
    TRANSIENT_TYPES,
    isTransient,
    shouldExcludeFromHistory,
    setCustomProperty,
    getCustomProperty,
    hasCustomProperty,
    isDataField,
    getDynamicField,
    getCustomType,
    getObjectId,

    // Core - FabricExports
    isFabricLoaded,
    waitForFabric,
    getExports,
    Canvas,
    StaticCanvas,
    FabricObject,
    FabricImage,
    FabricText,
    IText,
    Textbox,
    Rect,
    Circle,
    Ellipse,
    Triangle,
    Line,
    Polyline,
    Polygon,
    Path,
    Group,
    ActiveSelection,
    Gradient,
    Pattern,
    Color,
    util,
    Point,
    Control,
    loadSVGFromString,
    loadSVGFromURL,
    version,
    config,
    ORIGIN,
    V5_ORIGIN,
    V7_ORIGIN,
    convertOriginV5toV7,
    convertOriginV7toV5,

    // Core - LegacyAdapter
    convertCanvasJSON,
    convertToV5Format,
    convertTemplate,
    loadCanvasWithAdapter,
    exportAsV5,
    detectVersion,
    hasLegacyOrigin,
    analyzeOrigins,
    LegacyAdapter,

    // Factory
    ObjectFactory,
    CanvasManager,

    // Managers
    SelectionManager,
    HistoryManager,
    ClipboardManager,
    GridManager,

    // Panels
    PanelBase,
    PropertyPanel,
    LayersPanel,
    DynamicFieldsPanel,

    // Components
    Toolbar,

    // Config
    FeatureFlags,
    isV7EditorEnabled,
    setV7EditorEnabled,
    resetV7EditorSetting,
    isExperimentalFeatureEnabled,
    isDebugEnabled,
    getAllFlags,
    logFeatureFlags,

    // Version Info
    VERSION,
    FEATURES,
    DEFAULT_CONFIG
} from './index.js';

// ==========================================
// VALIDATION
// ==========================================

const requiredExports = {
    // Main Editor
    TemplateEditorV7: typeof TemplateEditorV7,

    // Core - EventBus
    eventBus: typeof eventBus,
    EventBus: typeof EventBus,
    EVENTS: typeof EVENTS,

    // Core - CustomProperties
    CUSTOM_PROPS: typeof CUSTOM_PROPS,
    CUSTOM_TYPES: typeof CUSTOM_TYPES,
    DYNAMIC_FIELDS: typeof DYNAMIC_FIELDS,
    isTransient: typeof isTransient,
    setCustomProperty: typeof setCustomProperty,
    getCustomProperty: typeof getCustomProperty,

    // Core - FabricExports
    waitForFabric: typeof waitForFabric,
    Canvas: typeof Canvas,
    Rect: typeof Rect,
    FabricText: typeof FabricText,
    FabricImage: typeof FabricImage,
    Group: typeof Group,

    // Core - LegacyAdapter
    convertCanvasJSON: typeof convertCanvasJSON,
    loadCanvasWithAdapter: typeof loadCanvasWithAdapter,
    detectVersion: typeof detectVersion,
    LegacyAdapter: typeof LegacyAdapter,

    // Factory
    ObjectFactory: typeof ObjectFactory,
    CanvasManager: typeof CanvasManager,

    // Managers
    SelectionManager: typeof SelectionManager,
    HistoryManager: typeof HistoryManager,
    ClipboardManager: typeof ClipboardManager,
    GridManager: typeof GridManager,

    // Panels
    PanelBase: typeof PanelBase,
    PropertyPanel: typeof PropertyPanel,
    LayersPanel: typeof LayersPanel,
    DynamicFieldsPanel: typeof DynamicFieldsPanel,

    // Components
    Toolbar: typeof Toolbar,

    // Config
    FeatureFlags: typeof FeatureFlags,
    isV7EditorEnabled: typeof isV7EditorEnabled,
    setV7EditorEnabled: typeof setV7EditorEnabled,

    // Version Info
    VERSION: typeof VERSION,
    FEATURES: typeof FEATURES,
    DEFAULT_CONFIG: typeof DEFAULT_CONFIG
};

// Kontrol et
let allValid = true;
const errors = [];

for (const [name, type] of Object.entries(requiredExports)) {
    if (type === 'undefined') {
        allValid = false;
        errors.push(`Missing export: ${name}`);
    }
}

// Sonucu raporla
if (allValid) {
    console.log('%c✓ All imports successful!', 'color: green; font-weight: bold; font-size: 14px');
    console.log('Editor v7 Modules:', requiredExports);
} else {
    console.error('%c✗ Import errors found:', 'color: red; font-weight: bold; font-size: 14px');
    errors.forEach(err => console.error('  -', err));
}

// Export test sonuçları
export { requiredExports, allValid, errors };
