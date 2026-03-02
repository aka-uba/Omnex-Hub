/**
 * Product Detail Page Component
 * Displays all product information including images, videos, and metadata
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { MediaUtils } from '../../utils/MediaUtils.js';
import { escapeHTML } from '../../core/SecurityUtils.js';
import { init as initPriceHistory } from './form/PriceHistorySection.js';

export class ProductDetailPage {
    constructor(app) {
        this.app = app;
        this.productId = null;
        this.product = null;
        this.images = [];
        this.videos = [];
        this.coverImageIndex = 0;
        this.priceHistorySection = null;
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Get appropriate "no devices" message based on active scope (branch > region > company)
     * @param {string} baseKey - Base translation key (e.g., 'detail.noDevicesAvailable')
     * @returns {string} Translated message with scope name
     */
    _getNoDevicesMessage(baseKey) {
        const activeBranch = this.app.state.get('activeBranch');
        const user = this.app.state.get('user');

        if (activeBranch) {
            // Check if it's a region or a branch/store
            if (activeBranch.type === 'region') {
                return this.__(`${baseKey}Region`, { regionName: activeBranch.name });
            } else {
                return this.__(`${baseKey}Branch`, { branchName: activeBranch.name });
            }
        }

        // Fallback to company
        const companyName = user?.company_name || 'Firma';
        return this.__(`${baseKey}Company`, { companyName });
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/products">${this.__('breadcrumb.products')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('breadcrumb.detail')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon blue">
                            <i class="ti ti-package"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('detail.title')}</h1>
                            <p class="page-subtitle">${this.__('detail.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <a href="#/products" class="btn btn-outline" title="${this.__('detail.tooltips.back')}">
                            <i class="ti ti-arrow-left"></i>
                            ${this.__('detail.buttons.back')}
                        </a>
                        <button id="edit-btn" class="btn btn-primary" title="${this.__('detail.tooltips.edit')}">
                            <i class="ti ti-edit"></i>
                            ${this.__('detail.buttons.edit')}
                        </button>
                        <button onclick="window.productDetailPage?.printLabel()" class="btn btn-outline" title="${this.__('detail.tooltips.print')}">
                            <i class="ti ti-printer"></i>
                        </button>
                        <button onclick="window.productDetailPage?.duplicate()" class="btn btn-outline" title="${this.__('actions.duplicate')}">
                            <i class="ti ti-copy"></i>
                        </button>
                        <button onclick="window.productDetailPage?.delete()" class="btn btn-outline-danger" title="${this.__('actions.delete')}">
                            <i class="ti ti-trash"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div id="product-container">
                ${this.renderLoading()}
            </div>
        `;
    }

    renderLoading() {
        return `
            <div class="flex items-center justify-center py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        `;
    }

    renderProduct() {
        if (!this.product) {
            return `
                <div class="chart-card">
                    <div class="chart-card-body text-center py-12 text-gray-500">
                        <i class="ti ti-package-off text-4xl mb-2"></i>
                        <p>${this.__('detail.notFound')}</p>
                    </div>
                </div>
            `;
        }

        const p = this.product;
        const coverImage = this.images[this.coverImageIndex] || this.images[0];
        const labelsCount = p.labels?.length || 0;

        return `
            <!-- Product Hero Summary -->
            <div class="pd-hero">
                <div class="pd-hero-image">
                    ${coverImage ? `
                        <img src="${this.getDisplayUrl(coverImage.url)}" alt="${escapeHTML(p.name)}"
                             onclick="window.productDetailPage?.showImageLightbox(${this.coverImageIndex})">
                    ` : `
                        <div class="pd-hero-image-placeholder">
                            <i class="ti ti-photo-off"></i>
                        </div>
                    `}
                </div>
                <div class="pd-hero-info">
                    <div class="pd-hero-top">
                        <div>
                            <h2 class="pd-hero-name">${this.escapeHtml(p.name)}</h2>
                            <div class="pd-hero-meta">
                                <span class="pd-hero-sku"><i class="ti ti-hash"></i> ${this.escapeHtml(p.sku)}</span>
                                ${p.barcode ? `<span class="pd-hero-barcode"><i class="ti ti-barcode"></i> ${this.escapeHtml(p.barcode)}</span>` : ''}
                                ${p.category ? `<span class="pd-hero-category"><i class="ti ti-category"></i> ${escapeHTML(p.category)}</span>` : ''}
                            </div>
                        </div>
                        <div class="pd-hero-badges">
                            <span class="badge ${p.status === 'active' ? 'badge-success' : p.status === 'draft' ? 'badge-warning' : 'badge-secondary'}">
                                ${p.status === 'active' ? this.__('detail.status.active') : p.status === 'draft' ? this.__('detail.status.draft') : this.__('detail.status.inactive')}
                            </span>
                            ${p.is_featured ? `<span class="badge badge-primary"><i class="ti ti-star"></i> ${this.__('detail.status.featured')}</span>` : ''}
                        </div>
                    </div>
                    <div class="pd-hero-price-row">
                        <div class="pd-hero-price">
                            <span class="pd-hero-current-price">${this.formatPrice(p.current_price)}</span>
                            ${p.previous_price ? `
                                <span class="pd-hero-old-price">${this.formatPrice(p.previous_price)}</span>
                                <span class="badge badge-success">${this.calculateDiscount(p.previous_price, p.current_price)}%</span>
                            ` : ''}
                        </div>
                        <div class="pd-hero-stock">
                            <span class="pd-hero-stock-value ${(p.stock || 0) <= 0 ? 'stock-empty' : (p.stock || 0) < 10 ? 'stock-low' : 'stock-ok'}">
                                ${p.stock || 0}
                            </span>
                            <span class="pd-hero-stock-label">${escapeHTML(p.unit || this.__('detail.fields.unit'))}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabs Navigation -->
            <div class="settings-tabs pd-tabs">
                <button class="settings-tab active" data-pd-tab="general">
                    <i class="ti ti-package"></i>
                    <span>${this.__('detail.tabs.general')}</span>
                </button>
                <button class="settings-tab" data-pd-tab="media">
                    <i class="ti ti-photo"></i>
                    <span>${this.__('detail.tabs.media')}</span>
                    ${(this.images.length + this.videos.length) > 0 ? `<span class="pd-tab-badge">${this.images.length + this.videos.length}</span>` : ''}
                </button>
                <button class="settings-tab" data-pd-tab="price">
                    <i class="ti ti-currency-lira"></i>
                    <span>${this.__('detail.tabs.priceStock')}</span>
                </button>
                <button class="settings-tab" data-pd-tab="meta">
                    <i class="ti ti-file-info"></i>
                    <span>${this.__('detail.tabs.recordInfo')}</span>
                </button>
            </div>

            <!-- Tab: General Info -->
            <div class="settings-tab-content active" id="pd-tab-general">
                <div class="pd-tab-grid pd-general-layout">
                    <!-- Left: Product Properties + Additional Info -->
                    <div class="pd-tab-col">
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-list-details"></i>
                                    ${this.__('detail.sections.productProperties')}
                                </h2>
                                <span class="badge ${p.status === 'active' ? 'badge-success' : 'badge-secondary'}">${p.status === 'active' ? this.__('status.active') : this.__('status.inactive')}</span>
                            </div>
                            <div class="chart-card-body">
                                <div class="pd-prop-grid">
                                    <div class="pd-prop-item">
                                        <span class="pd-prop-label">${this.__('detail.fields.sku')}</span>
                                        <span class="pd-prop-value">${this.escapeHtml(p.sku)}</span>
                                    </div>
                                    <div class="pd-prop-item">
                                        <span class="pd-prop-label">${this.__('detail.fields.barcode')}</span>
                                        <span class="pd-prop-value font-mono">${this.escapeHtml(p.barcode || '-')}</span>
                                    </div>
                                    <div class="pd-prop-item">
                                        <span class="pd-prop-label">${this.__('detail.fields.unit')}</span>
                                        <span class="pd-prop-value">${escapeHTML(p.unit || '-')}</span>
                                    </div>
                                    <div class="pd-prop-item">
                                        <span class="pd-prop-label">${this.__('detail.fields.category')}</span>
                                        <span class="pd-prop-value">${escapeHTML(p.category ? (p.subcategory ? p.category + ' / ' + p.subcategory : p.category) : '-')}</span>
                                    </div>
                                    <div class="pd-prop-item">
                                        <span class="pd-prop-label">${this.__('detail.fields.origin')}</span>
                                        <span class="pd-prop-value">${this.escapeHtml(p.origin || '-')}</span>
                                    </div>
                                    <div class="pd-prop-item">
                                        <span class="pd-prop-label">${this.__('detail.fields.vatRate')}</span>
                                        <span class="pd-prop-value">%${p.vat_rate || 20}</span>
                                    </div>
                                    ${p.brand ? `
                                        <div class="pd-prop-item">
                                            <span class="pd-prop-label">${this.__('detail.fields.brand')}</span>
                                            <span class="pd-prop-value">${this.escapeHtml(p.brand)}</span>
                                        </div>
                                    ` : ''}
                                    ${p.production_type ? `
                                        <div class="pd-prop-item">
                                            <span class="pd-prop-label">${this.__('detail.fields.productionType')}</span>
                                            <span class="pd-prop-value">${this.escapeHtml(p.production_type)}</span>
                                        </div>
                                    ` : ''}
                                </div>
                                ${p.description ? `<p class="pd-description">${this.escapeHtml(p.description)}</p>` : ''}
                            </div>
                        </div>

                        <!-- Additional Info Card (below Product Properties, same width) -->
                        ${p.weight || p.shelf_location || p.supplier_code || p.kunye_no || p.campaign_text || p.valid_from || p.valid_until ? `
                            <div class="chart-card">
                                <div class="chart-card-header">
                                    <h2 class="chart-card-title">
                                        <i class="ti ti-info-circle"></i>
                                        ${this.__('detail.sections.additionalInfo')}
                                    </h2>
                                </div>
                                <div class="chart-card-body">
                                    <div class="product-info-list">
                                        ${p.campaign_text ? `
                                            <div class="product-info-item">
                                                <span class="product-info-label">${this.__('detail.fields.campaign')}</span>
                                                <span class="product-info-value text-orange-600">${this.escapeHtml(p.campaign_text)}</span>
                                            </div>
                                        ` : ''}
                                        ${p.kunye_no ? `
                                            <div class="product-info-item">
                                                <span class="product-info-label">${this.__('detail.fields.kunyeNo')}</span>
                                                <span class="product-info-value text-xs">${this.escapeHtml(p.kunye_no)}</span>
                                            </div>
                                        ` : ''}
                                        ${p.weight ? `
                                            <div class="product-info-item">
                                                <span class="product-info-label">${this.__('detail.fields.weight')}</span>
                                                <span class="product-info-value">${p.weight} kg</span>
                                            </div>
                                        ` : ''}
                                        ${p.shelf_location ? `
                                            <div class="product-info-item">
                                                <span class="product-info-label">${this.__('detail.fields.shelfLocation')}</span>
                                                <span class="product-info-value">${this.escapeHtml(p.shelf_location)}</span>
                                            </div>
                                        ` : ''}
                                        ${p.supplier_code ? `
                                            <div class="product-info-item">
                                                <span class="product-info-label">${this.__('detail.fields.supplierCode')}</span>
                                                <span class="product-info-value">${this.escapeHtml(p.supplier_code)}</span>
                                            </div>
                                        ` : ''}
                                        ${p.valid_from || p.valid_until ? `
                                            <div class="product-info-item">
                                                <span class="product-info-label">${this.__('detail.fields.validity')}</span>
                                                <span class="product-info-value">
                                                    ${p.valid_from ? this.formatDate(p.valid_from) : '∞'} - ${p.valid_until ? this.formatDate(p.valid_until) : '∞'}
                                                </span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Right: Image Preview only -->
                    <div class="pd-tab-col">
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title pd-preview-title">${this.__('detail.sections.imagePreview')}</h2>
                                ${(this.images.length + this.videos.length) > 0 ? `
                                    <span class="pd-media-count">${this.images.length > 0 ? this.images.length + ' ' + this.__('detail.sections.image') : ''}${this.images.length > 0 && this.videos.length > 0 ? ' + ' : ''}${this.videos.length > 0 ? this.videos.length + ' Video' : ''}</span>
                                ` : ''}
                            </div>
                            <div class="chart-card-body">
                                ${this.images.length > 0 ? `
                                    <div class="pd-preview-image" onclick="window.productDetailPage?.showImageLightbox(${this.coverImageIndex})">
                                        <img src="${this.getDisplayUrl((this.images[this.coverImageIndex] || this.images[0]).url)}"
                                             alt="${escapeHTML(this.product?.name || '')}">
                                    </div>
                                ` : `
                                    <div class="pd-preview-placeholder">
                                        <i class="ti ti-photo-off"></i>
                                    </div>
                                `}
                                ${this.videos.length > 0 ? `
                                    <div class="pd-preview-video">
                                        <video src="${escapeHTML(this.videos[0].url)}" controls preload="metadata">
                                            ${this.__('detail.sections.videoNotSupported')}
                                        </video>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bottom row: Price + Labels + Template (full width, 3 columns) -->
                <div class="pd-bottom-cards">
                    <!-- Current Price Card -->
                    <div class="chart-card pd-mini-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title pd-mini-title">${this.__('detail.sections.currentPrice')}</h2>
                            <i class="ti ti-trending-up text-muted"></i>
                        </div>
                        <div class="chart-card-body">
                            <div class="pd-price-row">
                                <span class="pd-price-main">${this.formatPrice(p.current_price)}</span>
                                ${p.previous_price ? `<span class="pd-price-prev">${this.formatPrice(p.previous_price)}</span>` : ''}
                            </div>
                            <div class="pd-price-meta">
                                ${p.previous_price ? `<span class="pd-discount-badge">${this.calculateDiscount(p.previous_price, p.current_price)}% ${this.__('detail.sections.discount')}</span>` : ''}
                                <span class="pd-stock-inline ${(p.stock || 0) <= 0 ? 'stock-empty' : (p.stock || 0) < 10 ? 'stock-low' : 'stock-ok'}">${this.__('detail.fields.stock').toUpperCase()}: ${p.stock || 0} ${escapeHTML((p.unit || '').toUpperCase())}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Linked Labels Card -->
                    <div class="chart-card pd-mini-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title pd-mini-title">${this.__('detail.sections.linkedLabels')}</h2>
                            <button class="btn btn-sm btn-ghost text-primary" onclick="window.productDetailPage?.assignLabel()">
                                + ${this.__('detail.labels.assignLabel')}
                            </button>
                        </div>
                        <div class="chart-card-body">
                            ${this.renderLabels()}
                        </div>
                    </div>

                    <!-- Assigned Template Card -->
                    <div class="chart-card pd-mini-card">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title pd-mini-title">${this.__('detail.sections.assignedTemplate')}</h2>
                            <i class="ti ti-layout text-muted"></i>
                        </div>
                        <div class="chart-card-body">
                            ${(() => {
                                const labels = this.product?.labels || [];
                                // Deduplicate by template_id to get unique templates with their preview
                                const templateMap = new Map();
                                labels.filter(l => l.template_name).forEach(l => {
                                    if (!templateMap.has(l.template_id)) {
                                        templateMap.set(l.template_id, {
                                            name: l.template_name,
                                            preview: l.template_preview || null
                                        });
                                    }
                                });
                                if (templateMap.size === 0) {
                                    return `
                                        <div class="text-center py-3 text-gray-400">
                                            <i class="ti ti-layout-off" style="font-size: 1.5rem; margin-bottom: 0.25rem; display: block;"></i>
                                            <p class="text-xs">${this.__('detail.labels.noTemplate')}</p>
                                        </div>
                                    `;
                                }
                                return [...templateMap.values()].map(tpl => `
                                    <div class="pd-template-item">
                                        ${tpl.preview ? `
                                            <div class="pd-template-thumb">
                                                <img src="${tpl.preview.startsWith('data:') ? tpl.preview : this.getDisplayUrl(tpl.preview)}" alt="${escapeHTML(tpl.name)}">
                                            </div>
                                        ` : `
                                            <div class="pd-template-thumb pd-template-thumb-empty">
                                                <i class="ti ti-layout"></i>
                                            </div>
                                        `}
                                        <span>${escapeHTML(tpl.name)}</span>
                                    </div>
                                `).join('');
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab: Media -->
            <div class="settings-tab-content" id="pd-tab-media">
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h2 class="chart-card-title">
                            <i class="ti ti-photo"></i>
                            ${this.__('detail.sections.images')}
                        </h2>
                        <span class="badge badge-secondary">${this.images.length} ${this.__('detail.sections.image')}</span>
                    </div>
                    <div class="chart-card-body">
                        ${this.images.length > 0 ? `
                            <div class="pd-media-grid">
                                ${(() => {
                                    // Sort: cover image first, then the rest in original order
                                    const sorted = [];
                                    const ci = this.coverImageIndex;
                                    if (ci >= 0 && ci < this.images.length) sorted.push({ img: this.images[ci], origIdx: ci });
                                    this.images.forEach((img, idx) => { if (idx !== ci) sorted.push({ img, origIdx: idx }); });
                                    return sorted.map((item, displayIdx) => `
                                        <div class="pd-media-thumb ${item.origIdx === ci ? 'is-cover' : ''}"
                                             onclick="window.productDetailPage?.showImageLightbox(${item.origIdx})">
                                            <img src="${this.getDisplayUrl(item.img.url)}" alt="${this.__('detail.gallery.image')} ${displayIdx + 1}">
                                            ${item.origIdx === ci ? `<span class="pd-media-cover-badge">${this.__('detail.gallery.cover')}</span>` : ''}
                                        </div>
                                    `).join('');
                                })()}
                            </div>
                        ` : `
                            <div class="text-center py-6 text-gray-400">
                                <i class="ti ti-photo-off" style="font-size: 2.5rem; margin-bottom: 0.5rem; display: block;"></i>
                                <p class="text-sm">${this.__('detail.gallery.noImages')}</p>
                            </div>
                        `}
                    </div>
                </div>

                ${this.videos.length > 0 ? `
                    <div class="chart-card" style="margin-top: var(--space-6);">
                        <div class="chart-card-header">
                            <h2 class="chart-card-title">
                                <i class="ti ti-video"></i>
                                ${this.__('detail.sections.videos')}
                            </h2>
                            <span class="badge badge-secondary">${this.videos.length}</span>
                        </div>
                        <div class="chart-card-body">
                            <div class="pd-video-grid">
                                ${this.videos.map((video, idx) => `
                                    <div class="pd-video-item">
                                        <video src="${escapeHTML(video.url)}" class="pd-video-player" controls preload="metadata">
                                            ${this.__('detail.sections.videoNotSupported')}
                                        </video>
                                        <div class="pd-video-name">
                                            <i class="ti ti-video"></i>
                                            ${escapeHTML(video.filename || 'Video ' + (idx + 1))}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>

            <!-- Tab: Price & Stock -->
            <div class="settings-tab-content" id="pd-tab-price">
                <div class="pd-tab-grid pd-price-layout">
                    <!-- Left: Pricing + Stock -->
                    <div class="pd-tab-col">
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-currency-lira"></i>
                                    ${this.__('detail.sections.pricing')}
                                </h2>
                            </div>
                            <div class="chart-card-body">
                                <div class="pd-big-price">${this.formatPrice(p.current_price)}</div>
                                ${p.previous_price ? `
                                    <div class="pd-old-price">${this.formatPrice(p.previous_price)}</div>
                                    <div style="margin-top: 0.75rem;">
                                        <span class="pd-discount-badge">${this.calculateDiscount(p.previous_price, p.current_price)}% ${this.__('detail.sections.discount')}</span>
                                    </div>
                                ` : ''}
                                <div class="product-info-list" style="margin-top: 1rem;">
                                    ${p.discount_percent ? `
                                        <div class="product-info-item">
                                            <span class="product-info-label">${this.__('detail.fields.discountPercent')}</span>
                                            <span class="badge badge-warning">%${p.discount_percent}</span>
                                        </div>
                                    ` : ''}
                                    <div class="product-info-item">
                                        <span class="product-info-label">${this.__('detail.fields.vatRate')}</span>
                                        <span class="product-info-value">%${p.vat_rate || 20}</span>
                                    </div>
                                    ${p.vat_updated_at ? `
                                        <div class="product-info-item">
                                            <span class="product-info-label">KDV Degisiklik Tarihi</span>
                                            <span class="product-info-value text-xs">${this.formatDateTime(p.vat_updated_at)}</span>
                                        </div>
                                    ` : ''}
                                    ${p.price_updated_at ? `
                                        <div class="product-info-item">
                                            <span class="product-info-label">${this.__('detail.fields.priceUpdatedAt')}</span>
                                            <span class="product-info-value text-xs">${this.formatDateTime(p.price_updated_at)}</span>
                                        </div>
                                    ` : ''}
                                    ${p.price_valid_until ? `
                                        <div class="product-info-item">
                                            <span class="product-info-label">${this.__('detail.fields.priceValidUntil')}</span>
                                            <span class="product-info-value text-orange-500">${this.formatDate(p.price_valid_until)}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>

                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-box"></i>
                                    ${this.__('detail.sections.stockStatus')}
                                </h2>
                            </div>
                            <div class="chart-card-body">
                                <div class="pd-big-stock ${(p.stock || 0) <= 0 ? 'stock-empty' : (p.stock || 0) < 10 ? 'stock-low' : 'stock-ok'}">
                                    ${p.stock || 0}
                                </div>
                                <div class="pd-stock-unit">${escapeHTML(p.unit || this.__('detail.fields.unit'))}</div>
                                <div class="pd-stock-bar-wrap">
                                    <div class="pd-stock-bar ${(p.stock || 0) <= 0 ? 'bar-empty' : (p.stock || 0) < 10 ? 'bar-low' : 'bar-ok'}"
                                         style="width: ${Math.min(100, Math.max(5, (p.stock || 0)))}%"></div>
                                </div>
                                <div class="pd-stock-level ${(p.stock || 0) <= 0 ? 'level-empty' : (p.stock || 0) < 10 ? 'level-low' : 'level-ok'}">
                                    ${(p.stock || 0) <= 0
                                        ? `${this.__('detail.sections.stockDepleted')}`
                                        : (p.stock || 0) < 10
                                            ? `${this.__('detail.sections.stockLow')}`
                                            : `${this.__('detail.sections.stockHigh')}`
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Price History (full height) -->
                    <div class="pd-tab-col pd-price-history-col">
                        <div class="chart-card" style="flex: 1;">
                            <div id="price-history-container"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab: Record Info -->
            <div class="settings-tab-content" id="pd-tab-meta">
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h2 class="chart-card-title">
                            <i class="ti ti-file-info"></i>
                            ${this.__('detail.sections.recordInfo')}
                        </h2>
                    </div>
                    <div class="chart-card-body">
                        <div class="product-info-list">
                            <div class="product-info-item">
                                <span class="product-info-label">${this.__('detail.fields.createdAt')}</span>
                                <span class="product-info-value text-xs">${this.formatDateTime(p.created_at)}</span>
                            </div>
                            <div class="product-info-item">
                                <span class="product-info-label">${this.__('detail.fields.updatedAt')}</span>
                                <span class="product-info-value text-xs">${this.formatDateTime(p.updated_at)}</span>
                            </div>
                            <div class="product-info-item">
                                <span class="product-info-label">ID</span>
                                <span class="product-info-value text-xs font-mono text-gray-400">${p.id}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderImageGallery() {
        if (this.images.length === 0) {
            return `
                <div class="w-full aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <i class="ti ti-photo-off text-4xl text-gray-400"></i>
                </div>
            `;
        }

        const coverImage = this.images[this.coverImageIndex] || this.images[0];

        return `
            <div class="space-y-2">
                <!-- Main Image -->
                <div class="w-full aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer"
                     onclick="window.productDetailPage?.showImageLightbox(${this.coverImageIndex})">
                    <img src="${this.getDisplayUrl(coverImage.url)}" alt="${escapeHTML(this.product?.name || this.__('detail.product'))}"
                         class="w-full h-full object-cover hover:scale-105 transition-transform duration-300">
                </div>

                <!-- Thumbnails -->
                ${this.images.length > 1 ? `
                    <div class="grid grid-cols-4 gap-1">
                        ${this.images.slice(0, 4).map((img, idx) => `
                            <div class="aspect-square bg-gray-100 dark:bg-gray-800 rounded overflow-hidden cursor-pointer
                                        ${idx === this.coverImageIndex ? 'ring-2 ring-primary-500' : ''}"
                                 onclick="window.productDetailPage?.showImageLightbox(${idx})">
                                <img src="${this.getDisplayUrl(img.url)}" alt="${this.__('detail.gallery.image')} ${idx + 1}" class="w-full h-full object-cover">
                            </div>
                        `).join('')}
                    </div>
                    ${this.images.length > 4 ? `
                        <p class="text-xs text-center text-gray-500">+${this.images.length - 4} ${this.__('detail.gallery.moreImages')}</p>
                    ` : ''}
                ` : ''}
            </div>
        `;
    }

    showImageLightbox(startIndex = 0) {
        let currentIndex = startIndex;
        const self = this; // Store reference for closure

        const updateLightbox = () => {
            const img = self.images[currentIndex];
            const imageEl = document.getElementById('lightbox-image');
            const counterEl = document.getElementById('lightbox-counter');
            if (imageEl) imageEl.src = self.getDisplayUrl(img.url);
            if (counterEl) counterEl.textContent = `${currentIndex + 1} / ${self.images.length}`;
        };

        const content = `
            <div class="lightbox-container">
                <div class="lightbox-image-wrapper">
                    <img id="lightbox-image" src="${this.getDisplayUrl(this.images[currentIndex].url)}"
                         alt="${this.__('detail.gallery.image')}" class="lightbox-image">
                </div>

                ${this.images.length > 1 ? `
                    <div class="lightbox-controls">
                        <button id="lightbox-prev" class="lightbox-nav-btn">
                            <i class="ti ti-chevron-left"></i>
                        </button>
                        <div id="lightbox-counter" class="lightbox-counter">
                            ${currentIndex + 1} / ${this.images.length}
                        </div>
                        <button id="lightbox-next" class="lightbox-nav-btn">
                            <i class="ti ti-chevron-right"></i>
                        </button>
                    </div>
                ` : ''}

                ${this.images.length > 1 ? `
                    <div class="lightbox-thumbnails">
                        ${this.images.map((img, idx) => `
                            <div class="lightbox-thumb ${idx === currentIndex ? 'active' : ''}"
                                 data-index="${idx}" onclick="window.productDetailPage?.selectLightboxImage(${idx})">
                                <img src="${this.getDisplayUrl(img.url)}" alt="${this.__('detail.gallery.thumbnail')} ${idx + 1}">
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        Modal.show({
            title: this.__('detail.gallery.title'),
            icon: 'ti-photo',
            content: content,
            size: 'lg',
            showConfirm: false,
            cancelText: this.__('actions.close')
        });

        // Store current index for thumbnail click
        this.lightboxCurrentIndex = currentIndex;

        // Bind navigation events after modal renders
        setTimeout(() => {
            document.getElementById('lightbox-prev')?.addEventListener('click', () => {
                currentIndex = (currentIndex - 1 + this.images.length) % this.images.length;
                this.lightboxCurrentIndex = currentIndex;
                updateLightbox();
                this.updateThumbnailSelection(currentIndex);
            });
            document.getElementById('lightbox-next')?.addEventListener('click', () => {
                currentIndex = (currentIndex + 1) % this.images.length;
                this.lightboxCurrentIndex = currentIndex;
                updateLightbox();
                this.updateThumbnailSelection(currentIndex);
            });
        }, 100);
    }

    selectLightboxImage(index) {
        this.lightboxCurrentIndex = index;
        const imageEl = document.getElementById('lightbox-image');
        const counterEl = document.getElementById('lightbox-counter');
        if (imageEl) imageEl.src = this.getDisplayUrl(this.images[index].url);
        if (counterEl) counterEl.textContent = `${index + 1} / ${this.images.length}`;
        this.updateThumbnailSelection(index);
    }

    updateThumbnailSelection(index) {
        document.querySelectorAll('.lightbox-thumb').forEach((thumb, idx) => {
            if (idx === index) {
                thumb.classList.add('active');
            } else {
                thumb.classList.remove('active');
            }
        });
    }

    renderLabels() {
        const labels = this.product?.labels || [];

        if (!labels.length) {
            return `
                <div class="text-center py-6 text-gray-500">
                    <i class="ti ti-tag text-3xl mb-2"></i>
                    <p>${this.__('detail.labels.noLabels')}</p>
                </div>
            `;
        }

        return `
            <div class="space-y-2" id="labels-container">
                ${labels.map(l => `
                    <div class="label-item label-item-box">
                        <div class="flex items-center gap-3 flex-1 min-w-0">
                            <i class="ti ti-device-tablet text-muted"></i>
                            <div class="min-w-0">
                                <p class="font-medium truncate">${escapeHTML(l.device_name || this.__('detail.device'))}</p>
                                <p class="text-xs text-muted truncate">${escapeHTML(l.location || this.__('detail.locationNotSpecified'))}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <span class="badge ${l.status === 'synced' ? 'badge-success' : 'badge-warning'}">
                                ${l.status === 'synced' ? this.__('detail.labels.synced') : this.__('detail.labels.pending')}
                            </span>
                            <button class="btn btn-icon btn-sm btn-ghost label-edit-btn" data-label-id="${l.id}" title="${this.__('actions.edit')}">
                                <i class="ti ti-edit text-primary"></i>
                            </button>
                            <button class="btn btn-icon btn-sm btn-ghost label-remove-btn" data-label-id="${l.id}" title="${this.__('actions.remove')}">
                                <i class="ti ti-trash text-danger"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    bindLabelEvents() {
        const container = document.getElementById('labels-container');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.label-edit-btn');
            const removeBtn = e.target.closest('.label-remove-btn');

            if (editBtn) {
                e.preventDefault();
                e.stopPropagation();
                const labelId = editBtn.dataset.labelId;
                if (labelId) this.editLabel(labelId);
            } else if (removeBtn) {
                e.preventDefault();
                e.stopPropagation();
                const labelId = removeBtn.dataset.labelId;
                if (labelId) this.removeLabel(labelId);
            }
        });
    }

    /**
     * Edit assigned label
     */
    async editLabel(labelId) {
        const label = this.product?.labels?.find(l => l.id === labelId);
        if (!label) return;

        let devices = [];
        let templates = [];
        try {
            const [devResponse, tmplResponse] = await Promise.all([
                this.app.api.get('/devices?type=esl'),
                this.app.api.get('/templates?type=esl')
            ]);
            devices = devResponse.data || [];
            templates = tmplResponse.data || [];
        } catch (error) {
            Logger.error('Device/Template load error:', error);
        }

        const formContent = `
            <div class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${this.__('detail.selectDevice')}</label>
                    <select id="edit-device" class="form-select">
                        ${devices.map(d => `
                            <option value="${d.id}" ${d.id === label.device_id ? 'selected' : ''}>
                                ${escapeHTML(d.name)} - ${escapeHTML(d.location || this.__('detail.noLocation'))}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('detail.selectTemplate')}</label>
                    <select id="edit-template" class="form-select">
                        <option value="">${this.__('detail.defaultTemplate')}</option>
                        ${templates.map(t => `
                            <option value="${t.id}" ${t.id === label.template_id ? 'selected' : ''}>
                                ${escapeHTML(t.name)}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;

        Modal.show({
            title: this.__('detail.editLabel'),
            icon: 'ti-edit',
            content: formContent,
            size: 'md',
            confirmText: this.__('actions.update'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const deviceId = document.getElementById('edit-device')?.value;
                const templateId = document.getElementById('edit-template')?.value;

                if (!deviceId) {
                    Toast.error(this.__('detail.pleaseSelectDevice'));
                    throw new Error('Validation failed');
                }

                try {
                    await this.app.api.put(`/products/${this.productId}/labels/${labelId}`, {
                        device_id: deviceId,
                        template_id: templateId || null
                    });
                    Toast.success(this.__('detail.labelUpdated'));
                    await this.loadProduct();
                } catch (error) {
                    Toast.error(error.message || this.__('detail.updateFailed'));
                    throw error;
                }
            }
        });
    }

    /**
     * Remove assigned label
     */
    async removeLabel(labelId) {
        const label = this.product?.labels?.find(l => l.id === labelId);
        if (!label) return;

        Modal.confirm({
            title: this.__('detail.removeLabel'),
            message: this.__('detail.removeLabelConfirm', { device: escapeHTML(label.device_name) }),
            type: 'warning',
            confirmText: this.__('actions.remove'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/products/${this.productId}/labels/${labelId}`);
                    Toast.success(this.__('detail.labelRemoved'));
                    await this.loadProduct();
                } catch (error) {
                    Toast.error(error.message || this.__('messages.error'));
                    throw error;
                }
            }
        });
    }

    /**
     * Convert stored path to display URL
     * Uses MediaUtils for cross-environment compatibility
     */
    getDisplayUrl(url) {
        return MediaUtils.getDisplayUrl(url);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatPrice(price) {
        return this.app.i18n.formatPrice(price);
    }

    formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('tr-TR');
        } catch {
            return dateStr;
        }
    }

    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleString('tr-TR');
        } catch {
            return dateStr;
        }
    }

    calculateDiscount(original, current) {
        if (!original || !current) return 0;
        return Math.round((1 - current / original) * 100);
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('products');
    }

    async init() {
        window.productDetailPage = this;

        // Get product ID from URL
        const hash = window.location.hash;
        const match = hash.match(/\/products\/([^\/]+)$/);
        if (match) {
            this.productId = match[1];
        }

        await this.loadProduct();
        this.bindEvents();
    }

    async loadProduct() {
        if (!this.productId) return;

        try {
            const response = await this.app.api.get(`/products/${this.productId}`);
            this.product = response.data;

            // Parse images
            if (this.product.images) {
                try {
                    this.images = typeof this.product.images === 'string'
                        ? JSON.parse(this.product.images)
                        : this.product.images;
                    if (!Array.isArray(this.images)) this.images = [];
                } catch (e) {
                    this.images = [];
                }
            } else if (this.product.image_url) {
                this.images = [{ url: this.product.image_url, filename: this.product.image_url.split('/').pop() }];
            }

            // Parse videos
            if (this.product.videos) {
                try {
                    this.videos = typeof this.product.videos === 'string'
                        ? JSON.parse(this.product.videos)
                        : this.product.videos;
                    if (!Array.isArray(this.videos)) this.videos = [];
                } catch (e) {
                    this.videos = [];
                }
            }

            // Cover image index
            this.coverImageIndex = parseInt(this.product.cover_image_index) || 0;
            if (this.coverImageIndex >= this.images.length) {
                this.coverImageIndex = 0;
            }

            document.getElementById('product-container').innerHTML = this.renderProduct();
            this.bindLabelEvents();
            this.bindTabEvents();
            this.initPriceHistorySection();
            this._showBranchIndicator();
        } catch (error) {
            Logger.error('Product load error:', error);
            document.getElementById('product-container').innerHTML = this.renderProduct();
            this.bindLabelEvents();
            this.bindTabEvents();
        }
    }

    /**
     * Show visual indicator when viewing branch-specific data
     */
    _showBranchIndicator() {
        const activeBranch = this.app.state.get('activeBranch');
        if (!activeBranch) return;

        // Determine data source (branch or master)
        const dataSource = this.product?.branch_id ? 'branch' : 'master';

        // Add indicator to page-header-right (before buttons)
        const pageHeaderRight = document.querySelector('.page-header-right');
        if (pageHeaderRight && !document.getElementById('branch-edit-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'branch-edit-indicator';
            indicator.className = 'branch-edit-indicator branch-indicator-header';
            indicator.innerHTML = `
                <i class="ti ti-building-store"></i>
                <span>${this.__('branch.prefix')}: <strong>${activeBranch.name}</strong></span>
                <span class="badge badge-info">${dataSource === 'branch' ? this.__('branch.branchData') : this.__('branch.masterData')}</span>
            `;
            // Insert at the beginning of page-header-right
            pageHeaderRight.insertBefore(indicator, pageHeaderRight.firstChild);
        }
    }

    /**
     * Initialize Price History Section in grid mode
     */
    initPriceHistorySection() {
        const container = document.getElementById('price-history-container');
        if (!container || !this.productId) return;

        // Destroy previous instance if exists
        if (this.priceHistorySection) {
            this.priceHistorySection.destroy();
        }

        // Initialize in grid mode for detail page
        this.priceHistorySection = initPriceHistory({
            container: container,
            app: this.app,
            productId: this.productId,
            productName: this.product?.name || '',
            translator: (key, params) => this.__(key, params),
            mode: 'grid'
        });

        // Render and bind events
        this.priceHistorySection.render();
        this.priceHistorySection.bindEvents();

        // Load price history data
        this.priceHistorySection.loadHistory();

        this._priceHistoryInitialized = true;
    }

    bindTabEvents() {
        const tabs = document.querySelectorAll('[data-pd-tab]');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.pdTab;

                // Update active tab button
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Show corresponding content
                document.querySelectorAll('.settings-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                const targetContent = document.getElementById(`pd-tab-${tabId}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                // Initialize price history when switching to price tab
                if (tabId === 'price' && !this._priceHistoryInitialized) {
                    this._priceHistoryInitialized = true;
                    this.initPriceHistorySection();
                }
            });
        });
    }

    bindEvents() {
        document.getElementById('edit-btn')?.addEventListener('click', () => {
            window.location.hash = `#/products/${this.productId}/edit`;
        });
    }

    assignLabel() {
        this.showAssignLabelModal();
    }

    async showAssignLabelModal() {
        let devices = [];
        try {
            const response = await this.app.api.get('/devices?type=esl');
            devices = response.data || [];
        } catch (error) {
            Logger.error('Device load error:', error);
        }

        const formContent = `
            <div class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${this.__('detail.selectDevice')}</label>
                    <select id="assign-device" class="form-select">
                        <option value="">${this.__('detail.selectDevicePlaceholder')}</option>
                        ${devices.map(d => `
                            <option value="${d.id}">${escapeHTML(d.name)} - ${escapeHTML(d.location || this.__('detail.noLocation'))}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('detail.selectTemplate')}</label>
                    <select id="assign-template" class="form-select">
                        <option value="">${this.__('detail.selectTemplatePlaceholder')}</option>
                    </select>
                </div>
                ${devices.length === 0 ? `
                    <div class="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 rounded-lg p-3 text-sm">
                        <i class="ti ti-alert-triangle mr-2"></i>
                        ${this._getNoDevicesMessage('detail.noDevicesAvailable')}
                    </div>
                ` : ''}
            </div>
        `;

        Modal.show({
            title: this.__('detail.assignLabel'),
            icon: 'ti-tag',
            content: formContent,
            size: 'md',
            confirmText: this.__('actions.assign'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const deviceId = document.getElementById('assign-device')?.value;
                const templateId = document.getElementById('assign-template')?.value;

                if (!deviceId) {
                    Toast.error(this.__('detail.pleaseSelectDevice'));
                    throw new Error('Validation failed');
                }

                try {
                    await this.app.api.post(`/products/${this.productId}/assign-label`, {
                        device_id: deviceId,
                        template_id: templateId || null
                    });
                    Toast.success(this.__('detail.labelAssigned'));
                    await this.loadProduct();
                } catch (error) {
                    Toast.error(error.message || this.__('messages.error'));
                    throw error;
                }
            }
        });

        setTimeout(() => this.loadTemplatesForAssign(), 100);
    }

    async loadTemplatesForAssign() {
        try {
            const response = await this.app.api.get('/templates?type=esl');
            const templates = response.data || [];
            const select = document.getElementById('assign-template');
            if (select) {
                templates.forEach(t => {
                    const option = document.createElement('option');
                    option.value = t.id;
                    option.textContent = t.name;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            Logger.error('Templates load error:', error);
        }
    }

    printLabel() {
        const formContent = `
            <div class="space-y-4">
                <div class="form-group">
                    <label class="form-label">${this.__('printLabel.template')}</label>
                    <select id="print-template" class="form-select">
                        <option value="">${this.__('assignLabel.placeholders.template')}</option>
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="form-label">${this.__('printLabel.copies')}</label>
                        <input type="number" id="print-copies" class="form-input" value="1" min="1" max="100">
                    </div>
                    <div class="form-group">
                        <label class="form-label">${this.__('printLabel.paperSize')}</label>
                        <select id="print-size" class="form-select">
                            <option value="">${this.__('messages.loading')}</option>
                        </select>
                        <div class="flex items-center justify-between mt-1">
                            <span class="form-hint text-xs">${this.__('printLabel.paperSizeHint')}</span>
                            <a href="#/settings/labels" class="text-xs text-primary hover:underline">
                                <i class="ti ti-settings text-xs"></i> ${this.__('printLabel.manageSizes')}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        Modal.show({
            title: this.__('printLabel.title'),
            icon: 'ti-printer',
            content: formContent,
            size: 'md',
            confirmText: this.__('printLabel.print'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const selectedTemplateId = document.getElementById('print-template')?.value;
                const fallbackTemplateId = this._defaultPrintTemplateId || '';
                const copies = parseInt(document.getElementById('print-copies')?.value) || 1;
                const sizeSelect = document.getElementById('print-size');
                const selectedOption = sizeSelect?.options[sizeSelect.selectedIndex];
                const width = selectedOption?.dataset?.width;
                const height = selectedOption?.dataset?.height;
                const unit = selectedOption?.dataset?.unit || 'mm';

                if (!width || !height) {
                    Toast.error(this.__('printLabel.selectSize'));
                    throw new Error('Size not selected');
                }

                // mm to inch conversion if needed
                let widthInch = parseFloat(width);
                let heightInch = parseFloat(height);
                if (unit === 'mm') {
                    widthInch = widthInch / 25.4;
                    heightInch = heightInch / 25.4;
                }

                let template = null;
                const templateId = selectedTemplateId || fallbackTemplateId;
                if (templateId) {
                    try {
                        const templateRes = await this.app.api.get(`/templates/${templateId}`);
                        template = templateRes.data;
                    } catch (err) {
                        Logger.warn('Template fetch failed, using default layout:', err);
                    }
                }
                this.printPreview(
                    copies,
                    `${widthInch.toFixed(2)}x${heightInch.toFixed(2)}`,
                    parseInt(width),
                    parseInt(height),
                    template
                );
            }
        });

        setTimeout(() => {
            this.loadTemplatesForPrint();
            this.loadLabelSizesForPrint();
        }, 100);
    }

    async loadLabelSizesForPrint() {
        try {
            const response = await this.app.api.get('/label-sizes');
            const sizes = response.data || [];
            const select = document.getElementById('print-size');
            if (select) {
                select.innerHTML = '';

                if (sizes.length === 0) {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = this.__('printLabel.noSizes');
                    select.appendChild(option);
                    return;
                }

                sizes.forEach((size, index) => {
                    const option = document.createElement('option');
                    option.value = size.id;
                    option.dataset.width = size.width;
                    option.dataset.height = size.height;
                    option.dataset.unit = size.unit;

                    // Format display text
                    const displayName = size.name || `${size.width}x${size.height} ${size.unit}`;
                    const inchWidth = size.unit === 'mm' ? (size.width / 25.4).toFixed(2) : size.width;
                    const inchHeight = size.unit === 'mm' ? (size.height / 25.4).toFixed(2) : size.height;
                    option.textContent = `${displayName} (${inchWidth}" x ${inchHeight}")`;

                    // Mark default
                    if (size.is_default) {
                        option.selected = true;
                    }

                    select.appendChild(option);
                });

                // If no default, select first
                if (!sizes.some(s => s.is_default) && select.options.length > 0) {
                    select.selectedIndex = 0;
                }
            }
        } catch (error) {
            Logger.error('Label sizes load error:', error);
            const select = document.getElementById('print-size');
            if (select) {
                select.innerHTML = `<option value="">${this.__('printLabel.sizesLoadError')}</option>`;
            }
        }
    }

    async loadTemplatesForPrint() {
        try {
            const response = await this.app.api.get('/templates?status=active&type=label_printer');
            const templates = response.data?.templates || response.data || [];
            const select = document.getElementById('print-template');
            if (select) {
                this._defaultPrintTemplateId = templates.find(t => t.is_default)?.id || '';
                templates.forEach(t => {
                    const option = document.createElement('option');
                    option.value = t.id;
                    option.textContent = t.name;
                    if (this._defaultPrintTemplateId && t.id === this._defaultPrintTemplateId) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            }
        } catch (error) {
            Logger.error('Templates load error:', error);
        }
    }

    printPreview(copies, size, widthMm, heightMm, template = null) {
        const [width, height] = size.split('x').map(s => parseFloat(s));
        const p = this.product;
        const coverImage = this.images[this.coverImageIndex]?.url;
        const displayBarcode = this._getPrintBarcode(p);

        // i18n metinleri
        const helpTitle = this.__('printLabel.help.title');
        const helpPaperSize = this.__('printLabel.help.paperSize');
        const helpCopies = this.__('printLabel.help.copies');
        const helpWarning = this.__('printLabel.help.warning', { size: `${widthMm}x${heightMm}mm` });
        const helpTip = this.__('printLabel.help.tip');

        // Yeni sekmede tam boy aç, kağıt boyutu CSS @page ile ayarlanacak
        const printWindow = window.open('', '_blank');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${this.__('printLabel.label')} - ${this.escapeHtml(p.name)}</title>
                <style>
                    @page {
                        size: ${width}in ${height}in;
                        margin: 0;
                    }
                    @media print {
                        body { margin: 0; padding: 0; }
                        .page-wrapper { padding: 0; }
                        .help-btn, .help-popup { display: none !important; }
                    }
                    @media screen {
                        body {
                            font-family: Arial, sans-serif;
                            background: #f5f5f5;
                            padding: 20px;
                        }
                        .page-wrapper {
                            position: relative;
                            display: inline-block;
                            padding-right: 60px;
                        }
                        .help-btn {
                            position: absolute;
                            top: 0;
                            right: 0;
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            background: linear-gradient(135deg, #228be6, #1971c2);
                            color: white;
                            border: none;
                            cursor: pointer;
                            font-size: 18px;
                            font-weight: bold;
                            box-shadow: 0 4px 12px rgba(34, 139, 230, 0.4);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 1000;
                            transition: transform 0.2s, box-shadow 0.2s;
                        }
                        .help-btn:hover {
                            transform: scale(1.1);
                            box-shadow: 0 6px 16px rgba(34, 139, 230, 0.5);
                        }
                        .help-popup {
                            position: absolute;
                            top: 0;
                            left: calc(100% + 10px);
                            background: white;
                            border-radius: 12px;
                            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                            padding: 16px 20px;
                            width: 280px;
                            z-index: 999;
                            display: none;
                            border: 1px solid #e9ecef;
                        }
                        .help-popup.show { display: block; }
                        .help-popup h4 {
                            margin: 0 0 12px 0;
                            font-size: 14px;
                            color: #212529;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        }
                        .help-popup h4::before {
                            content: '📋';
                        }
                        .help-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 8px 0;
                            border-bottom: 1px solid #f1f3f4;
                            font-size: 13px;
                        }
                        .help-row:last-of-type { border-bottom: none; }
                        .help-label { color: #6c757d; }
                        .help-value { font-weight: 600; color: #212529; }
                        .help-warning {
                            background: #fff3cd;
                            border: 1px solid #ffc107;
                            border-radius: 8px;
                            padding: 10px 12px;
                            margin-top: 12px;
                            font-size: 12px;
                            color: #856404;
                        }
                        .help-tip {
                            font-size: 11px;
                            color: #6c757d;
                            margin-top: 10px;
                            font-style: italic;
                        }
                        .labels-container {
                            display: flex;
                            flex-wrap: wrap;
                            gap: 16px;
                        }
                        .label {
                            background: white;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                            border: 1px dashed #dee2e6;
                            border-radius: 4px;
                        }
                    }
                    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
                    .label {
                        width: ${width}in;
                        height: ${height}in;
                        padding: 0.1in;
                        box-sizing: border-box;
                        page-break-after: always;
                        overflow: hidden;
                    }
                    .product-name { font-size: 12pt; font-weight: bold; margin-bottom: 4px; }
                    .price { font-size: 20pt; font-weight: bold; color: #e53e3e; }
                    .old-price { font-size: 10pt; color: #444; text-decoration: line-through; }
                    .barcode { font-family: monospace; font-size: 10pt; margin-top: 4px; color: #212529; font-weight: 600; }
                    .sku { font-size: 8pt; color: #333; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="page-wrapper">
                    <button class="help-btn" onclick="document.querySelector('.help-popup').classList.toggle('show')" title="${helpTitle}">?</button>
                    <div class="help-popup">
                        <h4>${helpTitle}</h4>
                        <div class="help-row">
                            <span class="help-label">${helpPaperSize}:</span>
                            <span class="help-value">${widthMm} x ${heightMm} mm</span>
                        </div>
                        <div class="help-row">
                            <span class="help-label">${helpCopies}:</span>
                            <span class="help-value">${copies}</span>
                        </div>
                        <div class="help-warning">⚠️ ${helpWarning}</div>
                        <div class="help-tip">💡 ${helpTip}</div>
                    </div>
                    <div class="labels-container">
                        ${Array(copies).fill(0).map(() => {
                            if (template && template.design_data) {
                                return this.renderTemplateLabel(p, template, widthMm, heightMm, 2);
                            }
                            return `
                                <div class="label">
                                    <div class="product-name">${this.escapeHtml(p.name)}</div>
                                    ${p.previous_price ? `<div class="old-price">${this.formatPrice(p.previous_price)}</div>` : ''}
                                    <div class="price">${this.formatPrice(p.current_price)}</div>
                                    <div class="barcode">${escapeHTML(displayBarcode)}</div>
                                    <div class="sku">SKU: ${escapeHTML(p.sku)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <script>setTimeout(() => { window.print(); }, 500);</script>
            </body>
            </html>
        `);
        printWindow.document.close();
        Toast.success(this.__('printLabel.printDialog'));
    }

    /**
     * Print için barkod metnini hazırla (terazi barkodu desteği)
     */
    _getPrintBarcode(product) {
        const raw = (product?.barcode || product?.sku || '').trim();
        if (!raw) return '';
        // Terazi ürünleri: 5 haneli kod + bayrak kodu
        if (/^\d{5}$/.test(raw)) {
            const settings = this.app?.state?.get('settings') || {};
            const flagCode = settings.weighing_flag_code || '27';
            return `${flagCode}${raw}`;
        }
        return raw;
    }

    /**
     * Render a template-based label with product data
     */
    renderTemplateLabel(product, template, labelWidthMm, labelHeightMm, paddingMm) {
        const mmToPx = 96 / 25.4;
        const labelWidthPx = labelWidthMm * mmToPx;
        const labelHeightPx = labelHeightMm * mmToPx;
        const paddingPx = paddingMm * mmToPx;
        const availableWidthPx = labelWidthPx - (paddingPx * 2);
        const availableHeightPx = labelHeightPx - (paddingPx * 2);

        const templateWidth = template.width || 227;
        const templateHeight = template.height || 151;
        const scaleX = availableWidthPx / templateWidth;
        const scaleY = availableHeightPx / templateHeight;
        const scale = Math.min(scaleX, scaleY, 1);

        const scaledWidth = templateWidth * scale;
        const scaledHeight = templateHeight * scale;

        let designData;
        const rawDesignData = template.design_data || template.content || '{}';
        try {
            designData = typeof rawDesignData === 'string'
                ? JSON.parse(rawDesignData)
                : rawDesignData;
        } catch (e) {
            Logger.error('Failed to parse template design data:', e);
            return this.renderDefaultLabel(product, labelWidthMm, labelHeightMm);
        }

        const objects = designData.objects || [];
        let elementsHtml = '';
        objects.forEach(obj => {
            const html = this.renderFabricObject(obj, product, scale);
            if (html) elementsHtml += html;
        });

        const bgColor = designData.background || template.background_color || '#ffffff';

        return `
            <div class="label">
                <div class="label-template-wrapper" style="
                    width: 100%;
                    height: 100%;
                    padding: ${paddingMm}mm;
                    box-sizing: border-box;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <div class="template-canvas" style="
                        position: relative;
                        width: ${scaledWidth}px;
                        height: ${scaledHeight}px;
                        background: ${bgColor};
                        overflow: hidden;
                    ">
                        ${elementsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    renderFabricObject(obj, product, scale) {
        if (!obj || obj.visible === false) return '';

        const left = (obj.left || 0) * scale;
        const top = (obj.top || 0) * scale;
        const width = (obj.width || 0) * scale * (obj.scaleX || 1);
        const height = (obj.height || 0) * scale * (obj.scaleY || 1);
        const angle = obj.angle || 0;
        const opacity = obj.opacity !== undefined ? obj.opacity : 1;

        let text = obj.text || '';
        const dynamicKey = this.extractDynamicFieldKey(obj);
        const dynamicValue = dynamicKey ? this.getDynamicFieldValue(dynamicKey, product) : '';
        if (dynamicKey) {
            text = dynamicValue;
        }
        if (typeof text === 'string' && text.includes('{{')) {
            text = text.replace(/\{\{([^}]+)\}\}/g, (_, key) => this.getDynamicFieldValue(key, product) || '');
        }

        const baseStyle = `
            position: absolute;
            left: ${left}px;
            top: ${top}px;
            width: ${width}px;
            height: ${height}px;
            opacity: ${opacity};
            transform: rotate(${angle}deg);
            transform-origin: center;
            overflow: hidden;
        `;

        if (obj.customType === 'barcode' || obj.customType === 'qrcode') {
            return `
                <div style="
                    ${baseStyle}
                    font-family: 'Courier New', monospace;
                    font-size: ${Math.max(10, (obj.fontSize || 14) * scale)}px;
                    color: ${obj.fill || '#000'};
                    background: #fff;
                    border: 1px solid rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                ">${this.escapeHtml(dynamicValue || text)}</div>
            `;
        }

        switch (obj.type) {
            case 'textbox':
            case 'i-text':
            case 'text':
                return `
                    <div style="
                        ${baseStyle}
                        font-size: ${(obj.fontSize || 16) * scale}px;
                        font-family: ${obj.fontFamily || 'Arial'};
                        font-weight: ${obj.fontWeight || 'normal'};
                        color: ${obj.fill || '#000'};
                        text-align: ${obj.textAlign || 'left'};
                        line-height: ${obj.lineHeight || 1.2};
                        white-space: pre-wrap;
                    ">${this.escapeHtml(text)}</div>
                `;

            case 'rect':
                return `
                    <div style="
                        ${baseStyle}
                        background: ${obj.fill || 'transparent'};
                        border: ${obj.strokeWidth ? `${obj.strokeWidth}px solid ${obj.stroke || '#000'}` : 'none'};
                    "></div>
                `;

            case 'circle':
            case 'ellipse':
                return `
                    <div style="
                        ${baseStyle}
                        border-radius: 50%;
                        background: ${obj.fill || 'transparent'};
                        border: ${obj.strokeWidth ? `${obj.strokeWidth}px solid ${obj.stroke || '#000'}` : 'none'};
                    "></div>
                `;

            case 'line':
                return `
                    <div style="
                        ${baseStyle}
                        height: ${obj.strokeWidth || 1}px;
                        background: ${obj.stroke || '#000'};
                    "></div>
                `;

            case 'image':
                if (!obj.src) return '';
                let imgSource = obj.src;
                if (dynamicValue) {
                    imgSource = dynamicValue;
                }
                const imgSrc = imgSource.startsWith('data:') ? imgSource : this.getDisplayUrl(imgSource);
                return `
                    <img src="${imgSrc}" style="
                        ${baseStyle}
                        width: ${width}px;
                        height: ${height}px;
                        object-fit: contain;
                    " onerror="this.style.display='none'"/>
                `;

            case 'group':
                let groupHtml = '';
                (obj.objects || []).forEach(childObj => {
                    const childHtml = this.renderFabricObject(childObj, product, scale);
                    if (childHtml) groupHtml += childHtml;
                });
                return `
                    <div style="
                        ${baseStyle}
                        width: ${width}px;
                        height: ${height}px;
                    ">${groupHtml}</div>
                `;

            default:
                return '';
        }
    }

    getDynamicFieldValue(fieldKey, product) {
        if (!fieldKey || !product) return '';

        const normalizedKey = String(fieldKey).replace(/[{}\s]/g, '');
        const fieldMap = {
            'product_name': product.name,
            'name': product.name,
            'current_price': this.formatPrice(product.current_price),
            'price': this.formatPrice(product.current_price),
            'previous_price': product.previous_price ? this.formatPrice(product.previous_price) : '',
            'old_price': product.previous_price ? this.formatPrice(product.previous_price) : '',
            'price_with_currency': this.formatPrice(product.current_price),
            'alis_fiyati': this.formatPrice(product.alis_fiyati),
            'barcode': this._getPrintBarcode(product),
            'sku': product.sku || '',
            'category': product.category || '',
            'subcategory': product.subcategory || '',
            'unit': product.unit || '',
            'brand': product.brand || '',
            'origin': product.origin || '',
            'production_type': product.production_type || '',
            'description': product.description || '',
            'weight': product.weight || '',
            'stock': product.stock || '',
            'kunye_no': product.kunye_no || '',
            'shelf_location': product.shelf_location || '',
            'supplier_code': product.supplier_code || '',
            'vat_rate': product.vat_rate ? `%${product.vat_rate}` : '',
            'discount_percent': product.discount_percent ? `%${product.discount_percent}` : '',
            'campaign_text': product.campaign_text || '',
            'price_updated_at': product.price_updated_at || '',
            'price_valid_until': product.price_valid_until || '',
            'image_url': product.image_url || product.cover_image || '',
            'date_today': new Date().toLocaleDateString('tr-TR'),
            'date_time': new Date().toLocaleString('tr-TR')
        };

        const cleanKey = normalizedKey.replace(/^slot-/, '').replace(/^dynamic-/, '');
        return fieldMap[cleanKey] || fieldMap[normalizedKey] || fieldMap[fieldKey] || '';
    }

    extractDynamicFieldKey(obj) {
        if (!obj) return '';
        if (typeof obj.dynamicField === 'string' && obj.dynamicField.trim()) {
            return obj.dynamicField;
        }
        if (obj.isDynamicField || obj.isDataField) {
            const text = typeof obj.text === 'string' ? obj.text : '';
            const match = text.match(/\{\{([^}]+)\}\}/);
            if (match) {
                return match[1];
            }
        }
        return '';
    }

    renderDefaultLabel(product, widthMm, heightMm) {
        const baseFontScale = heightMm / 50;
        const nameFontSize = Math.max(8, Math.min(18, 12 * baseFontScale));
        const priceFontSize = Math.max(14, Math.min(36, 24 * baseFontScale));

        return `
            <div class="label">
                <div class="label-content">
                    <div style="font-size: ${nameFontSize}px; font-weight: 700;">${this.escapeHtml(product.name)}</div>
                    <div style="font-size: ${priceFontSize}px; font-weight: 800; color: #e03131; margin-top: auto;">
                        ${this.formatPrice(product.current_price)}
                    </div>
                </div>
            </div>
        `;
    }

    async duplicate() {
        Modal.confirm({
            title: this.__('detail.duplicate.title'),
            message: this.__('detail.duplicate.message'),
            type: 'info',
            confirmText: this.__('detail.duplicate.confirm'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                try {
                    const p = this.product;
                    const newProduct = {
                        name: `${p.name} (${this.__('detail.duplicate.copySuffix')})`,
                        sku: `${p.sku}-COPY-${Date.now()}`,
                        barcode: p.barcode || '',
                        current_price: p.current_price || 0,
                        previous_price: p.previous_price || null,
                        category: p.category || '',
                        subcategory: p.subcategory || '',
                        group: p.group || '',
                        unit: p.unit || '',
                        brand: p.brand || '',
                        origin: p.origin || '',
                        production_type: p.production_type || '',
                        description: p.description || '',
                        weight: p.weight || '',
                        stock: p.stock || '',
                        shelf_location: p.shelf_location || '',
                        supplier_code: p.supplier_code || '',
                        vat_rate: p.vat_rate || '',
                        discount_percent: p.discount_percent || '',
                        campaign_text: p.campaign_text || '',
                        image_url: p.image_url || '',
                        images: Array.isArray(p.images) ? JSON.stringify(p.images) : (p.images || '[]'),
                        videos: Array.isArray(p.videos) ? JSON.stringify(p.videos) : (p.videos || '[]'),
                        video_url: p.video_url || '',
                        status: 'inactive'
                    };

                    const response = await this.app.api.post('/products', newProduct);
                    if (response.success && response.data?.id) {
                        Toast.success(this.__('detail.productCopied'));
                        window.location.hash = `#/products/${response.data.id}/edit`;
                    }
                } catch (error) {
                    Toast.error(error.message || this.__('messages.error'));
                    throw error;
                }
            }
        });
    }

    async delete() {
        Modal.confirm({
            title: this.__('detail.deleteProduct'),
            message: this.__('detail.deleteProductConfirm'),
            type: 'danger',
            confirmText: this.__('actions.delete'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/products/${this.productId}`);
                    Toast.success(this.__('detail.productDeleted'));
                    window.location.hash = '#/products';
                } catch (error) {
                    Toast.error(this.__('detail.deleteFailed'));
                    throw error;
                }
            }
        });
    }

    destroy() {
        window.productDetailPage = null;
        if (this.priceHistorySection) {
            this.priceHistorySection.destroy();
            this.priceHistorySection = null;
        }
        this.app.i18n.clearPageTranslations();
    }
}

export default ProductDetailPage;
