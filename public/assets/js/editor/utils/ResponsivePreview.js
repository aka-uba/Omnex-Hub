/**
 * ResponsivePreview - Farklı Cihaz Boyutlarında Şablon Önizleme
 *
 * ResponsiveScaler.php'nin JS versiyonu. Editor toolbar'ından
 * çağrılır, seçilen device preset boyutunda şablonun nasıl
 * görüneceğini modal içinde gösterir.
 *
 * @version 1.0.0
 */

import { CUSTOM_PROPS } from '../core/CustomProperties.js';

/**
 * Standart grid layout tanımları (DevicePresets.js ile senkron)
 */
const GRID_LAYOUTS = {
    'single': [
        { id: 'main', x: 0, y: 0, widthPercent: 100, heightPercent: 100 }
    ],
    'split-horizontal': [
        { id: 'left', x: 0, y: 0, widthPercent: 50, heightPercent: 100 },
        { id: 'right', x: 50, y: 0, widthPercent: 50, heightPercent: 100 }
    ],
    'split-vertical': [
        { id: 'top', x: 0, y: 0, widthPercent: 100, heightPercent: 50 },
        { id: 'bottom', x: 0, y: 50, widthPercent: 100, heightPercent: 50 }
    ],
    'grid-2x2': [
        { id: 'top-left', x: 0, y: 0, widthPercent: 50, heightPercent: 50 },
        { id: 'top-right', x: 50, y: 0, widthPercent: 50, heightPercent: 50 },
        { id: 'bottom-left', x: 0, y: 50, widthPercent: 50, heightPercent: 50 },
        { id: 'bottom-right', x: 50, y: 50, widthPercent: 50, heightPercent: 50 }
    ],
    'header-content': [
        { id: 'header', x: 0, y: 0, widthPercent: 100, heightPercent: 20 },
        { id: 'content', x: 0, y: 20, widthPercent: 100, heightPercent: 80 }
    ],
    'header-content-footer': [
        { id: 'header', x: 0, y: 0, widthPercent: 100, heightPercent: 15 },
        { id: 'content', x: 0, y: 15, widthPercent: 100, heightPercent: 70 },
        { id: 'footer', x: 0, y: 85, widthPercent: 100, heightPercent: 15 }
    ],
    'sidebar-content': [
        { id: 'sidebar', x: 0, y: 0, widthPercent: 30, heightPercent: 100 },
        { id: 'content', x: 30, y: 0, widthPercent: 70, heightPercent: 100 }
    ],
    'media-labels': [
        { id: 'media', x: 0, y: 0, widthPercent: 100, heightPercent: 40 },
        { id: 'labels', x: 0, y: 40, widthPercent: 100, heightPercent: 60 }
    ]
};

/**
 * Ölçek faktörlerini hesapla
 */
function computeScaleFactors(srcW, srcH, dstW, dstH, policy = 'contain') {
    const rawScaleX = dstW / Math.max(1, srcW);
    const rawScaleY = dstH / Math.max(1, srcH);

    switch (policy) {
        case 'contain': {
            const uniformScale = Math.min(rawScaleX, rawScaleY);
            const effectiveW = srcW * uniformScale;
            const effectiveH = srcH * uniformScale;
            return {
                scaleX: uniformScale,
                scaleY: uniformScale,
                offsetX: (dstW - effectiveW) / 2,
                offsetY: (dstH - effectiveH) / 2
            };
        }
        case 'cover': {
            const uniformScale = Math.max(rawScaleX, rawScaleY);
            const effectiveW = srcW * uniformScale;
            const effectiveH = srcH * uniformScale;
            return {
                scaleX: uniformScale,
                scaleY: uniformScale,
                offsetX: (dstW - effectiveW) / 2,
                offsetY: (dstH - effectiveH) / 2
            };
        }
        case 'stretch':
        default:
            return { scaleX: rawScaleX, scaleY: rawScaleY, offsetX: 0, offsetY: 0 };
    }
}

/**
 * Grid layout'tan bölge tanımlarını çöz
 */
function resolveRegions(gridLayoutId) {
    if (gridLayoutId && GRID_LAYOUTS[gridLayoutId]) {
        return GRID_LAYOUTS[gridLayoutId];
    }
    return GRID_LAYOUTS['single'];
}

/**
 * Tek objeyi ölçekle (deep copy üzerinde)
 */
function scaleObject(obj, scaleFactors, regions, dstW, dstH) {
    if (obj.excludeFromExport || obj.isTransient || obj.isHelper) return obj;

    // Relative koordinatlar varsa → bölge bazlı ölçekleme
    if (obj.relativeLeft != null && obj.relativeTop != null) {
        const regionId = obj[CUSTOM_PROPS.REGION_ID];
        const region = regionId ? regions.find(r => r.id === regionId) : null;

        if (region) {
            const rx = (region.x / 100) * dstW;
            const ry = (region.y / 100) * dstH;
            const rw = (region.widthPercent / 100) * dstW;
            const rh = (region.heightPercent / 100) * dstH;

            obj.left = rx + (obj.relativeLeft / 100) * rw;
            obj.top = ry + (obj.relativeTop / 100) * rh;

            if (obj.relativeWidth > 0 && obj.width > 0) {
                obj.scaleX = ((obj.relativeWidth / 100) * rw) / obj.width;
            }
            if (obj.relativeHeight > 0 && obj.height > 0) {
                obj.scaleY = ((obj.relativeHeight / 100) * rh) / obj.height;
            }

            if (obj.fontSize) {
                const fontScale = Math.min(scaleFactors.scaleX, scaleFactors.scaleY);
                obj.fontSize = Math.max(obj.minFontSize || 8, obj.fontSize * fontScale);
            }

            return obj;
        }
    }

    // Lineer ölçekleme (legacy)
    const { scaleX: sx, scaleY: sy, offsetX: ox, offsetY: oy } = scaleFactors;

    if (obj.left != null) obj.left = obj.left * sx + ox;
    if (obj.top != null) obj.top = obj.top * sy + oy;
    if (obj.scaleX != null) obj.scaleX *= sx;
    if (obj.scaleY != null) obj.scaleY *= sy;
    if (obj.fontSize) {
        const fontScale = Math.min(sx, sy);
        obj.fontSize = Math.max(obj.minFontSize || 8, obj.fontSize * fontScale);
    }

    return obj;
}

/**
 * Design data'yı ölçekle
 *
 * @param {Array} objects - Canvas objects dizisi
 * @param {number} srcW - Kaynak genişlik
 * @param {number} srcH - Kaynak yükseklik
 * @param {number} dstW - Hedef genişlik
 * @param {number} dstH - Hedef yükseklik
 * @param {string} scalePolicy - contain/cover/stretch
 * @param {string} gridLayoutId - Grid layout ID
 * @returns {Array} Ölçeklenmiş objects
 */
export function scaleDesignData(objects, srcW, srcH, dstW, dstH, scalePolicy = 'contain', gridLayoutId = 'single') {
    if (srcW === dstW && srcH === dstH) return objects;

    const factors = computeScaleFactors(srcW, srcH, dstW, dstH, scalePolicy);
    const regions = resolveRegions(gridLayoutId);

    // Deep copy + ölçekle
    return objects.map(obj => {
        const copy = JSON.parse(JSON.stringify(obj));
        return scaleObject(copy, factors, regions, dstW, dstH);
    });
}

/**
 * Responsive önizleme modali göster.
 * Canvas'ın mevcut içeriğini farklı boyutlarda gösterir.
 *
 * @param {Object} editor - TemplateEditorV7 instance
 * @param {Function} __  - i18n çeviri fonksiyonu
 * @param {Array} presets - Önizlenecek preset listesi [{name, width, height}]
 */
export async function showResponsivePreview(editor, __, presets) {
    if (!editor?.canvas) return;

    const canvasW = editor.options?.width || 800;
    const canvasH = editor.options?.height || 1280;
    const gridLayoutId = editor.gridManager?.getCurrentLayoutId() || 'single';
    const scalePolicy = document.getElementById('scale-policy')?.value || 'contain';

    // Canvas'tan objeleri JSON olarak al (sadece export edilebilir olanları)
    const json = editor.canvas.toJSON();
    const objects = (json.objects || []).filter(o =>
        !o.excludeFromExport && !o.isTransient && !o.isHelper && !o.isBackground && !o.isRegionOverlay
    );

    // Modal HTML
    const presetButtons = presets.map((p, i) =>
        `<button class="btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-outline'} responsive-preset-btn"
                 data-width="${p.width}" data-height="${p.height}" data-idx="${i}">
            ${p.name} (${p.width}x${p.height})
        </button>`
    ).join(' ');

    const modalContent = `
        <div class="responsive-preview-container">
            <div class="responsive-preset-selector" style="margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 6px;">
                ${presetButtons}
            </div>
            <div class="responsive-preview-info" style="margin-bottom: 8px; font-size: 12px; color: var(--text-muted);">
                ${__('editor.responsive.previewInfo') || 'Kaynak'}: ${canvasW}x${canvasH} → <span id="rp-target-size">${presets[0]?.width || canvasW}x${presets[0]?.height || canvasH}</span>
            </div>
            <div class="responsive-preview-canvas-wrap" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f8f9fa; min-height: 300px;">
                <canvas id="responsive-preview-canvas"></canvas>
            </div>
        </div>
    `;

    // Modal göster
    const Modal = window.OmnexComponents?.Modal;
    if (!Modal) return;

    Modal.show({
        title: __('editor.responsive.previewTitle') || 'Responsive Önizleme',
        icon: 'ti-arrows-maximize',
        content: modalContent,
        size: 'lg',
        showFooter: false
    });

    // İlk preset'i render et
    const renderPreview = async (targetW, targetH) => {
        const scaledObjects = scaleDesignData(objects, canvasW, canvasH, targetW, targetH, scalePolicy, gridLayoutId);

        // Canvas oluştur
        const previewCanvas = document.getElementById('responsive-preview-canvas');
        if (!previewCanvas) return;

        // Modal'a sığacak şekilde ölçekle
        const maxDisplayW = 600;
        const maxDisplayH = 400;
        const displayScale = Math.min(maxDisplayW / targetW, maxDisplayH / targetH, 1);

        previewCanvas.width = targetW * displayScale;
        previewCanvas.height = targetH * displayScale;

        const ctx = previewCanvas.getContext('2d');
        ctx.scale(displayScale, displayScale);

        // Arka plan
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);

        // Grid bölge sınırları çiz (yarı saydam)
        const regions = resolveRegions(gridLayoutId);
        ctx.strokeStyle = 'rgba(0, 120, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        regions.forEach(r => {
            const rx = (r.x / 100) * targetW;
            const ry = (r.y / 100) * targetH;
            const rw = (r.widthPercent / 100) * targetW;
            const rh = (r.heightPercent / 100) * targetH;
            ctx.strokeRect(rx, ry, rw, rh);
        });
        ctx.setLineDash([]);

        // Objeleri çiz (basit wireframe)
        scaledObjects.forEach(obj => {
            const x = obj.left || 0;
            const y = obj.top || 0;
            const w = (obj.width || 50) * (obj.scaleX || 1);
            const h = (obj.height || 20) * (obj.scaleY || 1);

            // Fabric.js v7 center-origin: x,y = merkez
            const drawX = x - w / 2;
            const drawY = y - h / 2;

            // Tip rengine göre
            const type = obj.type?.toLowerCase() || '';
            const customType = obj.customType || '';

            if (type.includes('text') || customType.includes('text') || customType === 'dynamic-field') {
                ctx.fillStyle = 'rgba(0, 100, 200, 0.15)';
                ctx.strokeStyle = 'rgba(0, 100, 200, 0.5)';
                ctx.fillRect(drawX, drawY, w, h);
                ctx.strokeRect(drawX, drawY, w, h);

                // Metin göster
                if (obj.text) {
                    ctx.fillStyle = obj.fill || '#333';
                    ctx.font = `${Math.max(8, (obj.fontSize || 14) * (obj.scaleX || 1) * 0.7)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const displayText = obj.text.length > 30 ? obj.text.substring(0, 27) + '...' : obj.text;
                    ctx.fillText(displayText, x, y);
                }
            } else if (type === 'image' || customType.includes('image') || customType === 'barcode' || customType === 'qrcode') {
                ctx.fillStyle = 'rgba(100, 200, 100, 0.15)';
                ctx.strokeStyle = 'rgba(100, 200, 100, 0.5)';
                ctx.fillRect(drawX, drawY, w, h);
                ctx.strokeRect(drawX, drawY, w, h);

                // İkon
                ctx.fillStyle = '#999';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(customType === 'barcode' ? '|||' : customType === 'qrcode' ? 'QR' : '🖼', x, y);
            } else {
                // Şekil
                ctx.fillStyle = obj.fill || 'rgba(200, 200, 200, 0.3)';
                ctx.strokeStyle = obj.stroke || 'rgba(150, 150, 150, 0.5)';
                ctx.lineWidth = obj.strokeWidth || 1;
                ctx.fillRect(drawX, drawY, w, h);
                ctx.strokeRect(drawX, drawY, w, h);
            }
        });

        // Boyut etiketini güncelle
        const sizeLabel = document.getElementById('rp-target-size');
        if (sizeLabel) sizeLabel.textContent = `${targetW}x${targetH}`;
    };

    // İlk render
    if (presets.length > 0) {
        await renderPreview(presets[0].width, presets[0].height);
    }

    // Preset butonlarına click handler
    document.querySelectorAll('.responsive-preset-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const w = parseInt(btn.dataset.width);
            const h = parseInt(btn.dataset.height);

            // Active state
            document.querySelectorAll('.responsive-preset-btn').forEach(b => {
                b.className = b.className.replace('btn-primary', 'btn-outline');
            });
            btn.className = btn.className.replace('btn-outline', 'btn-primary');

            await renderPreview(w, h);
        });
    });
}
