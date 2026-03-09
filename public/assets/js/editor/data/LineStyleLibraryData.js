/**
 * LineStyleLibraryData.js
 * Rich line style presets for the template editor.
 */

const CURATED_PRESETS = [
    // Basic
    { id: 'line_01', name: 'Basic Clean', category: 'basic', stroke: '#111827', strokeWidth: 2, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_02', name: 'Basic Strong', category: 'basic', stroke: '#0f172a', strokeWidth: 5, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_03', name: 'Accent Blue', category: 'basic', stroke: '#2563eb', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_04', name: 'Accent Green', category: 'basic', stroke: '#16a34a', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'simple' },

    // Dashed
    { id: 'line_05', name: 'Short Dash', category: 'dashed', stroke: '#1f2937', strokeWidth: 3, strokeDashArray: [10, 6], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_06', name: 'Long Dash', category: 'dashed', stroke: '#111827', strokeWidth: 3, strokeDashArray: [24, 10], strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_07', name: 'Equal Dash', category: 'dashed', stroke: '#334155', strokeWidth: 3, strokeDashArray: [12, 12], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_08', name: 'Dense Dash', category: 'dashed', stroke: '#475569', strokeWidth: 2, strokeDashArray: [7, 4], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_09', name: 'Dash Dot Flow', category: 'dashed', stroke: '#0f172a', strokeWidth: 3, strokeDashArray: [18, 7, 2, 7], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_10', name: 'Dash Dot Rhythm', category: 'dashed', stroke: '#1e293b', strokeWidth: 3, strokeDashArray: [18, 7, 2, 7, 2, 7], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },

    // Dotted
    { id: 'line_11', name: 'Micro Dots', category: 'dotted', stroke: '#334155', strokeWidth: 2, strokeDashArray: [1, 6], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_12', name: 'Soft Dots', category: 'dotted', stroke: '#1e293b', strokeWidth: 3, strokeDashArray: [1, 10], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_13', name: 'Wide Dots', category: 'dotted', stroke: '#0f172a', strokeWidth: 3, strokeDashArray: [1, 16], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_14', name: 'Pixel Dots', category: 'dotted', stroke: '#475569', strokeWidth: 2, strokeDashArray: [2, 7], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },

    // Decorative
    { id: 'line_15', name: 'Rail Divider', category: 'decorative', stroke: '#111827', strokeWidth: 3, strokeDashArray: [30, 6, 4, 6], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_16', name: 'Pulse Divider', category: 'decorative', stroke: '#7c3aed', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'pulseWave' },
    { id: 'line_17', name: 'Wave Soft', category: 'decorative', stroke: '#2563eb', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'wave' },
    { id: 'line_18', name: 'Wave Bold', category: 'decorative', stroke: '#0ea5e9', strokeWidth: 5, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'scallop' },
    { id: 'line_19', name: 'Zigzag Sharp', category: 'decorative', stroke: '#ef4444', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'zigzag' },
    { id: 'line_20', name: 'Zigzag Calm', category: 'decorative', stroke: '#f97316', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'chevron' },
    { id: 'line_21', name: 'Step Tech', category: 'decorative', stroke: '#0f172a', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'step' },
    { id: 'line_22', name: 'Step Bold', category: 'decorative', stroke: '#1e293b', strokeWidth: 5, strokeDashArray: null, strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'notch' },
    { id: 'line_23', name: 'Bracket Minimal', category: 'decorative', stroke: '#16a34a', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'bracket' },
    { id: 'line_24', name: 'Bracket Bold', category: 'decorative', stroke: '#0891b2', strokeWidth: 5, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'arc' },

    // Basic (extended)
    { id: 'line_25', name: 'Basic Slate', category: 'basic', stroke: '#334155', strokeWidth: 1, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_26', name: 'Basic Indigo', category: 'basic', stroke: '#4338ca', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_27', name: 'Basic Teal', category: 'basic', stroke: '#0f766e', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_28', name: 'Basic Rose', category: 'basic', stroke: '#be123c', strokeWidth: 6, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_29', name: 'Basic Amber', category: 'basic', stroke: '#d97706', strokeWidth: 8, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_30', name: 'Basic Neutral', category: 'basic', stroke: '#525252', strokeWidth: 7, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },

    // Dashed (extended)
    { id: 'line_31', name: 'Dash Compact', category: 'dashed', stroke: '#1f2937', strokeWidth: 2, strokeDashArray: [8, 5], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_32', name: 'Dash Wide', category: 'dashed', stroke: '#0f172a', strokeWidth: 4, strokeDashArray: [30, 12], strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_33', name: 'Dash Medium', category: 'dashed', stroke: '#374151', strokeWidth: 3, strokeDashArray: [16, 8], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_34', name: 'Dash Alternating', category: 'dashed', stroke: '#1e293b', strokeWidth: 3, strokeDashArray: [18, 6, 8, 6], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_35', name: 'Dash Focus', category: 'dashed', stroke: '#475569', strokeWidth: 4, strokeDashArray: [20, 5, 3, 5], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_36', name: 'Dash Marker', category: 'dashed', stroke: '#334155', strokeWidth: 3, strokeDashArray: [14, 4, 2, 4, 2, 8], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_37', name: 'Dash Bold Cut', category: 'dashed', stroke: '#111827', strokeWidth: 5, strokeDashArray: [22, 10], strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'simple' },

    // Dotted (extended)
    { id: 'line_38', name: 'Dot Compact', category: 'dotted', stroke: '#334155', strokeWidth: 2, strokeDashArray: [1, 5], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_39', name: 'Dot Medium', category: 'dotted', stroke: '#1e293b', strokeWidth: 3, strokeDashArray: [1, 8], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_40', name: 'Dot Long Gap', category: 'dotted', stroke: '#0f172a', strokeWidth: 4, strokeDashArray: [1, 14], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_41', name: 'Dot Square', category: 'dotted', stroke: '#475569', strokeWidth: 2, strokeDashArray: [2, 6], strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_42', name: 'Dot Duo', category: 'dotted', stroke: '#64748b', strokeWidth: 3, strokeDashArray: [2, 4, 2, 10], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },
    { id: 'line_43', name: 'Dot Fine', category: 'dotted', stroke: '#6b7280', strokeWidth: 2, strokeDashArray: [1, 4], strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'simple' },

    // Decorative (extended)
    { id: 'line_44', name: 'Wave Mint', category: 'decorative', stroke: '#10b981', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'chain' },
    { id: 'line_45', name: 'Wave Violet', category: 'decorative', stroke: '#8b5cf6', strokeWidth: 6, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'ribbon' },
    { id: 'line_46', name: 'Zigzag Neon', category: 'decorative', stroke: '#06b6d4', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'butt', strokeLineJoin: 'round', renderType: 'stitch' },
    { id: 'line_47', name: 'Zigzag Bold', category: 'decorative', stroke: '#f43f5e', strokeWidth: 5, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'skyline' },
    { id: 'line_48', name: 'Step Cyan', category: 'decorative', stroke: '#0891b2', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'square', strokeLineJoin: 'round', renderType: 'ticket' },
    { id: 'line_49', name: 'Step Graphite', category: 'decorative', stroke: '#374151', strokeWidth: 3, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'hook' },
    { id: 'line_50', name: 'Bracket Accent', category: 'decorative', stroke: '#ea580c', strokeWidth: 4, strokeDashArray: null, strokeLineCap: 'round', strokeLineJoin: 'round', renderType: 'twinline' }
];

export const LINE_CATEGORIES = ['all', 'basic', 'dashed', 'dotted', 'decorative'];

export const LINE_STYLE_MAP = {
    solid: null,
    dashed: [10, 6],
    longDashed: [20, 10],
    dotted: [2, 10],
    dashDot: [16, 6, 2, 6],
    dashDotDot: [16, 6, 2, 6, 2, 6],
    denseDash: [6, 4],
    sparseDot: [2, 14]
};

export function dashArrayFromStyle(styleId) {
    return LINE_STYLE_MAP[styleId] || null;
}

export const LINE_PRESETS = CURATED_PRESETS;

export function getLinePresetsByCategory(category = 'all') {
    if (!category || category === 'all') return LINE_PRESETS;
    return LINE_PRESETS.filter((p) => p.category === category);
}

export function searchLinePresets(query = '') {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return LINE_PRESETS;
    return LINE_PRESETS.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
}
