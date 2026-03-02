/**
 * Omnex Display Hub - Custom VvvebJs Components
 * Özel widget'lar ve bileşenler
 *
 * Medya Kütüphanesi Entegrasyonu:
 * - OmnexMediaBrowser: Omnex medya kütüphanesine erişim
 * - API endpoint: /api/media
 */

// Omnex API Configuration
const OmnexConfig = {
    apiUrl: window.OmnexConfig?.apiUrl || '/market-etiket-sistemi/api',
    basePath: window.OmnexConfig?.basePath || '/market-etiket-sistemi',
    mediaUrl: '/api/media'
};

// Omnex Component Category
Vvveb.ComponentsGroup['Omnex'] = [
    'omnex/product-card',
    'omnex/price-list',
    'omnex/ticker',
    'omnex/clock',
    'omnex/countdown',
    'omnex/qrcode',
    'omnex/media-image',
    'omnex/dynamic-text'
];

/**
 * Omnex Medya Kütüphanesi Browser
 * Ana sistemdeki medya dosyalarına erişim sağlar
 */
window.OmnexMediaBrowser = {
    apiUrl: OmnexConfig.apiUrl,

    // Medya listesini getir
    async getMedia(type = 'image', page = 1, limit = 20) {
        try {
            const token = localStorage.getItem('omnex_token') || sessionStorage.getItem('omnex_token');
            const response = await fetch(`${this.apiUrl}/media?type=${type}&page=${page}&limit=${limit}`, {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                    'Content-Type': 'application/json'
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Omnex Media API Error:', error);
            return { success: false, data: [] };
        }
    },

    // Medya seçici modalı aç
    open(callback, type = 'image') {
        this.callback = callback;
        this.showModal(type);
    },

    // Modal göster
    async showModal(type = 'image') {
        const media = await this.getMedia(type);

        let modalHtml = `
        <div id="omnex-media-modal" class="modal fade show" style="display:block; background:rgba(0,0,0,0.5);">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="la la-image"></i> Omnex Medya Kütüphanesi
                        </h5>
                        <button type="button" class="btn-close" onclick="OmnexMediaBrowser.closeModal()"></button>
                    </div>
                    <div class="modal-body">
                        <div class="omnex-media-grid" style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; max-height:400px; overflow-y:auto;">
        `;

        if (media.success && media.data && media.data.length > 0) {
            media.data.forEach(item => {
                const thumbUrl = item.thumbnail || item.url || item.path;
                const fullUrl = item.url || item.path;
                modalHtml += `
                    <div class="omnex-media-item"
                         style="cursor:pointer; border:2px solid transparent; border-radius:8px; overflow:hidden;"
                         onclick="OmnexMediaBrowser.selectMedia('${fullUrl}')"
                         onmouseover="this.style.borderColor='#228be6'"
                         onmouseout="this.style.borderColor='transparent'">
                        <img src="${OmnexConfig.basePath}${thumbUrl}"
                             style="width:100%; height:120px; object-fit:cover;"
                             alt="${item.name || 'Media'}">
                        <div style="padding:5px; font-size:11px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                            ${item.name || 'Untitled'}
                        </div>
                    </div>
                `;
            });
        } else {
            modalHtml += `
                <div style="grid-column:1/-1; text-align:center; padding:40px; color:#666;">
                    <i class="la la-folder-open" style="font-size:48px;"></i>
                    <p>Medya kütüphanesi boş veya erişilemiyor</p>
                    <small>Ana panelden medya yükleyin</small>
                </div>
            `;
        }

        modalHtml += `
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="OmnexMediaBrowser.closeModal()">İptal</button>
                    </div>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // Medya seç
    selectMedia(url) {
        if (this.callback) {
            this.callback(OmnexConfig.basePath + url);
        }
        this.closeModal();
    },

    // Modalı kapat
    closeModal() {
        const modal = document.getElementById('omnex-media-modal');
        if (modal) modal.remove();
    }
};

/**
 * Ürün Kartı Widget
 * Dinamik ürün bilgisi gösteren kart
 */
Vvveb.Components.extend("_base", "omnex/product-card", {
    name: "Ürün Kartı",
    image: "icons/product.svg",
    dragHtml: '<img src="' + Vvveb.baseUrl + 'icons/product.svg" width="32" height="32">',
    classes: ["omnex-product-card"],
    html: `<div class="omnex-product-card" data-component="product-card" data-product-id="">
        <div class="product-image">
            <img src="https://via.placeholder.com/300x300?text=Ürün+Görseli" alt="Ürün">
        </div>
        <div class="product-info">
            <h3 class="product-name">Ürün Adı</h3>
            <p class="product-description">Ürün açıklaması buraya gelecek</p>
            <div class="product-price">
                <span class="current-price">29,99 ₺</span>
                <span class="old-price">39,99 ₺</span>
            </div>
        </div>
    </div>`,

    properties: [
        {
            name: "Veri Kaynağı",
            key: "data-source",
            htmlAttr: "data-source",
            inputtype: SelectInput,
            data: {
                options: [
                    { value: "manual", text: "Manuel" },
                    { value: "product", text: "Ürün Seç" },
                    { value: "api", text: "Harici API" }
                ]
            }
        },
        {
            name: "Ürün ID",
            key: "data-product-id",
            htmlAttr: "data-product-id",
            inputtype: TextInput
        },
        {
            name: false,
            key: "product_name",
            child: ".product-name",
            htmlAttr: "innerHTML",
            inputtype: TextInput,
            section: "İçerik",
            data: { label: "Ürün Adı" }
        },
        {
            name: false,
            key: "product_description",
            child: ".product-description",
            htmlAttr: "innerHTML",
            inputtype: TextareaInput,
            section: "İçerik",
            data: { label: "Açıklama" }
        },
        {
            name: false,
            key: "current_price",
            child: ".current-price",
            htmlAttr: "innerHTML",
            inputtype: TextInput,
            section: "Fiyat",
            data: { label: "Güncel Fiyat" }
        },
        {
            name: false,
            key: "old_price",
            child: ".old-price",
            htmlAttr: "innerHTML",
            inputtype: TextInput,
            section: "Fiyat",
            data: { label: "Eski Fiyat" }
        },
        {
            name: false,
            key: "product_image",
            child: ".product-image img",
            htmlAttr: "src",
            inputtype: ImageInput,
            section: "Görsel",
            data: { label: "Ürün Görseli" }
        },
        {
            name: "Görsel Göster",
            key: "data-show-image",
            htmlAttr: "data-show-image",
            inputtype: ToggleInput,
            section: "Görünüm",
            data: { on: "true", off: "false" }
        },
        {
            name: "Eski Fiyat Göster",
            key: "data-show-old-price",
            htmlAttr: "data-show-old-price",
            inputtype: ToggleInput,
            section: "Görünüm",
            data: { on: "true", off: "false" }
        }
    ]
});

/**
 * Fiyat Listesi Widget
 * Ürün fiyatlarını tablo formatında gösterir
 */
Vvveb.Components.extend("_base", "omnex/price-list", {
    name: "Fiyat Listesi",
    image: "icons/table.svg",
    dragHtml: '<img src="' + Vvveb.baseUrl + 'icons/table.svg" width="32" height="32">',
    classes: ["omnex-price-list"],
    html: `<div class="omnex-price-list" data-component="price-list">
        <div class="price-list-header">
            <h3>Günün Fiyatları</h3>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Ürün</th>
                    <th>Birim</th>
                    <th>Fiyat</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Domates</td>
                    <td>kg</td>
                    <td class="price-cell">12,99 ₺</td>
                </tr>
                <tr>
                    <td>Salatalık</td>
                    <td>kg</td>
                    <td class="price-cell">8,99 ₺</td>
                </tr>
                <tr>
                    <td>Biber</td>
                    <td>kg</td>
                    <td class="price-cell">15,99 ₺</td>
                </tr>
            </tbody>
        </table>
    </div>`,

    properties: [
        {
            name: "Başlık",
            key: "list_title",
            child: ".price-list-header h3",
            htmlAttr: "innerHTML",
            inputtype: TextInput
        },
        {
            name: "Veri Kaynağı",
            key: "data-source",
            htmlAttr: "data-source",
            inputtype: SelectInput,
            data: {
                options: [
                    { value: "manual", text: "Manuel" },
                    { value: "category", text: "Kategori" },
                    { value: "api", text: "Harici API" }
                ]
            }
        },
        {
            name: "Kategori ID",
            key: "data-category-id",
            htmlAttr: "data-category-id",
            inputtype: TextInput
        },
        {
            name: "Maksimum Satır",
            key: "data-max-rows",
            htmlAttr: "data-max-rows",
            inputtype: NumberInput,
            data: { min: 1, max: 50, step: 1 }
        }
    ]
});

/**
 * Kayan Yazı (Ticker) Widget
 * Yatay kayan metin banner'ı
 */
Vvveb.Components.extend("_base", "omnex/ticker", {
    name: "Kayan Yazı",
    image: "icons/stream-solid.svg",
    dragHtml: '<img src="' + Vvveb.baseUrl + 'icons/stream-solid.svg" width="32" height="32">',
    classes: ["omnex-ticker"],
    html: `<div class="omnex-ticker" data-component="ticker">
        <div class="ticker-content">
            <span class="ticker-item">🔥 Bugüne özel indirimler! 🔥</span>
            <span class="ticker-item">📢 Yeni ürünler raflarımızda!</span>
            <span class="ticker-item">🛒 500 TL üzeri alışverişlerde ücretsiz kargo</span>
            <span class="ticker-item">🔥 Bugüne özel indirimler! 🔥</span>
            <span class="ticker-item">📢 Yeni ürünler raflarımızda!</span>
            <span class="ticker-item">🛒 500 TL üzeri alışverişlerde ücretsiz kargo</span>
        </div>
    </div>`,

    properties: [
        {
            name: "Metin 1",
            key: "ticker_text_1",
            htmlAttr: "data-text-1",
            inputtype: TextInput
        },
        {
            name: "Metin 2",
            key: "ticker_text_2",
            htmlAttr: "data-text-2",
            inputtype: TextInput
        },
        {
            name: "Metin 3",
            key: "ticker_text_3",
            htmlAttr: "data-text-3",
            inputtype: TextInput
        },
        {
            name: "Hız (saniye)",
            key: "data-speed",
            htmlAttr: "data-speed",
            inputtype: NumberInput,
            data: { min: 5, max: 60, step: 1 }
        },
        {
            name: "Arka Plan Rengi",
            key: "background-color",
            htmlAttr: "style",
            inputtype: ColorInput,
            section: "Stil"
        },
        {
            name: "Metin Rengi",
            key: "color",
            htmlAttr: "style",
            inputtype: ColorInput,
            section: "Stil"
        }
    ]
});

/**
 * Saat Widget
 * Dijital saat gösterimi
 */
Vvveb.Components.extend("_base", "omnex/clock", {
    name: "Saat",
    image: "icons/stopwatch.svg",
    dragHtml: '<img src="' + Vvveb.baseUrl + 'icons/stopwatch.svg" width="32" height="32">',
    classes: ["omnex-clock"],
    html: `<div class="omnex-clock" data-component="clock">
        <div class="time">00:00:00</div>
        <div class="date">1 Ocak 2026, Pazartesi</div>
    </div>`,

    properties: [
        {
            name: "Tarih Göster",
            key: "data-show-date",
            htmlAttr: "data-show-date",
            inputtype: ToggleInput,
            data: { on: "true", off: "false" }
        },
        {
            name: "Saniye Göster",
            key: "data-show-seconds",
            htmlAttr: "data-show-seconds",
            inputtype: ToggleInput,
            data: { on: "true", off: "false" }
        },
        {
            name: "Format",
            key: "data-format",
            htmlAttr: "data-format",
            inputtype: SelectInput,
            data: {
                options: [
                    { value: "24h", text: "24 Saat" },
                    { value: "12h", text: "12 Saat (AM/PM)" }
                ]
            }
        },
        {
            name: "Saat Boyutu",
            key: "time-font-size",
            child: ".time",
            htmlAttr: "style",
            inputtype: CssUnitInput,
            section: "Stil"
        }
    ]
});

/**
 * Geri Sayım Widget
 * Kampanya veya etkinlik geri sayımı
 */
Vvveb.Components.extend("_base", "omnex/countdown", {
    name: "Geri Sayım",
    image: "icons/calendar.svg",
    dragHtml: '<img src="' + Vvveb.baseUrl + 'icons/calendar.svg" width="32" height="32">',
    classes: ["omnex-countdown"],
    html: `<div class="omnex-countdown" data-component="countdown" data-target-date="">
        <div class="countdown-title">Kampanya Bitimine Kalan Süre</div>
        <div class="countdown-timer">
            <div class="countdown-unit" data-unit="days">
                <div class="countdown-value">00</div>
                <div class="countdown-label">Gün</div>
            </div>
            <div class="countdown-unit" data-unit="hours">
                <div class="countdown-value">00</div>
                <div class="countdown-label">Saat</div>
            </div>
            <div class="countdown-unit" data-unit="minutes">
                <div class="countdown-value">00</div>
                <div class="countdown-label">Dakika</div>
            </div>
            <div class="countdown-unit" data-unit="seconds">
                <div class="countdown-value">00</div>
                <div class="countdown-label">Saniye</div>
            </div>
        </div>
    </div>`,

    properties: [
        {
            name: "Başlık",
            key: "countdown_title",
            child: ".countdown-title",
            htmlAttr: "innerHTML",
            inputtype: TextInput
        },
        {
            name: "Hedef Tarih",
            key: "data-target-date",
            htmlAttr: "data-target-date",
            inputtype: DateInput
        },
        {
            name: "Gün Göster",
            key: "data-show-days",
            htmlAttr: "data-show-days",
            inputtype: ToggleInput,
            data: { on: "true", off: "false" }
        },
        {
            name: "Saniye Göster",
            key: "data-show-seconds",
            htmlAttr: "data-show-seconds",
            inputtype: ToggleInput,
            data: { on: "true", off: "false" }
        }
    ]
});

/**
 * QR Kod Widget
 * Dinamik QR kod oluşturma
 */
Vvveb.Components.extend("_base", "omnex/qrcode", {
    name: "QR Kod",
    image: "icons/image.svg",
    dragHtml: '<img src="' + Vvveb.baseUrl + 'icons/image.svg" width="32" height="32">',
    classes: ["omnex-qrcode"],
    html: `<div class="omnex-qrcode" data-component="qrcode" data-content="https://omnex.com">
        <canvas width="150" height="150"></canvas>
        <div class="qr-label">Detaylar için tarayın</div>
    </div>`,

    properties: [
        {
            name: "İçerik",
            key: "data-content",
            htmlAttr: "data-content",
            inputtype: TextInput
        },
        {
            name: "Boyut",
            key: "data-size",
            htmlAttr: "data-size",
            inputtype: NumberInput,
            data: { min: 50, max: 300, step: 10 }
        },
        {
            name: "Etiket",
            key: "qr_label",
            child: ".qr-label",
            htmlAttr: "innerHTML",
            inputtype: TextInput
        },
        {
            name: "Etiket Göster",
            key: "data-show-label",
            htmlAttr: "data-show-label",
            inputtype: ToggleInput,
            data: { on: "true", off: "false" }
        },
        {
            name: "Ön Plan Rengi",
            key: "data-color",
            htmlAttr: "data-color",
            inputtype: ColorInput
        },
        {
            name: "Arka Plan Rengi",
            key: "data-bg-color",
            htmlAttr: "data-bg-color",
            inputtype: ColorInput
        }
    ]
});

/**
 * Medya Görsel Widget
 * Omnex medya kütüphanesinden görsel
 */
Vvveb.Components.extend("_base", "omnex/media-image", {
    name: "Medya Görseli",
    image: "icons/image.svg",
    dragHtml: '<img src="' + Vvveb.baseUrl + 'icons/image.svg" width="32" height="32">',
    classes: ["omnex-media-image"],
    html: `<div class="omnex-media-image" data-component="media-image">
        <img src="https://via.placeholder.com/400x300?text=Medya+Seçin" alt="Medya Görseli" style="max-width:100%;">
    </div>`,

    properties: [
        {
            name: "Görsel",
            key: "media_src",
            child: "img",
            htmlAttr: "src",
            inputtype: ImageInput
        },
        {
            name: "Alt Metin",
            key: "media_alt",
            child: "img",
            htmlAttr: "alt",
            inputtype: TextInput
        },
        {
            name: "Genişlik",
            key: "media_width",
            child: "img",
            htmlAttr: "width",
            inputtype: TextInput
        },
        {
            name: "Yükseklik",
            key: "media_height",
            child: "img",
            htmlAttr: "height",
            inputtype: TextInput
        },
        {
            name: "Kütüphaneden Seç",
            key: "omnex_media_select",
            inputtype: ButtonInput,
            data: {
                text: "Medya Kütüphanesi",
                icon: "la la-folder-open",
                onclick: function(element) {
                    OmnexMediaBrowser.open(function(url) {
                        $('img', element).attr('src', url);
                    }, 'image');
                }
            }
        }
    ]
});

/**
 * Dinamik Metin Widget
 * API'den gelen dinamik içerik
 */
Vvveb.Components.extend("_base", "omnex/dynamic-text", {
    name: "Dinamik Metin",
    image: "icons/paragraph.svg",
    dragHtml: '<img src="' + Vvveb.baseUrl + 'icons/paragraph.svg" width="32" height="32">',
    classes: ["omnex-dynamic-text"],
    html: `<div class="omnex-dynamic-text" data-component="dynamic-text" data-field="">
        <span class="dynamic-content">{{alan_adı}}</span>
    </div>`,

    properties: [
        {
            name: "Alan Adı",
            key: "data-field",
            htmlAttr: "data-field",
            inputtype: SelectInput,
            data: {
                options: [
                    { value: "", text: "Seçin..." },
                    { value: "product_name", text: "Ürün Adı" },
                    { value: "current_price", text: "Güncel Fiyat" },
                    { value: "previous_price", text: "Eski Fiyat" },
                    { value: "category", text: "Kategori" },
                    { value: "sku", text: "Stok Kodu" },
                    { value: "barcode", text: "Barkod" },
                    { value: "description", text: "Açıklama" },
                    { value: "unit", text: "Birim" },
                    { value: "origin", text: "Menşei" },
                    { value: "weight", text: "Ağırlık" },
                    { value: "brand", text: "Marka" }
                ]
            }
        },
        {
            name: "Varsayılan Değer",
            key: "default_value",
            child: ".dynamic-content",
            htmlAttr: "innerHTML",
            inputtype: TextInput
        },
        {
            name: "Önek",
            key: "data-prefix",
            htmlAttr: "data-prefix",
            inputtype: TextInput
        },
        {
            name: "Sonek",
            key: "data-suffix",
            htmlAttr: "data-suffix",
            inputtype: TextInput
        }
    ]
});

// Log component registration
console.log('Omnex components registered:', Vvveb.ComponentsGroup['Omnex']);
