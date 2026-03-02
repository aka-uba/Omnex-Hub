/**
 * Editor v7 Factory Modülleri
 *
 * Tüm factory modüllerini tek bir noktadan export eder.
 *
 * KULLANIM:
 * ```javascript
 * import {
 *     ObjectFactory,
 *     CanvasManager
 * } from './editor/factory/index.js';
 * ```
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

// ==========================================
// OBJECT FACTORY
// ==========================================

export { ObjectFactory, default as ObjectFactoryDefault } from './ObjectFactory.js';

// ==========================================
// CANVAS MANAGER
// ==========================================

export { CanvasManager, default as CanvasManagerDefault } from './CanvasManager.js';
