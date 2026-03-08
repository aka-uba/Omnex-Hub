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
                                <span>${tr(`cat_${cat}`, cat)}</span>
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
            } else if (type === 'zigzag') {
                shape = `<polyline points="16,32 32,20 48,32 64,20 80,32 96,20 112,32 128,20 144,32 160,20 176,32 192,20 208,32 224,20 244,32"
                                  fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" />`;
            } else if (type === 'step') {
                shape = `<path d="M 16 38 L 46 38 L 46 26 L 76 26 L 76 38 L 106 38 L 106 26 L 136 26 L 136 38 L 166 38 L 166 26 L 196 26 L 196 38 L 244 38"
                              fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="miter" />`;
            } else if (type === 'bracket') {
                shape = `
                    <path d="M 16 46 Q 16 32 30 32 L 214 32 Q 228 32 228 46" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" />
                    <line x1="30" y1="32" x2="30" y2="18" stroke="${color}" stroke-width="${Math.max(1, width - 1)}" />
                    <line x1="228" y1="32" x2="228" y2="18" stroke="${color}" stroke-width="${Math.max(1, width - 1)}" />
                `;
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
