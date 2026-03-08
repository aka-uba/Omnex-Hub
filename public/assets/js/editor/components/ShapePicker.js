/**
 * ShapePicker.js
 * Modal-based shape picker for the template editor.
 * Opens via Modal.show() with category tabs, search, color/variant/radius controls,
 * and a grid of shape previews. Single-click to select.
 */

import { Modal } from '../../components/Modal.js';
import { SHAPES, CATEGORIES, SHAPE_VIEWBOX, getShapesByCategory, searchShapes, renderShapeSvg } from '../data/ShapeLibraryData.js';

const CATEGORY_ICONS = {
    all:     'ti-layout-grid',
    new:     'ti-sparkles',
    banner:  'ti-flag',
    badge:   'ti-rosette',
    ribbon:  'ti-bookmark',
    sticker: 'ti-sticker',
    frame:   'ti-frame',
    tag:     'ti-tag',
    bubble:  'ti-message-circle'
};

export class ShapePicker {

    /**
     * Open the shape picker modal.
     * @param {object} opts
     * @param {Function} opts.onSelect - callback({shapeId, fill, stroke, strokeWidth, variant, radius})
     * @param {Function} [opts.__] - i18n helper
     */
    static open(opts = {}) {
        const { onSelect, __ = (k) => k } = opts;
        if (!onSelect) return;

        const state = {
            category: 'all',
            query: '',
            fill: '#ff4d4f',
            stroke: '#1f2937',
            strokeWidth: 8,
            variant: 'solid',
            radius: 24
        };

        const modalId = 'shape-picker-modal-' + Date.now();

        const content = `
            <div class="shape-picker" id="${modalId}">
                <div class="shape-picker-sidebar">
                    <div class="shape-picker-controls">
                        <div class="shape-picker-search">
                            <i class="ti ti-search"></i>
                            <input type="text" class="form-input" id="sp-search" placeholder="${__('editor.shapePicker.search') || 'Ara...'}">
                        </div>
                        <div class="shape-picker-colors">
                            <label class="color-label">
                                <span>${__('editor.shapePicker.fill') || 'Dolgu'}</span>
                                <input type="color" id="sp-fill" value="${state.fill}">
                            </label>
                            <label class="color-label">
                                <span>${__('editor.shapePicker.stroke') || 'Kenar'}</span>
                                <input type="color" id="sp-stroke" value="${state.stroke}">
                            </label>
                        </div>
                        <div class="shape-picker-variant">
                            <button class="btn btn-xs sp-variant active" data-variant="solid">${__('editor.shapePicker.solid') || 'Dolu'}</button>
                            <button class="btn btn-xs sp-variant" data-variant="outline">${__('editor.shapePicker.outline') || 'Kenar'}</button>
                            <button class="btn btn-xs sp-variant" data-variant="double">${__('editor.shapePicker.double') || 'Cift'}</button>
                        </div>
                        <div class="shape-picker-radius">
                            <label>${__('editor.shapePicker.radius') || 'Yaricap'}: <span id="sp-radius-val">${state.radius}</span></label>
                            <input type="range" id="sp-radius" min="0" max="180" value="${state.radius}">
                        </div>
                    </div>
                    <div class="shape-picker-categories">
                        <button class="sp-cat active" data-cat="all"><i class="ti ${CATEGORY_ICONS.all}"></i> ${__('editor.shapePicker.all') || 'Tumu'}</button>
                        <button class="sp-cat" data-cat="new"><i class="ti ${CATEGORY_ICONS.new}"></i> ${__('editor.shapePicker.new') || 'Yeni'}</button>
                        ${CATEGORIES.map(c => `<button class="sp-cat" data-cat="${c}"><i class="ti ${CATEGORY_ICONS[c] || 'ti-shape'}"></i> ${__('editor.shapePicker.cat_' + c) || c.charAt(0).toUpperCase() + c.slice(1)}</button>`).join('')}
                    </div>
                </div>
                <div class="shape-picker-grid" id="sp-grid">
                    <!-- filled by JS -->
                </div>
            </div>
        `;

        const modal = Modal.show({
            title: __('editor.shapePicker.title') || 'Sekil Ekle',
            icon: 'ti-shape',
            content,
            size: 'lg',
            showFooter: false,
            showConfirm: false,
            showCancel: false
        });

        // wait for DOM
        requestAnimationFrame(() => {
            const root = document.getElementById(modalId);
            if (!root) return;

            const grid = root.querySelector('#sp-grid');

            // render grid
            function renderGrid() {
                let shapes = state.query ? searchShapes(state.query) : getShapesByCategory(state.category);
                // filter shapes that support current variant
                shapes = shapes.filter(s => s.variants.includes(state.variant));

                if (!shapes.length) {
                    grid.innerHTML = `<div class="shape-picker-empty"><i class="ti ti-mood-empty"></i><p>${__('editor.shapePicker.noResults') || 'Sonuc bulunamadi'}</p></div>`;
                    return;
                }

                grid.innerHTML = shapes.map(s => `
                    <div class="shape-card" data-shape-id="${s.id}" title="${s.name}">
                        <div class="shape-card-preview">
                            ${renderShapeSvg(s, {
                                fill: state.fill,
                                stroke: state.stroke,
                                strokeWidth: state.strokeWidth,
                                variant: state.variant,
                                radius: state.radius
                            })}
                        </div>
                        <div class="shape-card-name">${s.name}</div>
                    </div>
                `).join('');
            }

            renderGrid();

            // ─── events ──────────────────────────
            // search
            const searchEl = root.querySelector('#sp-search');
            let searchTimer;
            searchEl.addEventListener('input', () => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    state.query = searchEl.value.trim();
                    renderGrid();
                }, 200);
            });

            // categories
            root.querySelectorAll('.sp-cat').forEach(btn => {
                btn.addEventListener('click', () => {
                    root.querySelectorAll('.sp-cat').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    state.category = btn.dataset.cat;
                    state.query = '';
                    searchEl.value = '';
                    renderGrid();
                });
            });

            // variant buttons
            root.querySelectorAll('.sp-variant').forEach(btn => {
                btn.addEventListener('click', () => {
                    root.querySelectorAll('.sp-variant').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    state.variant = btn.dataset.variant;
                    renderGrid();
                });
            });

            // color inputs
            root.querySelector('#sp-fill').addEventListener('input', (e) => {
                state.fill = e.target.value;
                renderGrid();
            });
            root.querySelector('#sp-stroke').addEventListener('input', (e) => {
                state.stroke = e.target.value;
                renderGrid();
            });

            // radius slider
            const radiusEl = root.querySelector('#sp-radius');
            const radiusVal = root.querySelector('#sp-radius-val');
            radiusEl.addEventListener('input', () => {
                state.radius = parseInt(radiusEl.value, 10);
                radiusVal.textContent = state.radius;
                renderGrid();
            });

            // shape click → select
            grid.addEventListener('click', (e) => {
                const card = e.target.closest('.shape-card');
                if (!card) return;
                const shapeId = card.dataset.shapeId;
                onSelect({
                    shapeId,
                    fill: state.fill,
                    stroke: state.stroke,
                    strokeWidth: state.strokeWidth,
                    variant: state.variant,
                    radius: state.radius
                });
                Modal.close(modal.id);
            });
        });
    }
}

export default ShapePicker;
