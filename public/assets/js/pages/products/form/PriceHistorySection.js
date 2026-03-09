/**
 * PriceHistorySection - Fiyat Geçmişi Modülü
 *
 * ProductForm ve ProductDetail'de fiyat geçmişi görüntüleme:
 * - Accordion (collapsible) modu: Form sayfası için
 * - Grid tablo modu: Detay sayfası için
 * - Detaylı modal: Tüm geçmiş + istatistik + export
 *
 * @version 2.1.0
 * @since v2.0.15
 */

import { Logger } from '../../../core/Logger.js';
import { Toast } from '../../../components/Toast.js';
import { Modal } from '../../../components/Modal.js';
import { ExportManager } from '../../../utils/ExportManager.js';

/**
 * PriceHistorySection init fonksiyonu
 * @param {Object} params - Parametre objesi
 * @param {HTMLElement} params.container - Container element (ZORUNLU)
 * @param {Object} params.app - App instance
 * @param {string} params.productId - Ürün ID
 * @param {string} params.productName - Ürün adı (modal başlığı için)
 * @param {Function} params.translator - Çeviri fonksiyonu
 * @param {string} params.mode - Görüntüleme modu: 'accordion' (varsayılan) veya 'grid'
 * @returns {PriceHistorySection} PriceHistorySection instance
 */
export function init({ container, app, productId, productName, translator, mode = 'accordion' }) {
    if (!container) {
        throw new Error('PriceHistorySection: container parametresi zorunludur');
    }
    return new PriceHistorySection({ container, app, productId, productName, translator, mode });
}

class PriceHistorySection {
    constructor({ container, app, productId, productName, translator, mode = 'accordion' }) {
        this.container = container;
        this.app = app;
        this.productId = productId;
        this.productName = productName || '';
        this.__ = translator || ((key) => key);
        this.mode = mode; // 'accordion' veya 'grid'

        // Stored price history data
        this._priceHistory = [];
        this._isExpanded = false;
        this._isLoading = false;

        // Export Manager
        this._exportManager = null;
        this._outsideClickHandler = null;
    }

    /**
     * Çeviri helper'ını güncelle
     */
    setTranslator(translator) {
        this.__ = translator;
    }

    /**
     * Ürün adını güncelle
     */
    setProductName(name) {
        this.productName = name;
    }

    /**
     * Export Manager oluştur
     * @private
     */
    _getExportManager() {
        if (!this._exportManager) {
            this._exportManager = new ExportManager({
                filename: `fiyat-gecmisi-${this._sanitizeFilename(this.productName)}`,
                title: `${this.__('priceHistory.title')} - ${this.productName}`,
                author: 'Omnex Display Hub'
            });
        }
        return this._exportManager;
    }

    /**
     * Export kolonlarını döndür
     * @private
     */
    _getExportColumns() {
        return [
            { key: 'changed_at', label: this.__('priceHistory.table.date') },
            { key: 'old_price', label: this.__('priceHistory.table.oldPrice') },
            { key: 'new_price', label: this.__('priceHistory.table.newPrice') },
            { key: 'change_percent', label: this.__('priceHistory.table.change') },
            { key: 'source', label: this.__('priceHistory.table.source') }
        ];
    }

    /**
     * Export için veri hazırla
     * @private
     */
    _prepareExportData() {
        return this._priceHistory.map(item => {
            const changePercent = item.old_price && item.old_price > 0
                ? (((item.new_price - item.old_price) / item.old_price) * 100).toFixed(1) + '%'
                : '-';

            return {
                changed_at: this._formatDate(item.changed_at),
                old_price: item.old_price !== null ? this._formatPrice(item.old_price) : '-',
                new_price: this._formatPrice(item.new_price),
                change_percent: changePercent,
                source: this._getSourceLabel(item.source)
            };
        });
    }

    /**
     * Ana render metodu - mode'a göre farklı görünüm
     */
    render() {
        if (this.mode === 'grid') {
            return this._renderGridMode();
        }
        return this._renderAccordionMode();
    }

    /**
     * Accordion modunda render (Form sayfası için)
     * @private
     */
    _renderAccordionMode() {
        const html = `
            <div class="price-history-section">
                <div class="price-history-header" id="price-history-toggle">
                    <div class="price-history-header-left">
                        <i class="ti ti-history"></i>
                        <span class="price-history-title">${this.__('priceHistory.title')}</span>
                        <span class="price-history-count" id="price-history-count" style="display: ${this._priceHistory.length > 0 ? 'inline-flex' : 'none'};">${this._priceHistory.length}</span>
                    </div>
                    <div class="price-history-header-right">
                        <button type="button" class="btn btn-sm btn-ghost" id="price-history-expand-btn" title="${this.__('priceHistory.toggle')}">
                            <i class="ti ti-chevron-down" id="price-history-chevron"></i>
                        </button>
                    </div>
                </div>
                <div class="price-history-body" id="price-history-body" style="display: none;">
                    <div class="price-history-list" id="price-history-list">
                        <div class="price-history-loading">
                            <i class="ti ti-loader-2 spin"></i>
                            <span>${this.__('messages.loading')}</span>
                        </div>
                    </div>
                    <div class="price-history-footer" id="price-history-footer" style="display: none;">
                        <button type="button" class="btn btn-sm btn-outline" id="price-history-view-all">
                            <i class="ti ti-list"></i>
                            ${this.__('priceHistory.viewAll')}
                        </button>
                    </div>
                </div>
            </div>
        `;

        if (this.container) {
            this.container.innerHTML = html;
        }

        return html;
    }

    /**
     * Grid tablo modunda render (Detay sayfası için)
     * @private
     */
    _renderGridMode() {
        const html = `
            <div class="price-history-grid-section">
                <div class="price-history-grid-header">
                    <div class="price-history-grid-title">
                        <i class="ti ti-history"></i>
                        <span>${this.__('priceHistory.title')}</span>
                        <span class="price-history-count" id="price-history-count-grid" style="display: none;">0</span>
                    </div>
                    <div class="price-history-grid-actions">
                        <div class="price-history-export-dropdown">
                            <button type="button" class="btn btn-sm btn-ghost" id="price-history-export-btn" title="${this.__('priceHistory.export.label')}">
                                <i class="ti ti-download"></i>
                            </button>
                            <div class="price-history-export-menu" id="price-history-export-dropdown">
                                <button type="button" data-export="csv">
                                    <i class="ti ti-file-text"></i> CSV
                                </button>
                                <button type="button" data-export="excel">
                                    <i class="ti ti-file-spreadsheet"></i> Excel
                                </button>
                                <button type="button" data-export="json">
                                    <i class="ti ti-braces"></i> JSON
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="price-history-grid-body" id="price-history-grid-body">
                    <div class="price-history-loading">
                        <i class="ti ti-loader-2 spin"></i>
                        <span>${this.__('messages.loading')}</span>
                    </div>
                </div>
            </div>
        `;

        if (this.container) {
            this.container.innerHTML = html;
        }

        return html;
    }

    /**
     * Event listener'ları bağla
     */
    bindEvents() {
        if (this.mode === 'grid') {
            this._bindGridEvents();
        } else {
            this._bindAccordionEvents();
        }
    }

    /**
     * Accordion event'lerini bağla
     * @private
     */
    _bindAccordionEvents() {
        // Toggle accordion
        const toggle = document.getElementById('price-history-toggle');
        toggle?.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            this.toggleAccordion();
        });

        const expandBtn = document.getElementById('price-history-expand-btn');
        expandBtn?.addEventListener('click', () => {
            this.toggleAccordion();
        });

        // View all button
        document.getElementById('price-history-view-all')?.addEventListener('click', () => {
            this.showFullHistoryModal();
        });
    }

    /**
     * Grid event'lerini bağla
     * @private
     */
    _bindGridEvents() {
        // Export dropdown toggle - CSS hover ile açılıyor, click ile de toggle
        const exportDropdownWrapper = this.container?.querySelector('.price-history-export-dropdown');
        const exportBtn = document.getElementById('price-history-export-btn');

        exportBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            exportDropdownWrapper?.classList.toggle('active');
        });

        // Export actions
        const exportDropdown = document.getElementById('price-history-export-dropdown');
        exportDropdown?.querySelectorAll('[data-export]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const type = e.currentTarget.dataset.export;
                await this._handleExport(type);
                exportDropdownWrapper?.classList.remove('active');
            });
        });

        // Close dropdown on outside click
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
        }
        this._outsideClickHandler = (e) => {
            if (!exportDropdownWrapper?.contains(e.target)) {
                exportDropdownWrapper?.classList.remove('active');
            }
        };
        document.addEventListener('click', this._outsideClickHandler);
    }

    /**
     * Export işlemi
     * @private
     */
    async _handleExport(type) {
        if (this._priceHistory.length === 0) {
            Toast.warning(this.__('priceHistory.noHistory'));
            return;
        }

        try {
            const exporter = this._getExportManager();
            const data = this._prepareExportData();
            const columns = this._getExportColumns();

            await exporter.export(type, data, columns);
            Toast.success(this.__('priceHistory.exportSuccess'));
        } catch (error) {
            Logger.error('Export hatası:', error);
            Toast.error(this.__('messages.error'));
        }
    }

    /**
     * Ürün ID'sini güncelle ve geçmişi yükle
     */
    setProductId(productId) {
        this.productId = productId;
        if (productId) {
            this.loadHistory();
        } else {
            this._priceHistory = [];
            this._renderContent();
        }
    }

    /**
     * Fiyat geçmişini direkt set et
     */
    setHistory(history) {
        this._priceHistory = history || [];
        this._renderContent();
        // Count'u hemen güncelle
        this._updateCount();
    }

    /**
     * Mode'a göre içerik render et
     * @private
     */
    _renderContent() {
        if (this.mode === 'grid') {
            this._renderGridContent();
        } else {
            this._renderAccordionList();
        }
    }

    /**
     * Accordion'u aç/kapa
     */
    toggleAccordion() {
        this._isExpanded = !this._isExpanded;

        const body = document.getElementById('price-history-body');
        const chevron = document.getElementById('price-history-chevron');

        if (body) {
            body.style.display = this._isExpanded ? 'block' : 'none';
        }

        if (chevron) {
            chevron.className = this._isExpanded ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
        }

        // İlk açılışta veri yükle
        if (this._isExpanded && this._priceHistory.length === 0 && this.productId) {
            this.loadHistory();
        }
    }

    /**
     * Fiyat geçmişini API'den yükle
     */
    async loadHistory() {
        if (!this.productId || this._isLoading) {
            return;
        }

        this._isLoading = true;
        this._showLoading();

        try {
            // Aktif şube varsa branch_id parametresi ekle
            const activeBranch = this.app?.state?.get('activeBranch');
            const branchId = activeBranch?.id;

            let url = `/products/${this.productId}`;
            if (branchId) {
                url += `?branch_id=${branchId}`;
            }

            const response = await this.app.api.get(url);

            if (response.success && response.data?.price_history) {
                this._priceHistory = response.data.price_history;
            } else {
                this._priceHistory = [];
            }
        } catch (error) {
            Logger.error('Fiyat geçmişi yükleme hatası:', error);
            this._priceHistory = [];
        } finally {
            this._isLoading = false;
            this._renderContent();
            this._updateCount();
        }
    }

    /**
     * Loading göster
     * @private
     */
    _showLoading() {
        const containerId = this.mode === 'grid' ? 'price-history-grid-body' : 'price-history-list';
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="price-history-loading">
                    <i class="ti ti-loader-2 spin"></i>
                    <span>${this.__('messages.loading')}</span>
                </div>
            `;
        }
    }

    /**
     * Kayıt sayısını güncelle
     * @private
     */
    _updateCount() {
        const countId = this.mode === 'grid' ? 'price-history-count-grid' : 'price-history-count';
        // Önce container içinde ara, sonra global DOM'da
        const countEl = this.container?.querySelector(`#${countId}`) || document.getElementById(countId);
        if (countEl) {
            if (this._priceHistory.length > 0) {
                countEl.textContent = this._priceHistory.length;
                countEl.style.display = 'inline-flex';
            } else {
                countEl.style.display = 'none';
            }
        }
    }

    /**
     * Accordion içindeki listeyi render et (son 5 kayıt)
     * @private
     */
    _renderAccordionList() {
        const listContainer = document.getElementById('price-history-list');
        const footerContainer = document.getElementById('price-history-footer');

        if (!listContainer) return;

        if (this._priceHistory.length === 0) {
            listContainer.innerHTML = `
                <div class="price-history-empty">
                    <i class="ti ti-history-off"></i>
                    <span>${this.__('priceHistory.noHistory')}</span>
                </div>
            `;
            if (footerContainer) footerContainer.style.display = 'none';
            return;
        }

        // Son 5 kayıt
        const recentHistory = this._priceHistory.slice(0, 5);

        const items = recentHistory.map(item => this._renderHistoryItem(item)).join('');
        listContainer.innerHTML = items;

        // 5'ten fazla kayıt varsa "Tümünü Gör" göster
        if (footerContainer) {
            footerContainer.style.display = this._priceHistory.length > 5 ? 'flex' : 'none';
        }
    }

    /**
     * Grid içeriğini render et
     * @private
     */
    _renderGridContent() {
        const container = document.getElementById('price-history-grid-body');
        if (!container) return;

        if (this._priceHistory.length === 0) {
            container.innerHTML = `
                <div class="price-history-empty">
                    <i class="ti ti-history-off"></i>
                    <span>${this.__('priceHistory.noHistory')}</span>
                </div>
            `;
            return;
        }

        const tableHtml = `
            <table class="price-history-table">
                <thead>
                    <tr>
                        <th>${this.__('priceHistory.table.date')}</th>
                        <th>${this.__('priceHistory.table.oldPrice')}</th>
                        <th>${this.__('priceHistory.table.newPrice')}</th>
                        <th>${this.__('priceHistory.table.change')}</th>
                        <th>${this.__('priceHistory.table.source')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${this._priceHistory.map(item => this._renderTableRow(item)).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHtml;
    }

    /**
     * Tek bir fiyat geçmişi satırını render et (accordion için)
     * @private
     */
    _renderHistoryItem(item) {
        const oldPrice = item.old_price !== null && item.old_price !== undefined
            ? this._formatPrice(item.old_price)
            : '-';
        const newPrice = this._formatPrice(item.new_price);

        // Fiyat değişim yönü
        const priceChange = item.old_price !== null && item.old_price !== undefined
            ? (item.new_price > item.old_price ? 'up' : item.new_price < item.old_price ? 'down' : 'same')
            : 'new';

        const sourceLabel = this._getSourceLabel(item.source);
        const sourceClass = item.source === 'import' ? 'import' : item.source === 'erp' ? 'erp' : 'manual';

        return `
            <div class="price-history-item">
                <div class="price-history-item-left">
                    <div class="price-history-date">
                        <i class="ti ti-calendar"></i>
                        ${this._formatDate(item.changed_at)}
                    </div>
                    <div class="price-history-source">
                        <span class="badge badge-sm badge-${sourceClass}">${sourceLabel}</span>
                    </div>
                </div>
                <div class="price-history-item-right">
                    <div class="price-history-change price-change-${priceChange}">
                        <span class="price-old">${oldPrice}</span>
                        <i class="ti ti-arrow-narrow-right"></i>
                        <span class="price-new">${newPrice}</span>
                        ${priceChange === 'up' ? '<i class="ti ti-trending-up change-icon"></i>' : ''}
                        ${priceChange === 'down' ? '<i class="ti ti-trending-down change-icon"></i>' : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Tablo satırı render et
     * @private
     */
    _renderTableRow(item) {
        const oldPrice = item.old_price !== null && item.old_price !== undefined
            ? this._formatPrice(item.old_price)
            : '-';
        const newPrice = this._formatPrice(item.new_price);

        // Değişim hesapla
        let changeHtml = '-';
        if (item.old_price !== null && item.old_price !== undefined && item.old_price > 0) {
            const changeAmount = item.new_price - item.old_price;
            const changePercent = ((changeAmount / item.old_price) * 100).toFixed(1);
            const isPositive = changeAmount > 0;
            const changeClass = isPositive ? 'text-danger' : changeAmount < 0 ? 'text-success' : '';
            const icon = isPositive ? 'ti-trending-up' : changeAmount < 0 ? 'ti-trending-down' : '';

            changeHtml = `
                <span class="${changeClass}">
                    ${icon ? `<i class="ti ${icon}"></i>` : ''}
                    ${isPositive ? '+' : ''}${changePercent}%
                </span>
            `;
        }

        const sourceLabel = this._getSourceLabel(item.source);
        const sourceClass = item.source === 'import' ? 'import' : item.source === 'erp' ? 'erp' : 'manual';

        return `
            <tr>
                <td>${this._formatDate(item.changed_at)}</td>
                <td>${oldPrice}</td>
                <td><strong>${newPrice}</strong></td>
                <td>${changeHtml}</td>
                <td><span class="badge badge-sm badge-${sourceClass}">${sourceLabel}</span></td>
            </tr>
        `;
    }

    /**
     * Tüm fiyat geçmişi modalını göster
     */
    showFullHistoryModal() {
        const content = this._renderFullHistoryContent();

        Modal.show({
            id: 'price-history-modal',
            title: `${this.__('priceHistory.modalTitle')} - ${this.productName}`,
            icon: 'ti-history',
            content: content,
            size: 'lg',
            showConfirm: false,
            cancelText: this.__('actions.close')
        });

        // Modal DOM'a eklendikten sonra event'leri bağla
        setTimeout(() => {
            this._bindModalEvents();
        }, 100);
    }

    /**
     * Modal içeriğini render et
     * @private
     */
    _renderFullHistoryContent() {
        if (this._priceHistory.length === 0) {
            return `
                <div class="price-history-modal-empty">
                    <i class="ti ti-history-off"></i>
                    <p>${this.__('priceHistory.noHistory')}</p>
                </div>
            `;
        }

        // İstatistikler
        const stats = this._calculateStats();

        // Fiyat değişim özeti
        const summaryHtml = `
            <div class="price-history-stats">
                <div class="stat-card">
                    <div class="stat-icon blue">
                        <i class="ti ti-list-numbers"></i>
                    </div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.totalChanges}</span>
                        <span class="stat-label">${this.__('priceHistory.stats.totalChanges')}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon red">
                        <i class="ti ti-trending-up"></i>
                    </div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.increases}</span>
                        <span class="stat-label">${this.__('priceHistory.stats.increases')}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">
                        <i class="ti ti-trending-down"></i>
                    </div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.decreases}</span>
                        <span class="stat-label">${this.__('priceHistory.stats.decreases')}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon amber">
                        <i class="ti ti-chart-line"></i>
                    </div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.avgChange}</span>
                        <span class="stat-label">${this.__('priceHistory.stats.avgChange')}</span>
                    </div>
                </div>
            </div>
        `;

        // Tablo
        const tableHtml = `
            <div class="price-history-table-container">
                <table class="price-history-table">
                    <thead>
                        <tr>
                            <th>${this.__('priceHistory.table.date')}</th>
                            <th>${this.__('priceHistory.table.oldPrice')}</th>
                            <th>${this.__('priceHistory.table.newPrice')}</th>
                            <th>${this.__('priceHistory.table.change')}</th>
                            <th>${this.__('priceHistory.table.source')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this._priceHistory.map(item => this._renderTableRow(item)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Export butonları - ExportManager türlerini kullan
        const exportHtml = `
            <div class="price-history-export">
                <span class="export-label">${this.__('priceHistory.export.label')}:</span>
                <button type="button" class="btn btn-sm btn-outline" data-export-type="csv">
                    <i class="ti ti-file-text"></i>
                    CSV
                </button>
                <button type="button" class="btn btn-sm btn-outline" data-export-type="excel">
                    <i class="ti ti-file-spreadsheet"></i>
                    Excel
                </button>
                <button type="button" class="btn btn-sm btn-outline" data-export-type="json">
                    <i class="ti ti-braces"></i>
                    JSON
                </button>
            </div>
        `;

        return `
            <div class="price-history-modal-content">
                ${summaryHtml}
                ${tableHtml}
                ${exportHtml}
            </div>
        `;
    }

    /**
     * Modal event'lerini bağla
     * @private
     */
    _bindModalEvents() {
        // Modal içindeki export butonlarını dinle
        const modal = document.getElementById('price-history-modal');
        if (!modal) return;

        const exportButtons = modal.querySelectorAll('[data-export-type]');
        exportButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const type = e.currentTarget.dataset.exportType;
                await this._handleExport(type);
            });
        });
    }

    /**
     * İstatistikleri hesapla
     * @private
     */
    _calculateStats() {
        const totalChanges = this._priceHistory.length;
        let increases = 0;
        let decreases = 0;
        let totalChangePercent = 0;
        let validChanges = 0;

        this._priceHistory.forEach(item => {
            if (item.old_price !== null && item.old_price !== undefined && item.old_price > 0) {
                const changePercent = ((item.new_price - item.old_price) / item.old_price) * 100;
                if (item.new_price > item.old_price) increases++;
                else if (item.new_price < item.old_price) decreases++;

                totalChangePercent += Math.abs(changePercent);
                validChanges++;
            }
        });

        const avgChange = validChanges > 0
            ? (totalChangePercent / validChanges).toFixed(1) + '%'
            : '-';

        return { totalChanges, increases, decreases, avgChange };
    }

    /**
     * Dosya adı için güvenli karakter temizleme
     * @private
     */
    _sanitizeFilename(name) {
        return name
            .toLowerCase()
            .replace(/[çÇ]/g, 'c')
            .replace(/[ğĞ]/g, 'g')
            .replace(/[ıİ]/g, 'i')
            .replace(/[öÖ]/g, 'o')
            .replace(/[şŞ]/g, 's')
            .replace(/[üÜ]/g, 'u')
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);
    }

    /**
     * Kaynak etiketini çevir
     * @private
     */
    _getSourceLabel(source) {
        const labels = {
            'manual': this.__('priceHistory.sources.manual'),
            'import': this.__('priceHistory.sources.import'),
            'erp': this.__('priceHistory.sources.erp'),
            'api': this.__('priceHistory.sources.api')
        };
        return labels[source] || source || labels['manual'];
    }

    /**
     * Fiyat formatla
     * @private
     */
    _formatPrice(price) {
        if (price === null || price === undefined) return '-';
        const i18n = this.app?.i18n;
        if (i18n?.formatCurrency) {
            return i18n.formatCurrency(price);
        }
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            minimumFractionDigits: 2
        }).format(price);
    }

    /**
     * Tarih formatla
     * @private
     */
    _formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Get stored price history
     */
    getHistory() {
        return this._priceHistory;
    }

    /**
     * Accordion'un açık olup olmadığını döndür
     */
    isExpanded() {
        return this._isExpanded;
    }

    /**
     * Destroy - cleanup
     */
    destroy() {
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
            this._outsideClickHandler = null;
        }
        this._priceHistory = [];
        this._isExpanded = false;
        this._exportManager = null;
    }
}

export { PriceHistorySection };
