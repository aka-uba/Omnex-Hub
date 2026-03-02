/**
 * DynamicFieldsPanel - Dinamik Alanlar Paneli
 *
 * Ürün verilerini şablona bağlamak için dinamik alan seçici.
 * Ürün adı, fiyat, barkod vb. alanları canvas'a ekler.
 *
 * KULLANIM:
 * ```javascript
 * import { DynamicFieldsPanel } from './editor/panels/DynamicFieldsPanel.js';
 *
 * const dynamicFieldsPanel = new DynamicFieldsPanel({
 *     container: '#left-panel',
 *     i18n: (key) => translate(key),
 *     onFieldSelect: (fieldKey, options) => {
 *         // Alan canvas'a eklenecek
 *     }
 * });
 *
 * dynamicFieldsPanel.mount();
 * ```
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

import { PanelBase } from './PanelBase.js';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { DYNAMIC_FIELDS } from '../core/CustomProperties.js';

/**
 * Alan grupları tanımları
 */
const FIELD_GROUPS = {
    basic: {
        icon: 'ti-package',
        fields: ['product_name', 'sku', 'barcode', 'description', 'slug']
    },
    price: {
        icon: 'ti-currency-lira',
        fields: ['current_price', 'previous_price', 'price_with_currency', 'vat_rate', 'discount_percent', 'campaign_text', 'price_updated_at', 'price_valid_until']
    },
    category: {
        icon: 'ti-category',
        fields: ['category', 'subcategory', 'brand']
    },
    detail: {
        icon: 'ti-info-circle',
        fields: ['unit', 'weight', 'stock', 'origin', 'production_type']
    },
    location: {
        icon: 'ti-map-pin',
        fields: ['shelf_location', 'supplier_code']
    },
    kunye: {
        icon: 'ti-qrcode',
        fields: ['kunye_no']
    },
    hal: {
        icon: 'ti-leaf',
        fields: [
            'uretici_adi',
            'malin_adi',
            'malin_cinsi',
            'malin_turu',
            'uretim_yeri',
            'uretim_sekli',
            'ilk_bildirim_tarihi',
            'malin_sahibi',
            'tuketim_yeri',
            'tuketim_bildirim_tarihi',
            'gumruk_kapisi',
            'uretim_ithal_tarihi',
            'miktar',
            'alis_fiyati',
            'isletme_adi',
            'sertifikasyon_kurulusu',
            'sertifika_no',
            'diger_bilgiler'
        ]
    },
    media: {
        icon: 'ti-photo',
        fields: ['image_url', 'video_url', 'videos']
    },
    special: {
        icon: 'ti-sparkles',
        fields: ['date_today', 'date_time']
    },
    bundle: {
        icon: 'ti-box-multiple',
        fields: [
            'bundle_name',
            'bundle_type',
            'bundle_description',
            'bundle_sku',
            'bundle_barcode',
            'bundle_category',
            'bundle_total_price',
            'bundle_discount_percent',
            'bundle_final_price',
            'bundle_item_count',
            'bundle_items_list',
            'bundle_valid_from',
            'bundle_valid_until',
            'bundle_image_url'
        ]
    }
};

/**
 * Alan ikonları
 */
const FIELD_ICONS = {
    // Temel Bilgiler
    product_name: 'ti-tag',
    sku: 'ti-hash',
    barcode: 'ti-barcode',
    description: 'ti-file-description',
    slug: 'ti-link',
    // Fiyat Bilgileri
    current_price: 'ti-currency-lira',
    previous_price: 'ti-currency-lira',
    price_with_currency: 'ti-currency-lira',
    vat_rate: 'ti-percentage',
    discount_percent: 'ti-discount-2',
    campaign_text: 'ti-speakerphone',
    price_updated_at: 'ti-calendar',
    price_valid_until: 'ti-calendar-event',
    // Kategori & Marka
    category: 'ti-category',
    subcategory: 'ti-category-2',
    brand: 'ti-building-store',
    // Ürün Detayları
    unit: 'ti-ruler-measure',
    weight: 'ti-scale',
    stock: 'ti-box',
    origin: 'ti-map-pin',
    production_type: 'ti-plant-2',
    // Konum & Lojistik
    shelf_location: 'ti-map-2',
    supplier_code: 'ti-truck',
    // Künye
    kunye_no: 'ti-qrcode',
    // HAL Künye Bilgileri
    uretici_adi: 'ti-user',
    malin_adi: 'ti-package',
    malin_cinsi: 'ti-category',
    malin_turu: 'ti-list',
    uretim_yeri: 'ti-map-pin',
    uretim_sekli: 'ti-leaf',
    ilk_bildirim_tarihi: 'ti-calendar',
    malin_sahibi: 'ti-user-circle',
    tuketim_yeri: 'ti-home',
    tuketim_bildirim_tarihi: 'ti-calendar-stats',
    gumruk_kapisi: 'ti-door-enter',
    uretim_ithal_tarihi: 'ti-calendar-event',
    miktar: 'ti-123',
    alis_fiyati: 'ti-coin',
    isletme_adi: 'ti-building',
    sertifikasyon_kurulusu: 'ti-certificate',
    sertifika_no: 'ti-file-certificate',
    diger_bilgiler: 'ti-notes',
    // Medya
    image_url: 'ti-photo',
    video_url: 'ti-video',
    videos: 'ti-playlist',
    // Özel Alanlar
    date_today: 'ti-calendar',
    date_time: 'ti-clock',
    // Paket/Koli/Menü Alanları
    bundle_name: 'ti-box-multiple',
    bundle_type: 'ti-category',
    bundle_description: 'ti-file-description',
    bundle_sku: 'ti-hash',
    bundle_barcode: 'ti-barcode',
    bundle_category: 'ti-category-2',
    bundle_total_price: 'ti-currency-lira',
    bundle_discount_percent: 'ti-discount-2',
    bundle_final_price: 'ti-currency-lira',
    bundle_item_count: 'ti-list-numbers',
    bundle_items_list: 'ti-list',
    bundle_valid_from: 'ti-calendar-event',
    bundle_valid_until: 'ti-calendar-off',
    bundle_image_url: 'ti-photo'
};

/**
 * DynamicFieldsPanel Sınıfı
 */
export class DynamicFieldsPanel extends PanelBase {
    /**
     * @param {Object} options - Panel ayarları
     * @param {Function} [options.onFieldSelect] - Alan seçildiğinde callback
     */
    constructor(options = {}) {
        super({
            panelId: 'dynamic-fields-panel',
            title: 'editor.dynamicFields.title',
            icon: 'ti ti-braces',
            ...options
        });

        /**
         * Alan seçimi callback
         * @type {Function|null}
         */
        this.onFieldSelect = options.onFieldSelect || null;

        /**
         * Arama metni
         * @type {string}
         */
        this._searchText = '';

        /**
         * Açık gruplar
         * @type {Set<string>}
         */
        this._openGroups = new Set(['basic', 'price']);
    }

    /**
     * Panel içeriğini render et
     * @returns {string} HTML string
     */
    renderContent() {
        return `
            <div class="dynamic-fields-content">
                <div class="field-search">
                    <i class="ti ti-search"></i>
                    <input type="text" class="form-input" placeholder="${this.__('editor.dynamicFields.search')}" value="${this._searchText}">
                </div>
                <div class="field-groups">
                    ${this._renderFieldGroups()}
                </div>
            </div>
        `;
    }

    /**
     * Alan gruplarını render et
     * @private
     * @returns {string} HTML string
     */
    _renderFieldGroups() {
        return Object.entries(FIELD_GROUPS).map(([groupKey, group]) => {
            const isOpen = this._openGroups.has(groupKey);
            const filteredFields = this._filterFields(group.fields);

            // Filtrelenmiş alan yoksa grubu gösterme
            if (this._searchText && filteredFields.length === 0) {
                return '';
            }

            return `
                <div class="field-group ${isOpen ? 'open' : ''}" data-group="${groupKey}">
                    <div class="field-group-header" data-action="toggle-group">
                        <i class="ti ${group.icon}"></i>
                        <span>${this.__(`editor.dynamicFields.groups.${groupKey}`)}</span>
                        <i class="ti ti-chevron-${isOpen ? 'up' : 'down'} group-toggle"></i>
                    </div>
                    <div class="field-group-body">
                        ${filteredFields.map(fieldKey => this._renderFieldButton(fieldKey)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Alan butonunu render et
     * @private
     * @param {string} fieldKey - Alan anahtarı
     * @returns {string} HTML string
     */
    _renderFieldButton(fieldKey) {
        const icon = FIELD_ICONS[fieldKey] || 'ti-point';
        const label = this.__(`editor.dynamicFields.${fieldKey}`);
        const fieldType = this._getFieldType(fieldKey);

        return `
            <button type="button" class="field-btn field-${fieldType}" data-field="${fieldKey}" title="${label}">
                <i class="ti ${icon}"></i>
                <span>${label}</span>
                <span class="field-type-badge">${this._getFieldTypeBadge(fieldType)}</span>
            </button>
        `;
    }

    /**
     * Alanları filtrele
     * @private
     * @param {Array<string>} fields - Alan listesi
     * @returns {Array<string>}
     */
    _filterFields(fields) {
        if (!this._searchText) return fields;

        const search = this._searchText.toLowerCase();
        return fields.filter(fieldKey => {
            const label = this.__(`editor.dynamicFields.${fieldKey}`).toLowerCase();
            return fieldKey.toLowerCase().includes(search) || label.includes(search);
        });
    }

    /**
     * Alan tipini al
     * @private
     * @param {string} fieldKey - Alan anahtarı
     * @returns {string}
     */
    _getFieldType(fieldKey) {
        // Fiyat alanları
        if (['current_price', 'previous_price', 'price_with_currency', 'vat_rate', 'discount_percent', 'alis_fiyati', 'bundle_total_price', 'bundle_discount_percent', 'bundle_final_price'].includes(fieldKey)) {
            return 'price';
        }
        // Barkod/QR alanları
        if (['barcode', 'kunye_no', 'bundle_barcode'].includes(fieldKey)) {
            return 'barcode';
        }
        // Görsel alanları
        if (['image_url', 'bundle_image_url'].includes(fieldKey)) {
            return 'image';
        }
        // Video alanları
        if (['video_url', 'videos'].includes(fieldKey)) {
            return 'video';
        }
        // Tarih alanları
        if (['price_updated_at', 'price_valid_until', 'date_today', 'date_time', 'ilk_bildirim_tarihi', 'tuketim_bildirim_tarihi', 'uretim_ithal_tarihi', 'bundle_valid_from', 'bundle_valid_until'].includes(fieldKey)) {
            return 'date';
        }
        // Varsayılan: metin
        return 'text';
    }

    /**
     * Alan tipi badge'i
     * @private
     * @param {string} type - Alan tipi
     * @returns {string}
     */
    _getFieldTypeBadge(type) {
        const badges = {
            text: 'T',
            price: '₺',
            barcode: '|||',
            image: '🖼',
            video: '▶',
            date: '📅'
        };
        return badges[type] || 'T';
    }

    /**
     * Event'leri bağla
     */
    bindEvents() {
        if (!this.element) return;

        // Arama input
        const searchInput = this.$('.field-search input');
        if (searchInput) {
            this._addEventListener(searchInput, 'input', (e) => {
                this._searchText = e.target.value;
                this._updateFieldGroups();
            });
        }

        // Grup toggle
        this.$$('[data-action="toggle-group"]').forEach(header => {
            this._addEventListener(header, 'click', (e) => {
                const group = e.target.closest('.field-group');
                const groupKey = group?.dataset.group;
                if (groupKey) {
                    this._toggleGroup(groupKey);
                }
            });
        });

        // Alan butonları
        this.$$('.field-btn').forEach(btn => {
            this._addEventListener(btn, 'click', (e) => {
                const fieldKey = e.currentTarget.dataset.field;
                this._selectField(fieldKey);
            });
        });
    }

    /**
     * Grup aç/kapa
     * @private
     * @param {string} groupKey - Grup anahtarı
     */
    _toggleGroup(groupKey) {
        if (this._openGroups.has(groupKey)) {
            this._openGroups.delete(groupKey);
        } else {
            this._openGroups.add(groupKey);
        }

        // DOM güncelle
        const group = this.$(`[data-group="${groupKey}"]`);
        if (group) {
            group.classList.toggle('open');
            const icon = group.querySelector('.group-toggle');
            if (icon) {
                icon.className = `ti ti-chevron-${this._openGroups.has(groupKey) ? 'up' : 'down'} group-toggle`;
            }
        }
    }

    /**
     * Alan gruplarını güncelle (arama sonrası)
     * @private
     */
    _updateFieldGroups() {
        const groupsContainer = this.$('.field-groups');
        if (groupsContainer) {
            groupsContainer.innerHTML = this._renderFieldGroups();

            // Event'leri yeniden bağla
            this.$$('[data-action="toggle-group"]').forEach(header => {
                this._addEventListener(header, 'click', (e) => {
                    const group = e.target.closest('.field-group');
                    const groupKey = group?.dataset.group;
                    if (groupKey) {
                        this._toggleGroup(groupKey);
                    }
                });
            });

            this.$$('.field-btn').forEach(btn => {
                this._addEventListener(btn, 'click', (e) => {
                    const fieldKey = e.currentTarget.dataset.field;
                    this._selectField(fieldKey);
                });
            });
        }
    }

    /**
     * Alan seç
     * @private
     * @param {string} fieldKey - Alan anahtarı
     */
    _selectField(fieldKey) {
        const fieldType = this._getFieldType(fieldKey);
        const fieldLabel = this.__(`editor.dynamicFields.${fieldKey}`);

        // Callback varsa çağır
        if (this.onFieldSelect) {
            this.onFieldSelect(fieldKey, {
                type: fieldType,
                label: fieldLabel,
                placeholder: `{{${fieldKey}}}`
            });
        }

        // Event emit et
        eventBus.emit(EVENTS.DYNAMIC_FIELD_SELECT, {
            fieldKey,
            fieldType,
            fieldLabel,
            placeholder: `{{${fieldKey}}}`
        });
    }

    /**
     * Alan seçim callback'ini ayarla
     * @param {Function} callback - Callback fonksiyonu
     */
    setOnFieldSelect(callback) {
        this.onFieldSelect = callback;
    }

    /**
     * Tüm alanları al
     * @returns {Array<{key: string, label: string, type: string, group: string}>}
     */
    getAllFields() {
        const fields = [];

        Object.entries(FIELD_GROUPS).forEach(([groupKey, group]) => {
            group.fields.forEach(fieldKey => {
                fields.push({
                    key: fieldKey,
                    label: this.__(`editor.dynamicFields.${fieldKey}`),
                    type: this._getFieldType(fieldKey),
                    group: groupKey,
                    icon: FIELD_ICONS[fieldKey]
                });
            });
        });

        return fields;
    }

    /**
     * Belirli bir grubun alanlarını al
     * @param {string} groupKey - Grup anahtarı
     * @returns {Array<{key: string, label: string, type: string}>}
     */
    getFieldsByGroup(groupKey) {
        const group = FIELD_GROUPS[groupKey];
        if (!group) return [];

        return group.fields.map(fieldKey => ({
            key: fieldKey,
            label: this.__(`editor.dynamicFields.${fieldKey}`),
            type: this._getFieldType(fieldKey),
            icon: FIELD_ICONS[fieldKey]
        }));
    }

    /**
     * Belirli bir tipteki alanları al
     * @param {string} type - Alan tipi (text, price, barcode, image, date)
     * @returns {Array<{key: string, label: string, group: string}>}
     */
    getFieldsByType(type) {
        return this.getAllFields().filter(field => field.type === type);
    }
}

/**
 * Default export
 */
export default DynamicFieldsPanel;
