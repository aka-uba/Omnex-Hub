import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { Logger } from '../../core/Logger.js';

export class KunyeDistribution {
    constructor(app) {
        this.app = app;
        this.bildirimler = [];
        this.grouped = {};
        this.selectedKunyeler = [];
        this.assignments = [];
        this.currentStep = 1;
        this.products = [];
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('hal-distribution');
    }

    render() {
        const sifatOptions = this.getSifatOptions();

        // Default dates: last 7 days
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const endDate = today.toISOString().split('T')[0];
        const startDate = weekAgo.toISOString().split('T')[0];

        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">></span>
                    <a href="#/products">${this.__('breadcrumb.products')}</a>
                    <span class="breadcrumb-separator">></span>
                    <span class="breadcrumb-current">${this.__('breadcrumb.distribution')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon"><i class="ti ti-leaf"></i></div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('title')}</h1>
                            <p class="page-subtitle">${this.__('subtitle')}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step Indicator -->
            <div class="card mb-4">
                <div class="card-body">
                    <div class="kunye-steps" id="step-indicator">
                        <div class="kunye-step active" data-step="1">
                            <div class="kunye-step-number">1</div>
                            <div class="kunye-step-label">${this.__('steps.query')}</div>
                        </div>
                        <div class="kunye-step-line"></div>
                        <div class="kunye-step" data-step="2">
                            <div class="kunye-step-number">2</div>
                            <div class="kunye-step-label">${this.__('steps.select')}</div>
                        </div>
                        <div class="kunye-step-line"></div>
                        <div class="kunye-step" data-step="3">
                            <div class="kunye-step-number">3</div>
                            <div class="kunye-step-label">${this.__('steps.assign')}</div>
                        </div>
                        <div class="kunye-step-line"></div>
                        <div class="kunye-step" data-step="4">
                            <div class="kunye-step-number">4</div>
                            <div class="kunye-step-label">${this.__('steps.result')}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 1: Query Form -->
            <div id="step-1" class="kunye-step-content">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="ti ti-search"></i> ${this.__('steps.query')}</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                            <div class="form-group">
                                <label class="form-label">${this.__('form.startDate')}</label>
                                <input type="date" id="query-start-date" class="form-input" value="${startDate}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">${this.__('form.endDate')}</label>
                                <input type="date" id="query-end-date" class="form-input" value="${endDate}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">${this.__('form.sifat')}</label>
                                <select id="query-sifat" class="form-input">
                                    ${sifatOptions}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">&nbsp;</label>
                                <label class="flex items-center gap-2 cursor-pointer" style="height: 38px;">
                                    <input type="checkbox" id="query-only-remaining" class="form-checkbox" checked>
                                    <span>${this.__('form.onlyRemaining')}</span>
                                </label>
                            </div>
                        </div>
                        <div class="flex justify-end mt-4">
                            <button type="button" id="btn-query" class="btn btn-primary">
                                <i class="ti ti-search"></i> ${this.__('form.query')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 2: Document/Belge Selection -->
            <div id="step-2" class="kunye-step-content" style="display:none;">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="ti ti-file-text"></i> ${this.__('steps.select')}</h3>
                        <div class="card-header-actions">
                            <span id="belge-count" class="badge badge-primary"></span>
                        </div>
                    </div>
                    <div class="card-body" id="belge-container">
                        <!-- Dynamic content -->
                    </div>
                    <div class="card-footer flex justify-between">
                        <button type="button" id="btn-back-to-1" class="btn btn-outline">
                            <i class="ti ti-arrow-left"></i> ${this.__('assign.prevStep')}
                        </button>
                        <button type="button" id="btn-to-step-3" class="btn btn-primary">
                            ${this.__('assign.nextStep')} <i class="ti ti-arrow-right"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Step 3: Product Matching & Distribution -->
            <div id="step-3" class="kunye-step-content" style="display:none;">
                <div class="card card-table">
                    <div class="card-header">
                        <h3 class="card-title"><i class="ti ti-link"></i> ${this.__('steps.assign')}</h3>
                        <div class="card-header-actions">
                            <button type="button" id="btn-auto-match" class="btn btn-sm btn-outline">
                                <i class="ti ti-wand"></i> ${this.__('assign.autoMatch')}
                            </button>
                        </div>
                    </div>
                    <div class="data-table-wrapper">
                        <div class="data-table-container">
                            <table class="data-table data-table-hover">
                                <thead>
                                    <tr>
                                        <th class="data-table-th">${this.__('assign.halProduct')}</th>
                                        <th class="data-table-th">${this.__('assign.belgeNo')}</th>
                                        <th class="data-table-th">${this.__('assign.miktar')}</th>
                                        <th class="data-table-th">${this.__('assign.kalan')}</th>
                                        <th class="data-table-th">${this.__('assign.birim')}</th>
                                        <th class="data-table-th">${this.__('assign.type')}</th>
                                        <th class="data-table-th">${this.__('assign.systemProduct')}</th>
                                    </tr>
                                </thead>
                                <tbody id="assign-table-body">
                                    <!-- Dynamic content -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="card-footer flex justify-between">
                        <button type="button" id="btn-back-to-2" class="btn btn-outline">
                            <i class="ti ti-arrow-left"></i> ${this.__('assign.prevStep')}
                        </button>
                        <button type="button" id="btn-distribute" class="btn btn-primary">
                            <i class="ti ti-send"></i> ${this.__('assign.distribute')}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Step 4: Results -->
            <div id="step-4" class="kunye-step-content" style="display:none;">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="ti ti-check"></i> ${this.__('result.title')}</h3>
                    </div>
                    <div class="card-body" id="result-container">
                        <!-- Dynamic content -->
                    </div>
                    <div class="card-footer flex gap-2">
                        <a href="#/products" class="btn btn-primary">
                            <i class="ti ti-package"></i> ${this.__('result.viewProducts')}
                        </a>
                        <button type="button" id="btn-new-distribution" class="btn btn-outline">
                            <i class="ti ti-refresh"></i> ${this.__('result.newDistribution')}
                        </button>
                    </div>
                </div>
            </div>

            <style>
                .kunye-steps {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0;
                }
                .kunye-step {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    opacity: 0.5;
                    transition: opacity 0.3s;
                }
                .kunye-step.active,
                .kunye-step.completed {
                    opacity: 1;
                }
                .kunye-step-number {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--color-gray-200);
                    color: var(--color-gray-600);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 14px;
                    transition: all 0.3s;
                }
                .kunye-step.active .kunye-step-number {
                    background: var(--color-primary);
                    color: #fff;
                }
                .kunye-step.completed .kunye-step-number {
                    background: var(--color-success);
                    color: #fff;
                }
                .kunye-step-label {
                    font-size: 12px;
                    color: var(--color-gray-600);
                    white-space: nowrap;
                }
                .kunye-step.active .kunye-step-label {
                    color: var(--color-primary);
                    font-weight: 600;
                }
                .kunye-step-line {
                    flex: 1;
                    height: 2px;
                    background: var(--color-gray-200);
                    margin: 0 12px;
                    margin-bottom: 22px;
                    min-width: 40px;
                    max-width: 120px;
                }

                .belge-group {
                    border: 1px solid var(--color-gray-200);
                    border-radius: 8px;
                    margin-bottom: 12px;
                    overflow: hidden;
                }
                .belge-group-header {
                    background: var(--color-gray-50);
                    padding: 12px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                    user-select: none;
                }
                .belge-group-header:hover {
                    background: var(--color-gray-100);
                }
                .belge-group-body {
                    padding: 0;
                }
                .belge-group-body.collapsed {
                    display: none;
                }
                .belge-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 16px;
                    border-top: 1px solid var(--color-gray-100);
                }
                .belge-item:hover {
                    background: var(--color-gray-50);
                }
                .belge-item-info {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                .belge-item-name {
                    font-weight: 500;
                    min-width: 160px;
                }
                .belge-item-detail {
                    color: var(--color-gray-500);
                    font-size: 13px;
                }

                .product-match-cell {
                    min-width: 220px;
                }
                .product-match-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border: 1px dashed var(--color-gray-300);
                    border-radius: 6px;
                    background: transparent;
                    cursor: pointer;
                    color: var(--color-gray-500);
                    font-size: 13px;
                    width: 100%;
                    transition: all 0.2s;
                }
                .product-match-btn:hover {
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                }
                .product-match-btn.matched {
                    border-style: solid;
                    border-color: var(--color-success);
                    color: var(--color-success);
                    background: var(--color-success-light, rgba(64, 192, 87, 0.08));
                }

                .result-stat {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 8px;
                }

                .result-stat.success { background: rgba(64, 192, 87, 0.1); color: var(--color-success); }
                .result-stat.warning { background: rgba(250, 176, 5, 0.1); color: var(--color-warning); }
                .result-stat.error { background: rgba(250, 82, 82, 0.1); color: var(--color-danger); }
                .result-stat-icon { font-size: 24px; }
                .result-stat-text { font-size: 15px; font-weight: 500; }
            </style>
        `;
    }

    async init() {
        this.bindEvents();
        await this.loadHalSettings();
    }

    /**
     * HAL entegrasyon ayarlarını yükle ve formu önceden doldur
     */
    async loadHalSettings() {
        try {
            const response = await this.app.api.get('/hal/settings');
            if (response.success && response.data) {
                this.halSettings = response.data.settings || {};

                // Varsayılan sıfat seç
                if (this.halSettings.sifat_id) {
                    const sifatEl = document.getElementById('query-sifat');
                    if (sifatEl) sifatEl.value = this.halSettings.sifat_id;
                }

                // HAL yapılandırılmamışsa uyarı göster
                if (!response.data.configured) {
                    Toast.warning(this.__('errors.noCredentials'));
                }
            }
        } catch (error) {
            Logger.warn('HAL settings load error:', error);
        }
    }

    destroy() {
        this.app.i18n.clearPageTranslations();
    }

    bindEvents() {
        // Step 1: Query
        document.getElementById('btn-query')?.addEventListener('click', () => this.queryBildirimler());

        // Step 2: Navigation
        document.getElementById('btn-back-to-1')?.addEventListener('click', () => this.goToStep(1));
        document.getElementById('btn-to-step-3')?.addEventListener('click', () => this.goToStep3());

        // Step 3: Actions
        document.getElementById('btn-back-to-2')?.addEventListener('click', () => this.goToStep(2));
        document.getElementById('btn-auto-match')?.addEventListener('click', () => this.autoMatchProducts());
        document.getElementById('btn-distribute')?.addEventListener('click', () => this.distribute());

        // Step 4: New distribution
        document.getElementById('btn-new-distribution')?.addEventListener('click', () => this.resetWizard());
    }

    getSifatOptions() {
        const sifatIds = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
        return sifatIds.map(id =>
            `<option value="${id}">${this.__('sifat.' + id)}</option>`
        ).join('');
    }

    goToStep(step) {
        this.currentStep = step;

        // Hide all steps
        for (let i = 1; i <= 4; i++) {
            const el = document.getElementById(`step-${i}`);
            if (el) el.style.display = i === step ? '' : 'none';
        }

        // Update step indicator
        document.querySelectorAll('#step-indicator .kunye-step').forEach(el => {
            const s = parseInt(el.dataset.step);
            el.classList.toggle('active', s === step);
            el.classList.toggle('completed', s < step);
        });
    }

    // =====================================================
    // Step 1: Query Bildirimler
    // =====================================================

    async queryBildirimler() {
        const startDate = document.getElementById('query-start-date')?.value;
        const endDate = document.getElementById('query-end-date')?.value;
        const sifatId = document.getElementById('query-sifat')?.value || '0';
        const onlyRemaining = document.getElementById('query-only-remaining')?.checked;

        if (!startDate || !endDate) {
            Toast.warning(this.__('errors.dateRequired'));
            return;
        }

        // Validate date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (diffDays > 31) {
            Toast.warning(this.__('errors.dateRange'));
            return;
        }

        const btn = document.getElementById('btn-query');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('form.querying')}`;
        }

        try {
            const params = new URLSearchParams({
                start_date: startDate,
                end_date: endDate,
                sifat_id: sifatId,
                only_remaining: onlyRemaining ? 'true' : 'false'
            });

            const response = await this.app.api.get(`/hal/bildirimler?${params}`);

            if (!response.success) {
                throw new Error(response.message || this.__('errors.fetchFailed'));
            }

            this.bildirimler = response.data.bildirimler || [];
            this.grouped = response.data.grouped || {};

            if (this.bildirimler.length === 0) {
                Toast.info(this.__('errors.noResults'));
                return;
            }

            this.renderBelgeGroups();
            this.goToStep(2);

        } catch (error) {
            Logger.error('HAL query error:', error);
            Toast.error(this.__('errors.fetchFailed') + ': ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-search"></i> ${this.__('form.query')}`;
            }
        }
    }

    // =====================================================
    // Step 2: Render Belge Groups
    // =====================================================

    renderBelgeGroups() {
        const container = document.getElementById('belge-container');
        if (!container) return;

        const countBadge = document.getElementById('belge-count');
        if (countBadge) {
            countBadge.textContent = `${this.bildirimler.length} ${this.__('belge.items')}`;
        }

        let html = '';
        const groupKeys = Object.keys(this.grouped);

        groupKeys.forEach((key, groupIdx) => {
            const group = this.grouped[key];
            const items = group.items || [];

            html += `
                <div class="belge-group">
                    <div class="belge-group-header" data-group="${groupIdx}">
                        <div class="flex items-center gap-3">
                            <label class="flex items-center gap-2" onclick="event.stopPropagation()">
                                <input type="checkbox" class="form-checkbox belge-group-check"
                                    data-group="${groupIdx}" onchange="window._kunyeDist.toggleGroup(${groupIdx})">
                                <span>${this.__('belge.selectAll')}</span>
                            </label>
                            <strong>${this.__('belge.title')}: ${this.escapeHtml(group.belge_no || '-')}</strong>
                            ${group.plaka ? `<span class="badge badge-secondary"><i class="ti ti-car"></i> ${this.escapeHtml(group.plaka)}</span>` : ''}
                            <span class="badge badge-primary">${items.length} ${this.__('belge.items')}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-muted text-sm">${this.__('belge.totalKalan')}: ${group.total_kalan.toFixed(1)}</span>
                            <i class="ti ti-chevron-down"></i>
                        </div>
                    </div>
                    <div class="belge-group-body" id="belge-group-body-${groupIdx}">
                        ${items.map((item, itemIdx) => this.renderBelgeItem(item, groupIdx, itemIdx)).join('')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Bind accordion toggle
        container.querySelectorAll('.belge-group-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (e.target.closest('input, label')) return;
                const groupIdx = header.dataset.group;
                const body = document.getElementById(`belge-group-body-${groupIdx}`);
                if (body) body.classList.toggle('collapsed');
            });
        });

        // Expose for inline handlers
        window._kunyeDist = this;
    }

    renderBelgeItem(item, groupIdx, itemIdx) {
        const miktar = parseFloat(item.MalinMiktari || 0).toFixed(1);
        const kalan = parseFloat(item.KalanMiktar || 0).toFixed(1);
        const birim = item.MiktarBirimiAd || '';

        return `
            <div class="belge-item">
                <input type="checkbox" class="form-checkbox belge-item-check"
                    data-group="${groupIdx}" data-item="${itemIdx}"
                    data-kunye="${this.escapeHtml(item.KunyeNo || '')}">
                <div class="belge-item-info">
                    <span class="belge-item-name">${this.escapeHtml(item.MalinAdi || '-')}</span>
                    <span class="belge-item-detail">${this.escapeHtml(item.MalinCinsi || '')} / ${this.escapeHtml(item.MalinTuru || '')}</span>
                    <span class="belge-item-detail">${miktar} ${birim}</span>
                    <span class="belge-item-detail"><strong>${this.__('assign.kalan')}:</strong> ${kalan} ${birim}</span>
                    <span class="belge-item-detail text-xs text-muted">${this.escapeHtml(item.KunyeNo || '')}</span>
                </div>
            </div>
        `;
    }

    toggleGroup(groupIdx) {
        const groupCheck = document.querySelector(`.belge-group-check[data-group="${groupIdx}"]`);
        const isChecked = groupCheck?.checked || false;
        const items = document.querySelectorAll(`.belge-item-check[data-group="${groupIdx}"]`);
        items.forEach(cb => cb.checked = isChecked);
    }

    // =====================================================
    // Step 3: Move to assignment
    // =====================================================

    goToStep3() {
        // Collect selected künye
        const checked = document.querySelectorAll('.belge-item-check:checked');
        if (checked.length === 0) {
            Toast.warning(this.__('belge.noSelection'));
            return;
        }

        this.selectedKunyeler = [];
        const groupKeys = Object.keys(this.grouped);

        checked.forEach(cb => {
            const groupIdx = parseInt(cb.dataset.group);
            const itemIdx = parseInt(cb.dataset.item);
            const group = this.grouped[groupKeys[groupIdx]];
            if (group && group.items[itemIdx]) {
                this.selectedKunyeler.push({
                    ...group.items[itemIdx],
                    _belgeNo: group.belge_no,
                    _matchedProduct: null,
                    _distributionType: 'full'
                });
            }
        });

        this.renderAssignmentTable();
        this.goToStep(3);
    }

    renderAssignmentTable() {
        const tbody = document.getElementById('assign-table-body');
        if (!tbody) return;

        let html = '';
        this.selectedKunyeler.forEach((item, idx) => {
            const miktar = parseFloat(item.MalinMiktari || 0).toFixed(1);
            const kalan = parseFloat(item.KalanMiktar || 0).toFixed(1);
            const birim = item.MiktarBirimiAd || '';
            const matched = item._matchedProduct;

            html += `
                <tr data-idx="${idx}">
                    <td class="data-table-td">
                        <div><strong>${this.escapeHtml(item.MalinAdi || '-')}</strong></div>
                        <div class="text-xs text-muted">${this.escapeHtml(item.KunyeNo || '')}</div>
                    </td>
                    <td class="data-table-td">${this.escapeHtml(item._belgeNo || item.BelgeNo || '-')}</td>
                    <td class="data-table-td">${miktar}</td>
                    <td class="data-table-td">${kalan}</td>
                    <td class="data-table-td">${birim}</td>
                    <td class="data-table-td">
                        <select class="form-input form-input-sm dist-type-select" data-idx="${idx}"
                            style="min-width: 130px;">
                            <option value="full" ${item._distributionType === 'full' ? 'selected' : ''}>
                                ${this.__('assign.full')}
                            </option>
                            <option value="split" ${item._distributionType === 'split' ? 'selected' : ''}>
                                ${this.__('assign.split')}
                            </option>
                        </select>
                    </td>
                    <td class="data-table-td product-match-cell">
                        <button type="button" class="product-match-btn ${matched ? 'matched' : ''}"
                            data-idx="${idx}" id="match-btn-${idx}">
                            ${matched
                                ? `<i class="ti ti-check"></i> ${this.escapeHtml(matched.name)}`
                                : `<i class="ti ti-search"></i> ${this.__('assign.selectProduct')}`
                            }
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Bind events
        tbody.querySelectorAll('.product-match-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                this.openProductSearchModal(idx);
            });
        });

        tbody.querySelectorAll('.dist-type-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(sel.dataset.idx);
                this.selectedKunyeler[idx]._distributionType = e.target.value;
            });
        });
    }

    // =====================================================
    // Product Search Modal
    // =====================================================

    /**
     * HAL ürün adını arama için normalize et
     * "DOMATES (SOFRALIK)" → "domates"
     * "PATLICAN (DOLMALIK) - KEMER" → "patlican"
     */
    _normalizeHalName(name) {
        if (!name) return '';
        // Parantez içini kaldır, tire sonrasını kaldır
        let normalized = name
            .replace(/\s*\([^)]*\)/g, '')
            .replace(/\s*-\s*.*/g, '')
            .trim();
        // Çok uzunsa ilk kelimeyi al
        const words = normalized.split(/\s+/);
        if (words.length > 2) {
            normalized = words.slice(0, 2).join(' ');
        }
        return normalized;
    }

    openProductSearchModal(kunyeIdx) {
        const kunye = this.selectedKunyeler[kunyeIdx];
        const searchTerm = this._normalizeHalName(kunye.MalinAdi);

        Modal.show({
            title: this.__('assign.selectProduct'),
            icon: 'ti-search',
            size: 'md',
            content: `
                <div class="form-group mb-3">
                    <div style="position:relative;">
                        <input type="text" id="product-search-input" class="form-input"
                            placeholder="${this.__('assign.search')}" value="${this.escapeHtml(searchTerm)}"
                            style="padding-right: 36px;">
                        <button type="button" id="product-search-clear"
                            style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--color-gray-400); padding:4px; display:${searchTerm ? 'block' : 'none'};"
                            title="Temizle">
                            <i class="ti ti-x" style="font-size:16px;"></i>
                        </button>
                    </div>
                    <div class="text-xs text-muted mt-1">${this.__('assign.searchHint') || 'Ad, SKU veya barkod ile arayın'}</div>
                </div>
                <div id="product-search-results" style="max-height: 350px; overflow-y: auto;">
                    <div class="text-center text-muted py-4">
                        <i class="ti ti-loader animate-spin"></i> ${this.__('form.querying')}
                    </div>
                </div>
            `,
            showFooter: false
        });

        // Trigger initial search
        setTimeout(() => {
            this.searchProducts(searchTerm, kunyeIdx);

            const input = document.getElementById('product-search-input');
            const clearBtn = document.getElementById('product-search-clear');

            if (input) {
                input.focus();
                input.select();
                let debounce;
                input.addEventListener('input', () => {
                    clearTimeout(debounce);
                    if (clearBtn) clearBtn.style.display = input.value ? 'block' : 'none';
                    debounce = setTimeout(() => {
                        this.searchProducts(input.value, kunyeIdx);
                    }, 300);
                });
            }

            if (clearBtn && input) {
                clearBtn.addEventListener('click', () => {
                    input.value = '';
                    input.focus();
                    clearBtn.style.display = 'none';
                    this.searchProducts('', kunyeIdx);
                });
            }
        }, 100);
    }

    async searchProducts(query, kunyeIdx) {
        const resultsEl = document.getElementById('product-search-results');
        if (!resultsEl) return;

        try {
            const params = new URLSearchParams({ search: query, limit: '15' });
            const response = await this.app.api.get(`/products?${params}`);

            if (!response.success || !response.data) {
                resultsEl.innerHTML = `<div class="text-center text-muted py-4">${this.__('assign.noMatch')}</div>`;
                return;
            }

            const products = Array.isArray(response.data)
                ? response.data
                : (response.data.products || response.data.items || []);

            if (products.length === 0) {
                resultsEl.innerHTML = `<div class="text-center text-muted py-4">${this.__('assign.noMatch')}</div>`;
                return;
            }

            resultsEl.innerHTML = products.map(p => `
                <div class="product-search-item" data-product-id="${p.id}"
                    style="padding: 10px 12px; border-bottom: 1px solid var(--color-gray-100); cursor: pointer; display: flex; align-items: center; gap: 10px;"
                    onmouseover="this.style.background='var(--color-gray-50)'"
                    onmouseout="this.style.background='transparent'">
                    <div style="flex:1;">
                        <div style="font-weight:500;">${this.escapeHtml(p.name || '-')}</div>
                        <div style="font-size:12px; color: var(--color-gray-500);">
                            ${p.sku ? `SKU: ${this.escapeHtml(p.sku)}` : ''}
                            ${p.barcode ? ` | Barkod: ${this.escapeHtml(p.barcode)}` : ''}
                        </div>
                    </div>
                    <i class="ti ti-chevron-right text-muted"></i>
                </div>
            `).join('');

            resultsEl.querySelectorAll('.product-search-item').forEach(item => {
                item.addEventListener('click', () => {
                    const productId = item.dataset.productId;
                    const product = products.find(p => p.id === productId);
                    if (product) {
                        this.selectProduct(kunyeIdx, product);
                        Modal.close();
                    }
                });
            });

        } catch (error) {
            Logger.error('Product search error:', error);
            resultsEl.innerHTML = `<div class="text-center text-danger py-4">${error.message}</div>`;
        }
    }

    selectProduct(kunyeIdx, product) {
        this.selectedKunyeler[kunyeIdx]._matchedProduct = product;

        const btn = document.getElementById(`match-btn-${kunyeIdx}`);
        if (btn) {
            btn.classList.add('matched');
            btn.innerHTML = `<i class="ti ti-check"></i> ${this.escapeHtml(product.name)}`;
        }
    }

    // =====================================================
    // Auto Match Products
    // =====================================================

    async autoMatchProducts() {
        const btn = document.getElementById('btn-auto-match');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="ti ti-loader animate-spin"></i>';
        }

        let matched = 0;

        try {
            for (let i = 0; i < this.selectedKunyeler.length; i++) {
                const kunye = this.selectedKunyeler[i];
                if (kunye._matchedProduct) continue; // Already matched

                const searchTerm = this._normalizeHalName(kunye.MalinAdi);
                if (!searchTerm) continue;

                try {
                    const params = new URLSearchParams({ search: searchTerm, limit: '1' });
                    const response = await this.app.api.get(`/products?${params}`);

                    if (response.success && response.data) {
                        const products = Array.isArray(response.data)
                            ? response.data
                            : (response.data.products || response.data.items || []);

                        if (products.length > 0) {
                            this.selectProduct(i, products[0]);
                            matched++;
                        }
                    }
                } catch (e) {
                    Logger.warn('Auto-match error for', searchTerm, e);
                }
            }

            Toast.info(this.__('result.success', { count: matched }));

        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-wand"></i> ${this.__('assign.autoMatch')}`;
            }
        }
    }

    // =====================================================
    // Step 4: Distribute
    // =====================================================

    async distribute() {
        // Validate: all must have matched products
        const unmatched = this.selectedKunyeler.filter(k => !k._matchedProduct);
        if (unmatched.length > 0) {
            Toast.warning(this.__('errors.noProduct'));
            return;
        }

        const btn = document.getElementById('btn-distribute');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="ti ti-loader animate-spin"></i> ${this.__('assign.distributing')}`;
        }

        try {
            const assignments = this.selectedKunyeler.map(k => ({
                kunye_no: k.KunyeNo,
                product_id: k._matchedProduct.id,
                miktar: parseFloat(k.MalinMiktari || 0),
                kalan_miktar: parseFloat(k.KalanMiktar || 0),
                type: k._distributionType,
                // HAL bildirim verileri - tüm alanlar
                malin_adi: k.MalinAdi || '',
                malin_cinsi: k.MalinCinsi || '',
                malin_turu: k.MalinTuru || '',
                belge_no: k._belgeNo || k.BelgeNo || '',
                belge_tipi: k.BelgeTipi || '',
                bildirim_tarihi: k.BildirimTarihi || '',
                sifat_id: k.Sifat ? parseInt(k.Sifat) : null,
                birim: k.MiktarBirimiAd || '',
                birim_id: k.MiktarBirimId || '',
                arac_plaka_no: k.AracPlakaNo || '',
                uretici_tc_vergi_no: k.UreticiTcKimlikVergiNo || '',
                malin_sahibi_tc_vergi_no: k.MalinSahibiTcKimlikVergiNo || '',
                bildirimci_tc_vergi_no: k.BildirimciTcKimlikVergiNo || '',
                malin_cins_kod_no: k.MalinCinsKodNo || '',
                malin_kod_no: k.MalinKodNo || '',
                malin_turu_kod_no: k.MalinTuruKodNo || '',
                malin_satis_fiyati: k.MalinSatisFiyati || '',
                gidecek_isyeri_id: k.GidecekIsyeriId || '',
                gidecek_yer_turu_id: k.GidecekYerTuruId || '',
                analiz_status: k.AnalizStatus || '',
                bildirim_turu: k.BildirimTuru || ''
            }));

            const response = await this.app.api.post('/hal/distribute', { assignments });

            if (!response.success) {
                throw new Error(response.message || this.__('errors.distributeFailed'));
            }

            this.showResults(response.data);
            this.goToStep(4);

        } catch (error) {
            Logger.error('Distribute error:', error);
            Toast.error(this.__('errors.distributeFailed') + ': ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-send"></i> ${this.__('assign.distribute')}`;
            }
        }
    }

    // =====================================================
    // Step 4: Results
    // =====================================================

    showResults(data) {
        const container = document.getElementById('result-container');
        if (!container) return;

        let html = '';

        if (data.distributed > 0) {
            html += `
                <div class="result-stat success">
                    <i class="ti ti-circle-check result-stat-icon"></i>
                    <span class="result-stat-text">${this.__('result.success', { count: data.distributed })}</span>
                </div>
            `;
        }

        if (data.skipped > 0) {
            html += `
                <div class="result-stat warning">
                    <i class="ti ti-alert-triangle result-stat-icon"></i>
                    <span class="result-stat-text">${this.__('result.skipped', { count: data.skipped })}</span>
                </div>
            `;
        }

        if (data.errors && data.errors.length > 0) {
            html += `
                <div class="result-stat error">
                    <i class="ti ti-circle-x result-stat-icon"></i>
                    <span class="result-stat-text">${this.__('result.error', { count: data.errors.length })}</span>
                </div>
                <div class="mt-3">
                    ${data.errors.map(e => `
                        <div class="text-sm text-danger mb-1">
                            <i class="ti ti-point"></i> ${this.escapeHtml(e.kunye_no || '')}: ${this.escapeHtml(e.error || '')}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        container.innerHTML = html;
    }

    // =====================================================
    // Reset
    // =====================================================

    resetWizard() {
        this.bildirimler = [];
        this.grouped = {};
        this.selectedKunyeler = [];
        this.assignments = [];
        this.goToStep(1);
    }

    // =====================================================
    // Utility
    // =====================================================

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

export default KunyeDistribution;
