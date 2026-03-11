/**
 * LinePicker.js
 * Modal-based rich line preset picker.
 */

import { Modal } from '../../components/Modal.js';
import { LINE_CATEGORIES, getLinePresetsByCategory, searchLinePresets } from '../data/LineStyleLibraryData.js';

const CATEGORY_ICONS = {
    all: 'ti-layout-grid',
    basic: 'ti-minus',
    dashed: 'ti-line-dashed',
    dotted: 'ti-dots',
    decorative: 'ti-sparkles'
};

export class LinePicker {

    static open(opts = {}) {
        const { onSelect, __ = (k) => k } = opts;
        if (!onSelect) return;

        const tr = (key, fallback) => {
            const fullKey = `editor.linePicker.${key}`;
            const val = __(fullKey);
            return val && val !== fullKey ? val : fallback;
        };

        const state = {
            category: 'all',
            query: '',
            stroke: '#111827',
            strokeWidth: 4,
            useCustom: false
        };
        const allPresets = getLinePresetsByCategory('all');
        const initialCounts = LINE_CATEGORIES.reduce((acc, cat) => {
            acc[cat] = cat === 'all'
                ? allPresets.length
                : allPresets.filter((i) => i.category === cat).length;
            return acc;
        }, {});

        const modalId = `line-picker-modal-${Date.now()}`;
        const content = `
            <div class="line-picker" id="${modalId}">
                <div class="line-picker-sidebar">
                    <div class="line-picker-search">
                        <div class="input-icon-wrapper">
                            <i class="ti ti-search"></i>
                            <input type="text" class="form-control form-control-sm" id="lp-search" placeholder="${tr('search', 'Cizgi ara...')}" autocomplete="off">
                        </div>
                    </div>
                    <div class="line-picker-controls">
                        <div class="line-picker-control" style="flex-direction:row;align-items:center;gap:8px;">
                            <input type="checkbox" id="lp-use-custom">
                            <label for="lp-use-custom" style="margin:0;text-transform:none;">${tr('custom', 'Ozel renk/kalinlik kullan')}</label>
                        </div>
                        <div class="line-picker-control">
                            <label>${tr('color', 'Renk')}</label>
                            <input type="color" id="lp-color" value="${state.stroke}">
                        </div>
                        <div class="line-picker-control">
                            <label>${tr('thickness', 'Kalinlik')}: <span id="lp-width-val">${state.strokeWidth}px</span></label>
                            <input type="range" id="lp-width" min="1" max="20" step="1" value="${state.strokeWidth}">
                        </div>
                    </div>
                    <div class="line-picker-categories">
                        ${LINE_CATEGORIES.map((cat) => `
                            <button class="lp-cat-btn ${cat === 'all' ? 'active' : ''}" data-cat="${cat}">
                                <i class="ti ${CATEGORY_ICONS[cat] || 'ti-minus'}"></i>
                                <span class="lp-cat-label">${tr(`cat_${cat}`, cat)}</span>
                                <span class="lp-cat-count" data-cat-count="${cat}">${initialCounts[cat] || 0}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="line-picker-main">
                    <div class="line-picker-grid" id="lp-grid"></div>
                    <div class="line-picker-empty" id="lp-empty" style="display:none;">
                        <i class="ti ti-mood-empty"></i>
                        <p>${tr('noResults', 'Sonuc bulunamadi')}</p>
                    </div>
                </div>
            </div>
        `;

        let modalInstance = null;

        const hashType = (type) => {
            const text = String(type || '');
            let h = 2166136261;
            for (let i = 0; i < text.length; i++) {
                h ^= text.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return h >>> 0;
        };

        const autoPathByType = (type) => {
            const t = String(type || '').toLowerCase();
            if (!t) return '';
            const builtIn = new Set([
                'simple', 'wave', 'pulsewave', 'scallop', 'zigzag', 'chevron',
                'step', 'notch', 'bracket', 'arc', 'chain', 'ribbon',
                'stitch', 'skyline', 'ticket', 'hook', 'twinline'
            ]);
            if (builtIn.has(t)) return '';
            const h = hashType(t);
            const v = h % 5;

            if (t.includes('basic') || t.includes('minimal') || t.includes('hairline') || t.includes('solid')) {
                if (v === 0) return 'M 16 32 H 244';
                if (v === 1) return 'M 16 32 H 244 M 116 32 H 144';
                if (v === 2) return 'M 16 32 H 244 M 130 24 V 40';
                if (v === 3) return 'M 16 30 H 244 M 16 34 H 244';
                return 'M 16 32 H 244 M 100 32 L 108 28 L 116 32 L 108 36 Z M 144 32 L 152 28 L 160 32 L 152 36 Z';
            }

            if (t.includes('premium') || t.includes('luxury') || t.includes('gold') || t.includes('jewel') || t.includes('crest') || t.includes('medallion')) {
                if (v === 0) return 'M 16 32 H 92 M 168 32 H 244 M 116 32 L 130 18 L 144 32 L 130 46 Z';
                if (v === 1) return 'M 16 32 H 244 M 112 32 a 18 18 0 1 1 36 0 a 18 18 0 1 1 -36 0';
                if (v === 2) return 'M 16 28 H 244 M 16 36 H 244 M 120 32 L 130 22 L 140 32 L 130 42 Z';
                if (v === 3) return 'M 16 32 H 244 M 130 18 L 136 28 L 148 28 L 138 36 L 142 48 L 130 40 L 118 48 L 122 36 L 112 28 L 124 28 Z';
                return 'M 16 32 H 100 M 160 32 H 244 M 110 32 a 20 12 0 1 0 40 0 a 20 12 0 1 0 -40 0';
            }

            if (t.includes('ramadan') || t.includes('bayram') || t.includes('hilal') || t.includes('mosque') || t.includes('lantern') || t.includes('islamic')) {
                if (v === 0) return 'M 16 32 H 244 M 130 20 a 12 12 0 1 1 0 24 a 8 8 0 1 0 0 -24';
                if (v === 1) return 'M 16 32 H 108 M 152 32 H 244 M 130 18 L 136 30 L 150 30 L 138 38 L 142 50 L 130 42 L 118 50 L 122 38 L 110 30 L 124 30 Z';
                if (v === 2) return 'M 16 32 H 244 M 130 14 L 130 22 M 120 22 H 140 V 44 H 120 Z';
                if (v === 3) return 'M 16 32 H 244 M 96 32 L 104 24 L 112 32 L 104 40 Z M 148 32 L 156 24 L 164 32 L 156 40 Z';
                return 'M 16 34 Q 80 14 130 28 Q 180 42 244 22';
            }

            if (t.includes('national') || t.includes('republic') || t.includes('victory') || t.includes('flag') || t.includes('state')) {
                if (v === 0) return 'M 16 28 H 244 M 16 36 H 244 M 130 20 L 134 28 L 143 28 L 136 34 L 139 42 L 130 37 L 121 42 L 124 34 L 117 28 L 126 28 Z';
                if (v === 1) return 'M 16 32 H 244 M 120 32 a 10 10 0 1 1 20 0 a 10 10 0 1 1 -20 0';
                if (v === 2) return 'M 16 30 H 244 M 16 34 H 244 M 108 32 H 152';
                if (v === 3) return 'M 16 32 H 244 M 78 32 L 84 24 L 90 32 L 84 40 Z M 170 32 L 176 24 L 182 32 L 176 40 Z';
                return 'M 16 32 H 244 M 130 22 L 138 32 L 130 42 L 122 32 Z';
            }

            if (t.includes('new-year') || t.includes('holiday') || t.includes('winter') || t.includes('snow') || t.includes('sparkle') || t.includes('confetti') || t.includes('gift') || t.includes('celebration')) {
                if (v === 0) return 'M 16 32 H 244 M 130 20 L 134 28 L 142 28 L 136 34 L 138 42 L 130 37 L 122 42 L 124 34 L 118 28 L 126 28 Z';
                if (v === 1) return 'M 16 32 H 244 M 92 26 L 92 38 M 106 24 L 106 40 M 130 22 L 130 42 M 154 24 L 154 40 M 168 26 L 168 38';
                if (v === 2) return 'M 16 32 H 244 M 120 32 L 130 22 L 140 32 L 130 42 Z M 100 32 L 106 26 L 112 32 L 106 38 Z M 148 32 L 154 26 L 160 32 L 154 38 Z';
                if (v === 3) return 'M 16 32 H 108 M 152 32 H 244 M 120 22 H 140 V 42 H 120 Z M 130 22 V 42';
                return 'M 16 32 H 244 M 130 18 L 130 46 M 116 32 H 144 M 120 22 L 140 42 M 140 22 L 120 42';
            }

            if (t.includes('campaign') || t.includes('promo') || t.includes('discount') || t.includes('sale') || t.includes('opening')) {
                if (v === 0) return 'M 16 32 H 220 L 244 32 L 228 22 M 244 32 L 228 42';
                if (v === 1) return 'M 16 32 H 244 M 118 22 H 142 V 42 H 118 Z';
                if (v === 2) return 'M 16 32 H 244 M 110 32 L 122 20 L 134 32 L 122 44 Z M 126 32 L 138 20 L 150 32 L 138 44 Z';
                if (v === 3) return 'M 16 30 H 244 M 16 34 H 244 M 210 20 L 230 32 L 210 44';
                return 'M 16 32 H 244 M 120 22 H 140 M 120 42 H 140 M 120 22 V 42 M 140 22 V 42';
            }

            if (t.includes('price') || t.includes('retail') || t.includes('pos') || t.includes('marker') || t.includes('label')) {
                if (v === 0) return 'M 16 32 H 244 M 120 32 L 130 22 L 140 32 L 130 42 Z';
                if (v === 1) return 'M 16 32 H 104 M 156 32 H 244 M 108 22 H 152 V 42 H 108 Z';
                if (v === 2) return 'M 16 32 H 244 M 116 32 H 144 M 130 18 V 46';
                if (v === 3) return 'M 16 32 H 114 M 146 32 H 244 M 118 24 L 142 40 M 142 24 L 118 40';
                return 'M 16 28 H 244 M 16 36 H 244 M 130 22 L 138 32 L 130 42 L 122 32 Z';
            }

            if (t.includes('floral') || t.includes('flower') || t.includes('leaf') || t.includes('rose') || t.includes('bloom') || t.includes('garden') || t.includes('petal')) {
                if (v === 0) return 'M 16 32 Q 48 22 80 32 T 144 32 T 208 32 T 244 32';
                if (v === 1) return 'M 16 32 H 244 M 96 32 C 106 22 118 22 128 32 C 118 42 106 42 96 32 M 132 32 C 142 22 154 22 164 32 C 154 42 142 42 132 32';
                if (v === 2) return 'M 16 32 H 244 M 88 32 a 4 4 0 1 1 8 0 a 4 4 0 1 1 -8 0 M 126 32 a 6 6 0 1 1 12 0 a 6 6 0 1 1 -12 0 M 166 32 a 4 4 0 1 1 8 0 a 4 4 0 1 1 -8 0';
                if (v === 3) return 'M 16 32 H 244 M 70 32 C 80 22 92 22 102 32 C 92 42 80 42 70 32 M 158 32 C 168 22 180 22 190 32 C 180 42 168 42 158 32';
                return 'M 16 34 Q 70 18 130 32 Q 190 46 244 30';
            }

            if (t.includes('tech') || t.includes('digital') || t.includes('circuit') || t.includes('scanline') || t.includes('data') || t.includes('pixel') || t.includes('futuristic') || t.includes('blue-screen')) {
                if (v === 0) return 'M 16 32 H 244 M 16 26 H 244 M 16 38 H 244';
                if (v === 1) return 'M 16 32 H 80 V 20 H 126 V 44 H 176 V 32 H 244';
                if (v === 2) return 'M 16 32 H 244 M 40 28 V 36 M 68 28 V 36 M 96 28 V 36 M 124 28 V 36 M 152 28 V 36 M 180 28 V 36 M 208 28 V 36';
                if (v === 3) return 'M 16 32 H 244 M 100 22 H 160 V 42 H 100 Z';
                return 'M 16 32 H 92 L 104 20 L 118 44 L 134 24 L 148 40 L 164 22 H 244';
            }

            if (t.includes('ornamental') || t.includes('baroque') || t.includes('vintage') || t.includes('symmetric') || t.includes('scroll') || t.includes('teardrop') || t.includes('curl')) {
                if (v === 0) return 'M 16 32 C 40 18 64 18 88 32 H 172 C 196 18 220 18 244 32';
                if (v === 1) return 'M 16 32 H 244 M 112 32 C 118 20 142 20 148 32 C 142 44 118 44 112 32';
                if (v === 2) return 'M 16 32 C 48 48 80 16 112 32 C 144 48 176 16 208 32 C 220 36 232 36 244 32';
                if (v === 3) return 'M 16 32 H 244 M 120 32 L 130 22 L 140 32 L 130 42 Z';
                return 'M 16 32 C 36 24 56 24 76 32 S 116 40 136 32 S 176 24 196 32 S 224 40 244 32';
            }

            if (t.includes('double') || t.includes('triple') || t.includes('rail') || t.includes('ribbon')) {
                if (v === 0) return 'M 16 27 H 244 M 16 37 H 244';
                if (v === 1) return 'M 16 24 H 244 M 16 32 H 244 M 16 40 H 244';
                if (v === 2) return 'M 16 26 H 244 M 16 38 H 244 M 124 32 L 130 26 L 136 32 L 130 38 Z';
                if (v === 3) return 'M 16 32 L 34 22 L 52 32 L 70 42 L 88 32 L 106 22 L 124 32 L 142 42 L 160 32 L 178 22 L 196 32 L 214 42 L 232 32 L 244 26';
                return 'M 16 32 H 244 M 30 32 a 4 4 0 1 1 8 0 a 4 4 0 1 1 -8 0 M 218 32 a 4 4 0 1 1 8 0 a 4 4 0 1 1 -8 0';
            }

            if (t.includes('dashed') || t.includes('dash')) return 'M 16 32 H 244';
            if (t.includes('dotted') || t.includes('dot')) return 'M 16 32 H 244';

            return 'M 16 32 Q 36 22 56 32 T 96 32 T 136 32 T 176 32 T 216 32 T 244 32';
        };

        const previewSvg = (preset) => {
            const color = preset.stroke;
            const width = Number(preset.strokeWidth || 4);
            const cap = preset.strokeLineCap || 'round';
            const dash = Array.isArray(preset.strokeDashArray) ? preset.strokeDashArray.join(',') : '';
            const dashAttr = dash ? `stroke-dasharray="${dash}"` : '';
            const type = preset.renderType || 'simple';
            let shape = `<line x1="16" y1="32" x2="244" y2="32" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" ${dashAttr} />`;
            const autoPath = autoPathByType(type);
            if (type !== 'simple' && autoPath) {
                shape = `<path d="${autoPath}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" ${dashAttr} />`;
            } else if (type === 'wave') {
                shape = `<path d="M 16 32 Q 36 16, 56 32 T 96 32 T 136 32 T 176 32 T 216 32 T 244 32"
                              fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" />`;
            } else if (type === 'pulseWave') {
                shape = `<path d="M 16 32 Q 28 20, 40 32 T 64 32 T 88 32 T 112 32 T 136 32 T 160 32 T 184 32 T 208 32 T 232 32 T 244 32"
                              fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" />`;
            } else if (type === 'scallop') {
                shape = `<path d="M 16 34 Q 26 20 36 34 Q 46 48 56 34 Q 66 20 76 34 Q 86 48 96 34 Q 106 20 116 34 Q 126 48 136 34 Q 146 20 156 34 Q 166 48 176 34 Q 186 20 196 34 Q 206 48 216 34 Q 226 20 236 34 Q 240 40 244 34"
                              fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" />`;
            } else if (type === 'zigzag') {
                shape = `<polyline points="16,32 32,20 48,32 64,20 80,32 96,20 112,32 128,20 144,32 160,20 176,32 192,20 208,32 224,20 244,32"
                                  fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" />`;
            } else if (type === 'chevron') {
                shape = `<polyline points="16,34 28,24 40,34 52,24 64,34 76,24 88,34 100,24 112,34 124,24 136,34 148,24 160,34 172,24 184,34 196,24 208,34 220,24 232,34 244,24"
                                  fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="miter" />`;
            } else if (type === 'step') {
                shape = `<path d="M 16 38 L 46 38 L 46 26 L 76 26 L 76 38 L 106 38 L 106 26 L 136 26 L 136 38 L 166 38 L 166 26 L 196 26 L 196 38 L 244 38"
                              fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="miter" />`;
            } else if (type === 'notch') {
                shape = `<path d="M 16 34 L 44 34 L 52 24 L 60 34 L 92 34 L 100 24 L 108 34 L 140 34 L 148 24 L 156 34 L 188 34 L 196 24 L 204 34 L 244 34"
                              fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" />`;
            } else if (type === 'bracket') {
                shape = `
                    <path d="M 16 46 Q 16 32 30 32 L 214 32 Q 228 32 228 46" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" />
                    <line x1="30" y1="32" x2="30" y2="18" stroke="${color}" stroke-width="${Math.max(1, width - 1)}" />
                    <line x1="228" y1="32" x2="228" y2="18" stroke="${color}" stroke-width="${Math.max(1, width - 1)}" />
                `;
            } else if (type === 'arc') {
                shape = `<path d="M 16 40 Q 72 14 130 30 Q 188 46 244 22"
                              fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" />`;
            } else if (type === 'chain') {
                shape = `<path d="M 16 32 H 244" fill="none" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" stroke-linecap="${cap}" />
                         <circle cx="40" cy="32" r="${Math.max(2, width + 1)}" fill="none" stroke="${color}" stroke-width="${Math.max(1, width - 2)}"/>
                         <circle cx="82" cy="32" r="${Math.max(2, width + 1)}" fill="none" stroke="${color}" stroke-width="${Math.max(1, width - 2)}"/>
                         <circle cx="124" cy="32" r="${Math.max(2, width + 1)}" fill="none" stroke="${color}" stroke-width="${Math.max(1, width - 2)}"/>
                         <circle cx="166" cy="32" r="${Math.max(2, width + 1)}" fill="none" stroke="${color}" stroke-width="${Math.max(1, width - 2)}"/>
                         <circle cx="208" cy="32" r="${Math.max(2, width + 1)}" fill="none" stroke="${color}" stroke-width="${Math.max(1, width - 2)}"/>`;
            } else if (type === 'ribbon') {
                shape = `<path d="M 16 32 L 32 20 L 48 32 L 64 44 L 80 32 L 96 20 L 112 32 L 128 44 L 144 32 L 160 20 L 176 32 L 192 44 L 208 32 L 224 20 L 244 32"
                              fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" />`;
            } else if (type === 'stitch') {
                shape = `<line x1="16" y1="32" x2="244" y2="32" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" />
                         <line x1="24" y1="26" x2="32" y2="38" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" />
                         <line x1="48" y1="26" x2="56" y2="38" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" />
                         <line x1="72" y1="26" x2="80" y2="38" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" />
                         <line x1="96" y1="26" x2="104" y2="38" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" />
                         <line x1="120" y1="26" x2="128" y2="38" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" />
                         <line x1="144" y1="26" x2="152" y2="38" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" />
                         <line x1="168" y1="26" x2="176" y2="38" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" />
                         <line x1="192" y1="26" x2="200" y2="38" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" />
                         <line x1="216" y1="26" x2="224" y2="38" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" />`;
            } else if (type === 'skyline') {
                shape = `<path d="M 16 40 L 32 40 L 32 24 L 44 24 L 44 34 L 58 34 L 58 20 L 72 20 L 72 36 L 86 36 L 86 16 L 102 16 L 102 30 L 118 30 L 118 22 L 132 22 L 132 38 L 148 38 L 148 18 L 166 18 L 166 34 L 184 34 L 184 26 L 198 26 L 198 40 L 244 40"
                              fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="miter" />`;
            } else if (type === 'ticket') {
                shape = `<path d="M 16 32 H 244" fill="none" stroke="${color}" stroke-width="${Math.max(1, width - 1)}" stroke-dasharray="6,6" />
                         <circle cx="40" cy="32" r="${Math.max(2, width)}" fill="${color}" />
                         <circle cx="80" cy="32" r="${Math.max(2, width)}" fill="${color}" />
                         <circle cx="120" cy="32" r="${Math.max(2, width)}" fill="${color}" />
                         <circle cx="160" cy="32" r="${Math.max(2, width)}" fill="${color}" />
                         <circle cx="200" cy="32" r="${Math.max(2, width)}" fill="${color}" />`;
            } else if (type === 'hook') {
                shape = `<path d="M 16 34 H 66 Q 80 34 80 48 Q 80 56 88 56 H 132 Q 146 56 146 42 Q 146 34 154 34 H 244"
                              fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" />`;
            } else if (type === 'twinline') {
                shape = `<line x1="16" y1="27" x2="244" y2="27" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" stroke-linecap="${cap}" />
                         <line x1="16" y1="37" x2="244" y2="37" stroke="${color}" stroke-width="${Math.max(1, width - 2)}" stroke-linecap="${cap}" />`;
            }
            return `
                <svg viewBox="0 0 260 64" class="line-card-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    ${shape}
                </svg>
            `;
        };

        const renderGrid = () => {
            const root = document.getElementById(modalId);
            if (!root) return;
            const grid = root.querySelector('#lp-grid');
            const empty = root.querySelector('#lp-empty');
            if (!grid || !empty) return;

            let items = state.query ? searchLinePresets(state.query) : getLinePresetsByCategory(state.category);
            if (state.query && state.category !== 'all') {
                items = items.filter((i) => i.category === state.category);
            }

            const sourceForCounts = state.query ? searchLinePresets(state.query) : allPresets;
            const counts = LINE_CATEGORIES.reduce((acc, cat) => {
                acc[cat] = cat === 'all'
                    ? sourceForCounts.length
                    : sourceForCounts.filter((i) => i.category === cat).length;
                return acc;
            }, {});
            root.querySelectorAll('.lp-cat-count[data-cat-count]').forEach((el) => {
                const cat = el.getAttribute('data-cat-count') || 'all';
                el.textContent = String(counts[cat] || 0);
            });

            if (!items.length) {
                grid.style.display = 'none';
                empty.style.display = 'flex';
                return;
            }

            grid.style.display = 'grid';
            empty.style.display = 'none';
            grid.innerHTML = items.map((item) => `
                <button type="button" class="line-card" data-line-id="${item.id}" title="${item.name}">
                    <div class="line-card-preview">${previewSvg(item)}</div>
                    <div class="line-card-name">${item.name}</div>
                </button>
            `).join('');
        };

        const bindEvents = () => {
            const root = document.getElementById(modalId);
            if (!root) return;

            const searchEl = root.querySelector('#lp-search');
            let searchTimer = null;
            searchEl?.addEventListener('input', () => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    state.query = searchEl.value.trim();
                    renderGrid();
                }, 180);
            });

            root.querySelectorAll('.lp-cat-btn').forEach((btn) => {
                btn.addEventListener('click', () => {
                    root.querySelectorAll('.lp-cat-btn').forEach((b) => b.classList.remove('active'));
                    btn.classList.add('active');
                    state.category = btn.dataset.cat || 'all';
                    renderGrid();
                });
            });

            const colorEl = root.querySelector('#lp-color');
            colorEl?.addEventListener('input', () => {
                state.stroke = colorEl.value || '#111827';
            });

            const widthEl = root.querySelector('#lp-width');
            const widthVal = root.querySelector('#lp-width-val');
            widthEl?.addEventListener('input', () => {
                state.strokeWidth = Math.max(1, parseInt(widthEl.value, 10) || 4);
                if (widthVal) widthVal.textContent = `${state.strokeWidth}px`;
            });
            const customEl = root.querySelector('#lp-use-custom');
            customEl?.addEventListener('change', () => {
                state.useCustom = !!customEl.checked;
            });

            const grid = root.querySelector('#lp-grid');
            grid?.addEventListener('click', (e) => {
                const card = e.target.closest('.line-card');
                if (!card) return;

                const lineId = card.dataset.lineId;
                const items = state.query ? searchLinePresets(state.query) : getLinePresetsByCategory(state.category);
                const selected = items.find((i) => i.id === lineId);
                if (!selected) return;

                if (modalInstance) modalInstance.close();
                const finalStroke = state.useCustom ? state.stroke : selected.stroke;
                const finalWidth = state.useCustom ? state.strokeWidth : selected.strokeWidth;
                onSelect({
                    stroke: finalStroke,
                    strokeWidth: Number(finalWidth || 4),
                    strokeDashArray: selected.strokeDashArray || null,
                    strokeLineCap: selected.strokeLineCap || 'round',
                    strokeLineJoin: selected.strokeLineJoin || 'round',
                    renderType: selected.renderType || 'simple'
                });
            });
        };

        modalInstance = Modal.show({
            title: tr('title', 'Cizgi Sec'),
            icon: 'ti-line-dashed',
            content,
            size: 'lg',
            showFooter: false
        });

        requestAnimationFrame(() => {
            renderGrid();
            bindEvents();
            setTimeout(() => {
                const input = document.getElementById('lp-search');
                if (input) input.focus();
            }, 100);
        });
    }
}

export default LinePicker;
