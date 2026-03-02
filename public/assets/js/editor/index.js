/**
 * Editor v7 - Ana Export Dosyası
 *
 * Fabric.js v7.1.0 tabanlı modüler template editor.
 * Tüm modülleri tek bir noktadan export eder.
 *
 * KULLANIM:
 * ```javascript
 * // Ana editor sınıfı
 * import { TemplateEditorV7 } from './editor/index.js';
 *
 * // Veya tüm modüller
 * import {
 *     // Main Editor
 *     TemplateEditorV7,
 *
 *     // Core
 *     eventBus,
 *     EVENTS,
 *     CUSTOM_PROPS,
 *     DYNAMIC_FIELDS,
 *     fabric,
 *     LegacyAdapter,
 *
 *     // Factory
 *     ObjectFactory,
 *     CanvasManager,
 *
 *     // Managers
 *     SelectionManager,
 *     HistoryManager,
 *     ClipboardManager,
 *     GridManager,
 *
 *     // Panels
 *     PanelBase,
 *     PropertyPanel,
 *     LayersPanel,
 *     DynamicFieldsPanel,
 *
 *     // Components
 *     Toolbar
 * } from './editor/index.js';
 *
 * // Editor başlat
 * const editor = new TemplateEditorV7({
 *     container: '#editor-container',
 *     canvasId: 'template-canvas',
 *     width: 800,
 *     height: 1280
 * });
 *
 * await editor.init();
 * ```
 *
 * MODÜLLERİN KULLANIM AMACI:
 *
 * 1. CORE MODÜLLER (core/)
 *    - EventBus: Modüller arası iletişim
 *    - CustomProperties: Özel fabric.js özellikleri
 *    - FabricExports: Fabric.js sınıf exportları
 *    - LegacyAdapter: v5 format dönüştürücü
 *
 * 2. FACTORY MODÜLLER (factory/)
 *    - ObjectFactory: Fabric.js nesne oluşturucu
 *    - CanvasManager: Canvas başlatma ve yönetim
 *
 * 3. MANAGER MODÜLLER (managers/)
 *    - SelectionManager: Seçim işlemleri
 *    - HistoryManager: Undo/Redo
 *    - ClipboardManager: Kopyala/Kes/Yapıştır
 *    - GridManager: Grid ve snap
 *
 * 4. PANEL MODÜLLER (panels/)
 *    - PanelBase: Panel temel sınıfı
 *    - PropertyPanel: Nesne özellikleri
 *    - LayersPanel: Katman yönetimi
 *    - DynamicFieldsPanel: Dinamik alan seçici
 *
 * 5. COMPONENT MODÜLLER (components/)
 *    - Toolbar: Araç çubuğu bileşeni
 *
 * @version 7.0.0
 * @author Omnex Display Hub
 */

// ==========================================
// MAIN EDITOR
// ==========================================

export { TemplateEditorV7, default as TemplateEditorV7Default } from './TemplateEditorV7.js';

// ==========================================
// CORE MODULES
// ==========================================

export {
    eventBus,
    EventBus,
    EVENTS
} from './core/EventBus.js';

export {
    // Constants
    CUSTOM_PROPS,
    CUSTOM_TYPES,
    DYNAMIC_FIELDS,
    BARCODE_FORMATS,
    SERIALIZABLE_PROPS,
    HISTORY_EXCLUDED_PROPS,
    TRANSIENT_TYPES,

    // Helper functions
    isTransient,
    shouldExcludeFromHistory,
    setCustomProperty,
    getCustomProperty,
    hasCustomProperty,
    isDataField,
    getDynamicField,
    getCustomType,
    getObjectId
} from './core/CustomProperties.js';

export {
    // Check functions
    isFabricLoaded,
    waitForFabric,
    getExports,

    // Canvas
    Canvas,
    StaticCanvas,

    // Objects
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

    // Styles
    Gradient,
    Pattern,
    Color,

    // Utility
    util,
    Point,
    Control,

    // SVG
    loadSVGFromString,
    loadSVGFromURL,

    // Meta
    version,
    config,

    // Origin helpers
    ORIGIN,
    V5_ORIGIN,
    V7_ORIGIN,
    convertOriginV5toV7,
    convertOriginV7toV5
} from './core/FabricExports.js';

export {
    // Main functions
    convertCanvasJSON,
    convertToV5Format,
    convertTemplate,
    loadCanvasWithAdapter,
    exportAsV5,

    // Utility functions
    detectVersion,
    hasLegacyOrigin,
    analyzeOrigins,

    // Default export
    default as LegacyAdapter
} from './core/LegacyAdapter.js';

// ==========================================
// FACTORY MODULES
// ==========================================

export {
    ObjectFactory
} from './factory/ObjectFactory.js';

export {
    CanvasManager
} from './factory/CanvasManager.js';

// ==========================================
// MANAGER MODULES
// ==========================================

export {
    SelectionManager
} from './managers/SelectionManager.js';

export {
    HistoryManager
} from './managers/HistoryManager.js';

export {
    ClipboardManager
} from './managers/ClipboardManager.js';

export {
    GridManager
} from './managers/GridManager.js';

// ==========================================
// PANEL MODULES
// ==========================================

export {
    PanelBase
} from './panels/PanelBase.js';

export {
    PropertyPanel
} from './panels/PropertyPanel.js';

export {
    LayersPanel
} from './panels/LayersPanel.js';

export {
    DynamicFieldsPanel
} from './panels/DynamicFieldsPanel.js';

// ==========================================
// COMPONENT MODULES
// ==========================================

export {
    Toolbar
} from './components/Toolbar.js';

// ==========================================
// CONFIG MODULES
// ==========================================

export {
    FeatureFlags,
    isV7EditorEnabled,
    setV7EditorEnabled,
    resetV7EditorSetting,
    isExperimentalFeatureEnabled,
    isDebugEnabled,
    getAllFlags,
    logFeatureFlags
} from './config/FeatureFlags.js';

// ==========================================
// VERSION INFO
// ==========================================

/**
 * Editor versiyon bilgisi
 */
export const VERSION = {
    editor: '7.0.0',
    fabric: '7.1.0',
    releaseDate: '2026-01-30'
};

/**
 * Özellik bayrakları
 */
export const FEATURES = {
    // Core özellikler
    eventBus: true,
    customProperties: true,
    legacySupport: true,

    // Canvas özellikleri
    multiSelect: true,
    grouping: true,
    layerOrdering: true,

    // History özellikleri
    undoRedo: true,
    maxHistorySize: 50,

    // Grid özellikleri
    grid: true,
    snapToGrid: true,
    smartGuides: true,

    // Clipboard özellikleri
    clipboard: true,
    systemClipboard: true,

    // Panel özellikleri
    propertyPanel: true,
    layersPanel: true,
    dynamicFieldsPanel: true,

    // Export özellikleri
    exportPNG: true,
    exportJPEG: true,
    exportSVG: true,
    exportJSON: true
};

/**
 * Varsayılan ayarlar
 */
export const DEFAULT_CONFIG = {
    width: 800,
    height: 1280,
    backgroundColor: '#ffffff',
    gridSize: 20,
    gridEnabled: true,
    snapEnabled: true,
    smartGuidesEnabled: true,
    historyEnabled: true,
    maxHistorySize: 50
};
