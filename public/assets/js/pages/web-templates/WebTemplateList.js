/**
 * Web Template List Page
 * VvvebJs HTML şablonlarının listesi
 */

import { DataTable } from '../../components/DataTable.js';
import { Modal } from '../../components/Modal.js';
import { Toast } from '../../components/Toast.js';

export class WebTemplateList {
    constructor(app) {
        this.app = app;
        this.dataTable = null;
        this.templates = [];
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
                            <button id="btn-new-template" class="btn btn-primary">
                                <i class="ti ti-plus"></i>
                                ${this.__('actions.new')}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Filters -->
                <div class="card mb-4">
                    <div class="card-body">
                        <div class="filter-row">
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
                            <!-- DataTable veya Grid burada render edilecek -->
                        </div>
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

        // Filtre değişiklikleri
        document.getElementById('filter-status')?.addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.loadTemplates();
        });

        document.getElementById('filter-type')?.addEventListener('change', (e) => {
            this.filters.type = e.target.value;
            this.loadTemplates();
        });

        // Arama
        document.getElementById('btn-search')?.addEventListener('click', () => {
            this.filters.search = document.getElementById('filter-search')?.value || '';
            this.loadTemplates();
        });

        document.getElementById('filter-search')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.filters.search = e.target.value;
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

            const response = await this.app.api.get(`/web-templates?${params.toString()}`);

            if (response.success) {
                this.templates = response.data.items || [];
                this.renderGrid(container);
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

        // Kart event'leri
        container.querySelectorAll('.template-card').forEach(card => {
            const templateId = card.dataset.id;

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
     * Tek şablon kartı render
     */
    renderTemplateCard(template) {
        const placeholderSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 250' fill='none'%3E%3Crect width='400' height='250' fill='%23f1f3f5'/%3E%3Crect x='20' y='20' width='360' height='40' rx='4' fill='%23dee2e6'/%3E%3Crect x='20' y='80' width='170' height='150' rx='4' fill='%23e9ecef'/%3E%3Crect x='210' y='80' width='170' height='70' rx='4' fill='%23e9ecef'/%3E%3Crect x='210' y='160' width='170' height='70' rx='4' fill='%23e9ecef'/%3E%3Ctext x='200' y='135' text-anchor='middle' fill='%23adb5bd' font-family='Arial' font-size='14'%3EWeb Template%3C/text%3E%3C/svg%3E";
        const thumbnail = this.sanitizeImageUrl(template.thumbnail, placeholderSvg);
        const statusClass = this.getStatusClass(template.status);
        const statusText = this.escapeHtml(this.__(`status.${template.status}`) || template.status);
        const typeText = this.escapeHtml(this.__(`types.${template.template_type}`) || template.template_type);
        const safeName = this.escapeHtml(template.name || '');
        const safeId = this.escapeHtml(template.id || '');
        const safeDeviceCount = Number.isFinite(Number(template.device_count)) ? Number(template.device_count) : 0;

        return `
            <div class="template-card" data-id="${safeId}">
                <div class="template-card-thumbnail">
                    <img src="${thumbnail}" alt="${safeName}" onerror="this.onerror=null; this.src='${placeholderSvg}'">
                    <div class="template-card-overlay">
                        <button class="btn btn-icon btn-edit" title="${this.__('actions.edit')}">
                            <i class="ti ti-edit"></i>
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
                        <span class="badge badge-outline">${typeText}</span>
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
     * Editör aç
     */
    openEditor(templateId = null) {
        const basePath = this.app.config.basePath || '';
        const url = templateId
            ? `${basePath}/html-editor/?id=${templateId}`
            : `${basePath}/html-editor/`;

        window.location.href = url;
    }

    /**
     * Şablon sil
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
                this.loadTemplates();
            } else {
                throw new Error(response.message || 'Silme hatası');
            }
        } catch (error) {
            console.error('Delete template error:', error);
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
