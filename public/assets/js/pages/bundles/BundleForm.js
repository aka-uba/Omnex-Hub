/**
 * BundleForm Page - Paket Oluşturma/Düzenleme
 *
 * Features:
 * - Product picker modal with search and multi-select
 * - Drag-drop item reordering (PlaylistDetail.js pattern)
 * - Bidirectional price calculation (discount ↔ final price)
 * - Multi-image and video support (ProductForm.js pattern)
 * - Collapsible chart-card layout (ProductForm.js pattern)
 * - Price history tracking with accordion view and export
 * - Previous price and auto price change dates
 */
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { Logger } from '../../core/Logger.js';
import { MediaUtils } from '../../utils/MediaUtils.js';
import { escapeHTML } from '../../core/SecurityUtils.js';
import { init as initMediaPicker } from '../products/form/MediaPicker.js';
import { init as initPriceHistorySection } from '../products/form/PriceHistorySection.js';

const BUNDLE_TYPES = ['menu', 'koli', 'package', 'pallet', 'basket', 'custom'];

const SKU_PREFIXES = {
    menu: 'MNU',
    koli: 'KOL',
    package: 'PKG',
    pallet: 'PLT',
    basket: 'BSK',
    custom: 'CST'
};

export class BundleFormPage {
    constructor(app) {
        this.app = app;
        this.bundleId = null;
        this.bundle = null;
        this.items = [];
        this.images = [];
        this.videos = [];
        this.coverImageIndex = 0;
        this.totalPrice = 0;
        this.discountPercent = 0;
        this.finalPrice = 0;
        this.previousFinalPrice = null;
        this.priceOverride = false;
        this._isCalculating = false;
        this.mediaPicker = null;
        this.categories = [];
        this.editingCategoryId = null;
        this.categoryModalId = null;
        this.priceHistorySection = null;
        this._itemClickHandler = null;
        this._itemInputHandler = null;
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('bundles');

        // Check if editing existing
        const hash = window.location.hash;
        const match = hash.match(/#\/bundles\/([^\/]+)/);
        if (match && match[1] !== 'new') {
            this.bundleId = match[1];
        }
    }

    render() {
        const isEdit = !!this.bundleId;
        const title = isEdit ? this.__('editBundle') : this.__('addBundle');

        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('nav.dashboard')}</a>
                    <span class="breadcrumb-separator">&gt;</span>
                    <a href="#/bundles">${this.__('title')}</a>
                    <span class="breadcrumb-separator">&gt;</span>
                    <span class="breadcrumb-current">${title}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon"><i class="ti ti-box-multiple"></i></div>
                        <div class="page-header-info">
                            <h1 class="page-title">${title}</h1>
                            <p class="page-subtitle">${this.__('subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button class="btn btn-secondary" id="btn-cancel">
                            <i class="ti ti-x"></i> ${this.__('actions.cancel')}
                        </button>
                        <button class="btn btn-primary" id="btn-save">
                            <i class="ti ti-device-floppy"></i> ${this.__('actions.save')}
                        </button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Left Column -->
                <div class="lg:col-span-2 flex flex-col gap-6">
                    ${this._renderInfoCard()}
                    ${this._renderItemsCard()}
                    ${this._renderPricingCard()}
                </div>

                <!-- Right Column -->
                <div class="flex flex-col gap-6">
                    ${this._renderStatusCard()}
                    ${this._renderImagesCard()}
                    ${this._renderVideoCard()}
                    ${this._renderValidityCard()}
                </div>
            </div>
        `;
    }

    _renderInfoCard() {
        return `
            <div class="chart-card collapsible mb-6">
                <div class="chart-card-header">
                    <h2 class="chart-card-title">
                        <i class="ti ti-info-circle"></i>
                        ${this.__('form.infoTitle')}
                    </h2>
                    <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                </div>
                <div class="chart-card-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="form-group md:col-span-2">
                            <label class="form-label">${this.__('form.name')} *</label>
                            <input type="text" class="form-input" id="bundle-name"
                                   placeholder="${this.__('form.namePlaceholder')}" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('form.type')}</label>
                            <select class="form-select" id="bundle-type">
                                ${BUNDLE_TYPES.map(t => `<option value="${t}">${this.__(`types.${t}`)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('form.category')}</label>
                            <div class="flex gap-2">
                                <select class="form-select flex-1" id="bundle-category">
                                    <option value="">${this.__('form.selectCategory')}</option>
                                </select>
                                <button type="button" id="manage-categories-btn" class="btn btn-outline" title="${this.__('form.manageCategories')}">
                                    <i class="ti ti-settings"></i>
                                </button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('form.sku')}</label>
                            <div class="flex gap-2">
                                <input type="text" class="form-input flex-1" id="bundle-sku"
                                       placeholder="${this.__('form.skuPlaceholder')}" />
                                <button type="button" id="btn-generate-sku" class="btn btn-outline" title="${this.__('form.generateSku')}">
                                    <i class="ti ti-refresh"></i>
                                </button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('form.barcode')}</label>
                            <input type="text" class="form-input" id="bundle-barcode" />
                        </div>
                        <div class="form-group md:col-span-2">
                            <label class="form-label">${this.__('form.description')}</label>
                            <textarea class="form-input" id="bundle-description" rows="3"
                                      placeholder="${this.__('form.descPlaceholder')}"></textarea>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    _renderItemsCard() {
        return `
            <div class="chart-card collapsible mb-6">
                <div class="chart-card-header">
                    <h2 class="chart-card-title">
                        <i class="ti ti-list"></i>
                        ${this.__('form.itemsTitle')}
                    </h2>
                    <button class="btn btn-sm btn-primary" id="btn-add-items" style="margin-left:auto;margin-right:8px;">
                        <i class="ti ti-plus"></i> ${this.__('form.addItem')}
                    </button>
                    <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                </div>
                <div class="chart-card-body">
                    <p class="text-muted text-sm" style="margin-bottom:12px;">
                        <i class="ti ti-grip-vertical"></i> ${this.__('form.itemsHint')}
                    </p>
                    <div id="bundle-items-container">
                        ${this._renderItems()}
                    </div>
                </div>
            </div>
        `;
    }

    _renderItems() {
        if (this.items.length === 0) {
            return `
                <div class="bundle-items-empty">
                    <i class="ti ti-package-off"></i>
                    <p>${this.__('form.noItems')}</p>
                </div>
            `;
        }

        return `
            <div class="bundle-items-list" id="sortable-bundle-items">
                ${this.items.map((item, index) => this._renderItemRow(item, index)).join('')}
            </div>
            <div class="bundle-pricing-summary">
                <div class="bundle-pricing-row">
                    <label>${this.__('form.totalPrice')}</label>
                    <span class="value" id="items-total">${this._formatPrice(this.totalPrice)}</span>
                </div>
            </div>
        `;
    }

    _renderItemRow(item, index) {
        const thumb = item.product_thumbnail || item.product_image_url;
        const thumbHtml = thumb
            ? `<img src="${this._getFileUrl(thumb)}" class="bundle-item-image" alt="" />`
            : `<div class="bundle-item-image-placeholder"><i class="ti ti-package"></i></div>`;

        const effectivePrice = item.custom_price !== null && item.custom_price !== undefined && item.custom_price !== ''
            ? parseFloat(item.custom_price) : parseFloat(item.unit_price);
        const subtotal = effectivePrice * (item.quantity || 1);

        return `
            <div class="bundle-item" data-index="${index}" draggable="false">
                <div class="bundle-item-drag" title="Sürükle">
                    <i class="ti ti-grip-vertical"></i>
                </div>
                ${thumbHtml}
                <div class="bundle-item-info">
                    <div class="bundle-item-name">${this._escapeHtml(item.product_name || item.name || '')}</div>
                    <div class="bundle-item-sku">${this._escapeHtml(item.product_sku || item.sku || '')}</div>
                </div>
                <div class="bundle-item-controls">
                    <input type="number" class="form-input bundle-item-quantity" value="${item.quantity || 1}"
                           min="1" step="1" data-index="${index}" data-field="quantity"
                           title="${this.__('form.quantity')}" />
                    <input type="number" class="form-input bundle-item-price" value="${item.custom_price !== null && item.custom_price !== undefined && item.custom_price !== '' ? item.custom_price : ''}"
                           min="0" step="0.01" data-index="${index}" data-field="custom_price"
                           placeholder="${this._formatPriceShort(item.unit_price)}"
                           title="${this.__('form.customPrice')}" />
                </div>
                <div class="bundle-item-subtotal">${this._formatPrice(subtotal)}</div>
                <button class="bundle-item-remove" data-index="${index}" title="${this.__('actions.remove')}">
                    <i class="ti ti-trash"></i>
                </button>
            </div>
        `;
    }

    _renderPricingCard() {
        const currencySymbol = this.app.i18n?.getCurrencySymbol?.() || '₺';

        return `
            <div class="chart-card collapsible">
                <div class="chart-card-header">
                    <h2 class="chart-card-title">
                        <i class="ti ti-currency-lira"></i>
                        ${this.__('form.pricingTitle')}
                    </h2>
                    <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                </div>
                <div class="chart-card-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">${this.__('form.totalPrice')}</label>
                            <input type="text" class="form-input" id="pricing-total" readonly
                                   value="${this._formatPrice(this.totalPrice)}"
                                   style="background:var(--bg-secondary);font-weight:600;" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('form.priceUpdatedAt')}</label>
                            <input type="datetime-local" class="form-input" id="pricing-updated-at" readonly />
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('form.finalPrice')}</label>
                            <div class="relative">
                                <input type="number" class="form-input pr-12" id="pricing-final"
                                       value="${this.finalPrice}" min="0" step="0.01"
                                       style="font-weight:700;color:var(--color-primary);font-size:1.1rem;" />
                                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 currency-symbol">${currencySymbol}</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('form.previousFinalPrice')}</label>
                            <div class="relative">
                                <input type="number" class="form-input pr-12" id="pricing-previous-final"
                                       value="${this.previousFinalPrice || ''}" min="0" step="0.01"
                                       placeholder="0.00" />
                                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 currency-symbol">${currencySymbol}</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('form.discountPercent')}</label>
                            <input type="number" class="form-input" id="pricing-discount"
                                   value="${this.discountPercent}" min="0" max="100" step="0.1" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">${this.__('form.previousPriceUpdatedAt')}</label>
                            <input type="datetime-local" class="form-input" id="pricing-previous-updated-at" readonly />
                        </div>
                    </div>

                    <div class="price-override-toggle mt-2">
                        <label class="toggle-switch" style="flex-shrink:0;">
                            <input type="checkbox" id="pricing-override" ${this.priceOverride ? 'checked' : ''} />
                            <span class="toggle-slider"></span>
                        </label>
                        <div>
                            <div style="font-weight:500;">${this.__('form.priceOverride')}</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);">${this.__('form.priceOverrideHint')}</div>
                        </div>
                    </div>

                    <!-- Price History Accordion -->
                    <div id="bundle-price-history-container" class="mt-4"></div>
                </div>
            </div>
        `;
    }

    _renderStatusCard() {
        return `
            <div class="chart-card collapsible mb-6">
                <div class="chart-card-header">
                    <h2 class="chart-card-title">
                        <i class="ti ti-toggle-left"></i>
                        ${this.__('form.statusTitle')}
                    </h2>
                    <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                </div>
                <div class="chart-card-body">
                    <select class="form-select" id="bundle-status">
                        <option value="active">${this.__('status.active')}</option>
                        <option value="draft">${this.__('status.draft')}</option>
                        <option value="inactive">${this.__('status.inactive')}</option>
                    </select>
                </div>
            </div>
        `;
    }

    _renderImagesCard() {
        return `
            <div class="chart-card collapsible mb-6">
                <div class="chart-card-header">
                    <h2 class="chart-card-title">
                        <i class="ti ti-photo"></i>
                        ${this.__('form.media.images')}
                    </h2>
                    <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                </div>
                <div class="chart-card-body">
                    <div id="images-grid" class="product-media-grid"></div>
                    <input type="file" id="bundle-image-input" class="hidden" accept="image/*" multiple>
                    <div class="flex gap-2 mt-3">
                        <button type="button" id="select-images-from-library" class="btn btn-outline btn-sm flex-1">
                            <i class="ti ti-folder"></i>
                            ${this.__('form.media.selectFromLibrary')}
                        </button>
                        <button type="button" id="upload-images-btn" class="btn btn-outline btn-sm">
                            <i class="ti ti-upload"></i>
                        </button>
                    </div>
                    <p class="text-xs text-gray-500 mt-2">${this.__('form.media.imagesHint')}</p>
                </div>
            </div>
        `;
    }

    renderImagesGrid() {
        const grid = document.getElementById('images-grid');
        if (!grid) return;

        if (this.coverImageIndex >= this.images.length) {
            this.coverImageIndex = 0;
        }

        if (this.images.length === 0) {
            grid.innerHTML = `
                <div class="product-media-placeholder" id="images-placeholder">
                    <i class="ti ti-photo"></i>
                    <span>${this.__('form.media.clickOrDragImages')}</span>
                </div>
            `;
            document.getElementById('images-placeholder')?.addEventListener('click', () => {
                document.getElementById('bundle-image-input')?.click();
            });
        } else {
            const isCover = (index) => index === this.coverImageIndex;

            grid.innerHTML = `
                ${this.images.map((img, index) => `
                    <div class="product-media-item ${isCover(index) ? 'is-cover' : ''}" data-index="${index}" data-type="image">
                        <img src="${this.getDisplayUrl(img.url)}" alt="${this.__('form.media.image')} ${index + 1}">
                        ${isCover(index) ? `<span class="product-media-cover-badge"><i class="ti ti-photo-star"></i> ${this.__('form.media.cover')}</span>` : ''}
                        <div class="product-media-actions">
                            ${!isCover(index) ? `
                                <button type="button" class="product-media-action-btn" data-action="set-cover" data-index="${index}" title="${this.__('form.media.setCover')}">
                                    <i class="ti ti-photo-star"></i>
                                </button>
                            ` : ''}
                            <button type="button" class="product-media-action-btn danger" data-action="remove-image" data-index="${index}" title="${this.__('form.media.remove')}">
                                <i class="ti ti-x"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
                <div class="product-media-add" id="add-more-images">
                    <i class="ti ti-plus"></i>
                </div>
            `;

            this.bindImagesGridEvents();
        }
    }

    bindImagesGridEvents() {
        document.getElementById('add-more-images')?.addEventListener('click', () => {
            document.getElementById('bundle-image-input')?.click();
        });

        document.querySelectorAll('#images-grid .product-media-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const index = parseInt(btn.dataset.index);

                if (action === 'set-cover') {
                    this.setCoverImage(index);
                } else if (action === 'remove-image') {
                    this.removeImage(index);
                }
            });
        });
    }

    addImage(url, filename = '') {
        const normalizedUrl = MediaUtils.normalizeUrl(url);
        this.images.push({ url: normalizedUrl, filename: filename || url.split('/').pop() });
        this.renderImagesGrid();
    }

    removeImage(index) {
        this.images.splice(index, 1);
        if (this.images.length === 0) {
            this.coverImageIndex = 0;
        } else if (index < this.coverImageIndex) {
            this.coverImageIndex--;
        } else if (index === this.coverImageIndex) {
            this.coverImageIndex = 0;
        }
        this.renderImagesGrid();
    }

    setCoverImage(index) {
        if (index >= 0 && index < this.images.length) {
            this.coverImageIndex = index;
            this.renderImagesGrid();
        }
    }

    async uploadImage(file) {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            Toast.error(this.__('toast.invalidImageType'));
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            Toast.error(this.__('toast.imageSizeLimit'));
            return;
        }
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'product');
            const response = await this.app.api.upload('/media/upload', formData);
            if (response.success && response.data) {
                const mediaUrl = response.data.url || response.data.path;
                this.addImage(mediaUrl, response.data.filename || file.name);
                Toast.success(this.__('toast.imageUploaded'));
            } else {
                Toast.error(this.__('toast.imageUploadFailed'));
            }
        } catch (error) {
            Logger.error('Image upload error:', error);
            Toast.error(this.__('toast.imageUploadError'));
        }
    }

    getDisplayUrl(url) {
        return MediaUtils.getDisplayUrl(url);
    }

    _renderVideoCard() {
        return `
            <div class="chart-card collapsible mb-6">
                <div class="chart-card-header">
                    <h2 class="chart-card-title">
                        <i class="ti ti-video"></i>
                        ${this.__('form.media.videos')}
                    </h2>
                    <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                </div>
                <div class="chart-card-body">
                    <div id="videos-grid" class="product-media-grid"></div>
                    <input type="file" id="bundle-video-input" class="hidden" accept="video/*" multiple>
                    <div class="flex gap-2 mt-3">
                        <button type="button" id="select-videos-from-library" class="btn btn-outline btn-sm flex-1">
                            <i class="ti ti-folder"></i>
                            ${this.__('form.media.selectFromLibrary')}
                        </button>
                        <button type="button" id="add-video-url-btn" class="btn btn-outline btn-sm flex-1">
                            <i class="ti ti-link"></i>
                            ${this.__('form.media.addLink')}
                        </button>
                        <button type="button" id="upload-videos-btn" class="btn btn-outline btn-sm">
                            <i class="ti ti-upload"></i>
                        </button>
                    </div>
                    <p class="text-xs text-gray-500 mt-2">${this.__('form.media.videosHint')}</p>
                </div>
            </div>
        `;
    }

    renderVideosGrid() {
        const grid = document.getElementById('videos-grid');
        if (!grid) return;

        if (this.videos.length === 0) {
            grid.innerHTML = `
                <div class="product-media-placeholder" id="videos-placeholder">
                    <i class="ti ti-video"></i>
                    <span>${this.__('form.media.clickToAddVideo')}</span>
                </div>
            `;
            document.getElementById('videos-placeholder')?.addEventListener('click', () => {
                this.showVideoUrlModal();
            });
        } else {
            grid.innerHTML = `
                ${this.videos.map((video, index) => `
                    <div class="product-media-item video-item" data-index="${index}" data-type="video">
                        ${this.getVideoThumbnail(video)}
                        <div class="product-media-overlay">
                            <i class="ti ti-player-play"></i>
                        </div>
                        <div class="product-media-video-info">
                            <span class="video-type-badge">${this.getVideoType(video.url)}</span>
                        </div>
                        <div class="product-media-actions">
                            <button type="button" class="product-media-action-btn" data-action="preview-video" data-index="${index}" title="${this.__('form.media.preview')}">
                                <i class="ti ti-eye"></i>
                            </button>
                            <button type="button" class="product-media-action-btn danger" data-action="remove-video" data-index="${index}" title="${this.__('form.media.remove')}">
                                <i class="ti ti-x"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
                <div class="product-media-add" id="add-more-videos">
                    <i class="ti ti-plus"></i>
                </div>
            `;

            this.bindVideosGridEvents();
        }
    }

    bindVideosGridEvents() {
        document.getElementById('add-more-videos')?.addEventListener('click', () => {
            this.showVideoUrlModal();
        });

        document.querySelectorAll('#videos-grid .product-media-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const index = parseInt(btn.dataset.index);

                if (action === 'preview-video') {
                    this.previewVideo(index);
                } else if (action === 'remove-video') {
                    this.removeVideo(index);
                }
            });
        });
    }

    getVideoThumbnail(video) {
        const type = this.getVideoType(video.url);

        if (type === 'YouTube') {
            const videoId = this.extractYouTubeId(video.url);
            if (videoId) {
                return `<img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" alt="Video thumbnail">`;
            }
        } else if (type === 'Vimeo') {
            return `<div class="video-placeholder vimeo-placeholder"><i class="ti ti-brand-vimeo"></i></div>`;
        } else if (type === 'Video') {
            return `<video src="${this._escapeHtml(video.url)}" class="video-thumbnail" preload="metadata" muted></video>`;
        }

        return `<div class="video-placeholder"><i class="ti ti-link"></i></div>`;
    }

    getVideoType(url) {
        if (!url) return 'Video';
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
        if (url.includes('vimeo.com')) return 'Vimeo';
        if (url.match(/\.(mp4|webm|ogg|avi|mov)$/i)) return 'Video';
        return 'Link';
    }

    extractYouTubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    addVideo(url, title = '') {
        this.videos.push({ url, title: title || 'Video ' + (this.videos.length + 1) });
        this.renderVideosGrid();
    }

    removeVideo(index) {
        this.videos.splice(index, 1);
        this.renderVideosGrid();
    }

    previewVideo(index) {
        const video = this.videos[index];
        if (!video) return;

        const type = this.getVideoType(video.url);
        let embedHtml = '';

        if (type === 'YouTube') {
            const videoId = this.extractYouTubeId(video.url);
            if (videoId) {
                embedHtml = `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
            }
        } else if (type === 'Vimeo') {
            const vimeoMatch = video.url.match(/vimeo.com\/(\d+)/);
            if (vimeoMatch) {
                embedHtml = `<iframe width="100%" height="400" src="https://player.vimeo.com/video/${vimeoMatch[1]}" frameborder="0" allowfullscreen></iframe>`;
            }
        } else {
            embedHtml = `<video width="100%" height="400" controls><source src="${this._escapeHtml(video.url)}" type="video/mp4">${this.__('form.media.videoNotSupported')}</video>`;
        }

        Modal.show({
            title: this._escapeHtml(video.title) || this.__('form.media.videoPreview'),
            icon: 'ti-video',
            content: `<div class="video-preview-container">${embedHtml}</div>`,
            size: 'lg',
            showConfirm: false,
            cancelText: this.__('actions.cancel')
        });
    }

    showVideoUrlModal() {
        Modal.show({
            title: this.__('form.media.addVideo'),
            icon: 'ti-video-plus',
            content: `
                <div class="form-group">
                    <label class="form-label">${this.__('form.media.videoUrl')}</label>
                    <input type="url" id="video-url-input" class="form-input" placeholder="${this.__('form.media.videoUrlPlaceholder')}">
                    <small class="text-gray-500 mt-1 block">${this.__('form.media.videoUrlHint')}</small>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('form.media.videoTitle')}</label>
                    <input type="text" id="video-title-input" class="form-input" placeholder="${this.__('form.media.videoTitlePlaceholder')}">
                </div>
            `,
            size: 'md',
            confirmText: this.__('form.addSelected'),
            cancelText: this.__('actions.cancel'),
            onConfirm: () => {
                const url = document.getElementById('video-url-input')?.value?.trim();
                const title = document.getElementById('video-title-input')?.value?.trim();

                if (!url) {
                    Toast.error(this.__('toast.videoUrlRequired'));
                    throw new Error('URL required');
                }

                try {
                    new URL(url);
                } catch {
                    Toast.error(this.__('toast.invalidUrl'));
                    throw new Error('Invalid URL');
                }

                this.addVideo(url, title);
                Toast.success(this.__('toast.videoAdded'));
            }
        });
    }

    async uploadVideo(file) {
        if (!file) return;
        if (!file.type.startsWith('video/')) {
            Toast.error(this.__('toast.invalidVideoType'));
            return;
        }
        if (file.size > 100 * 1024 * 1024) {
            Toast.error(this.__('toast.videoSizeLimit'));
            return;
        }
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'video');
            const response = await this.app.api.upload('/media/upload', formData);
            if (response.success && response.data) {
                const mediaUrl = response.data.url || response.data.path;
                this.addVideo(mediaUrl, response.data.filename || file.name);
                Toast.success(this.__('toast.videoUploaded'));
            } else {
                Toast.error(this.__('toast.videoUploadFailed'));
            }
        } catch (error) {
            Logger.error('Video upload error:', error);
            Toast.error(this.__('toast.videoUploadError'));
        }
    }

    _renderValidityCard() {
        return `
            <div class="chart-card collapsible mb-6">
                <div class="chart-card-header">
                    <h2 class="chart-card-title">
                        <i class="ti ti-calendar"></i>
                        ${this.__('form.validityTitle')}
                    </h2>
                    <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                </div>
                <div class="chart-card-body">
                    <div class="form-group">
                        <label class="form-label">${this.__('form.validFrom')}</label>
                        <input type="date" class="form-input" id="bundle-valid-from" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.validUntil')}</label>
                        <input type="date" class="form-input" id="bundle-valid-until" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.priceValidFrom')}</label>
                        <input type="date" class="form-input" id="bundle-price-valid-from" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('form.priceValidUntil')}</label>
                        <input type="date" class="form-input" id="bundle-price-valid-until" />
                    </div>
                </div>
            </div>
        `;
    }

    async init() {
        this.bindEvents();
        this._initMediaPicker();
        this._initPriceHistory();

        // Render initial grids
        this.renderImagesGrid();
        this.renderVideosGrid();

        // Load categories
        await this.loadCategories();

        if (this.bundleId) {
            await this.loadBundle();
        } else {
            // Auto-generate SKU for new bundles
            this.generateSku();
        }

        this.initDragDrop();
    }

    _initMediaPicker() {
        const container = document.createElement('div');
        container.id = 'bundle-media-picker-container';

        this.mediaPicker = initMediaPicker({
            container,
            app: this.app,
            onSelect: (result) => this._handleMediaSelection(result)
        });
    }

    _initPriceHistory() {
        const container = document.getElementById('bundle-price-history-container');
        if (!container) return;

        this.priceHistorySection = initPriceHistorySection({
            container,
            app: this.app,
            productId: this.bundleId, // reuse productId param for bundleId
            productName: '',
            translator: (key, params) => this.__(key, params),
            mode: 'accordion'
        });

        this.priceHistorySection.render();
        this.priceHistorySection.bindEvents();
    }

    _handleMediaSelection(result) {
        switch (result.mode) {
            case 'multi-image':
                result.media.forEach(img => {
                    this.addImage(img.url, img.filename);
                });
                break;
            case 'multi-video':
                result.media.forEach(video => {
                    this.addVideo(video.url, video.filename);
                });
                break;
        }
    }

    bindEvents() {
        // Save / Cancel
        document.getElementById('btn-save')?.addEventListener('click', () => this.save());
        document.getElementById('btn-cancel')?.addEventListener('click', () => {
            this.app.router.navigate('/bundles');
        });

        // Add items
        document.getElementById('btn-add-items')?.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card collapse
            this.showProductPicker();
        });

        // Generate SKU
        document.getElementById('btn-generate-sku')?.addEventListener('click', () => this.generateSku());

        // Category management modal
        document.getElementById('manage-categories-btn')?.addEventListener('click', () => {
            this.showCategoryManagementModal();
        });

        // Collapsible cards toggle
        document.querySelectorAll('.chart-card.collapsible .chart-card-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (e.target.closest('button, input, select, a, .badge, .btn')) return;
                header.closest('.chart-card').classList.toggle('collapsed');
            });
        });

        // Image file input (multiple)
        const imageInput = document.getElementById('bundle-image-input');
        imageInput?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => this.uploadImage(file));
            imageInput.value = '';
        });

        // Upload images button
        document.getElementById('upload-images-btn')?.addEventListener('click', () => {
            imageInput?.click();
        });

        // Select images from library
        document.getElementById('select-images-from-library')?.addEventListener('click', () => {
            this.mediaPicker?.showMultiImagePicker();
        });

        // Video file input (multiple)
        const videoInput = document.getElementById('bundle-video-input');
        videoInput?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => this.uploadVideo(file));
            videoInput.value = '';
        });

        // Upload videos button
        document.getElementById('upload-videos-btn')?.addEventListener('click', () => {
            videoInput?.click();
        });

        // Select videos from library
        document.getElementById('select-videos-from-library')?.addEventListener('click', () => {
            this.mediaPicker?.showVideoPicker();
        });

        // Add video URL
        document.getElementById('add-video-url-btn')?.addEventListener('click', () => {
            this.showVideoUrlModal();
        });

        // Pricing inputs
        document.getElementById('pricing-discount')?.addEventListener('input', (e) => {
            if (this._isCalculating) return;
            this._isCalculating = true;
            this.discountPercent = parseFloat(e.target.value) || 0;
            if (!this.priceOverride) {
                this.finalPrice = +(this.totalPrice * (1 - this.discountPercent / 100)).toFixed(2);
                document.getElementById('pricing-final').value = this.finalPrice;
            }
            this._isCalculating = false;
        });

        document.getElementById('pricing-final')?.addEventListener('input', (e) => {
            if (this._isCalculating) return;
            this._isCalculating = true;
            this.finalPrice = parseFloat(e.target.value) || 0;
            if (this.priceOverride && this.totalPrice > 0) {
                this.discountPercent = +((this.totalPrice - this.finalPrice) / this.totalPrice * 100).toFixed(2);
                document.getElementById('pricing-discount').value = this.discountPercent;
            }
            this._isCalculating = false;
        });

        document.getElementById('pricing-override')?.addEventListener('change', (e) => {
            this.priceOverride = e.target.checked;
        });

        // Delegate events for item controls
        if (this._itemClickHandler) {
            document.removeEventListener('click', this._itemClickHandler);
        }
        if (this._itemInputHandler) {
            document.removeEventListener('input', this._itemInputHandler);
        }
        this._itemClickHandler = (e) => this._handleItemClick(e);
        this._itemInputHandler = (e) => this._handleItemInput(e);
        document.addEventListener('click', this._itemClickHandler);
        document.addEventListener('input', this._itemInputHandler);
    }

    _handleItemClick(e) {
        // Remove item
        const removeBtn = e.target.closest('.bundle-item-remove[data-index]');
        if (removeBtn) {
            const index = parseInt(removeBtn.dataset.index);
            this.items.splice(index, 1);
            this.refreshItems();
            return;
        }
    }

    _handleItemInput(e) {
        const input = e.target;
        if (!input.dataset.index || !input.dataset.field) return;

        const index = parseInt(input.dataset.index);
        const field = input.dataset.field;
        const item = this.items[index];
        if (!item) return;

        if (field === 'quantity') {
            item.quantity = Math.max(1, parseInt(input.value) || 1);
        } else if (field === 'custom_price') {
            item.custom_price = input.value !== '' ? parseFloat(input.value) : null;
        }

        this.recalculatePricing();
    }

    refreshItems() {
        const container = document.getElementById('bundle-items-container');
        if (container) {
            container.innerHTML = this._renderItems();
        }
        this.recalculatePricing();
        this.initDragDrop();
    }

    recalculatePricing() {
        this.totalPrice = 0;
        this.items.forEach(item => {
            const price = (item.custom_price !== null && item.custom_price !== undefined && item.custom_price !== '')
                ? parseFloat(item.custom_price) : parseFloat(item.unit_price || 0);
            this.totalPrice += price * (item.quantity || 1);
        });

        const totalEl = document.getElementById('pricing-total');
        const itemsTotal = document.getElementById('items-total');
        if (totalEl) totalEl.value = this._formatPrice(this.totalPrice);
        if (itemsTotal) itemsTotal.textContent = this._formatPrice(this.totalPrice);

        // Recalculate based on override mode
        if (this.priceOverride) {
            if (this.totalPrice > 0) {
                this.discountPercent = +((this.totalPrice - this.finalPrice) / this.totalPrice * 100).toFixed(2);
                const discountEl = document.getElementById('pricing-discount');
                if (discountEl) discountEl.value = this.discountPercent;
            }
        } else {
            this.finalPrice = +(this.totalPrice * (1 - this.discountPercent / 100)).toFixed(2);
            const finalEl = document.getElementById('pricing-final');
            if (finalEl) finalEl.value = this.finalPrice;
        }

        // Update subtotals in item rows
        document.querySelectorAll('.bundle-item-subtotal').forEach((el, i) => {
            const item = this.items[i];
            if (item) {
                const price = (item.custom_price !== null && item.custom_price !== undefined && item.custom_price !== '')
                    ? parseFloat(item.custom_price) : parseFloat(item.unit_price || 0);
                el.textContent = this._formatPrice(price * (item.quantity || 1));
            }
        });
    }

    // ==========================================
    // Drag & Drop (PlaylistDetail.js pattern)
    // ==========================================
    initDragDrop() {
        const container = document.getElementById('sortable-bundle-items');
        if (!container) return;

        const items = container.querySelectorAll('.bundle-item');
        let draggingEl = null;

        items.forEach(item => {
            const dragHandle = item.querySelector('.bundle-item-drag');
            if (!dragHandle) return;

            item.setAttribute('draggable', 'true');

            item.addEventListener('dragstart', (e) => {
                draggingEl = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.dataset.index);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
                draggingEl = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (draggingEl && draggingEl !== item) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = parseInt(item.dataset.index);
                if (fromIndex !== toIndex) {
                    this.reorderItems(fromIndex, toIndex);
                }
            });
        });
    }

    reorderItems(fromIndex, toIndex) {
        const [movedItem] = this.items.splice(fromIndex, 1);
        this.items.splice(toIndex, 0, movedItem);
        this.items.forEach((item, index) => {
            item.sort_order = index;
        });
        this.refreshItems();
    }

    // ==========================================
    // Product Picker Modal
    // ==========================================
    async showProductPicker() {
        let products = [];
        let searchTimeout = null;
        const selectedIds = new Set();

        const loadProducts = async (search = '') => {
            try {
                const params = new URLSearchParams({ limit: '50', status: 'active' });
                if (search) params.append('search', search);
                const response = await this.app.api.get(`/products?${params.toString()}`);
                if (response.success) {
                    products = (response.data.products || response.data || []);
                }
            } catch (error) {
                Logger.error('Load products failed:', error);
            }
        };

        await loadProducts();

        const renderProducts = () => {
            const existingIds = new Set(this.items.map(i => i.product_id));
            return products.map(p => {
                const isAdded = existingIds.has(p.id);
                const isSelected = selectedIds.has(p.id);
                const imgs = typeof p.images === 'string' ? (JSON.parse(p.images || '[]')) : (p.images || []);
                const thumb = p.image_url || (imgs.length > 0 ? imgs[0].url : '');

                return `
                    <div class="product-picker-item ${isSelected ? 'selected' : ''} ${isAdded ? 'opacity-50' : ''}"
                         data-product-id="${p.id}" ${isAdded ? 'title="' + this.__('messages.productAlreadyAdded') + '"' : ''}>
                        <input type="checkbox" class="product-picker-check"
                               ${isSelected ? 'checked' : ''} ${isAdded ? 'disabled' : ''}
                               data-pid="${p.id}" />
                        ${thumb ? `<img src="${this._getFileUrl(thumb)}" style="width:36px;height:36px;border-radius:4px;object-fit:cover;" />` : ''}
                        <div class="product-picker-info">
                            <div class="product-picker-name">${this._escapeHtml(p.name)}</div>
                            <div class="product-picker-meta">${this._escapeHtml(p.sku || '')} ${p.barcode ? '| ' + this._escapeHtml(p.barcode) : ''}</div>
                        </div>
                        <div class="product-picker-price">${this._formatPrice(p.current_price)}</div>
                    </div>
                `;
            }).join('') || `<p class="text-muted text-center" style="padding:20px;">${this.__('form.noItems')}</p>`;
        };

        Modal.show({
            title: this.__('form.selectProducts'),
            icon: 'ti-package',
            size: 'lg',
            content: `
                <div class="product-picker">
                    <div class="product-picker-search" style="margin-bottom:12px;">
                        <input type="text" class="form-input" id="product-picker-search"
                               placeholder="${this.__('form.searchProducts')}" />
                    </div>
                    <div id="product-picker-list">${renderProducts()}</div>
                </div>
            `,
            confirmText: this.__('form.addSelected'),
            cancelText: this.__('actions.cancel'),
            onConfirm: () => {
                if (selectedIds.size === 0) {
                    Toast.warning(this.__('messages.noProductsSelected'));
                    return false;
                }

                const existingIds = new Set(this.items.map(i => i.product_id));

                selectedIds.forEach(pid => {
                    if (existingIds.has(pid)) return;
                    const product = products.find(p => p.id === pid);
                    if (!product) return;

                    const imgs = typeof product.images === 'string' ? (JSON.parse(product.images || '[]')) : (product.images || []);

                    this.items.push({
                        product_id: product.id,
                        product_name: product.name,
                        product_sku: product.sku,
                        product_barcode: product.barcode,
                        product_image_url: product.image_url,
                        product_thumbnail: product.image_url || (imgs.length > 0 ? imgs[0].url : null),
                        unit_price: parseFloat(product.current_price) || 0,
                        custom_price: null,
                        quantity: 1,
                        sort_order: this.items.length,
                        notes: null
                    });
                });

                this.refreshItems();
            }
        });

        // Search handler
        setTimeout(() => {
            const searchInput = document.getElementById('product-picker-search');
            const listEl = document.getElementById('product-picker-list');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(async () => {
                        await loadProducts(e.target.value);
                        if (listEl) listEl.innerHTML = renderProducts();
                        // Rebind click handlers
                        bindPickerClicks();
                    }, 300);
                });
            }

            const bindPickerClicks = () => {
                document.querySelectorAll('.product-picker-item').forEach(el => {
                    el.addEventListener('click', (e) => {
                        const pid = el.dataset.productId;
                        const checkbox = el.querySelector('.product-picker-check');
                        if (checkbox && checkbox.disabled) return;

                        const isCheckbox = e.target.tagName === 'INPUT';

                        if (selectedIds.has(pid)) {
                            selectedIds.delete(pid);
                            el.classList.remove('selected');
                            if (checkbox && !isCheckbox) checkbox.checked = false;
                        } else {
                            selectedIds.add(pid);
                            el.classList.add('selected');
                            if (checkbox && !isCheckbox) checkbox.checked = true;
                        }
                    });
                });
            };

            bindPickerClicks();
        }, 100);
    }


    // ==========================================
    // Load / Save
    // ==========================================
    async loadBundle() {
        try {
            // Check for active branch (branch-specific price override support)
            const activeBranch = this.app?.state?.get('activeBranch');
            const branchId = activeBranch?.id;
            let url = `/bundles/${this.bundleId}`;
            if (branchId) {
                url += `?branch_id=${branchId}`;
            }

            const response = await this.app.api.get(url);
            if (!response.success) {
                Toast.error(this.__('messages.loadFailed'));
                return;
            }

            const b = response.data;
            this.bundle = b;
            this.items = (b.items || []).map(item => ({
                ...item,
                product_name: item.product_name || item.name,
                product_sku: item.product_sku || item.sku,
                product_thumbnail: item.product_thumbnail || item.product_image_url,
                custom_price: item.custom_price !== null && item.custom_price !== undefined ? item.custom_price : null
            }));
            this.images = Array.isArray(b.images) ? b.images : [];
            this.videos = Array.isArray(b.videos) ? b.videos : [];
            this.coverImageIndex = parseInt(b.cover_image_index) || 0;
            this.totalPrice = parseFloat(b.total_price) || 0;
            this.discountPercent = parseFloat(b.discount_percent) || 0;
            this.finalPrice = parseFloat(b.final_price) || 0;
            this.previousFinalPrice = b.previous_final_price !== null && b.previous_final_price !== undefined ? parseFloat(b.previous_final_price) : null;
            this.priceOverride = !!parseInt(b.price_override);

            // Populate form fields
            this._setVal('bundle-name', b.name);
            this._setVal('bundle-type', b.type);
            this._setVal('bundle-category', b.category);
            this._setVal('bundle-sku', b.sku);
            this._setVal('bundle-barcode', b.barcode);
            this._setVal('bundle-description', b.description);
            this._setVal('bundle-status', b.status);
            this._setVal('bundle-valid-from', b.valid_from);
            this._setVal('bundle-valid-until', b.valid_until);
            this._setVal('bundle-price-valid-from', b.price_valid_from);
            this._setVal('bundle-price-valid-until', b.price_valid_until);
            this._setVal('pricing-total', this._formatPrice(this.totalPrice));
            this._setVal('pricing-discount', this.discountPercent);
            this._setVal('pricing-final', this.finalPrice);
            this._setVal('pricing-previous-final', this.previousFinalPrice !== null ? this.previousFinalPrice : '');

            // Set price date fields
            if (b.price_updated_at) {
                this._setVal('pricing-updated-at', this._toDatetimeLocal(b.price_updated_at));
            }
            if (b.previous_price_updated_at) {
                this._setVal('pricing-previous-updated-at', this._toDatetimeLocal(b.previous_price_updated_at));
            }

            const overrideEl = document.getElementById('pricing-override');
            if (overrideEl) overrideEl.checked = this.priceOverride;

            // Re-render dynamic sections
            this.refreshItems();
            this.renderImagesGrid();
            this.renderVideosGrid();

            // Set price history
            if (this.priceHistorySection) {
                this.priceHistorySection.setProductName(b.name || '');
                if (b.price_history && b.price_history.length > 0) {
                    this.priceHistorySection.setHistory(b.price_history);
                }
            }

        } catch (error) {
            Logger.error('Load bundle failed:', error);
            Toast.error(this.__('messages.loadFailed'));
        }
    }

    async save() {
        const name = document.getElementById('bundle-name')?.value?.trim();
        if (!name) {
            Toast.error(this.__('messages.nameRequired'));
            document.getElementById('bundle-name')?.focus();
            return;
        }

        const data = {
            name: name,
            type: document.getElementById('bundle-type')?.value || 'package',
            description: document.getElementById('bundle-description')?.value || '',
            category: document.getElementById('bundle-category')?.value || '',
            sku: document.getElementById('bundle-sku')?.value || '',
            barcode: document.getElementById('bundle-barcode')?.value || '',
            status: document.getElementById('bundle-status')?.value || 'active',
            valid_from: document.getElementById('bundle-valid-from')?.value || null,
            valid_until: document.getElementById('bundle-valid-until')?.value || null,
            price_valid_from: document.getElementById('bundle-price-valid-from')?.value || null,
            price_valid_until: document.getElementById('bundle-price-valid-until')?.value || null,
            discount_percent: this.discountPercent,
            final_price: this.finalPrice,
            price_override: this.priceOverride ? 1 : 0,
            images: this.images,
            videos: this.videos,
            image_url: this.images.length > 0 ? this.images[this.coverImageIndex]?.url : null,
            cover_image_index: this.coverImageIndex,
            items: this.items.map((item, index) => ({
                product_id: item.product_id,
                quantity: item.quantity || 1,
                unit_price: item.unit_price || 0,
                custom_price: item.custom_price,
                sort_order: index,
                notes: item.notes || null
            }))
        };

        // Check for active branch - if branch is selected, send branch override
        const activeBranch = this.app?.state?.get('activeBranch');
        const branchId = activeBranch?.id;
        if (branchId && this.bundleId) {
            data.branch_id = branchId;
        }

        try {
            let response;
            if (this.bundleId) {
                response = await this.app.api.put(`/bundles/${this.bundleId}`, data);
            } else {
                response = await this.app.api.post('/bundles', data);
            }

            if (response.success) {
                Toast.success(this.bundleId ? this.__('messages.updated') : this.__('messages.created'));
                this.app.router.navigate('/bundles');
            } else {
                Toast.error(response.message || this.__('messages.saveFailed'));
            }
        } catch (error) {
            Logger.error('Save bundle failed:', error);
            Toast.error(this.__('messages.saveFailed'));
        }
    }

    // ==========================================
    // SKU Auto-Generation
    // ==========================================
    generateSku() {
        const type = document.getElementById('bundle-type')?.value || 'package';
        const prefix = SKU_PREFIXES[type] || 'BND';
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        const sku = `${prefix}-${timestamp}-${random}`;
        const skuInput = document.getElementById('bundle-sku');
        if (skuInput) skuInput.value = sku;
    }

    // ==========================================
    // Category System
    // ==========================================
    async loadCategories() {
        try {
            const response = await this.app.api.get('/categories');
            this.categories = response.data || [];
            this.populateCategories();
        } catch (error) {
            Logger.error('Categories load error:', error);
        }
    }

    populateCategories() {
        const select = document.getElementById('bundle-category');
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = `<option value="">${this.__('form.selectCategory')}</option>`;

        const tree = this.buildCategoryTree(this.categories);
        this.renderCategoryOptions(select, tree, 0);

        // Restore value
        if (currentVal) select.value = currentVal;
    }

    buildCategoryTree(categories, parentId = null) {
        return categories
            .filter(cat => cat.parent_id === parentId)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(cat => ({
                ...cat,
                children: this.buildCategoryTree(categories, cat.id)
            }));
    }

    renderCategoryOptions(select, categories, level) {
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.dataset.id = cat.id;
            const prefix = level > 0 ? '\u2500'.repeat(level * 2) + ' ' : '';
            option.textContent = prefix + cat.name;
            select.appendChild(option);

            if (cat.children && cat.children.length > 0) {
                this.renderCategoryOptions(select, cat.children, level + 1);
            }
        });
    }

    showCategoryManagementModal() {
        this.editingCategoryId = null;

        const modal = Modal.show({
            title: this.__('form.manageCategories'),
            icon: 'ti-category',
            content: this.renderCategoryModalContent(),
            size: 'lg',
            showConfirm: false,
            cancelText: this.__('actions.cancel'),
            onClose: () => {
                this.categoryModalId = null;
            }
        });

        this.categoryModalId = modal.id;
        this.bindCategoryModalEvents();
    }

    renderCategoryModalContent() {
        const categoryTree = this.buildCategoryTree(this.categories);

        return `
            <div class="category-management">
                <div class="category-form-section mb-4">
                    <h4 class="text-sm font-medium mb-3" id="category-form-title">
                        <i class="ti ti-folder-plus text-primary-500 mr-2"></i>
                        ${this.__('categories.addCategory')}
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="form-group mb-0">
                            <label class="form-label text-sm">${this.__('categories.name')} *</label>
                            <input type="text" id="cat-name" class="form-input form-input-sm" placeholder="${this.__('categories.namePlaceholder')}">
                        </div>
                        <div class="form-group mb-0">
                            <label class="form-label text-sm">${this.__('categories.parent')}</label>
                            <select id="cat-parent" class="form-select form-select-sm">
                                <option value="">${this.__('categories.parentPlaceholder')}</option>
                                ${this.renderParentOptions(categoryTree, 0)}
                            </select>
                        </div>
                        <div class="form-group mb-0">
                            <label class="form-label text-sm">${this.__('categories.color')}</label>
                            <div class="flex gap-2">
                                <input type="color" id="cat-color" class="form-color h-9 w-12" value="#228be6">
                                <input type="text" id="cat-color-hex" class="form-input form-input-sm flex-1" value="#228be6" placeholder="#228be6">
                            </div>
                        </div>
                        <div class="form-group mb-0">
                            <label class="form-label text-sm">${this.__('categories.order')}</label>
                            <input type="number" id="cat-sort" class="form-input form-input-sm" value="0" min="0">
                        </div>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button type="button" id="btn-save-category" class="btn btn-primary btn-sm">
                            <i class="ti ti-check"></i>
                            <span id="btn-save-text">${this.__('actions.save')}</span>
                        </button>
                        <button type="button" id="btn-cancel-edit" class="btn btn-outline btn-sm hidden">
                            <i class="ti ti-x"></i>
                            ${this.__('actions.cancel')}
                        </button>
                    </div>
                    <input type="hidden" id="cat-edit-id" value="">
                </div>

                <div class="category-list-section">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="text-sm font-medium">
                            <i class="ti ti-list-tree text-primary-500 mr-2"></i>
                            ${this.__('categories.listTitle')}
                        </h4>
                        <span class="text-xs text-gray-500">${this.categories.length}</span>
                    </div>
                    ${categoryTree.length === 0 ? `
                        <div class="text-center py-8 text-gray-500">
                            <i class="ti ti-folder-off text-3xl mb-2"></i>
                            <p>${this.__('categories.empty')}</p>
                        </div>
                    ` : `
                        <div class="category-tree">
                            ${this.renderCategoryTree(categoryTree, 0)}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    renderParentOptions(categories, level, excludeId = null) {
        let html = '';
        categories.forEach(cat => {
            if (cat.id === excludeId) return;
            const prefix = '\u2500'.repeat(level * 2);
            html += `<option value="${escapeHTML(cat.id)}">${prefix} ${escapeHTML(cat.name)}</option>`;
            if (cat.children && cat.children.length > 0) {
                html += this.renderParentOptions(cat.children, level + 1, excludeId);
            }
        });
        return html;
    }

    renderCategoryTree(categories, level) {
        let html = '';
        categories.forEach(cat => {
            const hasChildren = cat.children && cat.children.length > 0;
            html += `
                <div class="category-item" data-id="${cat.id}" data-level="${level}">
                    <div class="category-row flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                        <div class="category-indent" style="width: ${level * 24}px"></div>
                        ${hasChildren ? `
                            <button class="btn-toggle p-1 text-gray-400 hover:text-gray-600" data-toggle="${cat.id}">
                                <i class="ti ti-chevron-down text-sm"></i>
                            </button>
                        ` : `
                            <span class="p-1 text-gray-300"><i class="ti ti-point text-sm"></i></span>
                        `}
                        <span class="category-color w-3 h-3 rounded-full" style="background-color: ${cat.color || '#228be6'}"></span>
                        <span class="category-name flex-1 text-sm">${escapeHTML(cat.name)}</span>
                        <div class="category-actions flex gap-1">
                            <button class="btn btn-ghost btn-xs" data-action="add-child" data-id="${cat.id}" title="${this.__('categories.addSubcategory')}">
                                <i class="ti ti-plus text-xs"></i>
                            </button>
                            <button class="btn btn-ghost btn-xs" data-action="edit" data-id="${cat.id}" title="${this.__('actions.edit')}">
                                <i class="ti ti-edit text-xs"></i>
                            </button>
                            <button class="btn btn-ghost btn-xs text-red-600" data-action="delete" data-id="${cat.id}" title="${this.__('actions.delete')}">
                                <i class="ti ti-trash text-xs"></i>
                            </button>
                        </div>
                    </div>
                    ${hasChildren ? `
                        <div class="category-children" data-parent="${cat.id}">
                            ${this.renderCategoryTree(cat.children, level + 1)}
                        </div>
                    ` : ''}
                </div>
            `;
        });
        return html;
    }

    bindCategoryModalEvents() {
        // Color picker sync
        const colorPicker = document.getElementById('cat-color');
        const colorHex = document.getElementById('cat-color-hex');
        colorPicker?.addEventListener('input', (e) => { colorHex.value = e.target.value; });
        colorHex?.addEventListener('input', (e) => {
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) colorPicker.value = e.target.value;
        });

        // Save category
        document.getElementById('btn-save-category')?.addEventListener('click', () => {
            this.saveCategoryFromModal();
        });

        // Cancel edit
        document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
            this.resetCategoryForm();
        });

        // Tree actions
        document.querySelector('.category-tree')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) {
                const toggleBtn = e.target.closest('[data-toggle]');
                if (toggleBtn) this.toggleCategoryChildren(toggleBtn.dataset.toggle);
                return;
            }
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            switch (action) {
                case 'add-child': this.prepareAddChildCategory(id); break;
                case 'edit': this.editCategory(id); break;
                case 'delete': this.deleteCategory(id); break;
            }
        });
    }

    toggleCategoryChildren(categoryId) {
        const children = document.querySelector(`[data-parent="${categoryId}"]`);
        const toggleBtn = document.querySelector(`[data-toggle="${categoryId}"] i`);
        if (children) {
            children.classList.toggle('hidden');
            if (toggleBtn) {
                toggleBtn.classList.toggle('ti-chevron-down');
                toggleBtn.classList.toggle('ti-chevron-right');
            }
        }
    }

    prepareAddChildCategory(parentId) {
        this.resetCategoryForm();
        document.getElementById('cat-parent').value = parentId;
        document.getElementById('cat-name')?.focus();
    }

    editCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return;

        this.editingCategoryId = categoryId;
        document.getElementById('cat-name').value = category.name || '';
        document.getElementById('cat-parent').value = category.parent_id || '';
        document.getElementById('cat-color').value = category.color || '#228be6';
        document.getElementById('cat-color-hex').value = category.color || '#228be6';
        document.getElementById('cat-sort').value = category.sort_order || 0;
        document.getElementById('cat-edit-id').value = categoryId;

        document.getElementById('category-form-title').innerHTML = `<i class="ti ti-edit text-primary-500 mr-2"></i> ${this.__('categories.editCategory')}`;
        document.getElementById('btn-save-text').textContent = this.__('categories.update');
        document.getElementById('btn-cancel-edit').classList.remove('hidden');

        // Disable self + children in parent select
        const childIds = this.getAllChildIds(categoryId);
        const parentSelect = document.getElementById('cat-parent');
        Array.from(parentSelect.options).forEach(option => {
            option.disabled = (option.value === categoryId || childIds.includes(option.value));
        });

        document.getElementById('cat-name')?.focus();
    }

    getAllChildIds(categoryId) {
        const ids = [];
        const findChildren = (parentId) => {
            this.categories.filter(c => c.parent_id === parentId).forEach(c => {
                ids.push(c.id);
                findChildren(c.id);
            });
        };
        findChildren(categoryId);
        return ids;
    }

    resetCategoryForm() {
        this.editingCategoryId = null;
        document.getElementById('cat-name').value = '';
        document.getElementById('cat-parent').value = '';
        document.getElementById('cat-color').value = '#228be6';
        document.getElementById('cat-color-hex').value = '#228be6';
        document.getElementById('cat-sort').value = '0';
        document.getElementById('cat-edit-id').value = '';
        document.getElementById('category-form-title').innerHTML = `<i class="ti ti-folder-plus text-primary-500 mr-2"></i> ${this.__('categories.addCategory')}`;
        document.getElementById('btn-save-text').textContent = this.__('actions.save');
        document.getElementById('btn-cancel-edit').classList.add('hidden');

        const parentSelect = document.getElementById('cat-parent');
        if (parentSelect) {
            Array.from(parentSelect.options).forEach(option => { option.disabled = false; });
        }
    }

    async saveCategoryFromModal() {
        const name = document.getElementById('cat-name')?.value?.trim();
        const parentId = document.getElementById('cat-parent')?.value || null;
        const color = document.getElementById('cat-color')?.value || '#228be6';
        const sortOrder = parseInt(document.getElementById('cat-sort')?.value) || 0;
        const editId = document.getElementById('cat-edit-id')?.value;

        if (!name) {
            Toast.error(this.__('categories.nameRequired'));
            return;
        }

        const saveBtn = document.getElementById('btn-save-category');
        const originalContent = saveBtn.innerHTML;
        saveBtn.innerHTML = `<i class="ti ti-loader-2 animate-spin"></i>`;
        saveBtn.disabled = true;

        try {
            if (editId) {
                await this.app.api.put(`/categories/${editId}`, {
                    name, parent_id: parentId, color, sort_order: sortOrder
                });
                Toast.success(this.__('categories.updated'));
            } else {
                await this.app.api.post('/categories', {
                    name, parent_id: parentId, color, sort_order: sortOrder, status: 'active'
                });
                Toast.success(this.__('categories.created'));
            }

            await this.loadCategories();
            this.refreshCategoryModal();

            // Auto-select newly created category
            if (!editId && name) {
                const categorySelect = document.getElementById('bundle-category');
                if (categorySelect) categorySelect.value = name;
            }
        } catch (error) {
            Logger.error('Category save error:', error);
            Toast.error(error.message || this.__('messages.saveFailed'));
        } finally {
            saveBtn.innerHTML = originalContent;
            saveBtn.disabled = false;
        }
    }

    async deleteCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return;

        const hasChildren = this.categories.some(c => c.parent_id === categoryId);

        Modal.confirm({
            title: this.__('categories.deleteCategory'),
            message: hasChildren
                ? this.__('categories.deleteWithChildren', { name: category.name })
                : this.__('categories.deleteConfirm', { name: category.name }),
            type: 'danger',
            confirmText: this.__('actions.delete'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/categories/${categoryId}`);
                    Toast.success(this.__('categories.deleted'));
                    await this.loadCategories();
                    this.refreshCategoryModal();
                } catch (error) {
                    Logger.error('Category delete error:', error);
                    Toast.error(error.message || this.__('messages.saveFailed'));
                }
            }
        });
    }

    refreshCategoryModal() {
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = this.renderCategoryModalContent();
            this.bindCategoryModalEvents();
        }
    }

    // ==========================================
    // Utilities
    // ==========================================
    _setVal(id, val) {
        const el = document.getElementById(id);
        if (el && val !== null && val !== undefined) el.value = val;
    }

    _toDatetimeLocal(dateStr) {
        if (!dateStr) return '';
        // Convert "2025-01-15 14:30:00" to "2025-01-15T14:30"
        return dateStr.replace(' ', 'T').substring(0, 16);
    }

    _formatPrice(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return '0,00 \u20BA';
        return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20BA';
    }

    _formatPriceShort(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return '0';
        return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    _getFileUrl(filePath) {
        return MediaUtils.getDisplayUrl(filePath);
    }

    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    destroy() {
        if (this._itemClickHandler) {
            document.removeEventListener('click', this._itemClickHandler);
            this._itemClickHandler = null;
        }
        if (this._itemInputHandler) {
            document.removeEventListener('input', this._itemInputHandler);
            this._itemInputHandler = null;
        }
        if (this.priceHistorySection) {
            this.priceHistorySection.destroy();
            this.priceHistorySection = null;
        }
        this.app.i18n.clearPageTranslations();
    }
}

export default BundleFormPage;
