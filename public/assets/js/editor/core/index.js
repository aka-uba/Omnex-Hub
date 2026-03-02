/**
 * Editor v7 Core Modülleri
 *
 * Tüm core modülleri tek bir noktadan export eder.
 *
 * KULLANIM:
 * ```javascript
 * import {
 *     eventBus,
 *     EVENTS,
 *     CUSTOM_PROPS,
 *     CUSTOM_TYPES,
 *     Canvas,
 *     FabricImage,
 *     convertCanvasJSON
 * } from './editor/core/index.js';
 * ```
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

// ==========================================
// EVENT BUS
// ==========================================

export {
    eventBus,
    EventBus,
    EVENTS
} from './EventBus.js';

// ==========================================
// CUSTOM PROPERTIES
// ==========================================

export {
    CUSTOM_PROPS,
    CUSTOM_TYPES,
    DYNAMIC_FIELDS,
    BARCODE_FORMATS,
    SERIALIZABLE_PROPS,
    HISTORY_EXCLUDED_PROPS,
    TRANSIENT_TYPES,
    isTransient,
    shouldExcludeFromHistory
} from './CustomProperties.js';

// ==========================================
// FABRIC EXPORTS
// ==========================================

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
} from './FabricExports.js';

// ==========================================
// LEGACY ADAPTER
// ==========================================

export {
    convertCanvasJSON,
    convertToV5Format,
    convertTemplate,
    loadCanvasWithAdapter,
    exportAsV5,
    detectVersion,
    hasLegacyOrigin,
    analyzeOrigins
} from './LegacyAdapter.js';

// Default import for legacy adapter
export { default as LegacyAdapter } from './LegacyAdapter.js';
