/**
 * Product Form Page Component (Create/Edit)
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { BarcodeUtils } from '../../utils/BarcodeUtils.js';
import { MediaUtils } from '../../utils/MediaUtils.js';
import { init as initMediaPicker } from './form/MediaPicker.js';
import { init as initBarcodeSection } from './form/BarcodeSection.js';
import { init as initHalKunyeSection } from './form/HalKunyeSection.js';
import { init as initPriceHistorySection } from './form/PriceHistorySection.js';
import { validate as validateProduct, validateRequired, showErrors, clearAllErrors, setTranslator } from './form/ProductValidator.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class ProductFormPage {
    constructor(app) {
        this.app = app;
        this.productId = null;
        this.product = null;
        this.categories = [];
        this.productionTypes = [];
        this.categoryModalId = null;
        this.productionTypeModalId = null;
        this.editingCategoryId = null;
        this.editingProductionTypeId = null;

        // Multiple images support
        this.images = [];
        // Cover image index (which image is the main/cover image)
        this.coverImageIndex = 0;
        // Multiple videos support
        this.videos = [];

        // Weighing barcode settings
        this.weighingSettings = {
            flagCode: '27',
            barcodeFormat: 'CODE128'
        };

        // MediaPicker module instance
        this.mediaPicker = null;

        // BarcodeSection module instance
        this.barcodeSection = null;

        // HalKunyeSection module instance
        this.halKunyeSection = null;

        // PriceHistorySection module instance
        this.priceHistorySection = null;

        // Pending HAL data (for new products)
        this._pendingHalData = null;

        // Auto-managed price/vat date baseline state
        this._priceAutoState = null;
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    render() {
        const isEdit = !!this.productId;

        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/products">${this.__('title')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${isEdit ? this.__('editProduct') : this.__('addProduct')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon blue">
                            <i class="ti ti-${isEdit ? 'edit' : 'plus'}"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${isEdit ? this.__('editProduct') : this.__('addProduct')}</h1>
                            <p class="page-subtitle">${isEdit ? this.__('editProductSubtitle') : this.__('addProductSubtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <a href="#/products" class="btn btn-outline">
                            <i class="ti ti-arrow-left"></i>
                            ${this.__('actions.back')}
                        </a>
                        <button type="submit" form="product-form" class="btn btn-primary">
                            <i class="ti ti-check"></i>
                            ${isEdit ? this.__('form.update') : this.__('form.save')}
                        </button>
                    </div>
                </div>
            </div>

            <form id="product-form">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Main Info -->
                    <div class="lg:col-span-2">
                        <div class="chart-card collapsible mb-6">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-info-circle"></i>
                                    ${this.__('form.basicInfo')}
                                </h2>
                                <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                            </div>
                            <div class="chart-card-body">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="form-group md:col-span-2">
                                        <label class="form-label">${this.__('form.fields.name')} *</label>
                                        <input type="text" id="name" class="form-input" required placeholder="${this.__('form.placeholders.name')}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.sku')} *</label>
                                        <input type="text" id="sku" class="form-input" required placeholder="${this.__('form.placeholders.sku')}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.barcode')}</label>
                                        <div class="flex gap-2">
                                            <input type="text" id="barcode" class="form-input flex-1" placeholder="${this.__('form.placeholders.barcode')}">
                                            <button type="button" id="preview-barcode-btn" class="btn btn-outline" title="${this.__('barcode.preview')}">
                                                <i class="ti ti-barcode"></i>
                                            </button>
                                        </div>
                                        <div id="barcode-preview" class="barcode-preview-container" style="display: none;">
                                            <div class="barcode-info">
                                                <span id="barcode-type-badge" class="badge badge-primary"></span>
                                                <span id="barcode-status" class="text-sm text-muted"></span>
                                            </div>
                                            <div id="barcode-canvas-container" class="barcode-canvas"></div>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Slug</label>
                                        <div class="flex gap-2">
                                            <input type="text" id="slug" class="form-input flex-1" placeholder="urun-adi-slug">
                                            <button type="button" id="generate-slug" class="btn btn-outline" title="${this.__('actions.generate')}">
                                                <i class="ti ti-refresh"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.group')}</label>
                                        <select id="product_group" class="form-select">
                                            <option value="">${this.__('form.placeholders.selectCategory')}</option>
                                            <option value="MANAV">${this.__('form.groupOptions.manav')}</option>
                                            <option value="KASAP">${this.__('form.groupOptions.kasap')}</option>
                                            <option value="SARKUTERI">${this.__('form.groupOptions.sarkuteri')}</option>
                                            <option value="BALIK">${this.__('form.groupOptions.balik')}</option>
                                            <option value="FIRINCI">${this.__('form.groupOptions.firinci')}</option>
                                            <option value="SERBEST">${this.__('form.groupOptions.serbest')}</option>
                                        </select>
                                        <small class="text-gray-500">${this.__('form.hints.group')}</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.category')}</label>
                                        <div class="flex gap-2">
                                            <select id="category" class="form-select flex-1">
                                                <option value="">${this.__('form.placeholders.selectCategory')}</option>
                                            </select>
                                            <button type="button" id="manage-categories-btn" class="btn btn-outline" title="${this.__('categories.title')}">
                                                <i class="ti ti-settings"></i>
                                            </button>
                                        </div>
                                        <small class="text-gray-500">${this.__('form.hints.category')}</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.subcategory')}</label>
                                        <select id="subcategory" class="form-select">
                                            <option value="">${this.__('form.placeholders.selectSubcategory')}</option>
                                        </select>
                                        <small class="text-gray-500">${this.__('form.hints.subcategory')}</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.brand')}</label>
                                        <input type="text" id="brand" class="form-input" placeholder="${this.__('form.placeholders.brand')}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.origin')}</label>
                                        <input type="text" id="origin" class="form-input" placeholder="${this.__('form.placeholders.origin')}">
                                    </div>
                                    <div class="form-group md:col-span-2">
                                        <label class="form-label">${this.__('form.fields.description')}</label>
                                        <textarea id="description" class="form-input" rows="6" placeholder="${this.__('form.placeholders.description')}"></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- HAL Kayıt Kartı (firma HAL entegrasyonu aktifse gösterilir) -->
                        <div id="hal-card" class="chart-card collapsible mb-6" style="display: none;">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-certificate"></i>
                                    ${this.__('hal.cardTitle')}
                                </h2>
                                <span class="badge badge-outline-primary">${this.__('hal.cardBadge')}</span>
                                <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                            </div>
                            <div class="chart-card-body">
                                <!-- Künye No ve Sorgu Bölümü -->
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div class="form-group">
                                        <label class="form-label">${this.__('hal.kunyeNo')}</label>
                                        <div class="flex gap-2">
                                            <input type="text" id="kunye_no" class="form-input flex-1"
                                                   placeholder="${this.__('hal.kunyeNoPlaceholder')}"
                                                   maxlength="19" pattern="[0-9]*">
                                            <button type="button" id="query-kunye-btn" class="btn btn-primary" title="${this.__('hal.queryKunye')}">
                                                <i class="ti ti-scan"></i>
                                            </button>
                                        </div>
                                        <small class="text-gray-500">${this.__('hal.kunyeNoHint')}</small>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.productionType')}</label>
                                        <div class="flex gap-2">
                                            <select id="production_type" class="form-select flex-1">
                                                <option value="">${this.__('form.placeholders.selectProductionType')}</option>
                                            </select>
                                            <button type="button" id="manage-production-types-btn" class="btn btn-outline" title="${this.__('productionTypes.manage')}">
                                                <i class="ti ti-settings"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Künye QR Önizleme -->
                                <div id="kunye-preview" class="kunye-preview-section" style="display: none;">
                                    <div class="kunye-preview-header">
                                        <span id="kunye-status" class="badge badge-info"></span>
                                    </div>
                                    <div id="kunye-canvas-container" class="kunye-qr-container"></div>
                                </div>

                                <!-- HAL Sorgu Sonuç Alanı -->
                                <div id="hal-kunye-result" class="hal-result-box" style="display: none;">
                                    <div class="hal-result-header">
                                        <i class="ti ti-check-circle text-success"></i>
                                        <span>${this.__('hal.querySuccess')}</span>
                                        <div class="hal-result-actions">
                                            <button type="button" id="apply-kunye-data" class="btn btn-sm btn-success">
                                                <i class="ti ti-download"></i>
                                                ${this.__('hal.applyData')}
                                            </button>
                                            <button type="button" id="close-kunye-result" class="btn btn-sm btn-outline">
                                                <i class="ti ti-x"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="hal-result-content">
                                        <div class="hal-result-grid">
                                            <div class="hal-result-item">
                                                <span class="label">${this.__('hal.fields.malinAdi')}</span>
                                                <span id="hal-urun-adi" class="value">-</span>
                                            </div>
                                            <div class="hal-result-item">
                                                <span class="label">${this.__('hal.fields.malinCinsi')}</span>
                                                <span id="hal-urun-cinsi" class="value">-</span>
                                            </div>
                                            <div class="hal-result-item">
                                                <span class="label">${this.__('hal.fields.ureticiAdi')}</span>
                                                <span id="hal-uretici" class="value">-</span>
                                            </div>
                                            <div class="hal-result-item">
                                                <span class="label">${this.__('hal.fields.uretimYeri')}</span>
                                                <span id="hal-uretim-yeri" class="value">-</span>
                                            </div>
                                            <div class="hal-result-item">
                                                <span class="label">${this.__('hal.fields.ilkBildirimTarihi')}</span>
                                                <span id="hal-bildirim-tarihi" class="value">-</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- HAL Veri Alanları -->
                                <div class="hal-data-fields mt-4">
                                    <div class="hal-data-section-title">
                                        <i class="ti ti-file-info"></i>
                                        ${this.__('hal.dataSection')}
                                    </div>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div class="form-group">
                                            <label class="form-label">${this.__('hal.fields.malinAdi')}</label>
                                            <input type="text" id="hal_malin_adi" class="form-input hal-field"
                                                   placeholder="${this.__('hal.placeholders.malinAdi')}">
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">${this.__('hal.fields.malinCinsi')}</label>
                                            <input type="text" id="hal_malin_cinsi" class="form-input hal-field"
                                                   placeholder="${this.__('hal.placeholders.malinCinsi')}">
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">${this.__('hal.fields.malinTuru')}</label>
                                            <input type="text" id="hal_malin_turu" class="form-input hal-field"
                                                   placeholder="${this.__('hal.placeholders.malinTuru')}">
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">${this.__('hal.fields.ureticiAdi')}</label>
                                            <input type="text" id="hal_uretici_adi" class="form-input hal-field"
                                                   placeholder="${this.__('hal.placeholders.ureticiAdi')}">
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">${this.__('hal.fields.uretimYeri')}</label>
                                            <input type="text" id="hal_uretim_yeri" class="form-input hal-field"
                                                   placeholder="${this.__('hal.placeholders.uretimYeri')}">
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">${this.__('hal.fields.ilkBildirimTarihi')}</label>
                                            <input type="text" id="hal_ilk_bildirim_tarihi" class="form-input hal-field"
                                                   placeholder="${this.__('hal.placeholders.ilkBildirimTarihi')}">
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">${this.__('hal.fields.malinSahibi')}</label>
                                            <input type="text" id="hal_malin_sahibi" class="form-input hal-field"
                                                   placeholder="${this.__('hal.placeholders.malinSahibi')}">
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">${this.__('hal.fields.tuketimYeri')}</label>
                                            <input type="text" id="hal_tuketim_yeri" class="form-input hal-field"
                                                   placeholder="${this.__('hal.placeholders.tuketimYeri')}">
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">${this.__('hal.fields.miktar')}</label>
                                            <input type="text" id="hal_miktar" class="form-input hal-field"
                                                   placeholder="${this.__('hal.placeholders.miktar')}">
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">${this.__('hal.fields.alisFiyati')}</label>
                                            <input type="number" id="hal_alis_fiyati" class="form-input hal-field"
                                                   step="0.01" placeholder="${this.__('hal.placeholders.alisFiyati')}">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Fiyat Bilgileri Kartı -->
                        <div class="chart-card collapsible">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-currency-lira"></i>
                                    ${this.__('form.priceInfo')}
                                </h2>
                                <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                            </div>
                            <div class="chart-card-body">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.salePrice')} *</label>
                                        <div class="relative">
                                            <input type="number" id="current_price" class="form-input pr-12" step="0.01" required placeholder="0.00">
                                            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 currency-symbol">${this.app.i18n.getCurrencySymbol()}</span>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.priceUpdatedAt')}</label>
                                        <input type="datetime-local" id="price_updated_at" class="form-input" readonly>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.previousPrice')}</label>
                                        <div class="relative">
                                            <input type="number" id="previous_price" class="form-input pr-12" step="0.01" placeholder="0.00">
                                            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 currency-symbol">${this.app.i18n.getCurrencySymbol()}</span>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.previousPriceUpdatedAt')}</label>
                                        <input type="datetime-local" id="previous_price_updated_at" class="form-input" readonly>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.vatRate')}</label>
                                        <select id="vat_rate" class="form-select">
                                            <option value="0">%0</option>
                                            <option value="1">%1</option>
                                            <option value="8">%8</option>
                                            <option value="10">%10</option>
                                            <option value="20" selected>%20</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.vatUpdatedAt')}</label>
                                        <input type="datetime-local" id="vat_updated_at" class="form-input" readonly>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.priceValidity')}</label>
                                        <input type="date" id="price_valid_until" class="form-input">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.discountPercent')}</label>
                                        <input type="number" id="discount_percent" class="form-input" min="0" max="100" placeholder="0">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('form.fields.campaignText')}</label>
                                        <input type="text" id="campaign_text" class="form-input" placeholder="${this.__('form.placeholders.campaignText')}">
                                    </div>
                                </div>

                                <!-- Fiyat Geçmişi Accordion -->
                                <div id="price-history-container" class="mt-4"></div>
                            </div>
                        </div>

                    </div>

                    <!-- Sidebar -->
                    <div class="lg:col-span-1">
                        <div class="chart-card collapsible mb-6">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-toggle-left"></i>
                                    ${this.__('list.columns.status')}
                                </h2>
                                <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                            </div>
                            <div class="chart-card-body">
                                <div class="form-group">
                                    <label class="form-label">${this.__('form.fields.status')}</label>
                                    <select id="status" class="form-select">
                                        <option value="active">${this.__('list.filters.active')}</option>
                                        <option value="inactive">${this.__('list.filters.inactive')}</option>
                                    </select>
                                </div>
                                <label class="flex items-center gap-3 cursor-pointer mt-4">
                                    <input type="checkbox" id="is_featured" class="form-checkbox">
                                    <span>${this.__('form.fields.isFeatured')}</span>
                                </label>
                            </div>
                        </div>

                        <div class="chart-card collapsible mb-6">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-photo"></i>
                                    ${this.__('form.media.images')}
                                </h2>
                                <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                            </div>
                            <div class="chart-card-body">
                                <div id="images-grid" class="product-media-grid">
                                    <!-- Images will be rendered here -->
                                </div>
                                <input type="file" id="image-input" class="hidden" accept="image/*" multiple>
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

                        <div class="chart-card collapsible mb-6">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-video"></i>
                                    ${this.__('form.media.videos')}
                                </h2>
                                <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                            </div>
                            <div class="chart-card-body">
                                <div id="videos-grid" class="product-media-grid">
                                    <!-- Videos will be rendered here -->
                                </div>
                                <input type="file" id="video-input" class="hidden" accept="video/*" multiple>
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

                        <!-- Stok ve Ölçü Kartı -->
                        <div class="chart-card collapsible mb-6">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-box"></i>
                                    ${this.__('form.stockAndMeasure')}
                                </h2>
                                <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                            </div>
                            <div class="chart-card-body">
                                <div class="form-group">
                                    <label class="form-label">${this.__('form.fields.unit')}</label>
                                    <select id="unit" class="form-select">
                                        <option value="adet">${this.__('form.units.adet')}</option>
                                        <option value="kg">${this.__('form.units.kg')}</option>
                                        <option value="gr">${this.__('form.units.gr')}</option>
                                        <option value="lt">${this.__('form.units.lt')}</option>
                                        <option value="ml">${this.__('form.units.ml')}</option>
                                        <option value="mt">${this.__('form.units.mt')}</option>
                                        <option value="cm">${this.__('form.units.cm')}</option>
                                        <option value="m2">${this.__('form.units.m2')}</option>
                                        <option value="paket">${this.__('form.units.paket')}</option>
                                        <option value="kutu">${this.__('form.units.kutu')}</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('form.fields.stock')}</label>
                                    <input type="number" id="stock" class="form-input" placeholder="0">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('form.fields.weight')}</label>
                                    <input type="number" id="weight" class="form-input" step="0.01" placeholder="0">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('form.fields.shelfLocation')}</label>
                                    <input type="text" id="shelf_location" class="form-input" placeholder="${this.__('form.placeholders.shelfLocation')}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('form.fields.supplierCode')}</label>
                                    <input type="text" id="supplier_code" class="form-input" placeholder="${this.__('form.placeholders.supplierCode')}">
                                </div>
                            </div>
                        </div>

                        <!-- Geçerlilik Kartı -->
                        <div class="chart-card collapsible mb-6">
                            <div class="chart-card-header">
                                <h2 class="chart-card-title">
                                    <i class="ti ti-calendar"></i>
                                    ${this.__('form.validity')}
                                </h2>
                                <span class="chart-card-toggle"><i class="ti ti-chevron-down"></i></span>
                            </div>
                            <div class="chart-card-body">
                                <div class="form-group">
                                    <label class="form-label">${this.__('form.fields.validFrom')}</label>
                                    <input type="date" id="valid_from" class="form-input">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('form.fields.validUntil')}</label>
                                    <input type="date" id="valid_until" class="form-input">
                                </div>
                            </div>
                        </div>

                        <div class="flex gap-2">
                            <button type="submit" class="btn btn-primary flex-1">
                                <i class="ti ti-check"></i>
                                ${isEdit ? this.__('form.update') : this.__('form.save')}
                            </button>
                            <a href="#/products" class="btn btn-outline">
                                ${this.__('form.cancel')}
                            </a>
                        </div>
                    </div>

                </div>
            </form>
        `;
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('products');

        // Extract productId from URL before render
        const hash = window.location.hash;
        const editMatch = hash.match(/\/products\/([^/]+)\/edit/);
        if (editMatch) {
            this.productId = editMatch[1];
        }
    }

    async init() {
        // productId is already set in preload()

        // Set translator for ProductValidator
        setTranslator((key, params) => this.__(key, params));

        await Promise.all([
            this.loadCategories(),
            this.loadProductionTypes(),
            this.loadWeighingSettings()
        ]);

        if (this.productId) {
            await this.loadProduct();
        }

        // Initialize MediaPicker module
        this._initMediaPicker();

        // Initialize BarcodeSection module
        this._initBarcodeSection();

        // HAL card: firma HAL entegrasyonu aktif ve yapılandırılmışsa göster
        await this._checkHalIntegration();

        // Initialize PriceHistorySection module (only for edit mode)
        if (this.productId) {
            this._initPriceHistorySection();
        }

        // Show branch indicator for new products if a branch is active
        if (!this.productId) {
            this._showBranchIndicatorForNew();
        }

        this.bindEvents();
    }

    /**
     * Show branch indicator for new product form
     */
    _showBranchIndicatorForNew() {
        const activeBranch = this.app.state.get('activeBranch');
        if (!activeBranch) return;

        // Add indicator to page-header-right (before buttons)
        const pageHeaderRight = document.querySelector('.page-header-right');
        if (pageHeaderRight && !document.getElementById('branch-edit-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'branch-edit-indicator';
            indicator.className = 'branch-edit-indicator branch-indicator-header';
            indicator.innerHTML = `
                <i class="ti ti-building-store"></i>
                <span>${this.__('detail.branchLabel', { name: activeBranch.name })}</span>
                <span class="badge badge-warning">${this.__('form.newBranchProduct')}</span>
            `;
            // Insert at the beginning of page-header-right
            pageHeaderRight.insertBefore(indicator, pageHeaderRight.firstChild);
        }
    }

    /**
     * Initialize MediaPicker module
     */
    _initMediaPicker() {
        // Create a virtual container for MediaPicker (modal-based, doesn't need DOM container)
        const container = document.createElement('div');
        container.id = 'media-picker-container';

        this.mediaPicker = initMediaPicker({
            container,
            app: this.app,
            onSelect: (result) => this._handleMediaSelection(result)
        });
    }

    /**
     * Handle media selection from MediaPicker module
     */
    _handleMediaSelection(result) {
        switch (result.mode) {
            case 'single':
                // Tek görsel seçimi - image_url alanına yaz
                document.getElementById('image_url').value = result.media.url;
                this.updateImagePreview(result.media.url);
                break;

            case 'multi-image':
                // Çoklu görsel seçimi - images dizisine ekle
                result.media.forEach(img => {
                    this.addImage(img.url, img.filename);
                });
                break;

            case 'multi-video':
                // Çoklu video seçimi - videos dizisine ekle
                result.media.forEach(video => {
                    this.addVideo(video.url, video.filename);
                });
                break;
        }
    }

    /**
     * Initialize BarcodeSection module
     */
    _initBarcodeSection() {
        // Create a virtual container for BarcodeSection
        const container = document.createElement('div');
        container.id = 'barcode-section-container';

        this.barcodeSection = initBarcodeSection({
            container,
            app: this.app,
            weighingSettings: this.weighingSettings
        });

        // Bind events after init
        this.barcodeSection.bindEvents();
    }

    /**
     * Check HAL integration status and show/hide HAL card
     */
    async _checkHalIntegration() {
        try {
            const response = await this.app.api.get('/hal/settings');
            if (response.success && response.data?.meta?.is_active && response.data?.configured) {
                const halCard = document.getElementById('hal-card');
                if (halCard) {
                    halCard.style.display = '';
                }
                this._initHalKunyeSection();

                // Mevcut ürün düzenleniyorsa HAL verisini yükle
                if (this.productId) {
                    this.loadProductionTypeFromHalData();
                }
            }
        } catch (e) {
            // HAL entegrasyonu yoksa veya hata oluşursa card gizli kalır
        }
    }

    /**
     * Initialize HalKunyeSection module
     */
    _initHalKunyeSection() {
        // Create a virtual container for HalKunyeSection
        const container = document.createElement('div');
        container.id = 'hal-kunye-section-container';

        this.halKunyeSection = initHalKunyeSection({
            container,
            app: this.app,
            onDataApply: (data) => this._handleKunyeDataApply(data)
        });

        // Bind events after init
        this.halKunyeSection.bindEvents();
    }

    /**
     * Handle künye data apply callback
     * Künye verilerini product_hal_data tablosuna kaydeder
     * @param {Object} data - Applied künye data
     */
    async _handleKunyeDataApply(data) {
        Logger.debug('Künye data applied:', data);

        // Üretim şekli eşleştirmesi yap
        await this._matchProductionType(data);

        // Ürün kaydedilmemişse HAL verisini saklayıp kaydederken göndereceğiz
        if (!this.productId) {
            this._pendingHalData = data;
            Logger.debug('HAL data stored for later (product not saved yet)');
            return;
        }

        // Ürün mevcutsa HAL verisini hemen kaydet
        await this._saveHalData(data);
    }

    /**
     * HAL verilerinden üretim şekli eşleştirmesi yap
     * malin_turu veya sertifikasyon bilgisinden production_type belirle
     * @param {Object} data - HAL künye verisi
     */
    async _matchProductionType(data) {
        // Eşleştirme için kullanılacak değerler
        const malinTuru = (data.malin_turu || data.urun_turu || '').toLowerCase().trim();
        const sertifikasyonKurulusu = (data.sertifikasyon_kurulusu || '').toLowerCase().trim();
        const sertifikaNo = data.sertifika_no || '';

        // Eşleştirme yapılacak değer yoksa çık
        if (!malinTuru && !sertifikasyonKurulusu) {
            return;
        }

        // Üretim şekillerini yükle (henüz yüklenmemişse)
        if (!this.productionTypes || this.productionTypes.length === 0) {
            await this.loadProductionTypes();
        }

        // Organik sertifikası varsa öncelikle "Organik" ara
        let matchedType = null;
        let detectedTypeName = '';

        if (sertifikasyonKurulusu || sertifikaNo) {
            detectedTypeName = 'Organik';
            matchedType = this._findProductionTypeMatch('organik');
        }

        // Malın türünden eşleştirme yap
        if (!matchedType && malinTuru) {
            // Bilinen üretim şekli kalıpları
            const patterns = [
                { keywords: ['organik'], typeName: 'Organik' },
                { keywords: ['konvansiyonel', 'geleneksel'], typeName: 'Konvansiyonel' },
                { keywords: ['naturel', 'doğal', 'natural'], typeName: 'Naturel' },
                { keywords: ['iyi tarım', 'iyi tarim', 'good agricultural'], typeName: 'İyi Tarım' },
                { keywords: ['coğrafi işaret', 'cografi isaret', 'geographical'], typeName: 'Coğrafi İşaretli' }
            ];

            for (const pattern of patterns) {
                if (pattern.keywords.some(kw => malinTuru.includes(kw))) {
                    detectedTypeName = pattern.typeName;
                    matchedType = this._findProductionTypeMatch(pattern.keywords[0]);
                    break;
                }
            }

            // Kalıp eşleşmezse doğrudan malinTuru ile ara
            if (!matchedType) {
                detectedTypeName = data.malin_turu || data.urun_turu;
                matchedType = this._findProductionTypeMatch(malinTuru);
            }
        }

        // Eşleşme bulundu - select'i güncelle ve HAL verisine ekle
        if (matchedType) {
            const ptSelect = document.getElementById('production_type');
            if (ptSelect) {
                ptSelect.value = matchedType.name;
                Logger.debug('Production type matched:', matchedType.name);
            }
            // HAL verisine üretim şeklini ekle
            data.uretim_sekli = matchedType.name;
            data.uretim_sekli_source = 'hal_query';
            return;
        }

        // Eşleşme bulunamadı - kullanıcıya sor
        if (detectedTypeName) {
            this._showProductionTypeMismatchModal(detectedTypeName, data);
        }
    }

    /**
     * Üretim şekli eşleştirmesi için arama yap
     * @param {string} searchTerm - Aranacak terim
     * @returns {Object|null} Eşleşen üretim şekli veya null
     */
    _findProductionTypeMatch(searchTerm) {
        if (!this.productionTypes || !searchTerm) return null;

        const term = searchTerm.toLowerCase().trim();

        // Tam eşleşme
        let match = this.productionTypes.find(pt =>
            pt.name.toLowerCase() === term
        );

        if (match) return match;

        // Kısmi eşleşme (içerme)
        match = this.productionTypes.find(pt =>
            pt.name.toLowerCase().includes(term) ||
            term.includes(pt.name.toLowerCase())
        );

        if (match) return match;

        // Türkçe karakter normalizasyonu ile ara
        const normalizedTerm = this._normalizeText(term);
        match = this.productionTypes.find(pt =>
            this._normalizeText(pt.name) === normalizedTerm ||
            this._normalizeText(pt.name).includes(normalizedTerm) ||
            normalizedTerm.includes(this._normalizeText(pt.name))
        );

        return match;
    }

    /**
     * Türkçe karakterleri normalize et
     * @param {string} text - Normalize edilecek metin
     * @returns {string} Normalize edilmiş metin
     */
    _normalizeText(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/İ/g, 'i')
            .trim();
    }

    /**
     * Üretim şekli eşleşmediğinde kullanıcıya seçenek sun
     * @param {string} detectedType - HAL'den tespit edilen tür
     * @param {Object} halData - HAL verisi
     */
    _showProductionTypeMismatchModal(detectedType, halData) {
        const existingOptions = this.productionTypes.map(pt => `
            <label class="production-type-option">
                <input type="radio" name="pt-mismatch-action" value="existing" data-id="${pt.id}" data-name="${escapeHTML(pt.name)}">
                <span class="option-color" style="background-color: ${pt.color || '#228be6'}"></span>
                <span class="option-name">${escapeHTML(pt.name)}</span>
            </label>
        `).join('');

        Modal.show({
            title: this.__('hal.productionType.mismatchTitle'),
            icon: 'ti-leaf',
            size: 'md',
            content: `
                <div class="production-type-mismatch">
                    <div class="mismatch-info">
                        <i class="ti ti-info-circle text-info"></i>
                        <p>${this.__('hal.productionType.mismatchMessage', { type: escapeHTML(detectedType) })}</p>
                    </div>

                    <div class="mismatch-options">
                        <!-- Yeni oluştur seçeneği -->
                        <div class="mismatch-option-group">
                            <label class="production-type-option highlight">
                                <input type="radio" name="pt-mismatch-action" value="create" checked>
                                <i class="ti ti-plus"></i>
                                <span class="option-name">"${escapeHTML(detectedType)}" ${this.__('hal.productionType.createNew')}</span>
                            </label>
                        </div>

                        ${this.productionTypes.length > 0 ? `
                        <!-- Mevcut seçenekler -->
                        <div class="mismatch-divider">
                            <span>${this.__('hal.productionType.orSelectExisting')}</span>
                        </div>
                        <div class="mismatch-option-group existing-options">
                            ${existingOptions}
                        </div>
                        ` : ''}

                        <!-- Atla seçeneği -->
                        <div class="mismatch-divider">
                            <span>${this.__('hal.productionType.orSkip')}</span>
                        </div>
                        <div class="mismatch-option-group">
                            <label class="production-type-option skip">
                                <input type="radio" name="pt-mismatch-action" value="skip">
                                <i class="ti ti-x"></i>
                                <span class="option-name">${this.__('hal.productionType.skipSelection')}</span>
                            </label>
                        </div>
                    </div>
                </div>
            `,
            confirmText: this.__('actions.apply'),
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                await this._handleProductionTypeMismatchAction(detectedType, halData);
            }
        });
    }

    /**
     * Üretim şekli uyumsuzluk modal seçimini işle
     * @param {string} detectedType - Tespit edilen tür adı
     * @param {Object} halData - HAL künye verisi (üretim şekli eklenecek)
     */
    async _handleProductionTypeMismatchAction(detectedType, halData) {
        const selectedOption = document.querySelector('input[name="pt-mismatch-action"]:checked');
        if (!selectedOption) return;

        const action = selectedOption.value;
        const ptSelect = document.getElementById('production_type');

        switch (action) {
            case 'create':
                // Yeni üretim şekli oluştur
                try {
                    const response = await this.app.api.post('/production-types', {
                        name: detectedType,
                        color: '#40c057', // Yeşil (organik/doğal için uygun)
                        status: 'active'
                    });

                    if (response.success) {
                        await this.loadProductionTypes();
                        if (ptSelect) {
                            ptSelect.value = detectedType;
                        }
                        // HAL verisine üretim şeklini ekle
                        if (halData) {
                            halData.uretim_sekli = detectedType;
                            halData.uretim_sekli_source = 'hal_query';
                        }
                        Toast.success(this.__('hal.productionType.created', { name: detectedType }));
                    }
                } catch (error) {
                    Logger.error('Production type create error:', error);
                    Toast.error(this.__('productionTypes.toast.saveFailed'));
                }
                break;

            case 'existing':
                // Mevcut üretim şeklini seç
                const selectedName = selectedOption.dataset.name;
                if (ptSelect && selectedName) {
                    ptSelect.value = selectedName;
                    // HAL verisine üretim şeklini ekle
                    if (halData) {
                        halData.uretim_sekli = selectedName;
                        halData.uretim_sekli_source = 'user_selected';
                    }
                    Toast.success(this.__('hal.productionType.selected', { name: selectedName }));
                }
                break;

            case 'skip':
                // Seçim yapma, atla
                Logger.debug('Production type selection skipped');
                break;
        }
    }

    /**
     * HAL künye verisini API'ye kaydet
     * @param {Object} halData - HAL künye verisi
     */
    async _saveHalData(halData) {
        if (!this.productId || !halData?.kunye_no) {
            return;
        }

        try {
            const payload = {
                product_id: this.productId,
                kunye_no: halData.kunye_no,
                // Üretim Yeri Bilgileri
                uretici_adi: halData.uretici_adi || halData.uretici,
                malin_adi: halData.malin_adi || halData.urun_adi,
                malin_cinsi: halData.malin_cinsi || halData.urun_cinsi,
                malin_turu: halData.malin_turu || halData.urun_turu,
                ilk_bildirim_tarihi: halData.ilk_bildirim_tarihi || halData.bildirim_tarihi,
                uretim_yeri: halData.uretim_yeri,
                // Tüketim Yeri Bilgileri
                malin_sahibi: halData.malin_sahibi,
                tuketim_bildirim_tarihi: halData.tuketim_bildirim_tarihi,
                tuketim_yeri: halData.tuketim_yeri,
                // Etiket Bilgileri
                gumruk_kapisi: halData.gumruk_kapisi,
                uretim_ithal_tarihi: halData.uretim_ithal_tarihi,
                miktar: halData.miktar,
                alis_fiyati: halData.alis_fiyati,
                isletme_adi: halData.isletme_adi,
                diger_bilgiler: halData.diger_bilgiler,
                // Organik Sertifika
                sertifikasyon_kurulusu: halData.sertifikasyon_kurulusu,
                sertifika_no: halData.sertifika_no,
                // Meta
                gecmis_bildirimler: halData.gecmis_bildirimler,
                hal_sorgu_tarihi: new Date().toISOString(),
                // Üretim Şekli (HAL tablosunda saklanır)
                uretim_sekli: halData.uretim_sekli || null,
                uretim_sekli_source: halData.uretim_sekli_source || 'user_selected'
            };

            const response = await this.app.api.post('/hal/data', payload);

            if (response.success) {
                Logger.debug('HAL data saved successfully');
            } else {
                Logger.warn('HAL data save failed:', response.message);
            }
        } catch (error) {
            Logger.error('HAL data save error:', error);
        }
    }

    /**
     * Initialize PriceHistorySection module
     */
    _initPriceHistorySection() {
        const container = document.getElementById('price-history-container');
        if (!container) {
            Logger.warn('PriceHistorySection: container not found');
            return;
        }

        this.priceHistorySection = initPriceHistorySection({
            container,
            app: this.app,
            productId: this.productId,
            productName: this.product?.name || '',
            translator: (key, params) => this.__(key, params)
        });

        // Render the section
        this.priceHistorySection.render();
        this.priceHistorySection.bindEvents();
    }

    /**
     * Load weighing barcode settings from API
     */
    async loadWeighingSettings() {
        try {
            const response = await this.app.api.get('/settings');
            if (response.success && response.data) {
                this.weighingSettings = {
                    flagCode: response.data.weighing_flag_code || '27',
                    barcodeFormat: response.data.weighing_barcode_format || 'CODE128'
                };

                // Update BarcodeSection module with new settings
                if (this.barcodeSection) {
                    this.barcodeSection.updateWeighingSettings(this.weighingSettings);
                }
            }
        } catch (error) {
            Logger.error('Weighing settings load error:', error);
        }
    }

    async loadCategories() {
        try {
            const response = await this.app.api.get('/categories');
            this.categories = response.data || [];
            this.populateCategories();
        } catch (error) {
            Logger.error('Categories load error:', error);
        }
    }

    async loadProductionTypes() {
        try {
            const response = await this.app.api.get('/production-types');
            this.productionTypes = response.data || [];
            this.populateProductionTypes();
        } catch (error) {
            Logger.error('Production types load error:', error);
        }
    }

    populateProductionTypes() {
        const select = document.getElementById('production_type');
        if (!select) return;

        // Clear existing options except first
        select.innerHTML = `<option value="">${this.__('form.placeholders.selectProductionType')}</option>`;

        // Add options sorted by sort_order
        const sortedTypes = [...this.productionTypes].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        sortedTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.name;
            option.dataset.id = type.id;
            option.textContent = type.name;
            select.appendChild(option);
        });
    }

    populateCategories() {
        const select = document.getElementById('category');
        if (!select) return;

        // Clear existing options except first
        select.innerHTML = `<option value="">${this.__('form.placeholders.selectCategory')}</option>`;

        // Get parent categories (those without parent_id) that have at least one child category
        // This filters out group names (Manav, Kasap, etc.) that were incorrectly added to categories
        const parentCategoriesWithChildren = this.categories
            .filter(cat => !cat.parent_id)
            .filter(cat => {
                // Check if this parent has any children
                return this.categories.some(child => child.parent_id === cat.id);
            })
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        parentCategoriesWithChildren.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.dataset.id = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });

        // Clear subcategory dropdown
        this.updateSubcategories('');
    }

    /**
     * Update subcategories based on selected category
     */
    updateSubcategories(categoryName) {
        const subcategorySelect = document.getElementById('subcategory');
        if (!subcategorySelect) return;

        // Clear existing options
        subcategorySelect.innerHTML = `<option value="">${this.__('form.placeholders.selectSubcategory')}</option>`;

        if (!categoryName) return;

        // Find the parent category by name (case-insensitive)
        const categoryNameLower = categoryName.toLowerCase();
        const parentCategory = this.categories.find(cat =>
            cat.name.toLowerCase() === categoryNameLower && !cat.parent_id
        );
        if (!parentCategory) return;

        // Get child categories
        const childCategories = this.categories
            .filter(cat => cat.parent_id === parentCategory.id)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        childCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.dataset.id = cat.id;
            option.textContent = cat.name;
            subcategorySelect.appendChild(option);
        });
    }

    /**
     * Build category tree from flat list
     */
    buildCategoryTree(categories, parentId = null) {
        return categories
            .filter(cat => cat.parent_id === parentId)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map(cat => ({
                ...cat,
                children: this.buildCategoryTree(categories, cat.id)
            }));
    }

    /**
     * Render category options with indentation
     */
    renderCategoryOptions(select, categories, level) {
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.dataset.id = cat.id;

            // Add visual indentation
            const prefix = level > 0 ? '│ '.repeat(level - 1) + '├─ ' : '';
            option.textContent = prefix + cat.name;

            select.appendChild(option);

            // Render children recursively
            if (cat.children && cat.children.length > 0) {
                this.renderCategoryOptions(select, cat.children, level + 1);
            }
        });
    }

    async loadProduct() {
        try {
            // Check for active branch and include in request
            const activeBranch = this.app.state.get('activeBranch');
            const branchId = activeBranch?.id || null;

            let url = `/products/${this.productId}`;
            if (branchId) {
                url += `?branch_id=${branchId}`;
            }

            const response = await this.app.api.get(url);
            this.product = response.data;

            // Store branch info for UI indication
            this._currentBranchId = branchId;
            this._hasOverride = response.data?._has_override || false;
            this._dataSource = response.data?._data_source || 'master';

            this.populateForm();

            // Show branch indicator if applicable
            if (branchId && this._hasOverride) {
                this._showBranchIndicator();
            }
        } catch (error) {
            Toast.error(this.__('toast.loadError'));
            window.location.hash = '#/products';
        }
    }

    /**
     * Show visual indicator when editing branch-specific data
     */
    _showBranchIndicator() {
        const activeBranch = this.app.state.get('activeBranch');
        if (!activeBranch) return;

        // Add indicator to page-header-right (before buttons)
        const pageHeaderRight = document.querySelector('.page-header-right');
        if (pageHeaderRight && !document.getElementById('branch-edit-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'branch-edit-indicator';
            indicator.className = 'branch-edit-indicator branch-indicator-header';
            indicator.innerHTML = `
                <i class="ti ti-building-store"></i>
                <span>${this.__('detail.branchLabel', { name: activeBranch.name })}</span>
                <span class="badge badge-info">${this._dataSource === 'branch' ? this.__('detail.branchData') : this.__('detail.masterData')}</span>
            `;
            // Insert at the beginning of page-header-right
            pageHeaderRight.insertBefore(indicator, pageHeaderRight.firstChild);
        }
    }

    populateForm() {
        if (!this.product) return;

        const fields = [
            'name', 'sku', 'barcode', 'slug', 'kunye_no',
            'brand', 'origin', 'description', 'current_price', 'previous_price',
            // NOT: production_type artık product_hal_data tablosundan yükleniyor (migration 059-060)
            'price_valid_until', 'vat_rate', 'discount_percent', 'campaign_text',
            'unit', 'stock', 'weight', 'shelf_location', 'supplier_code',
            'status', 'valid_from', 'valid_until', 'image_url'
        ];

        // Handle group field separately (product_group in HTML, group in DB)
        const groupEl = document.getElementById('product_group');
        if (groupEl && this.product.group) {
            groupEl.value = this.product.group;
        }

        // Handle category and subcategory specially with case-insensitive matching
        // Product data may have "MEYVE" but dropdown has "Meyve"
        const categoryEl = document.getElementById('category');
        if (categoryEl && this.product.category) {
            // Find matching option (case-insensitive)
            const productCategoryLower = this.product.category.toLowerCase();
            const matchingOption = Array.from(categoryEl.options).find(opt =>
                opt.value.toLowerCase() === productCategoryLower
            );
            if (matchingOption) {
                categoryEl.value = matchingOption.value;
            }
            // Update subcategories dropdown based on selected category
            this.updateSubcategories(categoryEl.value || this.product.category);
        }

        // Now set subcategory after dropdown is populated (case-insensitive)
        const subcategoryEl = document.getElementById('subcategory');
        if (subcategoryEl && this.product.subcategory) {
            const productSubcategoryLower = this.product.subcategory.toLowerCase();
            const matchingSubOption = Array.from(subcategoryEl.options).find(opt =>
                opt.value.toLowerCase() === productSubcategoryLower
            );
            if (matchingSubOption) {
                subcategoryEl.value = matchingSubOption.value;
            }
        }

        // Date-only fields that need YYYY-MM-DD format
        const dateOnlyFields = ['valid_from', 'valid_until', 'price_valid_until'];

        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el && this.product[field] !== undefined && this.product[field] !== null) {
                let value = this.product[field];

                // If this is a date-only field, extract just the date part
                if (dateOnlyFields.includes(field) && value) {
                    // Handle "2026-01-10 00:00:00" or "2026-01-10T00:00:00" -> "2026-01-10"
                    value = value.split(/[T\s]/)[0];
                }

                el.value = value;
            }
        });

        // Handle datetime-local fields
        const datetimeFields = ['price_updated_at', 'previous_price_updated_at', 'vat_updated_at'];
        datetimeFields.forEach(field => {
            const el = document.getElementById(field);
            if (el && this.product[field]) {
                let value = this.product[field];

                // If value is just a date (YYYY-MM-DD), append default time
                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    value = value + 'T00:00';
                } else {
                    // Convert from "2024-01-15 10:30:00" to "2024-01-15T10:30"
                    value = value.replace(' ', 'T').substring(0, 16);
                }

                el.value = value;
            }
        });

        const isFeatured = document.getElementById('is_featured');
        if (isFeatured) {
            isFeatured.checked = this.product.is_featured == 1;
        }

        // Load multiple images
        if (this.product.images) {
            try {
                const images = typeof this.product.images === 'string'
                    ? JSON.parse(this.product.images)
                    : this.product.images;
                if (Array.isArray(images)) {
                    this.images = images;
                }
            } catch (e) {
                Logger.error('Failed to parse images:', e);
            }
        } else if (this.product.image_url) {
            // Fallback: single image_url for backwards compatibility
            this.images = [{ url: this.product.image_url, filename: this.product.image_url.split('/').pop() }];
        }

        // Load cover image index
        this.coverImageIndex = parseInt(this.product.cover_image_index) || 0;
        // Ensure coverImageIndex is within bounds
        if (this.coverImageIndex >= this.images.length) {
            this.coverImageIndex = 0;
        }

        // Load multiple videos
        if (this.product.videos) {
            try {
                const videos = typeof this.product.videos === 'string'
                    ? JSON.parse(this.product.videos)
                    : this.product.videos;
                if (Array.isArray(videos)) {
                    this.videos = videos;
                }
            } catch (e) {
                Logger.error('Failed to parse videos:', e);
            }
        }

        // Render media grids after loading data
        this.renderImagesGrid();
        this.renderVideosGrid();

        // Load price history into section (if available)
        if (this.priceHistorySection && this.product.price_history) {
            this.priceHistorySection.setProductName(this.product.name);
            this.priceHistorySection.setHistory(this.product.price_history);
        }

        // HAL verisinden üretim şeklini yükleme _checkHalIntegration() içinde yapılır
    }

    /**
     * HAL verisinden form alanlarını ve üretim şeklini yükle
     * product_hal_data tablosundan tüm alanları okur ve formu doldurur
     */
    async loadProductionTypeFromHalData() {
        if (!this.productId) return;

        try {
            const halResponse = await this.app.api.get(`/hal/data?product_id=${this.productId}`);
            if (!halResponse.success || !halResponse.data) return;

            const halData = halResponse.data;

            // Üretim şeklini ayarla
            if (halData.uretim_sekli) {
                const productionTypeEl = document.getElementById('production_type');
                if (productionTypeEl) {
                    productionTypeEl.value = halData.uretim_sekli;
                    if (productionTypeEl.value !== halData.uretim_sekli) {
                        const newOption = document.createElement('option');
                        newOption.value = halData.uretim_sekli;
                        newOption.textContent = halData.uretim_sekli;
                        productionTypeEl.appendChild(newOption);
                        productionTypeEl.value = halData.uretim_sekli;
                    }
                }
            }

            // Künye no alanını doldur
            const kunyeNoEl = document.getElementById('kunye_no');
            if (kunyeNoEl && halData.kunye_no) {
                kunyeNoEl.value = halData.kunye_no;
            }

            // HAL form alanlarını doldur (DB alan adı → form input ID eşlemesi)
            const fieldMap = {
                'malin_adi': 'hal_malin_adi',
                'malin_cinsi': 'hal_malin_cinsi',
                'malin_turu': 'hal_malin_turu',
                'uretici_adi': 'hal_uretici_adi',
                'uretim_yeri': 'hal_uretim_yeri',
                'ilk_bildirim_tarihi': 'hal_ilk_bildirim_tarihi',
                'malin_sahibi': 'hal_malin_sahibi',
                'tuketim_yeri': 'hal_tuketim_yeri',
                'miktar': 'hal_miktar',
                'alis_fiyati': 'hal_alis_fiyati'
            };

            for (const [dbField, inputId] of Object.entries(fieldMap)) {
                const el = document.getElementById(inputId);
                if (el && halData[dbField]) {
                    el.value = halData[dbField];
                }
            }
        } catch (error) {
            // HAL verisi yoksa veya hata oluşursa sessizce devam et
            Logger.debug('HAL verisi yüklenemedi:', error);
        }
    }

    // ========================================
    // Multiple Images Management
    // ========================================

    /**
     * Render images grid
     */
    renderImagesGrid() {
        const grid = document.getElementById('images-grid');
        if (!grid) return;

        // Ensure coverImageIndex is valid
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
            // Bind placeholder click
            document.getElementById('images-placeholder')?.addEventListener('click', () => {
                document.getElementById('image-input')?.click();
            });
        } else {
            const isCover = (index) => index === this.coverImageIndex;

            grid.innerHTML = `
                ${this.images.map((img, index) => `
                    <div class="product-media-item ${isCover(index) ? 'is-cover' : ''}" data-index="${index}" data-type="image">
                        <img src="${this.getDisplayUrl(img.url)}" alt="${this.__('form.media.image')} ${index + 1}">
                        <span class="product-media-index-badge">${index + 1}.</span>
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

            // Bind events
            this.bindImagesGridEvents();
        }
    }

    /**
     * Bind images grid events
     */
    bindImagesGridEvents() {
        // Add more images button
        document.getElementById('add-more-images')?.addEventListener('click', () => {
            document.getElementById('image-input')?.click();
        });

        // Action buttons
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

    /**
     * Normalize media URL for storage
     * Uses MediaUtils for cross-environment compatibility
     */
    normalizeMediaUrl(url) {
        return MediaUtils.normalizeUrl(url);
    }

    /**
     * Get display URL from stored path
     * Uses MediaUtils for cross-environment compatibility
     */
    getDisplayUrl(url) {
        return MediaUtils.getDisplayUrl(url);
    }

    /**
     * Add image to the list
     */
    addImage(url, filename = '') {
        // Normalize URL before storing
        const normalizedUrl = this.normalizeMediaUrl(url);
        this.images.push({ url: normalizedUrl, filename: filename || url.split('/').pop() });
        this.renderImagesGrid();
    }

    /**
     * Upload image file to server and add to list
     * @param {File} file - Image file to upload
     */
    async uploadImage(file) {
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            Toast.error(this.__('toast.invalidImageType'));
            return;
        }

        // Validate file size (max 5MB)
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

    /**
     * Upload video file to server and add to list
     * @param {File} file - Video file to upload
     */
    async uploadVideo(file) {
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('video/')) {
            Toast.error(this.__('toast.invalidVideoType'));
            return;
        }

        // Validate file size (max 100MB)
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

    /**
     * Remove image from list
     */
    removeImage(index) {
        this.images.splice(index, 1);

        // Adjust cover image index if needed
        if (this.images.length === 0) {
            this.coverImageIndex = 0;
        } else if (index < this.coverImageIndex) {
            // Removed image was before cover, shift index down
            this.coverImageIndex--;
        } else if (index === this.coverImageIndex) {
            // Removed the cover image, reset to first
            this.coverImageIndex = 0;
        }

        this.renderImagesGrid();
    }

    /**
     * Set image as cover (kapak resmi)
     */
    setCoverImage(index) {
        if (index >= 0 && index < this.images.length) {
            this.coverImageIndex = index;
            this.renderImagesGrid();
        }
    }

    // ========================================
    // Multiple Videos Management
    // ========================================

    /**
     * Render videos grid
     */
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
            // Bind placeholder click
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

            // Bind events
            this.bindVideosGridEvents();
        }
    }

    /**
     * Get video thumbnail HTML
     */
    getVideoThumbnail(video) {
        const type = this.getVideoType(video.url);

        if (type === 'YouTube') {
            const videoId = this.extractYouTubeId(video.url);
            if (videoId) {
                return `<img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" alt="Video thumbnail">`;
            }
        } else if (type === 'Vimeo') {
            // Vimeo needs API call for thumbnail, use placeholder with brand icon
            return `<div class="video-placeholder vimeo-placeholder"><i class="ti ti-brand-vimeo"></i></div>`;
        } else if (type === 'Video') {
            // For direct video files (.mp4, .webm, etc.), use video element to show first frame
            return `<video src="${escapeHTML(video.url)}" class="video-thumbnail" preload="metadata" muted></video>`;
        }

        // For unknown link types
        return `<div class="video-placeholder"><i class="ti ti-link"></i></div>`;
    }

    /**
     * Get video type from URL
     */
    getVideoType(url) {
        if (!url) return 'Video';

        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return 'YouTube';
        } else if (url.includes('vimeo.com')) {
            return 'Vimeo';
        } else if (url.match(/\.(mp4|webm|ogg|avi|mov)$/i)) {
            return 'Video';
        }
        return 'Link';
    }

    /**
     * Extract YouTube video ID from URL
     */
    extractYouTubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    /**
     * Bind videos grid events
     */
    bindVideosGridEvents() {
        // Add more videos button
        document.getElementById('add-more-videos')?.addEventListener('click', () => {
            this.showVideoUrlModal();
        });

        // Action buttons
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

    /**
     * Add video to the list
     */
    addVideo(url, title = '') {
        this.videos.push({ url, title: title || 'Video ' + (this.videos.length + 1) });
        this.renderVideosGrid();
    }

    /**
     * Remove video from list
     */
    removeVideo(index) {
        this.videos.splice(index, 1);
        this.renderVideosGrid();
    }

    /**
     * Preview video in modal
     */
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
            embedHtml = `<video width="100%" height="400" controls><source src="${escapeHTML(video.url)}" type="video/mp4">${this.__('form.media.videoNotSupported')}</video>`;
        }

        Modal.show({
            title: escapeHTML(video.title) || this.__('form.media.videoPreview'),
            icon: 'ti-video',
            content: `<div class="video-preview-container">${embedHtml}</div>`,
            size: 'lg',
            showConfirm: false,
            cancelText: this.__('actions.close')
        });
    }

    /**
     * Show video URL input modal
     */
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
            confirmText: this.__('actions.add'),
            onConfirm: () => {
                const url = document.getElementById('video-url-input')?.value?.trim();
                const title = document.getElementById('video-title-input')?.value?.trim();

                if (!url) {
                    Toast.error(this.__('toast.videoUrlRequired'));
                    throw new Error('URL required'); // Prevent modal close
                }

                // Validate URL
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

    
    bindEvents() {
        // Collapsible cards toggle
        document.querySelectorAll('.chart-card.collapsible .chart-card-header').forEach(header => {
            header.addEventListener('click', (e) => {
                // Don't toggle if clicking on buttons, inputs, or interactive elements
                if (e.target.closest('button, input, select, a, .badge, .btn')) return;
                header.closest('.chart-card').classList.toggle('collapsed');
            });
        });

        // Form submit
        document.getElementById('product-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.save();
        });

        // Category change - update subcategories
        document.getElementById('category')?.addEventListener('change', (e) => {
            this.updateSubcategories(e.target.value);
        });

        // Slug generation
        document.getElementById('name')?.addEventListener('input', (e) => {
            const slugField = document.getElementById('slug');
            if (slugField && !slugField.value) {
                slugField.value = this.generateSlug(e.target.value);
            }
        });

        document.getElementById('generate-slug')?.addEventListener('click', () => {
            const name = document.getElementById('name')?.value;
            const slugField = document.getElementById('slug');
            if (name && slugField) {
                slugField.value = this.generateSlug(name);
            }
        });

        // ========================================
        // Multiple Images Handling
        // ========================================

        // Render initial images grid
        this.renderImagesGrid();

        // Image file input (multiple)
        const imageInput = document.getElementById('image-input');
        imageInput?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                this.uploadImage(file);
            });
            // Reset input so same file can be selected again
            imageInput.value = '';
        });

        // Upload images button
        document.getElementById('upload-images-btn')?.addEventListener('click', () => {
            imageInput?.click();
        });

        // Select images from library (multi-select) - uses MediaPicker module
        document.getElementById('select-images-from-library')?.addEventListener('click', () => {
            this.mediaPicker?.showMultiImagePicker();
        });

        // ========================================
        // Multiple Videos Handling
        // ========================================

        // Render initial videos grid
        this.renderVideosGrid();

        // Video file input (multiple)
        const videoInput = document.getElementById('video-input');
        videoInput?.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                this.uploadVideo(file);
            });
            videoInput.value = '';
        });

        // Upload videos button
        document.getElementById('upload-videos-btn')?.addEventListener('click', () => {
            videoInput?.click();
        });

        // Select videos from library - uses MediaPicker module
        document.getElementById('select-videos-from-library')?.addEventListener('click', () => {
            this.mediaPicker?.showVideoPicker();
        });

        // Add video URL
        document.getElementById('add-video-url-btn')?.addEventListener('click', () => {
            this.showVideoUrlModal();
        });

        // Category management modal
        document.getElementById('manage-categories-btn')?.addEventListener('click', () => {
            this.showCategoryManagementModal();
        });

        // Production type management modal
        document.getElementById('manage-production-types-btn')?.addEventListener('click', () => {
            this.showProductionTypeManagementModal();
        });

        // ========================================
        // Barcode Preview - handled by BarcodeSection module
        // Events are bound in _initBarcodeSection()
        // ========================================

        // ========================================
        // Künye QR Code Preview & HAL Sorgulama
        // handled by HalKunyeSection module
        // Events are bound in _initHalKunyeSection()
        // ========================================

        // Auto-manage price/vat dates based on changed values
        this._initAutoPriceDateHandlers();
    }

    _toNumericOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    _getNowDateTimeLocal() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    _capturePriceAutoState() {
        const currentPriceEl = document.getElementById('current_price');
        const previousPriceEl = document.getElementById('previous_price');
        const priceUpdatedAtEl = document.getElementById('price_updated_at');
        const previousPriceUpdatedAtEl = document.getElementById('previous_price_updated_at');
        const vatRateEl = document.getElementById('vat_rate');
        const vatUpdatedAtEl = document.getElementById('vat_updated_at');

        this._priceAutoState = {
            baselineCurrentPrice: this._toNumericOrNull(currentPriceEl?.value),
            baselinePreviousPriceRaw: previousPriceEl?.value || '',
            baselinePriceUpdatedAt: priceUpdatedAtEl?.value || '',
            baselinePreviousPriceUpdatedAt: previousPriceUpdatedAtEl?.value || '',
            baselineVatRate: this._toNumericOrNull(vatRateEl?.value),
            baselineVatUpdatedAt: vatUpdatedAtEl?.value || '',
            priceTouched: false,
            vatTouched: false
        };
    }

    _applyAutoPriceDates() {
        if (!this._priceAutoState) this._capturePriceAutoState();

        const currentPriceEl = document.getElementById('current_price');
        const previousPriceEl = document.getElementById('previous_price');
        const priceUpdatedAtEl = document.getElementById('price_updated_at');
        const previousPriceUpdatedAtEl = document.getElementById('previous_price_updated_at');
        if (!currentPriceEl || !previousPriceEl || !priceUpdatedAtEl || !previousPriceUpdatedAtEl) return;

        const state = this._priceAutoState;
        const currentPrice = this._toNumericOrNull(currentPriceEl.value);
        const baselinePrice = state.baselineCurrentPrice;
        const changedFromBaseline = baselinePrice === null
            ? currentPrice !== null
            : currentPrice !== null && Math.abs(currentPrice - baselinePrice) > 0.000001;

        if (changedFromBaseline) {
            const nowLocal = this._getNowDateTimeLocal();
            priceUpdatedAtEl.value = nowLocal;
            if (baselinePrice !== null) {
                previousPriceEl.value = String(baselinePrice);
                previousPriceUpdatedAtEl.value = nowLocal;
            }
            state.priceTouched = true;
            return;
        }

        if (state.priceTouched) {
            previousPriceEl.value = state.baselinePreviousPriceRaw;
            priceUpdatedAtEl.value = state.baselinePriceUpdatedAt;
            previousPriceUpdatedAtEl.value = state.baselinePreviousPriceUpdatedAt;
            state.priceTouched = false;
        }
    }

    _applyAutoVatDate() {
        if (!this._priceAutoState) this._capturePriceAutoState();

        const vatRateEl = document.getElementById('vat_rate');
        const vatUpdatedAtEl = document.getElementById('vat_updated_at');
        if (!vatRateEl || !vatUpdatedAtEl) return;

        const state = this._priceAutoState;
        const currentVat = this._toNumericOrNull(vatRateEl.value);
        const baselineVat = state.baselineVatRate;
        const vatChanged = baselineVat === null
            ? currentVat !== null
            : currentVat !== null && Math.abs(currentVat - baselineVat) > 0.000001;

        if (vatChanged) {
            vatUpdatedAtEl.value = this._getNowDateTimeLocal();
            state.vatTouched = true;
            return;
        }

        if (state.vatTouched) {
            vatUpdatedAtEl.value = state.baselineVatUpdatedAt;
            state.vatTouched = false;
        }
    }

    _initAutoPriceDateHandlers() {
        this._capturePriceAutoState();

        const currentPriceEl = document.getElementById('current_price');
        const vatRateEl = document.getElementById('vat_rate');

        currentPriceEl?.addEventListener('input', () => this._applyAutoPriceDates());
        currentPriceEl?.addEventListener('change', () => this._applyAutoPriceDates());
        vatRateEl?.addEventListener('change', () => this._applyAutoVatDate());
    }

    /**
     * Show category management modal with tree view
     */
    showCategoryManagementModal() {
        this.editingCategoryId = null;

        const modal = Modal.show({
            title: this.__('categories.title'),
            icon: 'ti-category',
            content: this.renderCategoryModalContent(),
            size: 'lg',
            showConfirm: false,
            cancelText: this.__('modal.close'),
            onClose: () => {
                this.categoryModalId = null;
            }
        });

        this.categoryModalId = modal.id;
        this.bindCategoryModalEvents();
    }

    /**
     * Render category modal content
     */
    renderCategoryModalContent() {
        const categoryTree = this.buildCategoryTree(this.categories);

        return `
            <div class="category-management">
                <!-- Add New Category Form -->
                <div class="category-form-section mb-4">
                    <h4 class="text-sm font-medium mb-3" id="category-form-title">
                        <i class="ti ti-folder-plus text-primary-500 mr-2"></i>
                        ${this.__('categories.addCategory')}
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="form-group mb-0">
                            <label class="form-label text-sm">${this.__('categories.fields.name')} *</label>
                            <input type="text" id="cat-name" class="form-input form-input-sm" placeholder="${this.__('categories.placeholders.name')}">
                        </div>
                        <div class="form-group mb-0">
                            <label class="form-label text-sm">${this.__('categories.fields.parent')}</label>
                            <select id="cat-parent" class="form-select form-select-sm">
                                <option value="">${this.__('categories.placeholders.parent')}</option>
                                ${this.renderParentOptions(categoryTree, 0)}
                            </select>
                        </div>
                        <div class="form-group mb-0">
                            <label class="form-label text-sm">${this.__('categories.fields.color')}</label>
                            <div class="flex gap-2">
                                <input type="color" id="cat-color" class="form-color h-9 w-12" value="#228be6">
                                <input type="text" id="cat-color-hex" class="form-input form-input-sm flex-1" value="#228be6" placeholder="#228be6">
                            </div>
                        </div>
                        <div class="form-group mb-0">
                            <label class="form-label text-sm">${this.__('categories.fields.order')}</label>
                            <input type="number" id="cat-sort" class="form-input form-input-sm" value="0" min="0">
                        </div>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button type="button" id="btn-save-category" class="btn btn-primary btn-sm">
                            <i class="ti ti-check"></i>
                            <span id="btn-save-text">${this.__('modal.add')}</span>
                        </button>
                        <button type="button" id="btn-cancel-edit" class="btn btn-outline btn-sm hidden">
                            <i class="ti ti-x"></i>
                            ${this.__('modal.cancel')}
                        </button>
                    </div>
                    <input type="hidden" id="cat-edit-id" value="">
                </div>

                <!-- Category Tree -->
                <div class="category-list-section">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="text-sm font-medium">
                            <i class="ti ti-list-tree text-primary-500 mr-2"></i>
                            ${this.__('categories.title')}
                        </h4>
                        <span class="text-xs text-gray-500">${this.__('categories.count', { count: this.categories.length })}</span>
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

    /**
     * Render parent category options for select
     */
    renderParentOptions(categories, level, excludeId = null) {
        let html = '';
        categories.forEach(cat => {
            if (cat.id === excludeId) return; // Exclude self when editing

            const prefix = '─'.repeat(level * 2);
            html += `<option value="${escapeHTML(cat.id)}">${prefix} ${escapeHTML(cat.name)}</option>`;

            if (cat.children && cat.children.length > 0) {
                html += this.renderParentOptions(cat.children, level + 1, excludeId);
            }
        });
        return html;
    }

    /**
     * Render category tree HTML
     */
    renderCategoryTree(categories, level) {
        let html = '';

        categories.forEach((cat, index) => {
            const isLast = index === categories.length - 1;
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
                            <span class="p-1 text-gray-300">
                                <i class="ti ti-point text-sm"></i>
                            </span>
                        `}
                        <span class="category-color w-3 h-3 rounded-full" style="background-color: ${cat.color || '#228be6'}"></span>
                        <span class="category-name flex-1 text-sm">${escapeHTML(cat.name)}</span>
                        ${cat.product_count > 0 ? `
                            <span class="badge badge-sm bg-gray-100 text-gray-600">${cat.product_count}</span>
                        ` : ''}
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

    /**
     * Bind category modal events
     */
    bindCategoryModalEvents() {
        // Color picker sync
        const colorPicker = document.getElementById('cat-color');
        const colorHex = document.getElementById('cat-color-hex');

        colorPicker?.addEventListener('input', (e) => {
            colorHex.value = e.target.value;
        });

        colorHex?.addEventListener('input', (e) => {
            const hex = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                colorPicker.value = hex;
            }
        });

        // Save category
        document.getElementById('btn-save-category')?.addEventListener('click', () => {
            this.saveCategoryFromModal();
        });

        // Cancel edit
        document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
            this.resetCategoryForm();
        });

        // Tree actions (event delegation)
        document.querySelector('.category-tree')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) {
                // Check for toggle button
                const toggleBtn = e.target.closest('[data-toggle]');
                if (toggleBtn) {
                    this.toggleCategoryChildren(toggleBtn.dataset.toggle);
                }
                return;
            }

            const action = btn.dataset.action;
            const id = btn.dataset.id;

            switch (action) {
                case 'add-child':
                    this.prepareAddChildCategory(id);
                    break;
                case 'edit':
                    this.editCategory(id);
                    break;
                case 'delete':
                    this.deleteCategory(id);
                    break;
            }
        });
    }

    /**
     * Toggle category children visibility
     */
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

    /**
     * Prepare form for adding child category
     */
    prepareAddChildCategory(parentId) {
        this.resetCategoryForm();
        document.getElementById('cat-parent').value = parentId;
        document.getElementById('cat-name')?.focus();
    }

    /**
     * Edit category
     */
    editCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return;

        this.editingCategoryId = categoryId;

        // Fill form
        document.getElementById('cat-name').value = category.name || '';
        document.getElementById('cat-parent').value = category.parent_id || '';
        document.getElementById('cat-color').value = category.color || '#228be6';
        document.getElementById('cat-color-hex').value = category.color || '#228be6';
        document.getElementById('cat-sort').value = category.sort_order || 0;
        document.getElementById('cat-edit-id').value = categoryId;

        // Update UI
        document.getElementById('category-form-title').textContent = this.__('categories.editCategory');
        document.getElementById('btn-save-text').textContent = this.__('modal.update');
        document.getElementById('btn-cancel-edit').classList.remove('hidden');

        // Update parent select (exclude self and children)
        const parentSelect = document.getElementById('cat-parent');
        const childIds = this.getAllChildIds(categoryId);
        Array.from(parentSelect.options).forEach(option => {
            if (option.value === categoryId || childIds.includes(option.value)) {
                option.disabled = true;
            } else {
                option.disabled = false;
            }
        });

        document.getElementById('cat-name')?.focus();
    }

    /**
     * Get all child category IDs recursively
     */
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

    /**
     * Reset category form
     */
    resetCategoryForm() {
        this.editingCategoryId = null;

        document.getElementById('cat-name').value = '';
        document.getElementById('cat-parent').value = '';
        document.getElementById('cat-color').value = '#228be6';
        document.getElementById('cat-color-hex').value = '#228be6';
        document.getElementById('cat-sort').value = '0';
        document.getElementById('cat-edit-id').value = '';

        document.getElementById('category-form-title').textContent = this.__('categories.addCategory');
        document.getElementById('btn-save-text').textContent = this.__('modal.add');
        document.getElementById('btn-cancel-edit').classList.add('hidden');

        // Re-enable all parent options
        const parentSelect = document.getElementById('cat-parent');
        Array.from(parentSelect.options).forEach(option => {
            option.disabled = false;
        });
    }

    /**
     * Save category from modal
     */
    async saveCategoryFromModal() {
        const name = document.getElementById('cat-name')?.value?.trim();
        const parentId = document.getElementById('cat-parent')?.value || null;
        const color = document.getElementById('cat-color')?.value || '#228be6';
        const sortOrder = parseInt(document.getElementById('cat-sort')?.value) || 0;
        const editId = document.getElementById('cat-edit-id')?.value;

        if (!name) {
            Toast.error(this.__('validation.required'));
            return;
        }

        const saveBtn = document.getElementById('btn-save-category');
        const originalContent = saveBtn.innerHTML;
        saveBtn.innerHTML = `<i class="ti ti-loader-2 animate-spin"></i> ${this.__('productionTypes.saving')}`;
        saveBtn.disabled = true;

        try {
            if (editId) {
                // Update existing
                await this.app.api.put(`/categories/${editId}`, {
                    name,
                    parent_id: parentId,
                    color,
                    sort_order: sortOrder
                });
                Toast.success(this.__('categories.toast.updated'));
            } else {
                // Create new
                await this.app.api.post('/categories', {
                    name,
                    parent_id: parentId,
                    color,
                    sort_order: sortOrder,
                    status: 'active'
                });
                Toast.success(this.__('categories.toast.created'));
            }

            // Reload categories and refresh both modal and main select
            await this.loadCategories();
            this.populateCategories(); // Update main form select
            this.refreshCategoryModal();

            // Select the newly added category if it was a new one
            if (!editId && name) {
                const categorySelect = document.getElementById('category');
                if (categorySelect) {
                    categorySelect.value = name;
                }
            }

        } catch (error) {
            Logger.error('Category save error:', error);
            Toast.error(error.message || this.__('messages.saveFailed'));
        } finally {
            saveBtn.innerHTML = originalContent;
            saveBtn.disabled = false;
        }
    }

    /**
     * Delete category
     */
    async deleteCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return;

        // Check for children
        const hasChildren = this.categories.some(c => c.parent_id === categoryId);

        Modal.confirm({
            title: this.__('categories.deleteCategory'),
            message: hasChildren
                ? this.__('categories.deleteWithChildren', { name: category.name })
                : this.__('categories.deleteConfirm', { name: category.name }),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/categories/${categoryId}`);
                    Toast.success(this.__('categories.toast.deleted'));

                    // Reload and refresh both modal and main select
                    await this.loadCategories();
                    this.populateCategories(); // Update main form select
                    this.refreshCategoryModal();

                } catch (error) {
                    Logger.error('Category delete error:', error);
                    Toast.error(error.message || this.__('messages.deleteFailed'));
                }
            }
        });
    }

    /**
     * Refresh category modal content
     */
    refreshCategoryModal() {
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = this.renderCategoryModalContent();
            this.bindCategoryModalEvents();
        }
    }

    generateSlug(text) {
        if (!text) return '';

        // Turkish character mapping
        const turkishMap = {
            'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
            'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
        };

        return text
            .toLowerCase()
            .split('')
            .map(char => turkishMap[char] || char)
            .join('')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    
    
    async save() {
        // Helper to convert datetime-local to SQL format
        const formatDateTime = (value) => {
            if (!value) return null;
            // Convert "2024-01-15T10:30" to "2024-01-15 10:30:00"
            return value.replace('T', ' ') + ':00';
        };

        // Check for active branch (for branch-specific updates)
        const activeBranch = this.app.state.get('activeBranch');
        const branchId = activeBranch?.id || null;

        // Debug: Log branch info
        Logger.debug('Branch info for save:', {
            activeBranch,
            branchId,
            stateKeys: Object.keys(this.app.state.data || {})
        });

        const data = {
            name: document.getElementById('name')?.value?.trim(),
            sku: document.getElementById('sku')?.value?.trim(),
            barcode: document.getElementById('barcode')?.value?.trim() || null,
            slug: document.getElementById('slug')?.value?.trim() || null,
            kunye_no: document.getElementById('kunye_no')?.value?.trim() || null,
            group: document.getElementById('product_group')?.value || null,
            category: document.getElementById('category')?.value || null,
            subcategory: document.getElementById('subcategory')?.value || null,
            brand: document.getElementById('brand')?.value?.trim() || null,
            origin: document.getElementById('origin')?.value?.trim() || null,
            // production_type artık product_hal_data tablosunda saklanıyor (migration 059-060)
            description: document.getElementById('description')?.value?.trim() || null,
            current_price: parseFloat(document.getElementById('current_price')?.value) || 0,
            previous_price: parseFloat(document.getElementById('previous_price')?.value) || null,
            price_updated_at: formatDateTime(document.getElementById('price_updated_at')?.value),
            previous_price_updated_at: formatDateTime(document.getElementById('previous_price_updated_at')?.value),
            vat_updated_at: formatDateTime(document.getElementById('vat_updated_at')?.value),
            price_valid_until: document.getElementById('price_valid_until')?.value || null,
            vat_rate: parseFloat(document.getElementById('vat_rate')?.value) || 20,
            discount_percent: parseFloat(document.getElementById('discount_percent')?.value) || null,
            campaign_text: document.getElementById('campaign_text')?.value?.trim() || null,
            unit: document.getElementById('unit')?.value || 'adet',
            stock: parseInt(document.getElementById('stock')?.value) || 0,
            weight: parseFloat(document.getElementById('weight')?.value) || null,
            shelf_location: document.getElementById('shelf_location')?.value?.trim() || null,
            supplier_code: document.getElementById('supplier_code')?.value?.trim() || null,
            status: document.getElementById('status')?.value || 'active',
            is_featured: document.getElementById('is_featured')?.checked ? 1 : 0,
            valid_from: document.getElementById('valid_from')?.value || null,
            valid_until: document.getElementById('valid_until')?.value || null,
            // Multiple images and videos (JSON stringified)
            images: JSON.stringify(this.images),
            videos: JSON.stringify(this.videos),
            cover_image_index: this.coverImageIndex,
            // Backwards compatibility: set image_url to cover image
            image_url: this.images.length > 0 ? this.images[this.coverImageIndex]?.url || this.images[0].url : null,
            // Branch-specific update (if a branch is selected)
            branch_id: branchId
        };

        // Validation using ProductValidator module
        clearAllErrors();
        const validation = validateRequired(data);
        if (!validation.valid) {
            showErrors(validation.errors);
            const firstError = Object.values(validation.errors)[0];
            Toast.error(firstError);
            return;
        }

        // Debug: Log data being sent
        Logger.debug('Saving product data:', data);

        try {
            let savedProductId = this.productId;

            if (this.productId) {
                await this.app.api.put(`/products/${this.productId}`, data);
                Toast.success(this.__('toast.updated'));
            } else {
                const response = await this.app.api.post('/products', data);
                savedProductId = response.data?.id;
                Toast.success(this.__('toast.created'));
            }

            // Eğer bekleyen HAL verisi varsa kaydet
            if (this._pendingHalData && savedProductId) {
                this.productId = savedProductId;
                await this._saveHalData(this._pendingHalData);
                this._pendingHalData = null;
            }

            // Manuel seçilen üretim şeklini HAL verisine kaydet (product_hal_data tablosunda)
            const selectedProductionType = document.getElementById('production_type')?.value;
            if (selectedProductionType && savedProductId) {
                try {
                    // Önce mevcut HAL verisini kontrol et
                    const halResponse = await this.app.api.get(`/hal/data?product_id=${savedProductId}`);
                    if (halResponse.success && halResponse.data) {
                        // HAL verisi varsa ve üretim şekli farklıysa güncelle
                        if (halResponse.data.uretim_sekli !== selectedProductionType) {
                            await this.app.api.post('/hal/data', {
                                product_id: savedProductId,
                                kunye_no: halResponse.data.kunye_no || data.kunye_no || 'MANUAL',
                                uretim_sekli: selectedProductionType,
                                uretim_sekli_source: 'user_selected'
                            });
                        }
                    } else if (data.kunye_no) {
                        // HAL verisi yoksa ama künye no varsa yeni kayıt oluştur
                        await this.app.api.post('/hal/data', {
                            product_id: savedProductId,
                            kunye_no: data.kunye_no,
                            uretim_sekli: selectedProductionType,
                            uretim_sekli_source: 'user_selected'
                        });
                    }
                } catch (halError) {
                    // HAL kaydetme hatası ürün kaydını etkilemesin
                    Logger.warning('Üretim şekli HAL verisine kaydedilemedi:', halError);
                }
            }

            window.location.hash = '#/products';
        } catch (error) {
            Logger.error('Save error:', error);

            // Show detailed validation errors if available
            if (error.data?.errors) {
                const errors = error.data.errors;
                const errorMessages = [];
                for (const [field, messages] of Object.entries(errors)) {
                    if (Array.isArray(messages)) {
                        errorMessages.push(...messages);
                    } else {
                        errorMessages.push(messages);
                    }
                }
                Toast.error(errorMessages.join('\n') || error.message || this.__('messages.error'));
            } else {
                Toast.error(error.message || this.__('messages.error'));
            }
        }
    }

    // ========================================
    // Production Type Management Modal
    // ========================================

    /**
     * Show production type management modal
     */
    showProductionTypeManagementModal() {
        this.editingProductionTypeId = null;

        const modal = Modal.show({
            title: this.__('productionTypes.title'),
            icon: 'ti-leaf',
            content: this.renderProductionTypeModalContent(),
            size: 'md',
            showConfirm: false,
            cancelText: this.__('modal.close'),
            onClose: () => {
                this.productionTypeModalId = null;
            }
        });

        this.productionTypeModalId = modal.id;
        this.bindProductionTypeModalEvents();
    }

    /**
     * Render production type modal content
     */
    renderProductionTypeModalContent() {
        return `
            <div class="production-type-management">
                <!-- Add New Production Type Form -->
                <div class="production-type-form-section mb-4">
                    <h4 class="text-sm font-medium mb-3" id="pt-form-title">
                        <i class="ti ti-plus text-primary-500 mr-2"></i>
                        ${this.__('productionTypes.addType')}
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="form-group mb-0">
                            <label class="form-label text-sm">${this.__('productionTypes.fields.name')} *</label>
                            <input type="text" id="pt-name" class="form-input form-input-sm" placeholder="${this.__('productionTypes.placeholders.name')}">
                        </div>
                        <div class="form-group mb-0">
                            <label class="form-label text-sm">${this.__('productionTypes.fields.color')}</label>
                            <div class="flex gap-2">
                                <input type="color" id="pt-color" class="form-color h-9 w-12" value="#228be6">
                                <input type="text" id="pt-color-hex" class="form-input form-input-sm flex-1" value="#228be6" placeholder="#228be6">
                            </div>
                        </div>
                        <div class="form-group mb-0 md:col-span-2">
                            <label class="form-label text-sm">${this.__('productionTypes.fields.description')}</label>
                            <input type="text" id="pt-description" class="form-input form-input-sm" placeholder="${this.__('productionTypes.placeholders.description')}">
                        </div>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button type="button" id="btn-save-pt" class="btn btn-primary btn-sm">
                            <i class="ti ti-check"></i>
                            <span id="btn-save-pt-text">${this.__('modal.add')}</span>
                        </button>
                        <button type="button" id="btn-cancel-pt-edit" class="btn btn-outline btn-sm hidden">
                            <i class="ti ti-x"></i>
                            ${this.__('modal.cancel')}
                        </button>
                    </div>
                    <input type="hidden" id="pt-edit-id" value="">
                </div>

                <!-- Production Types List -->
                <div class="production-type-list-section">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="text-sm font-medium">
                            <i class="ti ti-list text-primary-500 mr-2"></i>
                            ${this.__('productionTypes.title')}
                        </h4>
                        <span class="text-xs text-gray-500">${this.__('productionTypes.count', { count: this.productionTypes.length })}</span>
                    </div>
                    ${this.productionTypes.length === 0 ? `
                        <div class="text-center py-8 text-gray-500">
                            <i class="ti ti-leaf-off text-3xl mb-2"></i>
                            <p>${this.__('productionTypes.empty')}</p>
                        </div>
                    ` : `
                        <div class="production-type-list divide-y divide-gray-100 dark:divide-gray-700">
                            ${this.productionTypes.map(pt => `
                                <div class="production-type-item flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800" data-id="${pt.id}">
                                    <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${pt.color || '#228be6'}"></span>
                                    <div class="flex-1 min-w-0">
                                        <span class="text-sm font-medium">${escapeHTML(pt.name)}</span>
                                        ${pt.description ? `<p class="text-xs text-gray-500 truncate">${escapeHTML(pt.description)}</p>` : ''}
                                    </div>
                                    <div class="flex gap-1">
                                        <button class="btn btn-ghost btn-xs" data-pt-action="edit" data-id="${pt.id}" title="${this.__('modal.edit')}">
                                            <i class="ti ti-edit text-xs"></i>
                                        </button>
                                        <button class="btn btn-ghost btn-xs text-red-600" data-pt-action="delete" data-id="${pt.id}" title="${this.__('modal.delete')}">
                                            <i class="ti ti-trash text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    /**
     * Bind production type modal events
     */
    bindProductionTypeModalEvents() {
        // Color picker sync
        const colorPicker = document.getElementById('pt-color');
        const colorHex = document.getElementById('pt-color-hex');

        colorPicker?.addEventListener('input', (e) => {
            colorHex.value = e.target.value;
        });

        colorHex?.addEventListener('input', (e) => {
            const hex = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                colorPicker.value = hex;
            }
        });

        // Save production type
        document.getElementById('btn-save-pt')?.addEventListener('click', () => {
            this.saveProductionTypeFromModal();
        });

        // Cancel edit
        document.getElementById('btn-cancel-pt-edit')?.addEventListener('click', () => {
            this.resetProductionTypeForm();
        });

        // List actions (event delegation)
        document.querySelector('.production-type-list')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-pt-action]');
            if (!btn) return;

            const action = btn.dataset.ptAction;
            const id = btn.dataset.id;

            switch (action) {
                case 'edit':
                    this.editProductionType(id);
                    break;
                case 'delete':
                    this.deleteProductionType(id);
                    break;
            }
        });
    }

    /**
     * Edit production type
     */
    editProductionType(id) {
        const pt = this.productionTypes.find(p => p.id === id);
        if (!pt) return;

        this.editingProductionTypeId = id;

        document.getElementById('pt-name').value = pt.name || '';
        document.getElementById('pt-color').value = pt.color || '#228be6';
        document.getElementById('pt-color-hex').value = pt.color || '#228be6';
        document.getElementById('pt-description').value = pt.description || '';
        document.getElementById('pt-edit-id').value = id;

        document.getElementById('pt-form-title').innerHTML = `<i class="ti ti-edit text-primary-500 mr-2"></i>${this.__('productionTypes.editType')}`;
        document.getElementById('btn-save-pt-text').textContent = this.__('modal.update');
        document.getElementById('btn-cancel-pt-edit').classList.remove('hidden');

        document.getElementById('pt-name')?.focus();
    }

    /**
     * Reset production type form
     */
    resetProductionTypeForm() {
        this.editingProductionTypeId = null;

        document.getElementById('pt-name').value = '';
        document.getElementById('pt-color').value = '#228be6';
        document.getElementById('pt-color-hex').value = '#228be6';
        document.getElementById('pt-description').value = '';
        document.getElementById('pt-edit-id').value = '';

        document.getElementById('pt-form-title').innerHTML = `<i class="ti ti-plus text-primary-500 mr-2"></i>${this.__('productionTypes.addType')}`;
        document.getElementById('btn-save-pt-text').textContent = this.__('modal.add');
        document.getElementById('btn-cancel-pt-edit').classList.add('hidden');
    }

    /**
     * Save production type from modal
     */
    async saveProductionTypeFromModal() {
        const name = document.getElementById('pt-name')?.value?.trim();
        const color = document.getElementById('pt-color')?.value || '#228be6';
        const description = document.getElementById('pt-description')?.value?.trim() || '';
        const editId = document.getElementById('pt-edit-id')?.value;

        if (!name) {
            Toast.error(this.__('productionTypes.toast.required'));
            return;
        }

        const saveBtn = document.getElementById('btn-save-pt');
        const originalContent = saveBtn.innerHTML;
        saveBtn.innerHTML = `<i class="ti ti-loader-2 animate-spin"></i> ${this.__('productionTypes.saving')}`;
        saveBtn.disabled = true;

        try {
            if (editId) {
                await this.app.api.put(`/production-types/${editId}`, { name, color, description });
                Toast.success(this.__('productionTypes.toast.updated'));
            } else {
                await this.app.api.post('/production-types', { name, color, description, status: 'active' });
                Toast.success(this.__('productionTypes.toast.created'));
            }

            // Reload and refresh
            await this.loadProductionTypes();
            this.refreshProductionTypeModal();

            // Select the newly added type if it was new
            if (!editId && name) {
                const ptSelect = document.getElementById('production_type');
                if (ptSelect) {
                    ptSelect.value = name;
                }
            }

        } catch (error) {
            Logger.error('Production type save error:', error);
            Toast.error(error.message || this.__('productionTypes.toast.saveFailed'));
        } finally {
            saveBtn.innerHTML = originalContent;
            saveBtn.disabled = false;
        }
    }

    /**
     * Delete production type
     */
    async deleteProductionType(id) {
        const pt = this.productionTypes.find(p => p.id === id);
        if (!pt) return;

        Modal.confirm({
            title: this.__('productionTypes.deleteType'),
            message: this.__('productionTypes.deleteConfirm', { name: pt.name }),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/production-types/${id}`);
                    Toast.success(this.__('productionTypes.toast.deleted'));

                    await this.loadProductionTypes();
                    this.refreshProductionTypeModal();

                } catch (error) {
                    Logger.error('Production type delete error:', error);
                    Toast.error(error.message || this.__('productionTypes.toast.deleteFailed'));
                }
            }
        });
    }

    /**
     * Refresh production type modal content
     */
    refreshProductionTypeModal() {
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = this.renderProductionTypeModalContent();
            this.bindProductionTypeModalEvents();
        }
    }

    // ========================================
    // Barcode Preview Functions
    // ========================================


    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}

export default ProductFormPage;

