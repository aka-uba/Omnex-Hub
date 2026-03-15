/**
 * Web Template List Page
 * VvvebJs HTML şablonlarının listesi
 * Grid düzeni, çoklu seçim, sayfalama, toplu silme
 */

import { Modal } from '../../components/Modal.js';
import { Toast } from '../../components/Toast.js';

export class WebTemplateList {
    constructor(app) {
        this.app = app;
        this.templates = [];
        this.selectedIds = new Set();
        this.pagination = { total: 0, page: 1, per_page: 12, total_pages: 0 };
        this.filters = {
            status: '',
            type: '',
            search: ''
        };
    }

    /**
     * i18n helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Sayfa çevirilerini yükle
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('web-templates');
    }

    /**
     * Sayfa HTML'i
     */
    render() {
        return `
                <!-- Page Header -->
                <div class="page-header">
                    <div class="page-header-breadcrumb">
                        <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                        <span class="breadcrumb-separator">›</span>
                        <span class="breadcrumb-current">${this.__('list.title')}</span>
                    </div>
                    <div class="page-header-main">
                        <div class="page-header-left">
                            <div class="page-header-icon">
                                <i class="ti ti-layout-dashboard"></i>
                            </div>
                            <div class="page-header-info">
                                <h1 class="page-title">${this.__('list.title')}</h1>
                                <p class="page-subtitle">${this.__('list.subtitle')}</p>
                            </div>
                        </div>
                        <div class="page-header-right">
                            <button id="btn-bulk-delete" class="btn btn-danger" style="display:none;">
                                <i class="ti ti-trash"></i>
                                <span id="btn-bulk-delete-text">${this.__('actions.delete')}</span>
                            </button>
                            <button id="btn-new-template" class="btn btn-primary">
                                <i class="ti ti-plus"></i>
                                ${this.__('actions.new')}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Filters & Toolbar -->
                <div class="card mb-4">
                    <div class="card-body">
                        <div class="filter-row">
                            <div class="filter-item">
                                <label class="wt-select-all-wrapper">
                                    <input type="checkbox" id="wt-select-all" class="form-check-input">
                                    <span class="filter-label">${this.__('actions.selectAll') || 'Tümünü Seç'}</span>
                                </label>
                            </div>
                            <div class="filter-item">
                                <span class="filter-label">${this.__('filters.status')}</span>
                                <select id="filter-status" class="form-select">
                                    <option value="">${this.__('filters.all')}</option>
                                    <option value="draft">${this.__('status.draft')}</option>
                                    <option value="published">${this.__('status.published')}</option>
                                    <option value="archived">${this.__('status.archived')}</option>
                                </select>
                            </div>
                            <div class="filter-item">
                                <span class="filter-label">${this.__('filters.type')}</span>
                                <select id="filter-type" class="form-select">
                                    <option value="">${this.__('filters.all')}</option>
                                    <option value="signage">${this.__('types.signage')}</option>
                                    <option value="webpage">${this.__('types.webpage')}</option>
                                    <option value="dashboard">${this.__('types.dashboard')}</option>
                                    <option value="menu">${this.__('types.menu')}</option>
                                </select>
                            </div>
                            <div class="filter-item">
                                <span class="filter-label">${this.__('actions.perPage') || 'Sayfa başı'}</span>
                                <select id="filter-per-page" class="form-select" style="width:auto;">
                                    <option value="12">12</option>
                                    <option value="24">24</option>
                                    <option value="48">48</option>
                                    <option value="96">96</option>
                                </select>
                            </div>
                            <div class="filter-search" style="margin-left:auto; flex:none; max-width:220px;">
                                <input type="text" id="filter-search" class="form-input"
                                       placeholder="${this.__('filters.searchPlaceholder')}">
                            </div>
                            <button id="btn-search" class="btn btn-outline">
                                <i class="ti ti-search"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Template Grid -->
                <div class="card">
                    <div class="card-body">
                        <div id="templates-grid" class="templates-grid">
                            <!-- Grid burada render edilecek -->
                        </div>
                        <!-- Pagination -->
                        <div id="wt-pagination" class="wt-pagination" style="display:none;"></div>
                    </div>
                </div>
        `;
    }

    /**
     * Sayfa başlatma
     */
    async init() {
        this.bindEvents();
        await this.loadTemplates();
    }

    /**
     * Event listener'ları bağla
     */
    bindEvents() {
        // Yeni şablon butonu
        document.getElementById('btn-new-template')?.addEventListener('click', () => {
            this.openEditor();
        });

        // Toplu silme butonu
        document.getElementById('btn-bulk-delete')?.addEventListener('click', () => {
            this.bulkDeleteSelected();
        });

        // Tümünü seç checkbox
        document.getElementById('wt-select-all')?.addEventListener('change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });

        // Filtre değişiklikleri
        document.getElementById('filter-status')?.addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.pagination.page = 1;
            this.loadTemplates();
        });

        document.getElementById('filter-type')?.addEventListener('change', (e) => {
            this.filters.type = e.target.value;
            this.pagination.page = 1;
            this.loadTemplates();
        });

        // Sayfa başı öğe sayısı
        document.getElementById('filter-per-page')?.addEventListener('change', (e) => {
            this.pagination.per_page = parseInt(e.target.value);
            this.pagination.page = 1;
            this.loadTemplates();
        });

        // Arama
        document.getElementById('btn-search')?.addEventListener('click', () => {
            this.filters.search = document.getElementById('filter-search')?.value || '';
            this.pagination.page = 1;
            this.loadTemplates();
        });

        document.getElementById('filter-search')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.filters.search = e.target.value;
                this.pagination.page = 1;
                this.loadTemplates();
            }
        });
    }

    /**
     * Şablonları yükle
     */
    async loadTemplates() {
        const container = document.getElementById('templates-grid');
        if (!container) return;

        // Loading göster
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>${this.__('messages.loading')}</p>
            </div>
        `;

        try {
            const params = new URLSearchParams();
            if (this.filters.status) params.append('status', this.filters.status);
            if (this.filters.type) params.append('type', this.filters.type);
            if (this.filters.search) params.append('search', this.filters.search);
            params.append('page', this.pagination.page);
            params.append('per_page', this.pagination.per_page);

            const response = await this.app.api.get(`/web-templates?${params.toString()}`);

            if (response.success) {
                this.templates = response.data.items || [];
                this.pagination = {
                    ...this.pagination,
                    total: response.data.pagination?.total || 0,
                    total_pages: response.data.pagination?.total_pages || 1,
                    page: response.data.pagination?.page || 1
                };
                this.selectedIds.clear();
                this.updateSelectAllState();
                this.updateBulkDeleteBtn();
                this.renderGrid(container);
                this.renderPagination();
            } else {
                throw new Error(response.message || 'Yükleme hatası');
            }
        } catch (error) {
            console.error('Load templates error:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ti ti-alert-circle"></i>
                    <p>${this.__('messages.loadError')}</p>
                    <button class="btn btn-outline" onclick="location.reload()">
                        ${this.__('actions.retry')}
                    </button>
                </div>
            `;
        }
    }

    /**
     * Pagination render
     */
    renderPagination() {
        const container = document.getElementById('wt-pagination');
        if (!container) return;

        const { total, page, per_page, total_pages } = this.pagination;

        if (total_pages <= 1) {
            container.style.display = 'none';
            return;
        }

        container.style.display = '';

        const start = (page - 1) * per_page + 1;
        const end = Math.min(page * per_page, total);

        // Page buttons
        let pageButtons = '';
        const maxVisible = 5;
        let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
        let endPage = Math.min(total_pages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pageButtons += `<button class="wt-page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        container.innerHTML = `
            <div class="wt-pagination-info">
                ${this.__('list.total', { count: total })} &middot; ${start}-${end}
            </div>
            <div class="wt-pagination-controls">
                <button class="wt-page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
                    <i class="ti ti-chevron-left"></i>
                </button>
                ${startPage > 1 ? `<button class="wt-page-btn" data-page="1">1</button><span class="wt-page-dots">…</span>` : ''}
                ${pageButtons}
                ${endPage < total_pages ? `<span class="wt-page-dots">…</span><button class="wt-page-btn" data-page="${total_pages}">${total_pages}</button>` : ''}
                <button class="wt-page-btn" data-page="${page + 1}" ${page >= total_pages ? 'disabled' : ''}>
                    <i class="ti ti-chevron-right"></i>
                </button>
            </div>
        `;

        // Page button events
        container.querySelectorAll('.wt-page-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPage = parseInt(btn.dataset.page);
                if (targetPage >= 1 && targetPage <= total_pages && targetPage !== page) {
                    this.pagination.page = targetPage;
                    this.loadTemplates();
                }
            });
        });
    }

    /**
     * Grid render
     */
    renderGrid(container) {
        if (this.templates.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ti ti-layout-off"></i>
                    <h3>${this.__('messages.noTemplates')}</h3>
                    <p>${this.__('messages.noTemplatesHint')}</p>
                    <button id="btn-create-first" class="btn btn-primary">
                        <i class="ti ti-plus"></i>
                        ${this.__('actions.createFirst')}
                    </button>
                </div>
            `;

            document.getElementById('btn-create-first')?.addEventListener('click', () => {
                this.openEditor();
            });
            return;
        }

        container.innerHTML = `
            <div class="template-cards">
                ${this.templates.map(template => this.renderTemplateCard(template)).join('')}
            </div>
        `;

        this.bindCardEvents(container);
    }

    /**
     * Kart event listener'larını bağla
     */
    bindCardEvents(container) {
        container.querySelectorAll('.template-card').forEach(card => {
            const templateId = card.dataset.id;

            // Checkbox selection
            const checkbox = card.querySelector('.wt-card-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    if (e.target.checked) {
                        this.selectedIds.add(templateId);
                        card.classList.add('selected');
                    } else {
                        this.selectedIds.delete(templateId);
                        card.classList.remove('selected');
                    }
                    this.updateSelectAllState();
                    this.updateBulkDeleteBtn();
                });
                // Prevent card click when clicking checkbox
                checkbox.addEventListener('click', (e) => e.stopPropagation());
            }

            // Önizleme (yeni sekmede aç) butonu
            card.querySelector('.btn-preview')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openPreview(templateId);
            });

            // Düzenle butonu
            card.querySelector('.btn-edit')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openEditor(templateId);
            });

            // Sil butonu
            card.querySelector('.btn-delete')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTemplate(templateId);
            });

            // Kopyala butonu
            card.querySelector('.btn-duplicate')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.duplicateTemplate(templateId);
            });

            // Karta tıklama - düzenleme
            card.addEventListener('click', () => {
                this.openEditor(templateId);
            });
        });
    }

    /**
     * Tümünü seç/bırak
     */
    toggleSelectAll(checked) {
        this.selectedIds.clear();
        document.querySelectorAll('.wt-card-checkbox').forEach(cb => {
            cb.checked = checked;
            const card = cb.closest('.template-card');
            if (card) {
                if (checked) {
                    this.selectedIds.add(card.dataset.id);
                    card.classList.add('selected');
                } else {
                    card.classList.remove('selected');
                }
            }
        });
        this.updateBulkDeleteBtn();
    }

    /**
     * Select all checkbox state güncelle
     */
    updateSelectAllState() {
        const selectAll = document.getElementById('wt-select-all');
        if (!selectAll) return;
        const totalCards = document.querySelectorAll('.wt-card-checkbox').length;
        selectAll.checked = totalCards > 0 && this.selectedIds.size === totalCards;
        selectAll.indeterminate = this.selectedIds.size > 0 && this.selectedIds.size < totalCards;
    }

    /**
     * Toplu sil butonunu güncelle
     */
    updateBulkDeleteBtn() {
        const btn = document.getElementById('btn-bulk-delete');
        const btnText = document.getElementById('btn-bulk-delete-text');
        if (!btn) return;

        if (this.selectedIds.size > 0) {
            btn.style.display = '';
            if (btnText) {
                btnText.textContent = `${this.__('actions.delete')} (${this.selectedIds.size})`;
            }
        } else {
            btn.style.display = 'none';
        }
    }

    /**
     * Tek şablon kartı render
     */
    isFabricSource(template) {
        if (!template.data_sources) return false;
        try {
            const ds = typeof template.data_sources === 'string'
                ? JSON.parse(template.data_sources)
                : template.data_sources;
            return ds?.source === 'fabric_template';
        } catch { return false; }
    }

    getFabricSource(template) {
        try {
            const ds = typeof template.data_sources === 'string'
                ? JSON.parse(template.data_sources)
                : template.data_sources;
            return ds?.source === 'fabric_template' ? ds : null;
        } catch { return null; }
    }

    renderTemplateCard(template) {
        const placeholderSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 250' fill='none'%3E%3Crect width='400' height='250' fill='%23f1f3f5'/%3E%3Crect x='20' y='20' width='360' height='40' rx='4' fill='%23dee2e6'/%3E%3Crect x='20' y='80' width='170' height='150' rx='4' fill='%23e9ecef'/%3E%3Crect x='210' y='80' width='170' height='70' rx='4' fill='%23e9ecef'/%3E%3Crect x='210' y='160' width='170' height='70' rx='4' fill='%23e9ecef'/%3E%3Ctext x='200' y='135' text-anchor='middle' fill='%23adb5bd' font-family='Arial' font-size='14'%3EWeb Template%3C/text%3E%3C/svg%3E";
        const thumbnail = this.sanitizeImageUrl(template.thumbnail, placeholderSvg);
        const statusClass = this.getStatusClass(template.status);
        const statusText = this.escapeHtml(this.__(`status.${template.status}`) || template.status);
        const typeText = this.escapeHtml(this.__(`types.${template.template_type}`) || template.template_type);
        const safeName = this.escapeHtml(template.name || '');
        const safeId = this.escapeHtml(template.id || '');
        const safeDeviceCount = Number.isFinite(Number(template.device_count)) ? Number(template.device_count) : 0;
        const isSelected = this.selectedIds.has(template.id);

        const isFabric = this.isFabricSource(template);
        const sourceBadge = isFabric
            ? `<span class="badge badge-info" title="${this.__('source.fabricHint')}"><i class="ti ti-layout" style="margin-right:3px"></i>${this.__('source.fabricTemplate')}</span>`
            : '';

        // Fabric kaynağı için önizleme: serve endpoint'ini iframe olarak göster
        const thumbnailContent = isFabric
            ? `<iframe src="${this.app.config.basePath || ''}/api/web-templates/${safeId}/serve"
                   style="width:100%;height:100%;border:none;pointer-events:none;position:absolute;left:0;top:0"
                   loading="lazy" sandbox="allow-scripts"></iframe>`
            : `<img src="${thumbnail}" alt="${safeName}" onerror="this.onerror=null; this.src='${placeholderSvg}'">`;

        return `
            <div class="template-card ${isSelected ? 'selected' : ''}" data-id="${safeId}" ${isFabric ? 'data-fabric-source="true"' : ''}>
                <div class="template-card-thumbnail">
                    <label class="wt-card-select" onclick="event.stopPropagation();">
                        <input type="checkbox" class="wt-card-checkbox form-check-input" ${isSelected ? 'checked' : ''}>
                    </label>
                    ${thumbnailContent}
                    <div class="template-card-overlay">
                        <button class="btn btn-icon btn-preview" title="${this.__('actions.preview')}">
                            <i class="ti ti-external-link"></i>
                        </button>
                        <button class="btn btn-icon btn-edit" title="${this.__(isFabric ? 'actions.editTemplate' : 'actions.edit')}">
                            <i class="ti ti-${isFabric ? 'palette' : 'edit'}"></i>
                        </button>
                        <button class="btn btn-icon btn-duplicate" title="${this.__('actions.duplicate')}">
                            <i class="ti ti-copy"></i>
                        </button>
                        <button class="btn btn-icon btn-delete" title="${this.__('actions.delete')}">
                            <i class="ti ti-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="template-card-body">
                    <h4 class="template-card-title">${safeName}</h4>
                    <div class="template-card-meta">
                        <span class="badge badge-${statusClass}">${statusText}</span>
                        ${sourceBadge || `<span class="badge badge-outline">${typeText}</span>`}
                    </div>
                    <div class="template-card-info">
                        <span><i class="ti ti-device-desktop"></i> ${safeDeviceCount}</span>
                        <span><i class="ti ti-calendar"></i> ${this.formatDate(template.updated_at)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    sanitizeImageUrl(url, fallback) {
        if (!url) return fallback;
        const value = String(url).trim();
        if (/^javascript:/i.test(value)) return fallback;
        if (/^(https?:\/\/|\/|data:image\/)/i.test(value)) return value;
        return fallback;
    }

    /**
     * Status badge sınıfı
     */
    getStatusClass(status) {
        const classes = {
            draft: 'warning',
            published: 'success',
            archived: 'secondary'
        };
        return classes[status] || 'secondary';
    }

    /**
     * Tarih formatla
     */
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'short'
        });
    }

    /**
     * Editör aç — Fabric kaynağı varsa şablon editörüne, yoksa HTML editörüne yönlendir
     */
    openEditor(templateId = null) {
        if (templateId) {
            // Fabric kaynağı kontrolü
            const template = this.templates.find(t => t.id === templateId);
            const fabricSource = template ? this.getFabricSource(template) : null;

            if (fabricSource && fabricSource.fabric_template_id) {
                // Fabric.js şablon editörüne yönlendir
                window.location.hash = `#/templates/editor?id=${fabricSource.fabric_template_id}`;
                return;
            }
        }

        const basePath = this.app.config.basePath || '';
        const url = templateId
            ? `${basePath}/html-editor/?id=${templateId}`
            : `${basePath}/html-editor/`;

        window.location.href = url;
    }

    /**
     * Şablonu yeni sekmede önizle (serve endpoint)
     */
    openPreview(templateId) {
        const basePath = this.app.config.basePath || '';
        const url = `${basePath}/api/web-templates/${templateId}/serve`;
        window.open(url, '_blank');
    }

    /**
     * Şablon sil — DOM'dan kaldır, arka planda yeniden yükleme yapma
     */
    async deleteTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        const confirmed = await Modal.confirm({
            title: this.__('confirm.deleteTitle'),
            message: this.__('confirm.deleteMessage', { name: template.name }),
            type: 'danger',
            confirmText: this.__('actions.delete'),
            cancelText: this.__('actions.cancel')
        });

        if (!confirmed) return;

        try {
            const response = await this.app.api.delete(`/web-templates/${templateId}`);

            if (response.success) {
                Toast.success(this.__('messages.deleted'));

                // DOM'dan kartı kaldır (yeniden yükleme yapmadan)
                const card = document.querySelector(`.template-card[data-id="${templateId}"]`);
                if (card) {
                    card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.9)';
                    setTimeout(() => {
                        card.remove();
                        // Templates array'den de kaldır
                        this.templates = this.templates.filter(t => t.id !== templateId);
                        this.selectedIds.delete(templateId);
                        this.pagination.total = Math.max(0, this.pagination.total - 1);
                        this.updateSelectAllState();
                        this.updateBulkDeleteBtn();
                        this.renderPagination();

                        // Sayfa boşsa ve başka sayfa varsa önceki sayfaya git
                        if (this.templates.length === 0 && this.pagination.page > 1) {
                            this.pagination.page--;
                            this.loadTemplates();
                        } else if (this.templates.length === 0) {
                            const container = document.getElementById('templates-grid');
                            if (container) this.renderGrid(container);
                        }
                    }, 300);
                }
            } else {
                throw new Error(response.message || 'Silme hatası');
            }
        } catch (error) {
            console.error('Delete template error:', error);
            Toast.error(this.__('messages.deleteError') + ': ' + (error.message || ''));
        }
    }

    /**
     * Seçili şablonları toplu sil
     */
    async bulkDeleteSelected() {
        if (this.selectedIds.size === 0) return;

        const count = this.selectedIds.size;
        const confirmed = await Modal.confirm({
            title: this.__('confirm.deleteTitle'),
            message: this.__('confirm.bulkDeleteMessage', { count }) || `${count} şablonu silmek istediğinize emin misiniz?`,
            type: 'danger',
            confirmText: `${this.__('actions.delete')} (${count})`,
            cancelText: this.__('actions.cancel')
        });

        if (!confirmed) return;

        try {
            const ids = [...this.selectedIds];
            const response = await this.app.api.post('/web-templates/bulk-delete', { ids });

            if (response.success) {
                const result = response.data || {};
                const deleted = result.deleted || 0;
                const skipped = result.skipped || 0;

                if (deleted > 0) {
                    Toast.success(this.__('messages.bulkDeleted', { count: deleted }) || `${deleted} şablon silindi`);
                }
                if (skipped > 0) {
                    Toast.warning(this.__('messages.bulkSkipped', { count: skipped }) || `${skipped} şablon atlandı (aktif atama)`);
                }

                this.selectedIds.clear();
                this.loadTemplates();
            } else {
                throw new Error(response.message || 'Toplu silme hatası');
            }
        } catch (error) {
            console.error('Bulk delete error:', error);
            Toast.error(this.__('messages.deleteError') + ': ' + (error.message || ''));
        }
    }

    /**
     * Şablon kopyala
     */
    async duplicateTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        try {
            // Orijinal şablonu getir
            const response = await this.app.api.get(`/web-templates/${templateId}`);

            if (response.success && response.data) {
                const original = response.data;

                // Yeni şablon oluştur
                const newTemplate = {
                    name: original.name + ' (Kopya)',
                    description: original.description,
                    html_content: original.html_content,
                    css_content: original.css_content,
                    js_content: original.js_content,
                    template_type: original.template_type,
                    category: original.category,
                    tags: original.tags,
                    width: original.width,
                    height: original.height,
                    orientation: original.orientation,
                    status: 'draft'
                };

                const createResponse = await this.app.api.post('/web-templates', newTemplate);

                if (createResponse.success) {
                    Toast.success(this.__('messages.duplicated'));
                    this.loadTemplates();
                } else {
                    throw new Error(createResponse.message || 'Kopyalama hatası');
                }
            }
        } catch (error) {
            console.error('Duplicate template error:', error);
            Toast.error(this.__('messages.duplicateError') + ': ' + (error.message || ''));
        }
    }

    /**
     * Sayfa temizleme
     */
    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}

export default WebTemplateList;
