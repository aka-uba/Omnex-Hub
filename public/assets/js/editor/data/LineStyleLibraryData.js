/**
 * LineStyleLibraryData.js
 * Rich line style presets for the template editor.
 */

const PALETTE = [
    { id: 'red', name: 'Red', color: '#dc2626' },
    { id: 'orange', name: 'Orange', color: '#ea580c' },
    { id: 'yellow', name: 'Yellow', color: '#ca8a04' },
    { id: 'green', name: 'Green', color: '#16a34a' },
    { id: 'blue', name: 'Blue', color: '#2563eb' },
    { id: 'purple', name: 'Purple', color: '#7c3aed' }
];

const BASE_PATTERNS = [
    { id: 'solid', name: 'Solid', dash: null, cap: 'round', category: 'basic', renderType: 'simple' },
    { id: 'thin-dash', name: 'Thin Dash', dash: [14, 6], cap: 'butt', category: 'dashed', renderType: 'simple' },
    { id: 'long-dash', name: 'Long Dash', dash: [26, 12], cap: 'square', category: 'dashed', renderType: 'simple' },
    { id: 'equal-dash', name: 'Equal Dash', dash: [10, 10], cap: 'butt', category: 'dashed', renderType: 'simple' },
    { id: 'dense-dash', name: 'Dense Dash', dash: [8, 4], cap: 'butt', category: 'dashed', renderType: 'simple' },
    { id: 'dot', name: 'Dot', dash: [1, 11], cap: 'round', category: 'dotted', renderType: 'simple' },
    { id: 'micro-dot', name: 'Micro Dot', dash: [1, 7], cap: 'round', category: 'dotted', renderType: 'simple' },
    { id: 'sparse-dot', name: 'Sparse Dot', dash: [1, 17], cap: 'round', category: 'dotted', renderType: 'simple' },
    { id: 'dash-dot', name: 'Dash Dot', dash: [20, 8, 2, 8], cap: 'round', category: 'decorative', renderType: 'simple' },
    { id: 'dash-dot-dot', name: 'Dash Dot Dot', dash: [20, 8, 2, 8, 2, 8], cap: 'round', category: 'decorative', renderType: 'simple' },
    { id: 'rail', name: 'Rail', dash: [30, 6, 4, 6], cap: 'butt', category: 'decorative', renderType: 'simple' },
    { id: 'pulse', name: 'Pulse', dash: [4, 4, 12, 4, 4, 10], cap: 'round', category: 'decorative', renderType: 'simple' },
    { id: 'wave', name: 'Wave Divider', dash: null, cap: 'round', category: 'decorative', renderType: 'wave' },
    { id: 'zigzag', name: 'Zigzag Divider', dash: null, cap: 'round', category: 'decorative', renderType: 'zigzag' },
    { id: 'step', name: 'Step Divider', dash: null, cap: 'square', category: 'decorative', renderType: 'step' },
    { id: 'bracket', name: 'Bracket Divider', dash: null, cap: 'round', category: 'decorative', renderType: 'bracket' }
];

const WEIGHTS = [2, 3, 4, 5, 6, 7];

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

function createPresets() {
    const presets = [];
    const total = 60;
    for (let i = 0; i < total; i += 1) {
        const pattern = BASE_PATTERNS[i % BASE_PATTERNS.length];
        const palette = PALETTE[Math.floor(i / BASE_PATTERNS.length) % PALETTE.length];
        const width = WEIGHTS[Math.floor(i / (BASE_PATTERNS.length * PALETTE.length)) % WEIGHTS.length];
        const idx = i + 1;

        presets.push({
            id: `line_${String(idx).padStart(2, '0')}`,
            name: `${pattern.name} ${palette.name} ${width}px`,
            category: pattern.category,
            stroke: palette.color,
            strokeWidth: width,
            strokeDashArray: pattern.dash,
            strokeLineCap: pattern.cap,
            strokeLineJoin: 'round',
            renderType: pattern.renderType || 'simple'
        });
    }

    return presets;
}

export const LINE_PRESETS = createPresets();

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
