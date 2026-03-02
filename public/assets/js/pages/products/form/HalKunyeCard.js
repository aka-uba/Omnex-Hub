/**
 * HalKunyeCard - HAL Künye Veri Kartı Bileşeni
 *
 * Ürün formunda/detayında HAL künye verilerini gösteren kart.
 * Sadece TR locale'de görünür.
 *
 * @version 1.0.0
 */

import { Logger } from '../../../core/Logger.js';
import { Toast } from '../../../components/Toast.js';

export class HalKunyeCard {
    constructor({ container, app, productId, editable = false, onDataChange = null }) {
        this.container = container;
        this.app = app;
        this.productId = productId;
        this.editable = editable;
        this.onDataChange = onDataChange;
        this.halData = null;
    }

    /**
     * i18n helper
     */
    __(key, params = {}) {
        return this.app?.i18n?.t(key, params) || key;
    }

    /**
     * Locale kontrolü - sadece TR'de görünür
     */
    isVisible() {
        const locale = this.app?.i18n?.locale || localStorage.getItem('omnex_language') || 'tr';
        return locale === 'tr';
    }

    /**
     * Kartı render et
     */
    async render() {
        if (!this.isVisible()) {
            this.container.style.display = 'none';
            return;
        }

        this.container.style.display = 'block';
        this.container.innerHTML = this._getLoadingHtml();

        if (this.productId) {
            await this.loadHalData();
        }

        this._renderCard();
    }

    /**
     * HAL verisini yükle
     */
    async loadHalData() {
        try {
            const response = await this.app.api.get(`/hal/data?product_id=${this.productId}`);
            if (response.success && response.data) {
                this.halData = response.data;
            }
        } catch (error) {
            Logger.warn('HAL verisi yüklenemedi:', error);
        }
    }

    /**
     * HAL verisini kaydet
     */
    async saveHalData(data) {
        try {
            data.product_id = this.productId;
            const response = await this.app.api.post('/hal/data', data);
            if (response.success) {
                this.halData = { ...this.halData, ...data };
                Toast.success(this.__('hal.dataSaved'));
                if (this.onDataChange) {
                    this.onDataChange(this.halData);
                }
                return true;
            }
        } catch (error) {
            Logger.error('HAL verisi kaydedilemedi:', error);
            Toast.error(this.__('hal.saveError'));
        }
        return false;
    }

    /**
     * HAL sorgusu sonucunu uygula
     */
    applyQueryResult(queryData) {
        this.halData = {
            ...this.halData,
            ...queryData,
            hal_sorgu_tarihi: new Date().toISOString()
        };
        this._renderCard();
    }

    /**
     * Kart HTML'ini render et
     */
    _renderCard() {
        const data = this.halData || {};

        this.container.innerHTML = `
            <div class="hal-kunye-card">
                <div class="hal-card-header">
                    <div class="hal-card-title">
                        <i class="ti ti-leaf"></i>
                        <span>${this.__('hal.cardTitle')}</span>
                    </div>
                    ${data.kunye_no ? `<span class="hal-kunye-badge">${data.kunye_no}</span>` : ''}
                </div>

                ${!data.kunye_no ? this._getEmptyStateHtml() : this._getDataHtml(data)}
            </div>
        `;

        this._bindEvents();
    }

    /**
     * Veri yokken gösterilecek durum
     */
    _getEmptyStateHtml() {
        return `
            <div class="hal-empty-state">
                <i class="ti ti-leaf-off"></i>
                <p>${this.__('hal.noData')}</p>
                <p class="hal-empty-hint">${this.__('hal.queryHint')}</p>
            </div>
        `;
    }

    /**
     * Veri gösterimi
     */
    _getDataHtml(data) {
        return `
            <div class="hal-card-body">
                <!-- Üretim Yeri Bilgileri -->
                <div class="hal-section">
                    <div class="hal-section-title">
                        <i class="ti ti-map-pin"></i>
                        ${this.__('hal.sections.production')}
                    </div>
                    <div class="hal-fields-grid">
                        ${this._fieldRow('uretici_adi', data.uretici_adi)}
                        ${this._fieldRow('malin_adi', data.malin_adi)}
                        ${this._fieldRow('malin_cinsi', data.malin_cinsi)}
                        ${this._fieldRow('malin_turu', data.malin_turu)}
                        ${this._fieldRow('ilk_bildirim_tarihi', data.ilk_bildirim_tarihi)}
                        ${this._fieldRow('uretim_yeri', data.uretim_yeri)}
                    </div>
                </div>

                <!-- Tüketim Yeri Bilgileri -->
                <div class="hal-section">
                    <div class="hal-section-title">
                        <i class="ti ti-shopping-cart"></i>
                        ${this.__('hal.sections.consumption')}
                    </div>
                    <div class="hal-fields-grid">
                        ${this._fieldRow('malin_sahibi', data.malin_sahibi)}
                        ${this._fieldRow('tuketim_bildirim_tarihi', data.tuketim_bildirim_tarihi)}
                        ${this._fieldRow('tuketim_yeri', data.tuketim_yeri)}
                    </div>
                </div>

                <!-- Etiket Bilgileri -->
                <div class="hal-section">
                    <div class="hal-section-title">
                        <i class="ti ti-tag"></i>
                        ${this.__('hal.sections.label')}
                    </div>
                    <div class="hal-fields-grid">
                        ${this._fieldRow('gumruk_kapisi', data.gumruk_kapisi)}
                        ${this._fieldRow('uretim_ithal_tarihi', data.uretim_ithal_tarihi)}
                        ${this._fieldRow('miktar', data.miktar)}
                        ${this._fieldRow('alis_fiyati', data.alis_fiyati ? `${data.alis_fiyati} ₺` : null)}
                        ${this._fieldRow('isletme_adi', data.isletme_adi)}
                        ${this._fieldRow('diger_bilgiler', data.diger_bilgiler)}
                    </div>
                </div>

                <!-- Organik Sertifika (varsa) -->
                ${(data.sertifikasyon_kurulusu || data.sertifika_no) ? `
                <div class="hal-section">
                    <div class="hal-section-title">
                        <i class="ti ti-certificate"></i>
                        ${this.__('hal.sections.organic')}
                    </div>
                    <div class="hal-fields-grid">
                        ${this._fieldRow('sertifikasyon_kurulusu', data.sertifikasyon_kurulusu)}
                        ${this._fieldRow('sertifika_no', data.sertifika_no)}
                    </div>
                </div>
                ` : ''}

                <!-- Geçmiş Bildirimler (varsa) -->
                ${data.gecmis_bildirimler?.length ? this._getHistoryHtml(data.gecmis_bildirimler) : ''}

                <!-- Meta bilgiler -->
                ${data.hal_sorgu_tarihi ? `
                <div class="hal-meta">
                    <i class="ti ti-clock"></i>
                    ${this.__('hal.lastQuery')}: ${new Date(data.hal_sorgu_tarihi).toLocaleString('tr-TR')}
                </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Alan satırı
     */
    _fieldRow(key, value) {
        if (!value) return '';
        return `
            <div class="hal-field">
                <span class="hal-field-label">${this.__(`hal.fields.${key}`)}</span>
                <span class="hal-field-value">${value}</span>
            </div>
        `;
    }

    /**
     * Geçmiş bildirimler tablosu
     */
    _getHistoryHtml(history) {
        return `
            <div class="hal-section hal-section-history">
                <div class="hal-section-title">
                    <i class="ti ti-history"></i>
                    ${this.__('hal.sections.history')}
                </div>
                <div class="hal-history-table-container">
                    <table class="hal-history-table">
                        <thead>
                            <tr>
                                <th>${this.__('hal.history.name')}</th>
                                <th>${this.__('hal.history.title')}</th>
                                <th>${this.__('hal.history.type')}</th>
                                <th>${this.__('hal.history.price')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${history.map(item => `
                                <tr>
                                    <td>${item.adi_soyadi || '-'}</td>
                                    <td>${item.sifat || '-'}</td>
                                    <td>${item.islem_turu || '-'}</td>
                                    <td>${item.satis_fiyati ? `${item.satis_fiyati} ₺` : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Yükleniyor durumu
     */
    _getLoadingHtml() {
        return `
            <div class="hal-kunye-card">
                <div class="hal-loading">
                    <i class="ti ti-loader-2 animate-spin"></i>
                    <span>${this.__('messages.loading')}</span>
                </div>
            </div>
        `;
    }

    /**
     * Event bağlayıcıları
     */
    _bindEvents() {
        // Gelecekte genişletilebilir
    }

    /**
     * Veriyi al
     */
    getData() {
        return this.halData;
    }

    /**
     * Temizle
     */
    destroy() {
        this.container.innerHTML = '';
        this.halData = null;
    }
}

export default HalKunyeCard;
