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

        const previewSvg = (preset) => {
            const color = preset.stroke;
            const width = Number(preset.strokeWidth || 4);
            const cap = preset.strokeLineCap || 'round';
            const dash = Array.isArray(preset.strokeDashArray) ? preset.strokeDashArray.join(',') : '';
            const dashAttr = dash ? `stroke-dasharray="${dash}"` : '';
            const type = preset.renderType || 'simple';
            let shape = `<line x1="16" y1="32" x2="244" y2="32" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" ${dashAttr} />`;
            if (type === 'wave') {
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
