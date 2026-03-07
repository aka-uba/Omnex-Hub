/**
 * FramePicker.js
 * Modal-based frame picker for the template editor.
 * Opens via Modal.show() with category tabs, search, and a grid of frame thumbnails.
 * Single-click to select a frame.
 */

import { Modal } from '../../components/Modal.js';
import { FRAMES, FRAME_CATEGORIES, getFramesByCategory, searchFrames, getFrameThumbPath } from '../data/FrameAssetsData.js';

const CATEGORY_ICONS = {
    all:      'ti-layout-grid',
    classic:  'ti-frame',
    colorful: 'ti-palette',
    dotted:   'ti-dots',
    minimal:  'ti-square',
    other:    'ti-shapes',
    rounded:  'ti-circle',
    shadow:   'ti-shadow',
    simple:   'ti-minus',
    themed:   'ti-photo'
};

const CATEGORY_LABELS = {
    all:      'Tümü',
    classic:  'Klasik',
    colorful: 'Renkli',
    dotted:   'Noktalı',
    minimal:  'Minimal',
    other:    'Diğer',
    rounded:  'Yuvarlak',
    shadow:   'Gölgeli',
    simple:   'Basit',
    themed:   'Temalı'
};

export class FramePicker {

    /**
     * Open the frame picker modal.
     * @param {object} opts
     * @param {Function} opts.onSelect - callback(frameDef)
     * @param {Function} [opts.__] - i18n helper
     */
    static open(opts = {}) {
        const { onSelect, __ = (k) => k } = opts;
        if (!onSelect) return;

        const state = {
            category: 'all',
            query: ''
        };

        const modalId = 'frame-picker-modal-' + Date.now();

        const t = (key) => {
            const val = __(`framePicker.${key}`);
            return val !== `framePicker.${key}` ? val : (CATEGORY_LABELS[key] || key);
        };

        const content = `
            <div class="frame-picker" id="${modalId}">
                <div class="frame-picker-sidebar">
                    <div class="frame-picker-search">
                        <div class="input-icon-wrapper">
                            <i class="ti ti-search"></i>
                            <input type="text" class="form-control form-control-sm" id="fp-search"
                                   placeholder="${t('search') || 'Ara...'}" autocomplete="off">
                        </div>
                    </div>
                    <div class="frame-picker-categories">
                        <button class="fp-cat-btn active" data-cat="all">
                            <i class="ti ${CATEGORY_ICONS.all}"></i>
                            <span>${t('all') || 'Tümü'}</span>
                            <span class="fp-cat-count">${FRAMES.length}</span>
                        </button>
                        ${FRAME_CATEGORIES.map(cat => {
                            const count = getFramesByCategory(cat).length;
                            return `<button class="fp-cat-btn" data-cat="${cat}">
                                <i class="ti ${CATEGORY_ICONS[cat] || 'ti-shapes'}"></i>
                                <span>${t(cat)}</span>
                                <span class="fp-cat-count">${count}</span>
                            </button>`;
                        }).join('')}
                    </div>
                </div>
                <div class="frame-picker-main">
                    <div class="frame-picker-grid" id="fp-grid"></div>
                    <div class="frame-picker-empty" id="fp-empty" style="display:none;">
                        <i class="ti ti-mood-empty"></i>
                        <p>${t('noResults') || 'Sonuç bulunamadı'}</p>
                    </div>
                </div>
            </div>
        `;

        let modalInstance = null;

        const renderGrid = () => {
            const container = document.getElementById(modalId);
            if (!container) return;

            const grid = container.querySelector('#fp-grid');
            const empty = container.querySelector('#fp-empty');
            if (!grid || !empty) return;

            let frames;
            if (state.query) {
                frames = searchFrames(state.query);
                if (state.category !== 'all') {
                    frames = frames.filter(f => f.category === state.category);
                }
            } else {
                frames = getFramesByCategory(state.category);
            }

            if (frames.length === 0) {
                grid.style.display = 'none';
                empty.style.display = 'flex';
                return;
            }

            grid.style.display = 'grid';
            empty.style.display = 'none';

            grid.innerHTML = frames.map(f => `
                <div class="frame-card" data-frame-id="${f.id}" title="${f.title}">
                    <div class="frame-card-preview">
                        <img src="${getFrameThumbPath(f)}" alt="${f.title}" loading="lazy">
                    </div>
                    <div class="frame-card-name">${f.title}</div>
                </div>
            `).join('');
        };

        const bindEvents = () => {
            const container = document.getElementById(modalId);
            if (!container) return;

            // Category buttons
            container.querySelectorAll('.fp-cat-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    container.querySelectorAll('.fp-cat-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    state.category = btn.dataset.cat;
                    renderGrid();
                });
            });

            // Search
            let searchTimer;
            const searchInput = container.querySelector('#fp-search');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    clearTimeout(searchTimer);
                    searchTimer = setTimeout(() => {
                        state.query = searchInput.value.trim();
                        renderGrid();
                    }, 200);
                });
            }

            // Grid click → select frame
            const grid = container.querySelector('#fp-grid');
            if (grid) {
                grid.addEventListener('click', (e) => {
                    const card = e.target.closest('.frame-card');
                    if (!card) return;

                    const frameId = card.dataset.frameId;
                    const frameDef = FRAMES.find(f => f.id === frameId);
                    if (!frameDef) return;

                    // Close modal and call callback
                    if (modalInstance) {
                        modalInstance.close();
                    }
                    onSelect(frameDef);
                });
            }
        };

        modalInstance = Modal.show({
            title: t('title') || 'Çerçeve Seç',
            icon: 'ti-frame',
            content,
            size: 'lg',
            showFooter: false
        });

        // Wait for DOM then render grid and bind events
        requestAnimationFrame(() => {
            renderGrid();
            bindEvents();
            // Focus search
            setTimeout(() => {
                const input = document.getElementById('fp-search');
                if (input) input.focus();
            }, 100);
        });
    }
}
