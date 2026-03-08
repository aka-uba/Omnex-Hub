/**
 * FrameService.js - 9-Slice Frame Render Engine
 *
 * Renders PhotoScape-style 9-slice frames and manages their lifecycle
 * on the Fabric.js canvas. Frames are decorative overlays applied to
 * any visual object (text, image, shape).
 *
 * 9-Slice Layout:
 * ┌─────┬───────────┬─────┐
 * │ TL  │   Top     │ TR  │
 * ├─────┼───────────┼─────┤
 * │ Left│  Center   │Right│
 * ├─────┼───────────┼─────┤
 * │ BL  │  Bottom   │ BR  │
 * └─────┴───────────┴─────┘
 *
 * frameCorner: [left, top, right, bottom] - pixel sizes for corners/edges
 * frameBlank: [left, top, right, bottom] - inner padding (content inset)
 * frameType: 'opaque' | 'transparent' | 'transparent_resize' | 'transparent_tile'
 * frameBorder: 'tile' | 'stretch'
 */

import { CUSTOM_PROPS, CUSTOM_TYPES } from '../core/CustomProperties.js';
import { getFrameImagePath } from '../data/FrameAssetsData.js';

export class FrameService {

    constructor() {
        /** @type {Map<string, HTMLImageElement>} Image cache: frameId → loaded Image */
        this._imageCache = new Map();

        /** @type {Map<string, string>} Render cache: key → dataURL */
        this._renderCache = new Map();

        /** @type {number} Max render cache entries (LRU eviction) */
        this._maxCacheSize = 50;

        /** @type {Map<string, number>} Debounce timers per objectId */
        this._updateTimers = new Map();

        /** @type {number} Debounce delay ms */
        this._debounceMs = 100;

        /** @type {Map<string, boolean>} Opaque frame center fill policy cache */
        this._centerFillPolicyCache = new Map();
    }

    /**
     * Load a frame image (with cache)
     * @param {Object} frameDef - Frame definition from FrameAssetsData
     * @returns {Promise<HTMLImageElement>}
     */
    async _loadFrameImage(frameDef) {
        if (this._imageCache.has(frameDef.id)) {
            return this._imageCache.get(frameDef.id);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this._imageCache.set(frameDef.id, img);
                resolve(img);
            };
            img.onerror = () => reject(new Error(`Failed to load frame: ${frameDef.id}`));
            img.src = getFrameImagePath(frameDef);
        });
    }

    /**
     * Generate render cache key
     */
    _cacheKey(frameId, w, h, frameColor = '') {
        return `${frameId}_${Math.round(w)}_${Math.round(h)}_${String(frameColor || '').toLowerCase()}`;
    }

    /**
     * Evict oldest cache entry if over limit
     */
    _evictCache() {
        if (this._renderCache.size >= this._maxCacheSize) {
            const firstKey = this._renderCache.keys().next().value;
            this._renderCache.delete(firstKey);
        }
    }

    /**
     * Render a 9-slice frame to a dataURL
     *
     * @param {Object} frameDef - Frame definition
     * @param {number} targetW - Target width
     * @param {number} targetH - Target height
     * @returns {Promise<string>} dataURL (PNG)
     */
    async renderFrame(frameDef, targetW, targetH, options = {}) {
        const tintColor = String(options?.tintColor || '').trim();
        const key = this._cacheKey(frameDef.id, targetW, targetH, tintColor);

        if (this._renderCache.has(key)) {
            return this._renderCache.get(key);
        }

        const img = await this._loadFrameImage(frameDef);
        const srcW = img.naturalWidth;
        const srcH = img.naturalHeight;

        const [cL, cT, cR, cB] = frameDef.frameCorner;

        // For transparent_resize type: scale entire image to target
        if (frameDef.frameType === 'transparent_resize') {
            return this._renderResizeFrame(img, targetW, targetH, key, tintColor, frameDef);
        }

        // For transparent_tile: tile entire image
        if (frameDef.frameType === 'transparent_tile') {
            return this._renderTileFrame(img, targetW, targetH, key, tintColor, frameDef);
        }

        // Standard 9-slice rendering
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(targetW);
        canvas.height = Math.round(targetH);
        const ctx = canvas.getContext('2d');

        // Scale corner sizes proportionally if target is smaller than source corners
        let sL = cL, sT = cT, sR = cR, sB = cB;
        const minW = sL + sR;
        const minH = sT + sB;

        if (targetW < minW && minW > 0) {
            const ratio = targetW / minW;
            sL = Math.floor(sL * ratio);
            sR = Math.floor(sR * ratio);
        }
        if (targetH < minH && minH > 0) {
            const ratio = targetH / minH;
            sT = Math.floor(sT * ratio);
            sB = Math.floor(sB * ratio);
        }

        const centerW = Math.max(0, targetW - sL - sR);
        const centerH = Math.max(0, targetH - sT - sB);
        const srcCenterW = Math.max(0, srcW - cL - cR);
        const srcCenterH = Math.max(0, srcH - cT - cB);

        const isTile = frameDef.frameBorder === 'tile';

        // 1. Four corners (always drawn at original ratio, scaled to fit)
        // Top-Left
        if (sL > 0 && sT > 0) {
            ctx.drawImage(img, 0, 0, cL, cT, 0, 0, sL, sT);
        }
        // Top-Right
        if (sR > 0 && sT > 0) {
            ctx.drawImage(img, srcW - cR, 0, cR, cT, targetW - sR, 0, sR, sT);
        }
        // Bottom-Left
        if (sL > 0 && sB > 0) {
            ctx.drawImage(img, 0, srcH - cB, cL, cB, 0, targetH - sB, sL, sB);
        }
        // Bottom-Right
        if (sR > 0 && sB > 0) {
            ctx.drawImage(img, srcW - cR, srcH - cB, cR, cB, targetW - sR, targetH - sB, sR, sB);
        }

        // 2. Four edges
        if (centerW > 0) {
            // Top edge
            if (sT > 0 && srcCenterW > 0) {
                this._drawEdge(ctx, img, cL, 0, srcCenterW, cT, sL, 0, centerW, sT, isTile);
            }
            // Bottom edge
            if (sB > 0 && srcCenterW > 0) {
                this._drawEdge(ctx, img, cL, srcH - cB, srcCenterW, cB, sL, targetH - sB, centerW, sB, isTile);
            }
        }
        if (centerH > 0) {
            // Left edge
            if (sL > 0 && srcCenterH > 0) {
                this._drawEdge(ctx, img, 0, cT, cL, srcCenterH, 0, sT, sL, centerH, isTile);
            }
            // Right edge
            if (sR > 0 && srcCenterH > 0) {
                this._drawEdge(ctx, img, srcW - cR, cT, cR, srcCenterH, targetW - sR, sT, sR, centerH, isTile);
            }
        }

        // 3. Center
        if (centerW > 0 && centerH > 0 && srcCenterW > 0 && srcCenterH > 0) {
            if (frameDef.frameType === 'opaque' && this._shouldFillOpaqueCenter(frameDef, img, cL, cT, cR, cB)) {
                // Opaque: fill center
                if (isTile) {
                    this._tileRegion(ctx, img, cL, cT, srcCenterW, srcCenterH, sL, sT, centerW, centerH);
                } else {
                    ctx.drawImage(img, cL, cT, srcCenterW, srcCenterH, sL, sT, centerW, centerH);
                }
            }
            // transparent: leave center empty (content shows through)
        }

        this._applyTintOnCanvas(canvas, tintColor, frameDef);
        const dataURL = canvas.toDataURL('image/png');

        this._evictCache();
        this._renderCache.set(key, dataURL);

        return dataURL;
    }

    /**
     * Draw an edge region (tile or stretch)
     */
    _drawEdge(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, isTile) {
        if (isTile) {
            this._tileRegion(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh);
        } else {
            ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
        }
    }

    /**
     * Tile a source region across destination area
     */
    _tileRegion(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh) {
        if (sw <= 0 || sh <= 0) return;

        ctx.save();
        ctx.beginPath();
        ctx.rect(dx, dy, dw, dh);
        ctx.clip();

        for (let y = 0; y < dh; y += sh) {
            for (let x = 0; x < dw; x += sw) {
                const drawW = Math.min(sw, dw - x);
                const drawH = Math.min(sh, dh - y);
                ctx.drawImage(img, sx, sy, drawW, drawH, dx + x, dy + y, drawW, drawH);
            }
        }

        ctx.restore();
    }

    /**
     * Render transparent_resize type (scale entire image)
     */
    _renderResizeFrame(img, targetW, targetH, cacheKey, tintColor = '', frameDef = null) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(targetW);
        canvas.height = Math.round(targetH);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetW, targetH);

        this._applyTintOnCanvas(canvas, tintColor, frameDef);
        const dataURL = canvas.toDataURL('image/png');
        this._evictCache();
        this._renderCache.set(cacheKey, dataURL);
        return dataURL;
    }

    /**
     * Render transparent_tile type (tile entire image)
     */
    _renderTileFrame(img, targetW, targetH, cacheKey, tintColor = '', frameDef = null) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(targetW);
        canvas.height = Math.round(targetH);
        const ctx = canvas.getContext('2d');

        const sw = img.naturalWidth;
        const sh = img.naturalHeight;
        if (sw > 0 && sh > 0) {
            for (let y = 0; y < targetH; y += sh) {
                for (let x = 0; x < targetW; x += sw) {
                    ctx.drawImage(img, x, y);
                }
            }
        }

        this._applyTintOnCanvas(canvas, tintColor, frameDef);
        const dataURL = canvas.toDataURL('image/png');
        this._evictCache();
        this._renderCache.set(cacheKey, dataURL);
        return dataURL;
    }

    _isHexColor(value) {
        return /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
    }

    _shouldFillOpaqueCenter(frameDef, img, cL = 0, cT = 0, cR = 0, cB = 0) {
        const id = String(frameDef?.id || '').toLowerCase();
        if (this._centerFillPolicyCache.has(id)) {
            return this._centerFillPolicyCache.get(id);
        }

        const noCenterFillIds = new Set([
            'dot01',
            'dot02',
            'film01',
            'ilm01',
            'christmas_stick01',
            'christmas_stick02',
            'christmas_stick03',
            'christmas_stick04'
        ]);
        if (noCenterFillIds.has(id)) {
            this._centerFillPolicyCache.set(id, false);
            return false;
        }

        try {
            const srcW = Math.max(1, Number(img?.naturalWidth || 0));
            const srcH = Math.max(1, Number(img?.naturalHeight || 0));
            const centerW = Math.max(0, srcW - Math.max(0, cL) - Math.max(0, cR));
            const centerH = Math.max(0, srcH - Math.max(0, cT) - Math.max(0, cB));
            if (centerW < 2 || centerH < 2) {
                this._centerFillPolicyCache.set(id, false);
                return false;
            }

            const sampleSize = 48;
            const probe = document.createElement('canvas');
            probe.width = sampleSize;
            probe.height = sampleSize;
            const ctx = probe.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                this._centerFillPolicyCache.set(id, true);
                return true;
            }

            ctx.clearRect(0, 0, sampleSize, sampleSize);
            ctx.drawImage(img, cL, cT, centerW, centerH, 0, 0, sampleSize, sampleSize);
            const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

            let transparent = 0;
            let total = 0;
            for (let i = 3; i < data.length; i += 4) {
                total += 1;
                if (data[i] < 20) transparent += 1;
            }
            const transparentRatio = total > 0 ? (transparent / total) : 0;
            const shouldFill = transparentRatio < 0.015;
            this._centerFillPolicyCache.set(id, shouldFill);
            return shouldFill;
        } catch (err) {
            this._centerFillPolicyCache.set(id, true);
            return true;
        }
    }

    _applyTintOnCanvas(canvas, tintColor, frameDef = null) {
        const color = String(tintColor || '').trim();
        if (!this._isHexColor(color)) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const blanks = Array.isArray(frameDef?.frameBlank) ? frameDef.frameBlank : [0, 0, 0, 0];
        const [bLRaw, bTRaw, bRRaw, bBRaw] = blanks.map((v) => Math.max(0, Number(v) || 0));
        const hasInnerArea = bLRaw > 0 || bTRaw > 0 || bRRaw > 0 || bBRaw > 0;

        // Preserve alpha and texture while tinting visible pixels.
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = color;

        if (hasInnerArea) {
            const w = Math.max(1, canvas.width);
            const h = Math.max(1, canvas.height);
            const bL = Math.min(w, bLRaw);
            const bT = Math.min(h, bTRaw);
            const bR = Math.min(w, bRRaw);
            const bB = Math.min(h, bBRaw);

            // Tint only border strips so frame color does not flood inner content.
            if (bT > 0) ctx.fillRect(0, 0, w, bT);
            if (bB > 0) ctx.fillRect(0, h - bB, w, bB);
            if (bL > 0 && h - bT - bB > 0) ctx.fillRect(0, bT, bL, h - bT - bB);
            if (bR > 0 && h - bT - bB > 0) ctx.fillRect(w - bR, bT, bR, h - bT - bB);
        } else {
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.restore();
    }

    /**
     * Calculate the outer frame dimensions for a target object.
     * Frame sits on the object's own bounds so border is visible on/inside object.
     * Do not expand by frameBlank; expanding pushes border outside and makes
     * interior border look missing for filled objects.
     */
    _getFrameDimensions(targetObj, frameDef) {
        const [bL, bT, bR, bB] = frameDef.frameBlank;
        const objW = (targetObj.width || 100) * (targetObj.scaleX || 1);
        const objH = (targetObj.height || 100) * (targetObj.scaleY || 1);
        // Keep frame exactly on object box to ensure inner border remains visible.
        const frameW = Math.max(1, objW);
        const frameH = Math.max(1, objH);

        // Keep blank values for metadata compatibility, but do not use as offset.
        return { frameW, frameH, objW, objH, bL: 0, bT: 0, bR: 0, bB: 0 };
    }

    /**
     * Resolve object's center in canvas coordinates.
     */
    _getObjectCanvasCenter(targetObj) {
        if (!targetObj) return { x: 0, y: 0 };

        if (typeof targetObj.getCenterPoint === 'function') {
            const center = targetObj.getCenterPoint();
            const x = Number(center?.x);
            const y = Number(center?.y);
            if (Number.isFinite(x) && Number.isFinite(y)) {
                return { x, y };
            }
        }

        return {
            x: Number(targetObj.left) || 0,
            y: Number(targetObj.top) || 0
        };
    }

    /**
     * Apply a frame to a target object on the canvas
     *
     * @param {Object} targetObj - Fabric.js object to frame
     * @param {Object} frameDef - Frame definition from FrameAssetsData
     * @param {Object} canvas - Fabric.js canvas instance
     * @returns {Promise<Object|null>} The created frame overlay object
     */
    async applyFrame(targetObj, frameDef, canvas) {
        if (!targetObj || !frameDef || !canvas) return null;

        // Remove existing frame first
        this.removeFrame(targetObj, canvas);

        const { frameW, frameH, bL, bT, bR, bB } = this._getFrameDimensions(targetObj, frameDef);
        // Apply frame's default tint on first add/change when defined.
        // If no defaultColor exists, keep original frame design (no tint).
        const defaultColorRaw = String(frameDef.defaultColor || '').trim();
        const frameColor = /^#[0-9a-fA-F]{6}$/.test(defaultColorRaw) ? defaultColorRaw : '#000000';

        // Render the 9-slice frame
        const dataURL = await this.renderFrame(frameDef, frameW, frameH, {
            tintColor: frameColor
        });

        // Create fabric.Image from dataURL
        const frameObj = await new Promise((resolve) => {
            const fabric = window.fabric;
            fabric.FabricImage.fromURL(dataURL, { crossOrigin: 'anonymous' }).then(img => {
                resolve(img);
            });
        });

        if (!frameObj) return null;

        // Generate IDs
        const targetId = targetObj[CUSTOM_PROPS.OBJECT_ID] || this._generateId();
        if (!targetObj[CUSTOM_PROPS.OBJECT_ID]) {
            targetObj[CUSTOM_PROPS.OBJECT_ID] = targetId;
        }

        const frameObjId = this._generateId();

        // Position frame: center content area on target center
        const targetCenter = this._getObjectCanvasCenter(targetObj);

        // With center origin: frame center must be offset so that the
        // content area (inside blanks) is centered on the target.
        // Content center relative to frame center = (bL - bR)/2 horizontally
        // So: frameCenterX + (bL - bR)/2 = targetCenterX
        //     frameCenterX = targetCenterX - (bL - bR)/2
        frameObj.set({
            left: targetCenter.x - (bL - bR) / 2,
            top: targetCenter.y - (bT - bB) / 2,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true,
            excludeFromExport: false,
            // Custom properties
            [CUSTOM_PROPS.CUSTOM_TYPE]: CUSTOM_TYPES.FRAME_OVERLAY,
            custom_type: CUSTOM_TYPES.FRAME_OVERLAY,
            [CUSTOM_PROPS.OBJECT_ID]: frameObjId,
            [CUSTOM_PROPS.FRAME_ID]: frameDef.id,
            [CUSTOM_PROPS.FRAME_TARGET_ID]: targetId,
            [CUSTOM_PROPS.FRAME_OVERLAY_ID]: frameObjId,
            [CUSTOM_PROPS.FRAME_COLOR]: frameColor || '',
            [CUSTOM_PROPS.OBJECT_NAME]: `Frame: ${frameDef.title}`
        });

        // Store offset for lightweight move sync (center origin formula)
        frameObj._frameOffsetLeft = -(bL - bR) / 2;
        frameObj._frameOffsetTop = -(bT - bB) / 2;

        // Set frame reference on target object
        targetObj[CUSTOM_PROPS.FRAME_ID] = frameDef.id;
        targetObj[CUSTOM_PROPS.FRAME_OVERLAY_ID] = frameObjId;
        targetObj[CUSTOM_PROPS.FRAME_COLOR] = frameColor || '';

        // Add frame overlay and keep it just above target
        canvas.add(frameObj);
        this.syncZOrder(targetObj, canvas);

        canvas.requestRenderAll();
        return frameObj;
    }

    /**
     * Remove frame from a target object
     *
     * @param {Object} targetObj - Fabric.js object
     * @param {Object} canvas - Fabric.js canvas
     */
    removeFrame(targetObj, canvas) {
        if (!targetObj || !canvas) return;

        const frameOverlayId = targetObj[CUSTOM_PROPS.FRAME_OVERLAY_ID];
        if (!frameOverlayId) return;

        // Find and remove the frame overlay object
        const objects = canvas.getObjects();
        for (let i = objects.length - 1; i >= 0; i--) {
            const obj = objects[i];
            if (obj[CUSTOM_PROPS.OBJECT_ID] === frameOverlayId &&
                this._isOverlayObject(obj)) {
                canvas.remove(obj);
                break;
            }
        }

        // Clear frame props from target
        delete targetObj[CUSTOM_PROPS.FRAME_ID];
        delete targetObj[CUSTOM_PROPS.FRAME_OVERLAY_ID];

        canvas.requestRenderAll();
    }

    /**
     * Update frame position/size after target object changes (debounced)
     *
     * @param {Object} targetObj - Modified target object
     * @param {Object} canvas - Fabric.js canvas
     */
    updateFrame(targetObj, canvas) {
        if (!targetObj || !canvas) return;

        const frameId = targetObj[CUSTOM_PROPS.FRAME_ID];
        const frameOverlayId = targetObj[CUSTOM_PROPS.FRAME_OVERLAY_ID];
        if (!frameId || !frameOverlayId) return;

        const targetId = targetObj[CUSTOM_PROPS.OBJECT_ID] || '';

        // Clear existing timer
        if (this._updateTimers.has(targetId)) {
            clearTimeout(this._updateTimers.get(targetId));
        }

        // Debounce
        this._updateTimers.set(targetId, setTimeout(async () => {
            this._updateTimers.delete(targetId);
            await this._doUpdateFrame(targetObj, canvas, frameId, frameOverlayId);
        }, this._debounceMs));
    }

    /**
     * Immediate frame update (no debounce)
     */
    async _doUpdateFrame(targetObj, canvas, frameId, frameOverlayId) {
        try {
            const { getFrameById } = await import('../data/FrameAssetsData.js');
            const frameDef = getFrameById(frameId);
            if (!frameDef) return;

            const { frameW, frameH, bL, bT, bR, bB } = this._getFrameDimensions(targetObj, frameDef);
            const frameColor = targetObj[CUSTOM_PROPS.FRAME_COLOR] || '';

            // Render at new size
            const dataURL = await this.renderFrame(frameDef, frameW, frameH, {
                tintColor: frameColor
            });

            // Find existing frame overlay
            const frameObj = canvas.getObjects().find(
                obj => obj[CUSTOM_PROPS.OBJECT_ID] === frameOverlayId &&
                       this._isOverlayObject(obj)
            );

            if (!frameObj) return;

            // Update frame image
            const fabric = window.fabric;
            const newImg = await fabric.FabricImage.fromURL(dataURL, { crossOrigin: 'anonymous' });

            // Update position (center origin formula)
            const targetCenter = this._getObjectCanvasCenter(targetObj);
            frameObj.set({
                left: targetCenter.x - (bL - bR) / 2,
                top: targetCenter.y - (bT - bB) / 2,
                scaleX: 1,
                scaleY: 1,
                [CUSTOM_PROPS.FRAME_COLOR]: frameColor || ''
            });

            // Update offset for move sync
            frameObj._frameOffsetLeft = -(bL - bR) / 2;
            frameObj._frameOffsetTop = -(bT - bB) / 2;

            // Replace image source
            frameObj.setElement(newImg.getElement());
            frameObj.set({ width: newImg.width, height: newImg.height });

            // Keep frame overlay just above target
            this.syncZOrder(targetObj, canvas);

            canvas.requestRenderAll();
        } catch (err) {
            console.warn('[FrameService] Update frame failed:', err);
        }
    }

    /**
     * Check if an object has a frame applied
     */
    hasFrame(obj) {
        if (!obj) return false;
        return !!(obj[CUSTOM_PROPS.FRAME_ID] && obj[CUSTOM_PROPS.FRAME_OVERLAY_ID]);
    }

    /**
     * Check if an object is a frame overlay
     */
    isFrameOverlay(obj) {
        return this._isOverlayObject(obj);
    }

    /**
     * Ensure the frame overlay stays immediately above its target.
     * Call after any z-order change (bring forward, send backward, etc.)
     */
    syncZOrder(targetObj, canvas) {
        if (!targetObj || !canvas) return;

        const overlayId = targetObj[CUSTOM_PROPS.FRAME_OVERLAY_ID];
        if (!overlayId) return;

        const objects = canvas.getObjects();
        const frameObj = objects.find(
            o => o[CUSTOM_PROPS.OBJECT_ID] === overlayId &&
                 this._isOverlayObject(o)
        );
        if (!frameObj) return;

        const targetIndex = objects.indexOf(targetObj);
        const frameIndex = objects.indexOf(frameObj);
        if (targetIndex < 0 || frameIndex < 0) return;

        // Already correct: frame is just above target
        if (frameIndex === targetIndex + 1) return;

        // moveObjectTo removes first, then inserts.
        // We need frame right above target after the move:
        // - If frame is below target: removing frame shifts target index down by 1
        //   -> insert at original targetIndex.
        // - If frame is above target: removing frame does not change target index
        //   -> insert at targetIndex + 1.
        if (frameIndex < targetIndex) {
            canvas.moveObjectTo(frameObj, targetIndex);
        } else {
            canvas.moveObjectTo(frameObj, targetIndex + 1);
        }
    }

    /**
     * Sync z-order for ALL framed objects on canvas.
     * Useful after bulk reorder or undo/redo.
     */
    syncAllZOrders(canvas) {
        if (!canvas) return;

        const objects = canvas.getObjects();
        for (const obj of objects) {
            if (this.hasFrame(obj)) {
                this.syncZOrder(obj, canvas);
            }
        }
    }

    /**
     * After template load: reconnect frame overlays with their targets
     * and fix z-order
     */
    reconnectFrames(canvas) {
        if (!canvas) return;

        const objects = canvas.getObjects();
        const overlays = objects.filter(o => this._isOverlayObject(o));

        for (const overlay of overlays) {
            const targetId = overlay[CUSTOM_PROPS.FRAME_TARGET_ID];
            if (!targetId) continue;

            const target = objects.find(o => o[CUSTOM_PROPS.OBJECT_ID] === targetId);
            if (!target) {
                // Target not found - orphan frame, remove it
                canvas.remove(overlay);
                continue;
            }

            // Ensure frame overlay is above target
            this.syncZOrder(target, canvas);

            // Make frame non-interactive
            overlay.set({
                [CUSTOM_PROPS.CUSTOM_TYPE]: CUSTOM_TYPES.FRAME_OVERLAY,
                custom_type: CUSTOM_TYPES.FRAME_OVERLAY,
                selectable: false,
                evented: false,
                hasControls: false,
                hasBorders: false,
                lockMovementX: true,
                lockMovementY: true
            });
        }

        canvas.requestRenderAll();
    }

    /**
     * Generate a simple UUID
     */
    _generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    _readCustomType(obj) {
        return String(
            obj?.[CUSTOM_PROPS.CUSTOM_TYPE] ||
            obj?.customType ||
            obj?.custom_type ||
            obj?.get?.(CUSTOM_PROPS.CUSTOM_TYPE) ||
            ''
        ).toLowerCase();
    }

    _isOverlayObject(obj) {
        if (!obj) return false;
        if (this._readCustomType(obj) === CUSTOM_TYPES.FRAME_OVERLAY) return true;
        return !!(obj[CUSTOM_PROPS.FRAME_TARGET_ID] && obj[CUSTOM_PROPS.FRAME_ID]);
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this._imageCache.clear();
        this._renderCache.clear();
    }

    /**
     * Dispose / cleanup
     */
    dispose() {
        for (const timer of this._updateTimers.values()) {
            clearTimeout(timer);
        }
        this._updateTimers.clear();
        this.clearCache();
    }
}
