/**
 * MediaPicker - Medya Kütüphanesi Seçici Modülü
 *
 * ProductForm'dan ayrılmış bağımsız modül.
 * 3 farklı picker modu destekler:
 * - Tek görsel seçimi (single image)
 * - Çoklu görsel seçimi (multi image)
 * - Çoklu video seçimi (multi video)
 *
 * @version 1.0.0
 * @example
 * import { init as initMediaPicker } from './form/MediaPicker.js';
 *
 * const picker = initMediaPicker({
 *     container: document.getElementById('media-picker-container'),
 *     app: this.app,
 *     onSelect: (selectedMedia) => { ... }
 * });
 *
 * picker.showImagePicker();       // Tek görsel
 * picker.showMultiImagePicker();  // Çoklu görsel
 * picker.showVideoPicker();       // Çoklu video
 */

import { Logger } from '../../../core/Logger.js';
import { Toast } from '../../../components/Toast.js';
import { Modal } from '../../../components/Modal.js';

/**
 * MediaPicker init fonksiyonu
 * @param {Object} params - Parametre objesi
 * @param {HTMLElement} params.container - Container element (ZORUNLU)
 * @param {Object} params.app - App instance
 * @param {Function} params.onSelect - Seçim callback'i
 * @returns {MediaPicker} MediaPicker instance
 */
export function init({ container, app, onSelect }) {
    if (!container) {
        throw new Error('MediaPicker: container parametresi zorunludur');
    }
    return new MediaPicker({ container, app, onSelect });
}

class MediaPicker {
    constructor({ container, app, onSelect }) {
        this.container = container;
        this.app = app;
        this.onSelect = onSelect;
        this.videoThumbObserver = null;

        // State for different picker modes
        this.state = null;
        this.modalId = null;
    }

    /**
     * Active modal container resolver.
     * Uses current modalId first, then falls back to the top-most modal.
     */
    _getModalContainer() {
        if (this.modalId) {
            const byId = document.getElementById(this.modalId);
            const container = byId?.querySelector('.modal-container');
            if (container) return container;
        }

        const overlays = document.querySelectorAll('.modal-overlay');
        if (overlays.length > 0) {
            return overlays[overlays.length - 1].querySelector('.modal-container') || document;
        }

        return document;
    }

    /**
     * i18n helper
     */
    __(key, params = {}) {
        return this.app?.i18n?.t(key, params) || key;
    }

    /**
     * Get translated folder name. Uses name_key from API if available, otherwise falls back to name.
     */
    _getFolderDisplayName(folder) {
        if (folder && folder.name_key) {
            const translated = this.__(folder.name_key);
            if (translated && translated !== folder.name_key) {
                return translated;
            }
        }
        return (folder && folder.name) || '';
    }

    _resolveMediaFilename(file) {
        const raw = file?.filename || file?.original_name || file?.name || file?.file_path || file?.path || '';
        const normalized = String(raw).replace(/\\/g, '/');
        return normalized.split('/').pop() || '';
    }

    _isVideoFile(file) {
        const itemType = String(file?.file_type || file?.fileType || file?.type || '').toLowerCase();
        if (itemType === 'video') return true;
        const filename = this._resolveMediaFilename(file);
        return /\.(mp4|webm|avi|mov|mkv|wmv|flv)$/i.test(filename);
    }

    _getCurrentLoadType() {
        if (!this.state) return 'image';
        if (this.state.mode === 'multi-video') return 'video';
        if (this.state.mode === 'multi-image') return 'image';
        if (this.state.mode === 'single' && this.state.includeVideos) return 'all';
        return 'image';
    }

    // ========================================
    // SINGLE IMAGE PICKER
    // ========================================

    /**
     * Tek görsel seçici modalını göster
     */
    async showImagePicker(options = {}) {
        const includeVideos = !!options.includeVideos;
        this.state = {
            mode: 'single',
            includeVideos,
            viewMode: 'grid',
            searchTerm: '',
            selectedMedia: null,
            allMedia: [],
            filteredMedia: [],
            activeLibrary: 'company', // 'company' veya 'public'
            companyMedia: [],
            publicMedia: [],
            // Sayfalama
            currentPage: 1,
            perPage: 27,
            totalPages: 1,
            totalItems: 0,
            companyMeta: null,
            publicMeta: null,
            // Klasör navigasyonu
            currentFolderId: null,
            folders: [],
            breadcrumb: [],
            companyFolders: [],
            publicFolders: []
        };

        await this._loadMediaWithScopes(includeVideos ? 'all' : 'image');
        this._showPickerModal({
            title: this.__('mediaLibrary.title'),
            icon: 'ti-photo',
            content: this._renderSingleImageContent()
        });

        setTimeout(() => this._bindSingleImageEvents(), 200);
    }

    _renderSingleImageContent() {
        const { viewMode, filteredMedia, selectedMedia, searchTerm, activeLibrary } = this.state;

        return `
            <div class="media-library-picker">
                <!-- Main Tabs: Kütüphane / Yükle -->
                <div class="media-library-tabs">
                    <button type="button" class="media-library-tab active" data-tab="library">
                        <i class="ti ti-photo"></i>
                        ${this.__('mediaLibrary.tabs.library')}
                    </button>
                    <button type="button" class="media-library-tab" data-tab="upload">
                        <i class="ti ti-upload"></i>
                        ${this.__('mediaLibrary.tabs.upload')}
                    </button>
                </div>

                <!-- Library Tab Content -->
                <div id="media-tab-library" class="media-tab-content">
                    <!-- Sub-tabs: Firma Kütüphanesi / Ortak Kütüphane -->
                    <div class="media-library-subtabs">
                        <button type="button" class="media-library-subtab ${activeLibrary === 'company' ? 'active' : ''}" data-library="company">
                            <i class="ti ti-building"></i>
                            ${this.__('mediaLibrary.companyLibrary')}
                        </button>
                        <button type="button" class="media-library-subtab ${activeLibrary === 'public' ? 'active' : ''}" data-library="public">
                            <i class="ti ti-world"></i>
                            ${this.__('mediaLibrary.publicLibrary')}
                        </button>
                    </div>

                    <!-- Toolbar -->
                    <div class="media-library-toolbar">
                        <div class="media-library-search">
                            <i class="ti ti-search"></i>
                            <input type="text" class="form-input form-input-sm" id="media-search"
                                placeholder="${this.__('mediaLibrary.search')}" value="${searchTerm}">
                        </div>
                        <div class="media-library-view-toggle">
                            <button type="button" class="media-library-view-btn ${viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="${this.__('mediaLibrary.gridView')}">
                                <i class="ti ti-grid-dots"></i>
                            </button>
                            <button type="button" class="media-library-view-btn ${viewMode === 'list' ? 'active' : ''}" data-view="list" title="${this.__('mediaLibrary.listView')}">
                                <i class="ti ti-list"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="media-library-content">
                        ${this._renderMediaItems()}
                    </div>

                    <!-- Footer -->
                    <div class="media-library-footer">
                        <div class="media-library-selected-info">
                            ${selectedMedia ? `
                                ${this.__('mediaLibrary.selected', { filename: selectedMedia.filename })}
                            ` : `
                                ${this.__('mediaLibrary.total', { count: this.state.totalItems || filteredMedia.length })}
                            `}
                        </div>
                        ${this._renderPagination()}
                        <div class="media-library-actions">
                            <button type="button" class="btn btn-outline btn-sm" id="media-cancel-btn">
                                ${this.__('modal.cancel')}
                            </button>
                            <button type="button" class="btn btn-primary btn-sm" id="media-select-btn" ${!selectedMedia ? 'disabled' : ''}>
                                <i class="ti ti-check"></i>
                                ${this.__('mediaLibrary.select')}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Upload Tab Content -->
                <div id="media-tab-upload" class="media-tab-content hidden">
                    <div class="media-library-upload-zone" id="media-upload-zone">
                        <i class="ti ti-cloud-upload"></i>
                        <p>${this.__('mediaLibrary.uploadZone.title')}</p>
                        <p class="text-xs text-gray-400 mt-2">${this.__('mediaLibrary.uploadZone.hint')}</p>
                    </div>
                    <input type="file" id="media-upload-input" class="hidden" accept="image/*">
                    <div id="media-upload-progress" class="hidden mt-4">
                        <div class="flex items-center gap-3">
                            <div class="flex-1">
                                <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div class="h-full bg-primary-500 transition-all" id="upload-progress-bar" style="width: 0%"></div>
                                </div>
                            </div>
                            <span class="text-sm text-gray-500" id="upload-progress-text">0%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    _renderMediaItems() {
        const { viewMode, filteredMedia, selectedMedia, folders, currentFolderId, breadcrumb } = this.state;

        // Breadcrumb navigasyonu
        let breadcrumbHtml = '';
        if (currentFolderId || (breadcrumb && breadcrumb.length > 0)) {
            breadcrumbHtml = `
                <div class="media-library-breadcrumb">
                    <button type="button" class="media-breadcrumb-item media-breadcrumb-home" data-folder-id="">
                        <i class="ti ti-home"></i>
                    </button>
                    ${(breadcrumb || []).map(item => `
                        <span class="media-breadcrumb-separator"><i class="ti ti-chevron-right"></i></span>
                        <button type="button" class="media-breadcrumb-item" data-folder-id="${item.id}">
                            ${this._getFolderDisplayName(item)}
                        </button>
                    `).join('')}
                </div>
            `;
        }

        // Klasörleri render et
        let foldersHtml = '';
        if (folders && folders.length > 0) {
            if (viewMode === 'grid') {
                foldersHtml = folders.map(folder => `
                    <div class="media-library-item media-folder-item" data-folder-id="${folder.id}" data-folder-name="${this._getFolderDisplayName(folder)}" data-folder-name-key="${folder.name_key || ''}">
                        <div class="media-folder-icon">
                            <i class="ti ti-folder${folder.is_public ? '-share' : ''}"></i>
                        </div>
                        <div class="media-library-item-name">${this._getFolderDisplayName(folder)}</div>
                    </div>
                `).join('');
            } else {
                foldersHtml = folders.map(folder => `
                    <div class="media-library-list-item media-folder-item" data-folder-id="${folder.id}" data-folder-name="${this._getFolderDisplayName(folder)}" data-folder-name-key="${folder.name_key || ''}">
                        <div class="media-library-list-check"></div>
                        <div class="media-library-list-thumb media-folder-thumb">
                            <i class="ti ti-folder${folder.is_public ? '-share' : ''}"></i>
                        </div>
                        <div class="media-library-list-info">
                            <div class="media-library-list-name">${this._getFolderDisplayName(folder)}</div>
                            <div class="media-library-list-meta">
                                <span><i class="ti ti-folder"></i> ${this.__('mediaLibrary.folder')}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Dosya ve klasör boşsa
        if (filteredMedia.length === 0 && (!folders || folders.length === 0)) {
            return `
                ${breadcrumbHtml}
                <div class="media-library-empty">
                    <i class="ti ti-photo-off"></i>
                    <p>${this.__('mediaLibrary.empty')}</p>
                    <p class="text-sm">${this.__('mediaLibrary.emptyHint')}</p>
                </div>
            `;
        }

        if (viewMode === 'grid') {
            return `
                ${breadcrumbHtml}
                <div class="media-library-grid">
                    ${foldersHtml}
                    ${filteredMedia.map(media => {
                        const filename = media.filename || this._resolveMediaFilename(media);
                        const isVideo = this._isVideoFile(media);
                        const fileType = isVideo ? 'video' : 'image';
                        const thumbnailUrl = media.thumbnail_url || media.thumbnail || '';
                        const thumb = isVideo
                            ? this._renderVideoThumbnailMarkup({
                                videoUrl: media.url,
                                thumbnailUrl,
                                filename
                            })
                            : `<img src="${media.url}" alt="${filename}" loading="lazy">`;

                        return `
                        <div class="media-library-item ${selectedMedia?.id === media.id ? 'selected' : ''}"
                            data-id="${media.id}" data-url="${media.url}" data-filename="${filename}" data-file-type="${fileType}">
                            ${thumb}
                            <div class="media-library-item-check">
                                <i class="ti ti-check"></i>
                            </div>
                            <div class="media-library-item-name">${filename}</div>
                        </div>
                    `;
                    }).join('')}
                </div>
            `;
        } else {
            return `
                ${breadcrumbHtml}
                <div class="media-library-list">
                    ${foldersHtml}
                    ${filteredMedia.map(media => {
                        const filename = media.filename || this._resolveMediaFilename(media);
                        const isVideo = this._isVideoFile(media);
                        const fileType = isVideo ? 'video' : 'image';
                        const thumb = isVideo
                            ? `<div class="media-library-list-video-icon"><i class="ti ti-video"></i></div>`
                            : `<img src="${media.url}" alt="${filename}" loading="lazy">`;

                        return `
                        <div class="media-library-list-item ${selectedMedia?.id === media.id ? 'selected' : ''}"
                            data-id="${media.id}" data-url="${media.url}" data-filename="${filename}" data-file-type="${fileType}">
                            <div class="media-library-list-check">
                                ${selectedMedia?.id === media.id ? '<i class="ti ti-check"></i>' : ''}
                            </div>
                            <div class="media-library-list-thumb">
                                ${thumb}
                            </div>
                            <div class="media-library-list-info">
                                <div class="media-library-list-name">${filename}</div>
                                <div class="media-library-list-meta">
                                    ${media.size ? `<span>${this._formatFileSize(media.size)}</span>` : ''}
                                    ${media.created_at ? `<span>${new Date(media.created_at).toLocaleDateString('tr-TR')}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                    }).join('')}
                </div>
            `;
        }
    }

    /**
     * Sayfalama kontrollerini render et
     */
    _renderPagination() {
        const { currentPage, totalPages, totalItems, perPage } = this.state;

        // Tek sayfa varsa sayfalama gösterme
        if (totalPages <= 1) {
            return '';
        }

        const startItem = ((currentPage - 1) * perPage) + 1;
        const endItem = Math.min(currentPage * perPage, totalItems);

        return `
            <div class="media-library-pagination">
                <button type="button" class="btn btn-icon btn-sm btn-ghost" id="media-prev-page"
                    ${currentPage <= 1 ? 'disabled' : ''} title="${this.__('actions.previous')}">
                    <i class="ti ti-chevron-left"></i>
                </button>
                <span class="media-pagination-info">
                    ${startItem}-${endItem} / ${totalItems}
                </span>
                <button type="button" class="btn btn-icon btn-sm btn-ghost" id="media-next-page"
                    ${currentPage >= totalPages ? 'disabled' : ''} title="${this.__('actions.next')}">
                    <i class="ti ti-chevron-right"></i>
                </button>
            </div>
        `;
    }

    _bindSingleImageEvents() {
        // Modal container'ı bul (daha güvenilir event binding için)
        const modalContainer = this._getModalContainer();

        // Tab switching (Kütüphane / Yükle)
        modalContainer.querySelectorAll('.media-library-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                modalContainer.querySelectorAll('.media-library-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                modalContainer.querySelectorAll('.media-tab-content').forEach(content => content.classList.add('hidden'));
                modalContainer.querySelector(`#media-tab-${tabName}`)?.classList.remove('hidden');
            });
        });

        // Sub-tab switching (Firma Kütüphanesi / Ortak Kütüphane)
        modalContainer.querySelectorAll('.media-library-subtab').forEach(tab => {
            tab.addEventListener('click', async () => {
                const library = tab.dataset.library;
                if (library && library !== this.state.activeLibrary) {
                    await this._switchLibrary(library);
                }
            });
        });

        // View toggle
        modalContainer.querySelectorAll('.media-library-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const view = btn.dataset.view;
                if (!view) return;

                this.state.viewMode = view;

                // Aktif butonu güncelle
                modalContainer.querySelectorAll('.media-library-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // İçeriği yeniden render et
                const content = modalContainer.querySelector('.media-library-content');
                if (content) {
                    content.innerHTML = this._renderMediaItems();
                    this._bindMediaItemEvents('single');
                }
            });
        });

        // Search
        const searchInput = modalContainer.querySelector('#media-search');
        let searchTimeout;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.state.searchTerm = e.target.value.toLowerCase();
                this._filterMedia();
            }, 300);
        });

        // Media items
        this._bindMediaItemEvents('single');

        // Cancel button
        modalContainer.querySelector('#media-cancel-btn')?.addEventListener('click', () => {
            Modal.close(this.modalId);
        });

        // Select button
        modalContainer.querySelector('#media-select-btn')?.addEventListener('click', () => {
            this._confirmSingleSelection();
        });

        // Upload zone
        this._bindUploadEvents('media-upload-zone', 'media-upload-input', 'image');

        // Sayfalama butonları
        this._bindPaginationEvents();
    }

    /**
     * Sayfalama butonlarını bağla
     */
    _bindPaginationEvents() {
        const modalContainer = this._getModalContainer();

        modalContainer.querySelector('#media-prev-page')?.addEventListener('click', async () => {
            if (this.state.currentPage > 1) {
                await this._goToPage(this.state.currentPage - 1);
            }
        });

        modalContainer.querySelector('#media-next-page')?.addEventListener('click', async () => {
            if (this.state.currentPage < this.state.totalPages) {
                await this._goToPage(this.state.currentPage + 1);
            }
        });
    }

    /**
     * Belirtilen sayfaya git
     */
    async _goToPage(page) {
        const modalContainer = this._getModalContainer();

        // Loading göster
        const content = modalContainer.querySelector('.media-library-content');
        if (content) {
            content.innerHTML = `
                <div class="media-library-loading">
                    <i class="ti ti-loader-2 animate-spin"></i>
                    <p>${this.__('messages.loading')}</p>
                </div>
            `;
        }

        // Medyaları yükle (mevcut klasörü koru)
        const type = this._getCurrentLoadType();
        await this._loadMediaWithScopes(type, page, this.state.currentFolderId);

        // İçeriği güncelle
        if (content) {
            content.innerHTML = this._renderMediaItems();
            this._bindMediaItemEvents(this.state.mode === 'multi' ? 'multi' : 'single');
        }

        // Footer'ı güncelle
        const footerEl = modalContainer.querySelector('.media-library-footer');
        if (footerEl) {
            const paginationEl = footerEl.querySelector('.media-library-pagination');
            if (paginationEl) {
                paginationEl.outerHTML = this._renderPagination();
            } else {
                // Pagination yoksa ekle
                const infoEl = footerEl.querySelector('.media-library-selected-info');
                if (infoEl) {
                    infoEl.insertAdjacentHTML('afterend', this._renderPagination());
                }
            }
            this._bindPaginationEvents();
        }

        // Info'yu güncelle
        const infoEl = modalContainer.querySelector('.media-library-selected-info');
        if (infoEl) {
            infoEl.innerHTML = this.__('mediaLibrary.total', { count: this.state.totalItems || this.state.filteredMedia.length });
        }
    }

    _bindMediaItemEvents(mode) {
        const modalContainer = this._getModalContainer();

        // Klasör tıklama olayları
        modalContainer.querySelectorAll('.media-folder-item').forEach(folderItem => {
            folderItem.addEventListener('click', async () => {
                const folderId = folderItem.dataset.folderId;
                const folderName = folderItem.dataset.folderName;
                const folderNameKey = folderItem.dataset.folderNameKey || null;
                if (folderId) {
                    await this._navigateToFolder(folderId, folderName, folderNameKey);
                }
            });
        });

        // Breadcrumb navigasyonu
        modalContainer.querySelectorAll('.media-breadcrumb-item').forEach(crumb => {
            crumb.addEventListener('click', async () => {
                const folderId = crumb.dataset.folderId;
                await this._navigateToFolder(folderId || null, null, null);
            });
        });

        // Medya öğeleri (klasör olmayan)
        modalContainer.querySelectorAll('.media-library-item:not(.media-folder-item), .media-library-list-item:not(.media-folder-item)').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const url = item.dataset.url;
                const filename = item.dataset.filename;
                const fileType = item.dataset.fileType || '';

                if (mode === 'single') {
                    // Toggle selection
                    if (this.state.selectedMedia?.id === id) {
                        this.state.selectedMedia = null;
                    } else {
                        this.state.selectedMedia = { id, url, filename, file_type: fileType };
                    }

                    // Update UI
                    modalContainer.querySelectorAll('.media-library-item:not(.media-folder-item), .media-library-list-item:not(.media-folder-item)').forEach(i => {
                        i.classList.toggle('selected', i.dataset.id === this.state.selectedMedia?.id);
                    });

                    const selectBtn = modalContainer.querySelector('#media-select-btn');
                    if (selectBtn) {
                        selectBtn.disabled = !this.state.selectedMedia;
                    }

                    const infoEl = modalContainer.querySelector('.media-library-selected-info');
                    if (infoEl) {
                        if (this.state.selectedMedia) {
                            infoEl.innerHTML = this.__('mediaLibrary.selected', { filename: this.state.selectedMedia.filename });
                        } else {
                            infoEl.innerHTML = this.__('mediaLibrary.total', { count: this.state.filteredMedia.length });
                        }
                    }
                }
            });

            // Double click to select immediately
            item.addEventListener('dblclick', () => {
                const url = item.dataset.url;
                const filename = item.dataset.filename;
                const fileType = item.dataset.fileType || '';
                this.state.selectedMedia = { id: item.dataset.id, url, filename, file_type: fileType };
                this._confirmSingleSelection();
            });
        });

        this._initLazyVideoThumbnails(modalContainer);
    }

    /**
     * Klasöre git
     */
    async _navigateToFolder(folderId, folderName, nameKey) {
        const modalContainer = this._getModalContainer();

        // Loading göster
        const content = modalContainer.querySelector('.media-library-content');
        if (content) {
            content.innerHTML = `
                <div class="media-library-loading">
                    <i class="ti ti-loader-2 animate-spin"></i>
                    <p>${this.__('messages.loading')}</p>
                </div>
            `;
        }

        // Breadcrumb güncelle
        this.state.breadcrumb = this.state.breadcrumb || [];

        if (folderId && folderName) {
            // Yeni klasöre giriş
            // Eğer zaten bu klasördeyiz, üstüne tıklandıysa kırp
            const existingIndex = this.state.breadcrumb.findIndex(b => b.id === folderId);
            if (existingIndex >= 0) {
                this.state.breadcrumb = this.state.breadcrumb.slice(0, existingIndex + 1);
            } else {
                this.state.breadcrumb.push({ id: folderId, name: folderName, name_key: nameKey || null });
            }
        } else if (folderId && !folderName) {
            // Breadcrumb'dan tıklama - klasör ID'ye göre kırp
            const existingIndex = this.state.breadcrumb.findIndex(b => b.id === folderId);
            if (existingIndex >= 0) {
                this.state.breadcrumb = this.state.breadcrumb.slice(0, existingIndex + 1);
            }
        } else if (!folderId) {
            // Ana dizine dön (Home tıklandı)
            this.state.breadcrumb = [];
        }

        // Medyaları yükle
        const type = this._getCurrentLoadType();
        await this._loadMediaWithScopes(type, 1, folderId || null);

        // İçeriği güncelle
        if (content) {
            content.innerHTML = this._renderMediaItems();
            this._bindMediaItemEvents(this.state.mode === 'multi' ? 'multi' : 'single');
        }

        // Footer'daki sayfalama güncellemesi
        const footerEl = modalContainer.querySelector('.media-library-footer');
        if (footerEl) {
            const paginationEl = footerEl.querySelector('.media-library-pagination');
            if (paginationEl) {
                paginationEl.outerHTML = this._renderPagination();
            } else {
                const infoEl = footerEl.querySelector('.media-library-selected-info');
                if (infoEl) {
                    infoEl.insertAdjacentHTML('afterend', this._renderPagination());
                }
            }
            this._bindPaginationEvents();
        }

        // Info güncelle
        const infoEl = modalContainer.querySelector('.media-library-selected-info');
        if (infoEl) {
            infoEl.innerHTML = this.__('mediaLibrary.total', { count: this.state.totalItems || this.state.filteredMedia.length });
        }
    }

    _confirmSingleSelection() {
        const { selectedMedia } = this.state;
        if (selectedMedia && this.onSelect) {
            this.onSelect({
                mode: 'single',
                media: selectedMedia
            });
            Toast.success(this.__('mediaLibrary.toast.selected'));
            Modal.close(this.modalId);
        }
    }

    // ========================================
    // MULTI IMAGE PICKER
    // ========================================

    /**
     * Çoklu görsel seçici modalını göster
     */
    async showMultiImagePicker() {
        this.state = {
            mode: 'multi-image',
            viewMode: 'grid',
            searchTerm: '',
            selectedImages: [],
            allMedia: [],
            filteredMedia: [],
            activeLibrary: 'company',
            companyMedia: [],
            publicMedia: [],
            // Sayfalama
            currentPage: 1,
            perPage: 27,
            totalPages: 1,
            totalItems: 0,
            companyMeta: null,
            publicMeta: null,
            // Klasör navigasyonu
            currentFolderId: null,
            folders: [],
            breadcrumb: [],
            companyFolders: [],
            publicFolders: []
        };

        await this._loadMediaWithScopes('image');
        this._showPickerModal({
            title: this.__('mediaLibrary.title'),
            icon: 'ti-photo',
            content: this._renderMultiImageContent()
        });

        setTimeout(() => this._bindMultiImageEvents(), 100);
    }

    _renderMultiImageContent() {
        const { filteredMedia, selectedImages, searchTerm, activeLibrary } = this.state;

        return `
            <div class="media-library-picker">
                <div class="media-library-tabs">
                    <button type="button" class="media-library-tab active" data-tab="img-library">
                        <i class="ti ti-photo"></i>
                        ${this.__('mediaLibrary.tabs.library')}
                    </button>
                    <button type="button" class="media-library-tab" data-tab="img-upload">
                        <i class="ti ti-upload"></i>
                        ${this.__('mediaLibrary.tabs.upload')}
                    </button>
                </div>

                <div id="media-tab-img-library" class="media-tab-content">
                    <!-- Sub-tabs: Firma Kütüphanesi / Ortak Kütüphane -->
                    <div class="media-library-subtabs">
                        <button type="button" class="media-library-subtab ${activeLibrary === 'company' ? 'active' : ''}" data-library="company">
                            <i class="ti ti-building"></i>
                            ${this.__('mediaLibrary.companyLibrary')}
                        </button>
                        <button type="button" class="media-library-subtab ${activeLibrary === 'public' ? 'active' : ''}" data-library="public">
                            <i class="ti ti-world"></i>
                            ${this.__('mediaLibrary.publicLibrary')}
                        </button>
                    </div>

                    <div class="media-library-toolbar">
                        <div class="media-library-search">
                            <i class="ti ti-search"></i>
                            <input type="text" class="form-input form-input-sm" id="multi-image-search"
                                placeholder="${this.__('mediaLibrary.search')}" value="${searchTerm}">
                        </div>
                        <div class="media-library-view-toggle">
                            <button type="button" class="media-library-view-btn ${this.state.viewMode === 'grid' ? 'active' : ''}" data-view="grid">
                                <i class="ti ti-grid-dots"></i>
                            </button>
                            <button type="button" class="media-library-view-btn ${this.state.viewMode === 'list' ? 'active' : ''}" data-view="list">
                                <i class="ti ti-list"></i>
                            </button>
                        </div>
                    </div>

                    <div class="media-library-content">
                        ${this._renderMultiMediaItems()}
                    </div>

                    <div class="media-library-footer">
                        <div class="media-library-selected-info">
                            ${selectedImages.length > 0 ? this.__('mediaLibrary.imagesSelected', { count: selectedImages.length }) : this.__('mediaLibrary.totalImages', { count: this.state.totalItems || filteredMedia.length })}
                        </div>
                        ${this._renderMultiPagination()}
                        <div class="media-library-actions">
                            <button type="button" class="btn btn-outline btn-sm" id="multi-image-cancel-btn">${this.__('modal.cancel')}</button>
                            <button type="button" class="btn btn-primary btn-sm" id="multi-image-select-btn" ${selectedImages.length === 0 ? 'disabled' : ''}>
                                <i class="ti ti-check"></i>
                                ${this.__('mediaLibrary.selectCount', { count: selectedImages.length })}
                            </button>
                        </div>
                    </div>
                </div>

                <div id="media-tab-img-upload" class="media-tab-content hidden">
                    <div class="media-library-upload-zone" id="multi-image-upload-zone">
                        <i class="ti ti-cloud-upload"></i>
                        <p>${this.__('mediaLibrary.uploadZone.title')}</p>
                        <p class="text-xs text-gray-400 mt-2">${this.__('mediaLibrary.uploadZone.hint')}</p>
                    </div>
                    <input type="file" id="multi-image-upload-input" class="hidden" accept="image/*" multiple>
                </div>
            </div>
        `;
    }

    /**
     * Multi-image picker için medya öğelerini render et (klasör destekli)
     */
    _renderMultiMediaItems() {
        const { viewMode, filteredMedia, selectedImages, folders, currentFolderId, breadcrumb, activeLibrary } = this.state;

        // Firma kütüphanesinde klasör ve breadcrumb gösterme
        const showFolders = activeLibrary === 'public';

        // Breadcrumb navigasyonu (sadece ortak kütüphanede)
        let breadcrumbHtml = '';
        if (showFolders && (currentFolderId || (breadcrumb && breadcrumb.length > 0))) {
            breadcrumbHtml = `
                <div class="media-library-breadcrumb">
                    <button type="button" class="media-breadcrumb-item media-breadcrumb-home" data-folder-id="">
                        <i class="ti ti-home"></i>
                    </button>
                    ${(breadcrumb || []).map(item => `
                        <span class="media-breadcrumb-separator"><i class="ti ti-chevron-right"></i></span>
                        <button type="button" class="media-breadcrumb-item" data-folder-id="${item.id}">
                            ${this._getFolderDisplayName(item)}
                        </button>
                    `).join('')}
                </div>
            `;
        }

        // Klasörleri render et (sadece ortak kütüphanede)
        let foldersHtml = '';
        if (showFolders && folders && folders.length > 0) {
            if (viewMode === 'grid') {
                foldersHtml = folders.map(folder => `
                    <div class="media-library-item media-folder-item" data-folder-id="${folder.id}" data-folder-name="${this._getFolderDisplayName(folder)}" data-folder-name-key="${folder.name_key || ''}">
                        <div class="media-folder-icon">
                            <i class="ti ti-folder${folder.is_public ? '-share' : ''}"></i>
                        </div>
                        <div class="media-library-item-name">${this._getFolderDisplayName(folder)}</div>
                    </div>
                `).join('');
            } else {
                foldersHtml = folders.map(folder => `
                    <div class="media-library-list-item media-folder-item" data-folder-id="${folder.id}" data-folder-name="${this._getFolderDisplayName(folder)}" data-folder-name-key="${folder.name_key || ''}">
                        <div class="media-library-list-check"></div>
                        <div class="media-library-list-thumb media-folder-thumb">
                            <i class="ti ti-folder${folder.is_public ? '-share' : ''}"></i>
                        </div>
                        <div class="media-library-list-info">
                            <div class="media-library-list-name">${this._getFolderDisplayName(folder)}</div>
                            <div class="media-library-list-meta">
                                <span><i class="ti ti-folder"></i> ${this.__('mediaLibrary.folder')}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Dosya ve klasör boşsa
        if (filteredMedia.length === 0 && (!folders || folders.length === 0)) {
            return `
                ${breadcrumbHtml}
                <div class="media-library-empty">
                    <i class="ti ti-photo-off"></i>
                    <p>${this.__('mediaLibrary.empty')}</p>
                    <p class="text-sm">${this.__('mediaLibrary.emptyHint')}</p>
                </div>
            `;
        }

        if (viewMode === 'grid') {
            return `
                ${breadcrumbHtml}
                <div class="media-library-grid">
                    ${foldersHtml}
                    ${filteredMedia.map(media => `
                        <div class="media-library-item ${selectedImages.some(i => i.id === media.id) ? 'selected' : ''}"
                            data-id="${media.id}" data-url="${media.url}" data-filename="${media.filename}">
                            <img src="${media.url}" alt="${media.filename}" loading="lazy">
                            <div class="media-library-item-check">
                                <i class="ti ti-check"></i>
                            </div>
                            <div class="media-library-item-name">${media.filename}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            return `
                ${breadcrumbHtml}
                <div class="media-library-list">
                    ${foldersHtml}
                    ${filteredMedia.map(media => `
                        <div class="media-library-list-item ${selectedImages.some(i => i.id === media.id) ? 'selected' : ''}"
                            data-id="${media.id}" data-url="${media.url}" data-filename="${media.filename}">
                            <div class="media-library-list-check">
                                ${selectedImages.some(i => i.id === media.id) ? '<i class="ti ti-check"></i>' : ''}
                            </div>
                            <div class="media-library-list-thumb">
                                <img src="${media.url}" alt="${media.filename}" loading="lazy">
                            </div>
                            <div class="media-library-list-info">
                                <div class="media-library-list-name">${media.filename}</div>
                                <div class="media-library-list-meta">
                                    ${media.size ? `<span>${this._formatFileSize(media.size)}</span>` : ''}
                                    ${media.created_at ? `<span>${new Date(media.created_at).toLocaleDateString('tr-TR')}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    /**
     * Multi-image picker için sayfalama kontrollerini render et
     */
    _renderMultiPagination() {
        const { currentPage, totalPages, totalItems, perPage } = this.state;

        // Tek sayfa varsa sayfalama gösterme
        if (totalPages <= 1) {
            return '';
        }

        const startItem = ((currentPage - 1) * perPage) + 1;
        const endItem = Math.min(currentPage * perPage, totalItems);

        return `
            <div class="media-library-pagination">
                <button type="button" class="btn btn-icon btn-sm btn-ghost" id="multi-prev-page"
                    ${currentPage <= 1 ? 'disabled' : ''} title="${this.__('actions.previous')}">
                    <i class="ti ti-chevron-left"></i>
                </button>
                <span class="media-pagination-info">
                    ${startItem}-${endItem} / ${totalItems}
                </span>
                <button type="button" class="btn btn-icon btn-sm btn-ghost" id="multi-next-page"
                    ${currentPage >= totalPages ? 'disabled' : ''} title="${this.__('actions.next')}">
                    <i class="ti ti-chevron-right"></i>
                </button>
            </div>
        `;
    }

    _bindMultiImageEvents() {
        const modalContainer = this._getModalContainer();

        // Tab switching (Kütüphane / Yükle)
        modalContainer.querySelectorAll('.media-library-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                modalContainer.querySelectorAll('.media-library-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                modalContainer.querySelectorAll('.media-tab-content').forEach(content => content.classList.add('hidden'));
                modalContainer.querySelector(`#media-tab-${tabName}`)?.classList.remove('hidden');
            });
        });

        // Sub-tab switching (Firma Kütüphanesi / Ortak Kütüphane)
        modalContainer.querySelectorAll('.media-library-subtab').forEach(tab => {
            tab.addEventListener('click', async () => {
                const library = tab.dataset.library;
                if (library && library !== this.state.activeLibrary) {
                    await this._switchMultiImageLibrary(library);
                }
            });
        });

        // View toggle
        modalContainer.querySelectorAll('.media-library-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const view = btn.dataset.view;
                if (!view) return;

                this.state.viewMode = view;

                // Aktif butonu güncelle
                modalContainer.querySelectorAll('.media-library-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // İçeriği yeniden render et
                const content = modalContainer.querySelector('.media-library-content');
                if (content) {
                    content.innerHTML = this._renderMultiMediaItems();
                    this._bindMultiSelectItemEvents();
                }
            });
        });

        // Search
        const searchInput = modalContainer.querySelector('#multi-image-search');
        let searchTimeout;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.state.searchTerm = e.target.value.toLowerCase();
                this._filterMultiMedia();
            }, 300);
        });

        // Image items - multi-select
        this._bindMultiSelectItemEvents();

        // Cancel button
        modalContainer.querySelector('#multi-image-cancel-btn')?.addEventListener('click', () => {
            Modal.close(this.modalId);
        });

        // Select button
        modalContainer.querySelector('#multi-image-select-btn')?.addEventListener('click', () => {
            if (this.state.selectedImages.length > 0 && this.onSelect) {
                this.onSelect({
                    mode: 'multi-image',
                    media: this.state.selectedImages
                });
                Toast.success(this.__('mediaLibrary.toast.imagesAdded', { count: this.state.selectedImages.length }));
                Modal.close(this.modalId);
            }
        });

        // Upload zone
        this._bindUploadEvents('multi-image-upload-zone', 'multi-image-upload-input', 'image', true);

        // Sayfalama butonları
        this._bindMultiPaginationEvents();
    }

    /**
     * Multi-image picker için sayfalama event'lerini bağla
     */
    _bindMultiPaginationEvents() {
        const modalContainer = this._getModalContainer();

        modalContainer.querySelector('#multi-prev-page')?.addEventListener('click', async () => {
            if (this.state.currentPage > 1) {
                await this._goToMultiPage(this.state.currentPage - 1);
            }
        });

        modalContainer.querySelector('#multi-next-page')?.addEventListener('click', async () => {
            if (this.state.currentPage < this.state.totalPages) {
                await this._goToMultiPage(this.state.currentPage + 1);
            }
        });
    }

    /**
     * Multi-image picker için belirtilen sayfaya git
     */
    async _goToMultiPage(page) {
        const modalContainer = this._getModalContainer();

        // Loading göster
        const content = modalContainer.querySelector('.media-library-content');
        if (content) {
            content.innerHTML = `
                <div class="media-library-loading">
                    <i class="ti ti-loader-2 animate-spin"></i>
                    <p>${this.__('messages.loading')}</p>
                </div>
            `;
        }

        // Medyaları yükle (mevcut klasörü koru)
        await this._loadMediaWithScopes('image', page, this.state.currentFolderId);

        // İçeriği güncelle
        if (content) {
            content.innerHTML = this._renderMultiMediaItems();
            this._bindMultiSelectItemEvents();
        }

        // Footer'ı güncelle
        const footerEl = modalContainer.querySelector('.media-library-footer');
        if (footerEl) {
            const paginationEl = footerEl.querySelector('.media-library-pagination');
            const newPaginationHtml = this._renderMultiPagination();
            if (paginationEl) {
                paginationEl.outerHTML = newPaginationHtml;
            } else if (newPaginationHtml) {
                const infoEl = footerEl.querySelector('.media-library-selected-info');
                if (infoEl) {
                    infoEl.insertAdjacentHTML('afterend', newPaginationHtml);
                }
            }
            this._bindMultiPaginationEvents();
        }

        // Info'yu güncelle
        const infoEl = modalContainer.querySelector('.media-library-selected-info');
        if (infoEl) {
            infoEl.innerHTML = this.state.selectedImages.length > 0
                ? this.__('mediaLibrary.imagesSelected', { count: this.state.selectedImages.length })
                : this.__('mediaLibrary.totalImages', { count: this.state.totalItems || this.state.filteredMedia.length });
        }
    }

    _bindMultiSelectItemEvents() {
        const modalContainer = this._getModalContainer();

        // Klasör tıklama olayları
        modalContainer.querySelectorAll('.media-folder-item').forEach(folderItem => {
            folderItem.addEventListener('click', async () => {
                const folderId = folderItem.dataset.folderId;
                const folderName = folderItem.dataset.folderName;
                const folderNameKey = folderItem.dataset.folderNameKey || null;
                if (folderId) {
                    await this._navigateMultiImageFolder(folderId, folderName, folderNameKey);
                }
            });
        });

        // Breadcrumb navigasyonu
        modalContainer.querySelectorAll('.media-breadcrumb-item').forEach(crumb => {
            crumb.addEventListener('click', async () => {
                const folderId = crumb.dataset.folderId;
                await this._navigateMultiImageFolder(folderId || null, null, null);
            });
        });

        // Medya öğeleri (klasör olmayan) - multi-select
        modalContainer.querySelectorAll('.media-library-item:not(.media-folder-item), .media-library-list-item:not(.media-folder-item)').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const url = item.dataset.url;
                const filename = item.dataset.filename;

                const index = this.state.selectedImages.findIndex(i => i.id === id);
                if (index >= 0) {
                    this.state.selectedImages.splice(index, 1);
                    item.classList.remove('selected');
                } else {
                    this.state.selectedImages.push({ id, url, filename });
                    item.classList.add('selected');
                }

                this._updateMultiSelectUI();
            });
        });
    }

    /**
     * Multi-image picker için klasöre git
     */
    async _navigateMultiImageFolder(folderId, folderName, nameKey) {
        const modalContainer = this._getModalContainer();

        // Loading göster
        const content = modalContainer.querySelector('.media-library-content');
        if (content) {
            content.innerHTML = `
                <div class="media-library-loading">
                    <i class="ti ti-loader-2 animate-spin"></i>
                    <p>${this.__('messages.loading')}</p>
                </div>
            `;
        }

        // Breadcrumb güncelle
        this.state.breadcrumb = this.state.breadcrumb || [];

        if (folderId && folderName) {
            const existingIndex = this.state.breadcrumb.findIndex(b => b.id === folderId);
            if (existingIndex >= 0) {
                this.state.breadcrumb = this.state.breadcrumb.slice(0, existingIndex + 1);
            } else {
                this.state.breadcrumb.push({ id: folderId, name: folderName, name_key: nameKey || null });
            }
        } else if (folderId && !folderName) {
            const existingIndex = this.state.breadcrumb.findIndex(b => b.id === folderId);
            if (existingIndex >= 0) {
                this.state.breadcrumb = this.state.breadcrumb.slice(0, existingIndex + 1);
            }
        } else if (!folderId) {
            this.state.breadcrumb = [];
        }

        // Medyaları yükle
        await this._loadMediaWithScopes('image', 1, folderId || null);

        // İçeriği güncelle
        if (content) {
            content.innerHTML = this._renderMultiMediaItems();
            this._bindMultiSelectItemEvents();
        }

        // Footer sayfalama güncelle
        const footerEl = modalContainer.querySelector('.media-library-footer');
        if (footerEl) {
            const paginationEl = footerEl.querySelector('.media-library-pagination');
            const newPaginationHtml = this._renderMultiPagination();
            if (paginationEl) {
                paginationEl.outerHTML = newPaginationHtml;
            } else if (newPaginationHtml) {
                const infoEl = footerEl.querySelector('.media-library-selected-info');
                if (infoEl) {
                    infoEl.insertAdjacentHTML('afterend', newPaginationHtml);
                }
            }
            this._bindMultiPaginationEvents();
        }

        // Footer info güncelle
        const infoEl = modalContainer.querySelector('.media-library-selected-info');
        if (infoEl) {
            infoEl.innerHTML = this.state.selectedImages.length > 0
                ? this.__('mediaLibrary.imagesSelected', { count: this.state.selectedImages.length })
                : this.__('mediaLibrary.totalImages', { count: this.state.totalItems || this.state.filteredMedia.length });
        }
    }

    _updateMultiSelectUI() {
        const selectBtn = document.getElementById('multi-image-select-btn');
        if (selectBtn) {
            selectBtn.disabled = this.state.selectedImages.length === 0;
            selectBtn.innerHTML = `<i class="ti ti-check"></i> ${this.__('mediaLibrary.selectCount', { count: this.state.selectedImages.length })}`;
        }

        const infoEl = document.querySelector('.media-library-selected-info');
        if (infoEl) {
            infoEl.textContent = this.state.selectedImages.length > 0
                ? this.__('mediaLibrary.imagesSelected', { count: this.state.selectedImages.length })
                : this.__('mediaLibrary.totalImages', { count: this.state.filteredMedia.length });
        }
    }

    /**
     * Multi-image picker için kütüphane sekmesi değiştir
     * @param {string} library - 'company' veya 'public'
     */
    async _switchMultiImageLibrary(library) {
        const modalContainer = this._getModalContainer();
        const content = modalContainer.querySelector('.media-library-content');

        this.state.activeLibrary = library;
        this.state.searchTerm = '';
        this.state.currentPage = 1;
        this.state.currentFolderId = null;
        this.state.breadcrumb = [];
        this.state.selectedMedia = null;

        if (content) {
            content.innerHTML = `
                <div class="media-library-loading">
                    <i class="ti ti-loader-2 animate-spin"></i>
                    <p>${this.__('messages.loading')}</p>
                </div>
            `;
        }

        await this._loadMediaWithScopes(this._getCurrentLoadType(), 1, null);
        this._setActiveLibraryMedia();

        // Sub-tab'ları güncelle
        modalContainer.querySelectorAll('.media-library-subtab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.library === library);
        });

        // Arama kutusunu temizle
        const searchInput = modalContainer.querySelector('#multi-image-search');
        if (searchInput) searchInput.value = '';

        // İçeriği yeniden render et
        if (content) {
            content.innerHTML = this._renderMultiMediaItems();
            this._bindMultiSelectItemEvents();
        }

        // Footer sayfalama güncelle
        const footerEl = modalContainer.querySelector('.media-library-footer');
        if (footerEl) {
            const paginationEl = footerEl.querySelector('.media-library-pagination');
            const newPaginationHtml = this._renderMultiPagination();
            if (paginationEl) {
                paginationEl.outerHTML = newPaginationHtml;
            } else if (newPaginationHtml) {
                const infoEl = footerEl.querySelector('.media-library-selected-info');
                if (infoEl) {
                    infoEl.insertAdjacentHTML('afterend', newPaginationHtml);
                }
            }
            this._bindMultiPaginationEvents();
        }

        // Footer info güncelle
        const infoEl = modalContainer.querySelector('.media-library-selected-info');
        if (infoEl) {
            infoEl.innerHTML = this.state.selectedImages.length > 0
                ? this.__('mediaLibrary.imagesSelected', { count: this.state.selectedImages.length })
                : this.__('mediaLibrary.totalImages', { count: this.state.totalItems || this.state.filteredMedia.length });
        }
    }

    // ========================================
    // VIDEO PICKER
    // ========================================

    /**
     * Çoklu video seçici modalını göster
     */
    async showVideoPicker() {
        this.state = {
            mode: 'multi-video',
            viewMode: 'grid',
            searchTerm: '',
            selectedVideos: [],
            allMedia: [],
            filteredMedia: [],
            activeLibrary: 'company',
            companyMedia: [],
            publicMedia: [],
            // Sayfalama
            currentPage: 1,
            perPage: 27,
            totalPages: 1,
            totalItems: 0,
            companyMeta: null,
            publicMeta: null,
            // Klasör navigasyonu
            currentFolderId: null,
            folders: [],
            breadcrumb: [],
            companyFolders: [],
            publicFolders: []
        };

        await this._loadMediaWithScopes('video');
        this._showPickerModal({
            title: this.__('mediaLibrary.videoTitle'),
            icon: 'ti-video',
            content: this._renderVideoContent()
        });

        setTimeout(() => this._bindVideoEvents(), 100);
    }

    _renderVideoContent() {
        const { filteredMedia, selectedVideos, activeLibrary, searchTerm } = this.state;

        return `
            <div class="media-library-picker">
                <!-- Main Tabs: Kütüphane / Yükle -->
                <div class="media-library-tabs">
                    <button type="button" class="media-library-tab active" data-tab="video-library">
                        <i class="ti ti-video"></i>
                        ${this.__('mediaLibrary.tabs.library')}
                    </button>
                    <button type="button" class="media-library-tab" data-tab="video-upload">
                        <i class="ti ti-upload"></i>
                        ${this.__('mediaLibrary.tabs.upload')}
                    </button>
                </div>

                <div id="media-tab-video-library" class="media-tab-content">
                    <!-- Sub-tabs: Firma Kütüphanesi / Ortak Kütüphane -->
                    <div class="media-library-subtabs">
                        <button type="button" class="media-library-subtab ${activeLibrary === 'company' ? 'active' : ''}" data-library="company">
                            <i class="ti ti-building"></i>
                            ${this.__('mediaLibrary.companyLibrary')}
                        </button>
                        <button type="button" class="media-library-subtab ${activeLibrary === 'public' ? 'active' : ''}" data-library="public">
                            <i class="ti ti-world"></i>
                            ${this.__('mediaLibrary.publicLibrary')}
                        </button>
                    </div>

                    <div class="media-library-toolbar">
                        <div class="media-library-search">
                            <i class="ti ti-search"></i>
                            <input type="text" class="form-input form-input-sm" id="video-search" placeholder="${this.__('mediaLibrary.searchVideo')}" value="${searchTerm || ''}">
                        </div>
                    </div>

                    <div class="media-library-content">
                        ${this._renderVideoItems()}
                    </div>

                    <div class="media-library-footer">
                        <div class="media-library-selected-info">
                            ${selectedVideos.length > 0
                                ? this.__('mediaLibrary.videosSelected', { count: selectedVideos.length })
                                : this.__('mediaLibrary.totalVideos', { count: this.state.totalItems || filteredMedia.length })}
                        </div>
                        ${this._renderVideoPagination()}
                        <div class="media-library-actions">
                            <button type="button" class="btn btn-outline btn-sm" id="video-cancel-btn">${this.__('modal.cancel')}</button>
                            <button type="button" class="btn btn-primary btn-sm" id="video-select-btn" ${selectedVideos.length === 0 ? 'disabled' : ''}>
                                <i class="ti ti-check"></i>
                                ${this.__('mediaLibrary.selectCount', { count: selectedVideos.length })}
                            </button>
                        </div>
                    </div>
                </div>

                <div id="media-tab-video-upload" class="media-tab-content hidden">
                    <div class="media-library-upload-zone" id="video-upload-zone">
                        <i class="ti ti-cloud-upload"></i>
                        <p>${this.__('mediaLibrary.videoUploadZone.title')}</p>
                        <p class="text-xs text-gray-400 mt-2">${this.__('mediaLibrary.videoUploadZone.hint')}</p>
                    </div>
                    <input type="file" id="video-upload-input" class="hidden" accept="video/*" multiple>
                </div>
            </div>
        `;
    }

    /**
     * Video öğelerini thumbnail desteği ile render et
     * Video dosyasının ilk frame'ini <video> elementi ile gösterir (ürün kartı gibi tutarlı)
     */
    _renderVideoItems() {
        const { filteredMedia, selectedVideos, folders, currentFolderId, breadcrumb } = this.state;

        let breadcrumbHtml = '';
        if (currentFolderId || (breadcrumb && breadcrumb.length > 0)) {
            breadcrumbHtml = `
                <div class="media-library-breadcrumb">
                    <button type="button" class="media-breadcrumb-item media-breadcrumb-home" data-folder-id="">
                        <i class="ti ti-home"></i>
                    </button>
                    ${(breadcrumb || []).map(item => `
                        <span class="media-breadcrumb-separator"><i class="ti ti-chevron-right"></i></span>
                        <button type="button" class="media-breadcrumb-item" data-folder-id="${item.id}">
                            ${this._getFolderDisplayName(item)}
                        </button>
                    `).join('')}
                </div>
            `;
        }

        let foldersHtml = '';
        if (folders && folders.length > 0) {
            foldersHtml = folders.map(folder => `
                <div class="media-library-item media-folder-item" data-folder-id="${folder.id}" data-folder-name="${this._getFolderDisplayName(folder)}" data-folder-name-key="${folder.name_key || ''}">
                    <div class="media-folder-icon">
                        <i class="ti ti-folder${folder.is_public ? '-share' : ''}"></i>
                    </div>
                    <div class="media-library-item-name">${this._getFolderDisplayName(folder)}</div>
                </div>
            `).join('');
        }

        if (filteredMedia.length === 0 && (!folders || folders.length === 0)) {
            return `
                <div class="media-library-empty">
                    <i class="ti ti-video-off"></i>
                    <p>${this.__('mediaLibrary.videoEmpty')}</p>
                    <p class="text-sm">${this.__('mediaLibrary.videoEmptyHint')}</p>
                </div>
            `;
        }

        return `
            ${breadcrumbHtml}
            <div class="media-library-grid">
                ${foldersHtml}
                ${filteredMedia.map(media => {
                    const videoUrl = media.url || '';
                    const thumbnailUrl = media.thumbnail_url || media.thumbnail || null;
                    const filename = media.filename || this._resolveMediaFilename(media);

                    return `
                        <div class="media-library-item video ${selectedVideos.some(v => v.id === media.id) ? 'selected' : ''}"
                            data-id="${media.id}" data-url="${videoUrl}" data-filename="${filename}"
                            ${thumbnailUrl ? `data-thumbnail="${thumbnailUrl}"` : ''}>
                            ${this._renderVideoThumbnailMarkup({
                                videoUrl,
                                thumbnailUrl,
                                filename,
                                duration: media.duration
                            })}
                            <div class="media-library-item-check"><i class="ti ti-check"></i></div>
                            <div class="media-library-item-name">${filename}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Video süresini formatla
     * @param {number} seconds - Saniye cinsinden süre
     * @returns {string} Formatlanmış süre (mm:ss)
     */
    _formatVideoDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    _renderVideoThumbnailMarkup({ videoUrl, thumbnailUrl, filename, duration = null }) {
        const safeVideoUrl = videoUrl || '';
        const mediaMarkup = thumbnailUrl
            ? `<img src="${thumbnailUrl}" alt="${filename}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="video-placeholder" style="display:none;"><i class="ti ti-video"></i></div>`
            : `<video data-src="${safeVideoUrl}" class="media-picker-lazy-video" preload="none" muted playsinline style="opacity:0;"></video>
               <div class="video-placeholder" style="display:flex;"><i class="ti ti-video"></i></div>`;

        return `
            <div class="video-thumbnail">
                ${mediaMarkup}
                <div class="video-play-icon"><i class="ti ti-player-play"></i></div>
                ${duration ? `<span class="video-duration-badge">${this._formatVideoDuration(duration)}</span>` : ''}
            </div>
        `;
    }

    _initLazyVideoThumbnails(modalContainer = this._getModalContainer()) {
        const videos = Array.from(modalContainer.querySelectorAll('video.media-picker-lazy-video[data-src]:not([data-thumb-bound="1"])'));
        if (!videos.length) return;

        const activateVideo = (video) => {
            if (video.dataset.thumbBound === '1') return;
            video.dataset.thumbBound = '1';

            const src = video.dataset.src;
            if (!src) return;

            const placeholder = video.nextElementSibling;
            const showFallback = () => {
                video.style.opacity = '0';
                if (placeholder) placeholder.style.display = 'flex';
            };
            const showVideo = () => {
                video.style.opacity = '1';
                if (placeholder) placeholder.style.display = 'none';
            };

            video.addEventListener('loadedmetadata', () => {
                if (video.duration && Number.isFinite(video.duration)) {
                    try {
                        video.currentTime = Math.min(1, video.duration * 0.1);
                    } catch {
                        // ignore seek errors on unsupported streams
                    }
                }
                showVideo();
            }, { once: true });

            video.addEventListener('loadeddata', showVideo, { once: true });
            video.addEventListener('error', showFallback, { once: true });
            video.src = src;
            video.preload = 'metadata';
            video.load();
        };

        if (typeof IntersectionObserver === 'undefined') {
            videos.forEach(activateVideo);
            return;
        }

        if (!this.videoThumbObserver) {
            this.videoThumbObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        activateVideo(entry.target);
                        this.videoThumbObserver.unobserve(entry.target);
                    }
                });
            }, {
                root: null,
                rootMargin: '160px 0px',
                threshold: 0.01
            });
        }

        videos.forEach((video) => this.videoThumbObserver.observe(video));
    }

    _renderVideoPagination() {
        const { currentPage, totalPages, totalItems, perPage } = this.state;

        if (totalPages <= 1) {
            return '';
        }

        const startItem = ((currentPage - 1) * perPage) + 1;
        const endItem = Math.min(currentPage * perPage, totalItems);

        return `
            <div class="media-library-pagination">
                <button type="button" class="btn btn-icon btn-sm btn-ghost" id="video-prev-page"
                    ${currentPage <= 1 ? 'disabled' : ''} title="${this.__('actions.previous')}">
                    <i class="ti ti-chevron-left"></i>
                </button>
                <span class="media-pagination-info">
                    ${startItem}-${endItem} / ${totalItems}
                </span>
                <button type="button" class="btn btn-icon btn-sm btn-ghost" id="video-next-page"
                    ${currentPage >= totalPages ? 'disabled' : ''} title="${this.__('actions.next')}">
                    <i class="ti ti-chevron-right"></i>
                </button>
            </div>
        `;
    }

    _bindVideoPaginationEvents() {
        const modalContainer = this._getModalContainer();

        modalContainer.querySelector('#video-prev-page')?.addEventListener('click', async () => {
            if (this.state.currentPage > 1) {
                await this._goToVideoPage(this.state.currentPage - 1);
            }
        });

        modalContainer.querySelector('#video-next-page')?.addEventListener('click', async () => {
            if (this.state.currentPage < this.state.totalPages) {
                await this._goToVideoPage(this.state.currentPage + 1);
            }
        });
    }

    _refreshVideoPagination() {
        const modalContainer = this._getModalContainer();
        const footerEl = modalContainer.querySelector('.media-library-footer');
        if (!footerEl) return;

        const paginationEl = footerEl.querySelector('.media-library-pagination');
        const newPaginationHtml = this._renderVideoPagination();
        if (paginationEl) {
            if (newPaginationHtml) {
                paginationEl.outerHTML = newPaginationHtml;
            } else {
                paginationEl.remove();
            }
        } else if (newPaginationHtml) {
            const infoEl = footerEl.querySelector('.media-library-selected-info');
            if (infoEl) {
                infoEl.insertAdjacentHTML('afterend', newPaginationHtml);
            }
        }

        this._bindVideoPaginationEvents();
    }

    async _goToVideoPage(page) {
        if (page < 1 || page > (this.state.totalPages || 1)) return;

        const modalContainer = this._getModalContainer();

        const content = modalContainer.querySelector('.media-library-content');
        if (content) {
            content.innerHTML = `
                <div class="media-library-loading">
                    <i class="ti ti-loader-2 animate-spin"></i>
                    <p>${this.__('messages.loading')}</p>
                </div>
            `;
        }

        await this._loadMediaWithScopes('video', page, this.state.currentFolderId);

        if (content) {
            content.innerHTML = this._renderVideoItems();
            this._bindVideoItemEvents();
        }

        this._refreshVideoPagination();
        this._updateVideoSelectUI();
    }

    _bindVideoEvents() {
        const modalContainer = this._getModalContainer();

        // Tab switching (Kütüphane / Yükle)
        modalContainer.querySelectorAll('.media-library-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                modalContainer.querySelectorAll('.media-library-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                modalContainer.querySelectorAll('.media-tab-content').forEach(content => content.classList.add('hidden'));
                modalContainer.querySelector(`#media-tab-${tabName}`)?.classList.remove('hidden');
            });
        });

        // Sub-tab switching (Firma Kütüphanesi / Ortak Kütüphane)
        modalContainer.querySelectorAll('.media-library-subtab').forEach(tab => {
            tab.addEventListener('click', async () => {
                const library = tab.dataset.library;
                if (library && library !== this.state.activeLibrary) {
                    await this._switchVideoLibrary(library);
                }
            });
        });

        // Search
        const searchInput = modalContainer.querySelector('#video-search');
        let searchTimeout;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.state.searchTerm = e.target.value.toLowerCase();
                this._filterVideoMedia();
            }, 300);
        });

        // Video items - multi-select
        this._bindVideoItemEvents();
        this._bindVideoPaginationEvents();

        // Cancel button
        modalContainer.querySelector('#video-cancel-btn')?.addEventListener('click', () => {
            Modal.close(this.modalId);
        });

        // Select button
        modalContainer.querySelector('#video-select-btn')?.addEventListener('click', () => {
            if (this.state.selectedVideos.length > 0 && this.onSelect) {
                this.onSelect({
                    mode: 'multi-video',
                    media: this.state.selectedVideos
                });
                Toast.success(this.__('theme.videosAdded', { count: this.state.selectedVideos.length }));
                Modal.close(this.modalId);
            }
        });

        // Upload zone
        this._bindUploadEvents('video-upload-zone', 'video-upload-input', 'video', true);
    }

    /**
     * Video öğelerine event binding
     */
    _bindVideoItemEvents() {
        const modalContainer = this._getModalContainer();

        // Klasör tıklama olayları
        modalContainer.querySelectorAll('.media-folder-item').forEach(folderItem => {
            folderItem.addEventListener('click', async () => {
                const folderId = folderItem.dataset.folderId;
                const folderName = folderItem.dataset.folderName;
                const folderNameKey = folderItem.dataset.folderNameKey || null;
                if (folderId) {
                    await this._navigateVideoFolder(folderId, folderName, folderNameKey);
                }
            });
        });

        // Breadcrumb navigasyonu
        modalContainer.querySelectorAll('.media-breadcrumb-item').forEach(crumb => {
            crumb.addEventListener('click', async () => {
                const folderId = crumb.dataset.folderId;
                await this._navigateVideoFolder(folderId || null, null, null);
            });
        });

        modalContainer.querySelectorAll('.media-library-picker .media-library-item.video').forEach(item => {
            // Video elementlerinin ilk frame'ini göster
            const video = item.querySelector('.video-thumbnail video');
            if (video) {
                // Video'nun ilk frame'ine git (thumbnail olarak kullan)
                const seekToFirstFrame = () => {
                    if (video.duration && video.duration > 0) {
                        // İlk 1 saniyeye git (bazı videolarda 0. saniye siyah olabiliyor)
                        video.currentTime = Math.min(1, video.duration * 0.1);
                    }
                };

                // Metadata zaten yüklendiyse hemen seek yap
                if (video.readyState >= 1) {
                    seekToFirstFrame();
                } else {
                    // Henüz yüklenmediyse event dinle
                    video.addEventListener('loadedmetadata', seekToFirstFrame, { once: true });
                }

                // Hata durumunda placeholder göster
                video.addEventListener('error', () => {
                    const thumbnail = item.querySelector('.video-thumbnail');
                    if (thumbnail && !thumbnail.querySelector('.video-error-placeholder')) {
                        thumbnail.innerHTML = `
                            <div class="video-error-placeholder">
                                <i class="ti ti-video-off"></i>
                            </div>
                            <div class="video-play-icon"><i class="ti ti-player-play"></i></div>
                        `;
                    }
                }, { once: true });
            }

            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const url = item.dataset.url;
                const filename = item.dataset.filename;
                const thumbnail = item.dataset.thumbnail || null;

                const index = this.state.selectedVideos.findIndex(v => v.id === id);
                if (index >= 0) {
                    this.state.selectedVideos.splice(index, 1);
                    item.classList.remove('selected');
                } else {
                    this.state.selectedVideos.push({ id, url, filename, thumbnail });
                    item.classList.add('selected');
                }

                this._updateVideoSelectUI();
            });
        });

        this._initLazyVideoThumbnails(modalContainer);
    }

    /**
     * Video picker için klasöre git
     */
    async _navigateVideoFolder(folderId, folderName, nameKey) {
        const modalContainer = this._getModalContainer();
        const content = modalContainer.querySelector('.media-library-content');

        if (content) {
            content.innerHTML = `
                <div class="media-library-loading">
                    <i class="ti ti-loader-2 animate-spin"></i>
                    <p>${this.__('messages.loading')}</p>
                </div>
            `;
        }

        this.state.breadcrumb = this.state.breadcrumb || [];

        if (folderId && folderName) {
            const existingIndex = this.state.breadcrumb.findIndex(b => b.id === folderId);
            if (existingIndex >= 0) {
                this.state.breadcrumb = this.state.breadcrumb.slice(0, existingIndex + 1);
            } else {
                this.state.breadcrumb.push({ id: folderId, name: folderName, name_key: nameKey || null });
            }
        } else if (folderId && !folderName) {
            const existingIndex = this.state.breadcrumb.findIndex(b => b.id === folderId);
            if (existingIndex >= 0) {
                this.state.breadcrumb = this.state.breadcrumb.slice(0, existingIndex + 1);
            }
        } else if (!folderId) {
            this.state.breadcrumb = [];
        }

        await this._loadMediaWithScopes('video', 1, folderId || null);

        if (content) {
            content.innerHTML = this._renderVideoItems();
            this._bindVideoItemEvents();
        }

        this._refreshVideoPagination();
        this._updateVideoSelectUI();
    }

    /**
     * Video picker için kütüphane sekmesi değiştir
     * @param {string} library - 'company' veya 'public'
     */
    async _switchVideoLibrary(library) {
        const modalContainer = this._getModalContainer();
        const content = modalContainer.querySelector('.media-library-content');

        this.state.activeLibrary = library;
        this.state.searchTerm = '';
        this.state.currentPage = 1;
        this.state.currentFolderId = null;
        this.state.breadcrumb = [];

        if (content) {
            content.innerHTML = `
                <div class="media-library-loading">
                    <i class="ti ti-loader-2 animate-spin"></i>
                    <p>${this.__('messages.loading')}</p>
                </div>
            `;
        }

        await this._loadMediaWithScopes('video', 1, null);
        this._setActiveLibraryMedia();

        // Sub-tab'ları güncelle
        modalContainer.querySelectorAll('.media-library-subtab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.library === library);
        });

        // Arama kutusunu temizle
        const searchInput = modalContainer.querySelector('#video-search');
        if (searchInput) searchInput.value = '';

        // İçeriği yeniden render et
        if (content) {
            content.innerHTML = this._renderVideoItems();
            this._bindVideoItemEvents();
        }

        // Footer'ı güncelle
        this._refreshVideoPagination();
        this._updateVideoSelectUI();
    }

    _updateVideoSelectUI() {
        const modalContainer = this._getModalContainer();
        const selectBtn = modalContainer.querySelector('#video-select-btn');
        if (selectBtn) {
            selectBtn.disabled = this.state.selectedVideos.length === 0;
            selectBtn.innerHTML = `<i class="ti ti-check"></i> ${this.__('mediaLibrary.selectCount', { count: this.state.selectedVideos.length })}`;
        }

        const infoEl = modalContainer.querySelector('.media-library-selected-info');
        if (infoEl) {
            const totalCount = this.state.searchTerm
                ? this.state.filteredMedia.length
                : (this.state.totalItems || this.state.filteredMedia.length);
            infoEl.textContent = this.state.selectedVideos.length > 0
                ? this.__('mediaLibrary.videosSelected', { count: this.state.selectedVideos.length })
                : this.__('mediaLibrary.totalVideos', { count: totalCount });
        }
    }

    // ========================================
    // SHARED HELPERS
    // ========================================

    async _loadMedia(type) {
        try {
            const response = await this.app.api.get(`/media?type=${type}`);
            const mediaData = response.data;
            let files = [];

            if (Array.isArray(mediaData)) {
                files = mediaData;
            } else if (mediaData && Array.isArray(mediaData.files)) {
                files = mediaData.files;
            }

            this.state.allMedia = files;
            this.state.filteredMedia = [...files];
        } catch (error) {
            Logger.error('Media load error:', error);
            this.state.allMedia = [];
            this.state.filteredMedia = [];
        }
    }

    /**
     * Firma ve Ortak kütüphaneden medya yükle
     * @param {string} type - 'image' veya 'video'
     * @param {number} page - Sayfa numarası (varsayılan 1)
     * @param {string|null} folderId - Klasör ID (opsiyonel)
     */
    async _loadMediaWithScopes(type, page = 1, folderId = null) {
        try {
            // Dosya uzantılarına göre filtreleme için
            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
            const videoExtensions = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'flv'];
            const allExtensions = [...imageExtensions, ...videoExtensions];
            const allowedExtensions = type === 'all'
                ? allExtensions
                : (type === 'image' ? imageExtensions : videoExtensions);

            // Client-side dosya uzantısı filtresi
            const filterByExtension = (files) => {
                return files.filter(file => {
                    const itemType = String(file?.file_type || file?.type || '').toLowerCase();
                    if (type === 'all' && (itemType === 'image' || itemType === 'video')) return true;
                    if (itemType === type) return true;
                    const filename = this._resolveMediaFilename(file);
                    const ext = filename.split('.').pop()?.toLowerCase().trim() || '';
                    return allowedExtensions.includes(ext);
                }).map(file => ({
                    ...file,
                    filename: this._resolveMediaFilename(file)
                }));
            };

            const perPage = this.state.perPage || 27;
            const folderParam = folderId ? `&folder_id=${folderId}` : '';
            const typeParam = type === 'all' ? '' : `type=${type}&`;

            // Firma kütüphanesi
            const query = `${typeParam}page=${page}&per_page=${perPage}&skip_validation=1${folderParam}`;
            const [companyResponse, publicResponse] = await Promise.all([
                this.app.api.get(`/media?${query}&scope=company`),
                this.app.api.get(`/media?${query}&scope=public`)
            ]);
            const companyData = companyResponse.data;
            const publicData = publicResponse.data;
            let companyFiles = [];
            if (Array.isArray(companyData)) {
                companyFiles = companyData;
            } else if (companyData && Array.isArray(companyData.files)) {
                companyFiles = companyData.files;
            }
            // Meta bilgilerini sakla
            this.state.companyMeta = companyData?.meta || null;
            // Klasörleri sakla
            this.state.companyFolders = companyData?.folders || [];
            // Client-side filtreleme uygula
            companyFiles = filterByExtension(companyFiles);

            // Ortak kütüphane (public/samples) - sayfalama ile
            let publicFiles = [];
            if (Array.isArray(publicData)) {
                publicFiles = publicData;
            } else if (publicData && Array.isArray(publicData.files)) {
                publicFiles = publicData.files;
            }
            // Meta bilgilerini sakla
            this.state.publicMeta = publicData?.meta || null;
            // Klasörleri sakla
            this.state.publicFolders = publicData?.folders || [];
            // Client-side filtreleme uygula
            publicFiles = filterByExtension(publicFiles);

            this.state.companyMedia = companyFiles;
            this.state.publicMedia = publicFiles;
            this.state.currentPage = page;
            this.state.currentFolderId = folderId;

            // Aktif kütüphaneye göre filteredMedia'yı ayarla
            this._setActiveLibraryMedia();

        } catch (error) {
            Logger.error('Media load error:', error);
            this.state.companyMedia = [];
            this.state.publicMedia = [];
            this.state.allMedia = [];
            this.state.filteredMedia = [];
            this.state.companyMeta = null;
            this.state.publicMeta = null;
            this.state.companyFolders = [];
            this.state.publicFolders = [];
        }
    }

    /**
     * Aktif kütüphaneye göre görüntülenen medyayı ayarla
     */
    _setActiveLibraryMedia() {
        const { activeLibrary, companyMedia, publicMedia, companyMeta, publicMeta, companyFolders, publicFolders } = this.state;
        if (activeLibrary === 'company') {
            this.state.allMedia = companyMedia || [];
            this.state.folders = companyFolders || [];
            // Sayfalama bilgilerini güncelle
            if (companyMeta) {
                this.state.totalPages = companyMeta.total_pages || 1;
                this.state.totalItems = companyMeta.total || this.state.allMedia.length;
            } else {
                this.state.totalPages = 1;
                this.state.totalItems = this.state.allMedia.length;
            }
        } else {
            this.state.allMedia = publicMedia || [];
            this.state.folders = publicFolders || [];
            // Sayfalama bilgilerini güncelle
            if (publicMeta) {
                this.state.totalPages = publicMeta.total_pages || 1;
                this.state.totalItems = publicMeta.total || this.state.allMedia.length;
            } else {
                this.state.totalPages = 1;
                this.state.totalItems = this.state.allMedia.length;
            }
        }
        this.state.filteredMedia = [...this.state.allMedia];
    }

    /**
     * Kütüphane sekmesi değiştir
     * @param {string} library - 'company' veya 'public'
     */
    async _switchLibrary(library) {
        const modalContainer = this._getModalContainer();
        const content = modalContainer.querySelector('.media-library-content');

        this.state.activeLibrary = library;
        this.state.selectedMedia = null;
        this.state.searchTerm = '';
        this.state.currentPage = 1; // Kütüphane değişince sayfa 1'e dön
        this.state.currentFolderId = null; // Klasör sıfırla
        this.state.breadcrumb = []; // Breadcrumb sıfırla

        if (content) {
            content.innerHTML = `
                <div class="media-library-loading">
                    <i class="ti ti-loader-2 animate-spin"></i>
                    <p>${this.__('messages.loading')}</p>
                </div>
            `;
        }

        await this._loadMediaWithScopes(this._getCurrentLoadType(), 1, null);
        this._setActiveLibraryMedia();

        // Sub-tab'ları güncelle
        modalContainer.querySelectorAll('.media-library-subtab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.library === library);
        });

        // Arama kutusunu temizle
        const searchInput = modalContainer.querySelector('#media-search');
        if (searchInput) searchInput.value = '';

        // İçeriği yeniden render et
        if (content) {
            content.innerHTML = this._renderMediaItems();
            this._bindMediaItemEvents('single');
        }

        // Sayfalama butonlarını güncelle
        const footerEl = modalContainer.querySelector('.media-library-footer');
        if (footerEl) {
            const paginationEl = footerEl.querySelector('.media-library-pagination');
            const newPaginationHtml = this._renderPagination();
            if (paginationEl) {
                paginationEl.outerHTML = newPaginationHtml;
            } else if (newPaginationHtml) {
                // Pagination yoksa ekle (selected-info'dan sonra)
                const infoEl = footerEl.querySelector('.media-library-selected-info');
                if (infoEl) {
                    infoEl.insertAdjacentHTML('afterend', newPaginationHtml);
                }
            }
            this._bindPaginationEvents();
        }

        // Footer info'yu güncelle
        const infoEl = modalContainer.querySelector('.media-library-selected-info');
        if (infoEl) {
            infoEl.innerHTML = this.__('mediaLibrary.total', { count: this.state.totalItems || this.state.filteredMedia.length }) || `${this.state.totalItems || this.state.filteredMedia.length} dosya`;
        }

        const selectBtn = modalContainer.querySelector('#media-select-btn');
        if (selectBtn) selectBtn.disabled = true;
    }

    _showPickerModal({ title, icon, content }) {
        const modal = Modal.show({
            title,
            icon,
            content,
            size: 'lg',
            showConfirm: false,
            showCancel: false,
            closable: true
        });
        this.modalId = modal.id;
    }

    _filterMedia() {
        const modalContainer = this._getModalContainer();
        const { allMedia, searchTerm } = this.state;

        if (!searchTerm) {
            this.state.filteredMedia = [...allMedia];
        } else {
            this.state.filteredMedia = allMedia.filter(m =>
                this._resolveMediaFilename(m).toLowerCase().includes(searchTerm)
            );
        }

        // Clear selection if filtered out
        if (this.state.selectedMedia) {
            const stillExists = this.state.filteredMedia.some(
                m => m.id === this.state.selectedMedia.id
            );
            if (!stillExists) {
                this.state.selectedMedia = null;
            }
        }

        // Re-render
        const content = modalContainer.querySelector('.media-library-content');
        if (content) {
            content.innerHTML = this._renderMediaItems();
            this._bindMediaItemEvents('single');
        }

        // Update footer
        const infoEl = modalContainer.querySelector('.media-library-selected-info');
        if (infoEl && !this.state.selectedMedia) {
            infoEl.innerHTML = this.__('mediaLibrary.total', { count: this.state.filteredMedia.length });
        }

        const selectBtn = modalContainer.querySelector('#media-select-btn');
        if (selectBtn) {
            selectBtn.disabled = !this.state.selectedMedia;
        }
    }

    _filterMultiMedia() {
        const { allMedia, searchTerm, selectedImages } = this.state;

        if (!searchTerm) {
            this.state.filteredMedia = [...allMedia];
        } else {
            this.state.filteredMedia = allMedia.filter(m =>
                this._resolveMediaFilename(m).toLowerCase().includes(searchTerm)
            );
        }

        this._refreshMultiImageGrid();
    }

    _refreshMultiImageGrid() {
        const modalContainer = this._getModalContainer();
        const container = modalContainer.querySelector('.media-library-content');
        if (!container) return;

        container.innerHTML = this._renderMultiMediaItems();
        this._bindMultiSelectItemEvents();
        this._updateMultiSelectUI();
    }

    _filterVideoMedia() {
        const { allMedia, searchTerm } = this.state;

        if (!searchTerm) {
            this.state.filteredMedia = [...allMedia];
        } else {
            this.state.filteredMedia = allMedia.filter(m =>
                this._resolveMediaFilename(m).toLowerCase().includes(searchTerm)
            );
        }

        // Sadece içerik alanını yeniden render et
        const content = this._getModalContainer().querySelector('.media-library-content');
        if (content) {
            content.innerHTML = this._renderVideoItems();
            this._bindVideoItemEvents();
        }

        // Footer'ı güncelle
        this._updateVideoSelectUI();
    }

    _bindUploadEvents(zoneId, inputId, type, multiple = false) {
        const uploadZone = document.getElementById(zoneId);
        const uploadInput = document.getElementById(inputId);

        uploadZone?.addEventListener('click', () => uploadInput?.click());

        uploadZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone?.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files).filter(f =>
                type === 'image' ? f.type.startsWith('image/') : f.type.startsWith('video/')
            );
            if (multiple) {
                files.forEach(file => this._uploadMedia(file, type));
            } else if (files[0]) {
                this._uploadMedia(files[0], type);
            }
        });

        uploadInput?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (multiple) {
                files.forEach(file => this._uploadMedia(file, type));
            } else if (files[0]) {
                this._uploadMedia(files[0], type);
            }
            uploadInput.value = '';
        });
    }

    async _uploadMedia(file, type) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type === 'image' ? 'product' : 'video');

        try {
            const response = await this.app.api.upload('/media/upload', formData);
            if (response.success && response.data) {
                Toast.success(type === 'image' ? this.__('mediaLibrary.toast.imageUploaded') : this.__('mediaLibrary.toast.videoUploaded'));

                // Add to list and select
                this.state.allMedia.unshift(response.data);
                this.state.filteredMedia = [...this.state.allMedia];

                if (this.state.mode === 'multi-image') {
                    this.state.selectedImages.push(response.data);
                    document.querySelector('[data-tab="img-library"]')?.click();
                    this._refreshMultiImageGrid();
                } else if (this.state.mode === 'single') {
                    this.state.selectedMedia = response.data;
                    document.querySelector('[data-tab="library"]')?.click();
                    const content = this._getModalContainer().querySelector('.media-library-content');
                    if (content) {
                        content.innerHTML = this._renderMediaItems();
                        this._bindMediaItemEvents('single');
                    }
                    const selectBtn = document.getElementById('media-select-btn');
                    if (selectBtn) selectBtn.disabled = false;
                }
            }
        } catch (error) {
            Logger.error('Media upload error:', error);
            Toast.error(this.__('mediaLibrary.toast.uploadFailed'));
        }
    }

    _formatFileSize(bytes) {
        if (!bytes) return '';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.videoThumbObserver) {
            this.videoThumbObserver.disconnect();
            this.videoThumbObserver = null;
        }
        this.state = null;
        this.modalId = null;
    }
}

export default MediaPicker;
