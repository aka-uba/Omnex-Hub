/**
 * Editor v7 Manager Modülleri
 *
 * Tüm manager modüllerini tek bir noktadan export eder.
 *
 * KULLANIM:
 * ```javascript
 * import {
 *     SelectionManager,
 *     HistoryManager,
 *     ClipboardManager,
 *     GridManager
 * } from './editor/managers/index.js';
 * ```
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

// ==========================================
// SELECTION MANAGER
// ==========================================

export { SelectionManager, default as SelectionManagerDefault } from './SelectionManager.js';

// ==========================================
// HISTORY MANAGER
// ==========================================

export { HistoryManager, default as HistoryManagerDefault } from './HistoryManager.js';

// ==========================================
// CLIPBOARD MANAGER
// ==========================================

export { ClipboardManager, default as ClipboardManagerDefault } from './ClipboardManager.js';

// ==========================================
// GRID MANAGER
// ==========================================

export { GridManager, default as GridManagerDefault } from './GridManager.js';
