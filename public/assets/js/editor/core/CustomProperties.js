/**
 * CustomProperties - Fabric.js Özel Özellikler Merkezi Tanımlaması
 *
 * Tüm custom property isimleri burada tanımlanır.
 * String tekrarını önler, typo hatalarını engeller.
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

/**
 * Custom Property Sabitleri
 * Fabric.js objelerine eklenen özel özellikler
 */
export const CUSTOM_PROPS = {
    // ==========================================
    // TEMEL TANIMLAYICILAR
    // ==========================================

    /**
     * Obje tipi tanımlayıcısı
     * Değerler: 'text', 'barcode', 'qrcode', 'image', 'dynamic-field',
     *           'multi-product-frame', 'slot-text', 'slot-barcode', etc.
     */
    CUSTOM_TYPE: 'customType',

    /**
     * Alias for CUSTOM_TYPE (backwards compatibility with GridManager)
     * GridManager.js CUSTOM_PROPS.TYPE kullanıyor
     */
    TYPE: 'customType',

    /**
     * Unique obje ID'si (UUID)
     */
    OBJECT_ID: 'objectId',

    /**
     * Obje adı (kullanıcı tarafından verilir)
     */
    OBJECT_NAME: 'objectName',

    /**
     * Objenin kilitli olup olmadığı
     */
    LOCKED: 'locked',

    /**
     * Objenin görünür olup olmadığı (katman panelinde)
     */
    HIDDEN: 'hidden',

    // ==========================================
    // DİNAMİK ALAN ÖZELLİKLERİ
    // ==========================================

    /**
     * Dinamik alan olup olmadığı
     */
    IS_DATA_FIELD: 'isDataField',

    /**
     * Bağlı dinamik alan adı
     * Değerler: 'product_name', 'current_price', 'barcode', 'kunye_no', etc.
     */
    DYNAMIC_FIELD: 'dynamicField',

    /**
     * Dinamik alan placeholder metni
     */
    PLACEHOLDER: 'placeholder',

    /**
     * Dinamik alan formatı
     * Değerler: 'text', 'currency', 'date', 'number'
     */
    FIELD_FORMAT: 'fieldFormat',

    /**
     * Fiyat alanları için currency sembolü
     */
    CURRENCY_SYMBOL: 'currencySymbol',

    /**
     * Sayısal alanlar için ondalık basamak sayısı
     */
    DECIMAL_PLACES: 'decimalPlaces',

    // ==========================================
    // BARKOD ÖZELLİKLERİ
    // ==========================================

    /**
     * Barkod değeri
     */
    BARCODE_VALUE: 'barcodeValue',

    /**
     * Barkod formatı
     * Değerler: 'EAN13', 'EAN8', 'CODE128', 'CODE39', 'UPC', etc.
     */
    BARCODE_FORMAT: 'barcodeFormat',

    /**
     * Barkod altında değer gösterilsin mi
     */
    BARCODE_DISPLAY_VALUE: 'barcodeDisplayValue',

    /**
     * Barkod çizgi genişliği
     */
    BARCODE_LINE_WIDTH: 'barcodeLineWidth',

    /**
     * Barkod yüksekliği
     */
    BARCODE_HEIGHT: 'barcodeHeight',

    /**
     * Barkod arka plan rengi
     */
    BARCODE_BACKGROUND: 'barcodeBackground',

    /**
     * Barkod çizgi rengi
     */
    BARCODE_LINE_COLOR: 'barcodeLineColor',

    /**
     * Barkod türü otomatik algılansın mı (dinamik alan)
     */
    BARCODE_AUTO_DETECT: 'barcodeAutoDetect',

    // ==========================================
    // QR KOD ÖZELLİKLERİ
    // ==========================================

    /**
     * QR kod değeri
     */
    QR_VALUE: 'qrValue',

    /**
     * QR kod hata düzeltme seviyesi
     * Değerler: 'L', 'M', 'Q', 'H'
     */
    QR_ERROR_LEVEL: 'qrErrorLevel',

    /**
     * QR kod ön plan rengi
     */
    QR_FOREGROUND: 'qrForeground',

    /**
     * QR kod arka plan rengi
     */
    QR_BACKGROUND: 'qrBackground',

    // ==========================================
    // MULTI-PRODUCT FRAME ÖZELLİKLERİ
    // ==========================================

    /**
     * Frame sütun sayısı
     */
    FRAME_COLS: 'frameCols',

    /**
     * Frame satır sayısı
     */
    FRAME_ROWS: 'frameRows',

    /**
     * Aktif slot ID'si
     */
    ACTIVE_SLOT_ID: 'activeSlotId',

    /**
     * Slot tanımları (JSON array)
     */
    SLOTS: 'slots',

    /**
     * Objenin ait olduğu slot ID'si
     */
    SLOT_ID: 'slotId',

    /**
     * Obje multi-frame içinde mi
     */
    IN_MULTI_FRAME: 'inMultiFrame',

    /**
     * Üst frame ID'si
     */
    PARENT_FRAME_ID: 'parentFrameId',

    /**
     * Frame orijinal genişliği (Group boyutunu save/load'da korumak için)
     */
    FRAME_WIDTH: 'frameWidth',

    /**
     * Frame orijinal yüksekliği (Group boyutunu save/load'da korumak için)
     */
    FRAME_HEIGHT: 'frameHeight',

    /**
     * Slot arkaplanı mı
     */
    IS_SLOT_BACKGROUND: 'isSlotBackground',

    /**
     * Slot etiketi mi
     */
    IS_SLOT_LABEL: 'isSlotLabel',

    /**
     * Slot placeholder'ı mı
     */
    IS_SLOT_PLACEHOLDER: 'isSlotPlaceholder',

    // ==========================================
    // BÖLGE (REGION) ÖZELLİKLERİ
    // ==========================================

    /**
     * Objenin ait olduğu bölge ID'si
     */
    REGION_ID: 'regionId',

    /**
     * Bölge tipi
     * Değerler: 'header', 'content', 'footer', 'sidebar', 'media', 'label'
     */
    REGION_TYPE: 'regionType',

    // ==========================================
    // ARKAPLAN ÖZELLİKLERİ
    // ==========================================

    /**
     * Arkaplan tipi
     * Değerler: 'color', 'gradient', 'image', 'video'
     */
    BACKGROUND_TYPE: 'backgroundType',

    /**
     * Gradient yönü
     * Değerler: 'vertical', 'horizontal', 'diagonal'
     */
    GRADIENT_DIRECTION: 'gradientDirection',

    /**
     * Gradient renkleri (JSON array)
     */
    GRADIENT_COLORS: 'gradientColors',

    /**
     * Video placeholder URL'i
     */
    VIDEO_PLACEHOLDER_URL: 'videoPlaceholderUrl',

    /**
     * Video placeholder mı (dinamik video alanı)
     */
    IS_VIDEO_PLACEHOLDER: 'isVideoPlaceholder',

    /**
     * Çoklu video mu
     */
    IS_MULTIPLE_VIDEOS: 'isMultipleVideos',

    /**
     * Medya kütüphanesinden manuel seçilmiş video listesi (şablon bazlı statik video)
     * Değer: string[] veya {url,path,filename}[]
     */
    STATIC_VIDEOS: 'staticVideos',

    // ==========================================
    // GÖRSEL ÖZELLİKLERİ
    // ==========================================

    /**
     * Orijinal görsel URL'i
     */
    ORIGINAL_SRC: 'originalSrc',

    /**
     * Ürün görseli indeksi (çoklu görsel desteği)
     * 0 = kapak görseli, 1 = 2. görsel, 2 = 3. görsel, 3 = 4. görsel
     */
    IMAGE_INDEX: 'imageIndex',

    /**
     * Görsel fit modu
     * Değerler: 'contain', 'cover', 'fill', 'none'
     */
    IMAGE_FIT: 'imageFit',

    /**
     * Görsel crop ayarları (JSON)
     */
    CROP_SETTINGS: 'cropSettings',

    // ==========================================
    // KATMAN/SIRALAMA ÖZELLİKLERİ
    // ==========================================

    /**
     * Katman sırası (z-index benzeri)
     */
    LAYER_ORDER: 'layerOrder',

    /**
     * Grup içindeki sıra
     */
    GROUP_ORDER: 'groupOrder',

    // ==========================================
    // TRANSIENT (GEÇİCİ) ÖZELLİKLER
    // ==========================================

    /**
     * Obje geçici mi (serialize edilmez)
     * Grid overlay, selection handles vb. için
     */
    IS_TRANSIENT: 'isTransient',

    /**
     * Helper obje mi (grid çizgileri vb.)
     */
    IS_HELPER: 'isHelper',

    /**
     * History'den hariç tutulsun mu
     */
    EXCLUDE_FROM_HISTORY: 'excludeFromHistory',

    // ==========================================
    // RESPONSIVE ÖLÇEKLEME ÖZELLİKLERİ
    // ==========================================

    /**
     * Bölge içi yatay pozisyon (%)
     * 0-100 arası, bölge solundan % uzaklık
     */
    RELATIVE_LEFT: 'relativeLeft',

    /**
     * Bölge içi dikey pozisyon (%)
     * 0-100 arası, bölge üstünden % uzaklık
     */
    RELATIVE_TOP: 'relativeTop',

    /**
     * Bölge genişliğine oranla obje genişliği (%)
     */
    RELATIVE_WIDTH: 'relativeWidth',

    /**
     * Bölge yüksekliğine oranla obje yüksekliği (%)
     */
    RELATIVE_HEIGHT: 'relativeHeight',

    /**
     * Yatay çapa noktası
     * Değerler: 'left', 'center', 'right'
     */
    ANCHOR_X: 'anchorX',

    /**
     * Dikey çapa noktası
     * Değerler: 'top', 'center', 'bottom'
     */
    ANCHOR_Y: 'anchorY',

    /**
     * Metin uyum modu
     * Değerler: 'none', 'shrink', 'ellipsis'
     */
    TEXT_FIT: 'textFit',

    /**
     * Shrink modu için minimum font boyutu (px)
     */
    MIN_FONT_SIZE: 'minFontSize',

    /**
     * Maksimum satır sayısı (0 = sınırsız)
     */
    MAX_LINES: 'maxLines',

    // ==========================================
    // LEGACY UYUMLULUK
    // ==========================================

    /**
     * Legacy v5 formatından dönüştürüldü mü
     */
    LEGACY_CONVERTED: 'legacyConverted',

    /**
     * Orijinal v5 origin değerleri (migration için)
     */
    LEGACY_ORIGIN_X: 'legacyOriginX',
    LEGACY_ORIGIN_Y: 'legacyOriginY'
};

/**
 * Custom Type Sabitleri
 * customType alanı için kullanılan değerler
 */
export const CUSTOM_TYPES = {
    // Temel tipler
    TEXT: 'text',
    IMAGE: 'image',
    RECT: 'rect',
    CIRCLE: 'circle',
    LINE: 'line',
    PATH: 'path',

    // Özel tipler
    BARCODE: 'barcode',
    QRCODE: 'qrcode',
    DYNAMIC_FIELD: 'dynamic-field',
    DYNAMIC_TEXT: 'dynamic-text',
    DYNAMIC_IMAGE: 'dynamic-image',
    DYNAMIC_VIDEO: 'dynamic-video',

    // Multi-frame tipler
    MULTI_PRODUCT_FRAME: 'multi-product-frame',
    SLOT_TEXT: 'slot-text',
    SLOT_BARCODE: 'slot-barcode',
    SLOT_QRCODE: 'slot-qrcode',
    SLOT_IMAGE: 'slot-image',

    // Arkaplan tipler
    REGION_BACKGROUND: 'region-background',
    VIDEO_PLACEHOLDER: 'video-placeholder',

    // Helper tipler
    GRID_LINE: 'grid-line',
    GUIDE_LINE: 'guide-line',
    SELECTION_RECT: 'selection-rect'
};

/**
 * Dinamik Alan Sabitleri
 * dynamicField alanı için kullanılan değerler
 */
export const DYNAMIC_FIELDS = {
    // Temel ürün bilgileri
    PRODUCT_NAME: 'product_name',
    SKU: 'sku',
    BARCODE: 'barcode',
    DESCRIPTION: 'description',
    SLUG: 'slug',

    // Fiyat bilgileri
    CURRENT_PRICE: 'current_price',
    PREVIOUS_PRICE: 'previous_price',
    VAT_RATE: 'vat_rate',
    DISCOUNT_PERCENT: 'discount_percent',
    CAMPAIGN_TEXT: 'campaign_text',
    PRICE_UPDATED_AT: 'price_updated_at',
    PRICE_VALID_UNTIL: 'price_valid_until',

    // Kategori bilgileri
    CATEGORY: 'category',
    SUBCATEGORY: 'subcategory',
    BRAND: 'brand',

    // Detay bilgileri
    UNIT: 'unit',
    WEIGHT: 'weight',
    STOCK: 'stock',
    ORIGIN: 'origin',
    PRODUCTION_TYPE: 'production_type',

    // Konum bilgileri
    SHELF_LOCATION: 'shelf_location',
    SUPPLIER_CODE: 'supplier_code',

    // HAL Kunye
    KUNYE_NO: 'kunye_no',

    // Medya
    IMAGE_URL: 'image_url',
    VIDEO_URL: 'video_url',
    VIDEOS: 'videos'
};

/**
 * Barkod Format Sabitleri
 */
export const BARCODE_FORMATS = {
    EAN13: 'EAN13',
    EAN8: 'EAN8',
    UPC_A: 'UPC',
    UPC_E: 'UPCE',
    CODE128: 'CODE128',
    CODE39: 'CODE39',
    ITF14: 'ITF14',
    MSI: 'MSI',
    PHARMACODE: 'pharmacode'
};

/**
 * Serialize edilecek custom property listesi
 * Fabric.js toObject() çağrısında dahil edilecek
 */
export const SERIALIZABLE_PROPS = [
    // Temel
    CUSTOM_PROPS.CUSTOM_TYPE,
    CUSTOM_PROPS.OBJECT_ID,
    CUSTOM_PROPS.OBJECT_NAME,
    CUSTOM_PROPS.LOCKED,
    CUSTOM_PROPS.HIDDEN,

    // Dinamik alan
    CUSTOM_PROPS.IS_DATA_FIELD,
    CUSTOM_PROPS.DYNAMIC_FIELD,
    CUSTOM_PROPS.PLACEHOLDER,
    CUSTOM_PROPS.FIELD_FORMAT,
    CUSTOM_PROPS.CURRENCY_SYMBOL,
    CUSTOM_PROPS.DECIMAL_PLACES,

    // Barkod
    CUSTOM_PROPS.BARCODE_VALUE,
    CUSTOM_PROPS.BARCODE_FORMAT,
    CUSTOM_PROPS.BARCODE_DISPLAY_VALUE,
    CUSTOM_PROPS.BARCODE_LINE_WIDTH,
    CUSTOM_PROPS.BARCODE_HEIGHT,
    CUSTOM_PROPS.BARCODE_BACKGROUND,
    CUSTOM_PROPS.BARCODE_LINE_COLOR,
    CUSTOM_PROPS.BARCODE_AUTO_DETECT,

    // QR kod
    CUSTOM_PROPS.QR_VALUE,
    CUSTOM_PROPS.QR_ERROR_LEVEL,
    CUSTOM_PROPS.QR_FOREGROUND,
    CUSTOM_PROPS.QR_BACKGROUND,

    // Multi-frame
    CUSTOM_PROPS.FRAME_COLS,
    CUSTOM_PROPS.FRAME_ROWS,
    CUSTOM_PROPS.FRAME_WIDTH,
    CUSTOM_PROPS.FRAME_HEIGHT,
    CUSTOM_PROPS.ACTIVE_SLOT_ID,
    CUSTOM_PROPS.SLOTS,
    CUSTOM_PROPS.SLOT_ID,
    CUSTOM_PROPS.IN_MULTI_FRAME,
    CUSTOM_PROPS.PARENT_FRAME_ID,
    CUSTOM_PROPS.IS_SLOT_BACKGROUND,
    CUSTOM_PROPS.IS_SLOT_LABEL,
    CUSTOM_PROPS.IS_SLOT_PLACEHOLDER,

    // Bölge
    CUSTOM_PROPS.REGION_ID,
    CUSTOM_PROPS.REGION_TYPE,

    // Responsive ölçekleme
    CUSTOM_PROPS.RELATIVE_LEFT,
    CUSTOM_PROPS.RELATIVE_TOP,
    CUSTOM_PROPS.RELATIVE_WIDTH,
    CUSTOM_PROPS.RELATIVE_HEIGHT,
    CUSTOM_PROPS.ANCHOR_X,
    CUSTOM_PROPS.ANCHOR_Y,
    CUSTOM_PROPS.TEXT_FIT,
    CUSTOM_PROPS.MIN_FONT_SIZE,
    CUSTOM_PROPS.MAX_LINES,

    // Arkaplan
    CUSTOM_PROPS.BACKGROUND_TYPE,
    CUSTOM_PROPS.GRADIENT_DIRECTION,
    CUSTOM_PROPS.GRADIENT_COLORS,
    CUSTOM_PROPS.VIDEO_PLACEHOLDER_URL,
    CUSTOM_PROPS.IS_VIDEO_PLACEHOLDER,
    CUSTOM_PROPS.IS_MULTIPLE_VIDEOS,
    CUSTOM_PROPS.STATIC_VIDEOS,

    // Görsel
    CUSTOM_PROPS.ORIGINAL_SRC,
    CUSTOM_PROPS.IMAGE_INDEX,
    CUSTOM_PROPS.IMAGE_FIT,
    CUSTOM_PROPS.CROP_SETTINGS,

    // Katman
    CUSTOM_PROPS.LAYER_ORDER,
    CUSTOM_PROPS.GROUP_ORDER,

    // Legacy
    CUSTOM_PROPS.LEGACY_CONVERTED,
    CUSTOM_PROPS.LEGACY_ORIGIN_X,
    CUSTOM_PROPS.LEGACY_ORIGIN_Y
];

/**
 * History'den hariç tutulacak property listesi
 * Bu property'ler değiştiğinde history kaydedilmez
 */
export const HISTORY_EXCLUDED_PROPS = [
    CUSTOM_PROPS.IS_TRANSIENT,
    CUSTOM_PROPS.IS_HELPER,
    CUSTOM_PROPS.EXCLUDE_FROM_HISTORY
];

/**
 * Transient (geçici) obje tipleri
 * Bu tipler serialize edilmez ve history'ye kaydedilmez
 */
export const TRANSIENT_TYPES = [
    CUSTOM_TYPES.GRID_LINE,
    CUSTOM_TYPES.GUIDE_LINE,
    CUSTOM_TYPES.SELECTION_RECT
];

/**
 * Objenin transient (geçici) olup olmadığını kontrol et
 *
 * @param {Object} obj - Fabric.js objesi
 * @returns {boolean}
 */
export function isTransient(obj) {
    if (!obj) return false;

    // Explicit transient flag
    if (obj[CUSTOM_PROPS.IS_TRANSIENT] === true) return true;

    // Helper objeler
    if (obj[CUSTOM_PROPS.IS_HELPER] === true) return true;

    // Transient tip kontrolü
    const customType = obj[CUSTOM_PROPS.CUSTOM_TYPE];
    if (customType && TRANSIENT_TYPES.includes(customType)) return true;

    return false;
}

/**
 * Objenin history'ye kaydedilip kaydedilmeyeceğini kontrol et
 *
 * @param {Object} obj - Fabric.js objesi
 * @returns {boolean}
 */
export function shouldExcludeFromHistory(obj) {
    if (!obj) return true;

    // Transient objeler history'ye kaydedilmez
    if (isTransient(obj)) return true;

    // Explicit exclude flag
    if (obj[CUSTOM_PROPS.EXCLUDE_FROM_HISTORY] === true) return true;

    return false;
}

// ==========================================
// HELPER FONKSIYONLAR
// ==========================================

/**
 * Objeye özel özellik ekle
 *
 * @param {Object} obj - Fabric.js objesi
 * @param {string} propName - Özellik adı (CUSTOM_PROPS enum kullanın)
 * @param {*} value - Özellik değeri
 */
export function setCustomProperty(obj, propName, value) {
    if (!obj) return;
    obj[propName] = value;
}

/**
 * Objeden özel özellik oku
 *
 * @param {Object} obj - Fabric.js objesi
 * @param {string} propName - Özellik adı
 * @param {*} [defaultValue=undefined] - Varsayılan değer
 * @returns {*}
 */
export function getCustomProperty(obj, propName, defaultValue = undefined) {
    if (!obj) return defaultValue;
    return obj[propName] !== undefined ? obj[propName] : defaultValue;
}

/**
 * Objede özel özellik var mı kontrol et
 *
 * @param {Object} obj - Fabric.js objesi
 * @param {string} propName - Özellik adı
 * @returns {boolean}
 */
export function hasCustomProperty(obj, propName) {
    if (!obj) return false;
    return obj[propName] !== undefined;
}

/**
 * Objenin dinamik alan olup olmadığını kontrol et
 *
 * @param {Object} obj - Fabric.js objesi
 * @returns {boolean}
 */
export function isDataField(obj) {
    if (!obj) return false;
    return obj[CUSTOM_PROPS.IS_DATA_FIELD] === true;
}

/**
 * Objeden dinamik alan adını al
 *
 * @param {Object} obj - Fabric.js objesi
 * @returns {string|null}
 */
export function getDynamicField(obj) {
    if (!obj) return null;
    return obj[CUSTOM_PROPS.DYNAMIC_FIELD] || null;
}

/**
 * Objenin customType değerini al
 *
 * @param {Object} obj - Fabric.js objesi
 * @returns {string|null}
 */
export function getCustomType(obj) {
    if (!obj) return null;
    return obj[CUSTOM_PROPS.CUSTOM_TYPE] || null;
}

/**
 * Objenin objectId değerini al veya oluştur
 *
 * @param {Object} obj - Fabric.js objesi
 * @param {boolean} [createIfMissing=true] - Yoksa oluştur
 * @returns {string|null}
 */
export function getObjectId(obj, createIfMissing = true) {
    if (!obj) return null;

    let id = obj[CUSTOM_PROPS.OBJECT_ID];

    if (!id && createIfMissing) {
        id = generateUUID();
        obj[CUSTOM_PROPS.OBJECT_ID] = id;
    }

    return id || null;
}

/**
 * UUID oluştur
 *
 * @returns {string}
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
