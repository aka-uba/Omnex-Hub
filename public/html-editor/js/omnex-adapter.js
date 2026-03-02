/**
 * Omnex VvvebJs Adapter
 * VvvebJs editörünü Omnex API'si ile entegre eder
 */

const OmnexAdapter = {
    // State
    templateId: null,
    isModified: false,
    autoSaveInterval: null,

    // Config
    config: {
        apiUrl: null,
        basePath: null,
        autoSaveEnabled: true,
        autoSaveDelay: 60000 // 1 dakika
    },

    /**
     * Adapter'ı başlat
     */
    init: function() {
        // Config'i window'dan al
        if (window.OmnexConfig) {
            this.config.apiUrl = window.OmnexConfig.apiUrl;
            this.config.basePath = window.OmnexConfig.basePath;
        } else {
            // Fallback - URL'den hesapla
            const pathParts = window.location.pathname.split('/');
            const htmlEditorIndex = pathParts.indexOf('html-editor');
            if (htmlEditorIndex > 0) {
                this.config.basePath = '/' + pathParts.slice(1, htmlEditorIndex).join('/');
                this.config.apiUrl = this.config.basePath + '/api';
            }
        }

        // URL'den template ID'yi al
        const urlParams = new URLSearchParams(window.location.search);
        this.templateId = urlParams.get('id');

        // Event listener'ları bağla
        this.bindEvents();

        // Template yükle veya yeni oluştur
        if (this.templateId) {
            this.loadTemplate(this.templateId);
        } else {
            this.initNewTemplate();
        }

        // Auto-save başlat
        if (this.config.autoSaveEnabled) {
            this.startAutoSave();
        }

        console.log('OmnexAdapter initialized', this.config);
    },

    /**
     * Event listener'ları bağla
     */
    bindEvents: function() {
        // Kaydet butonu
        document.getElementById('btn-save')?.addEventListener('click', () => {
            this.saveTemplate(false);
        });

        // Yayınla butonu
        document.getElementById('btn-publish')?.addEventListener('click', () => {
            this.saveTemplate(true);
        });

        // Önizleme butonu
        document.getElementById('btn-preview')?.addEventListener('click', () => {
            this.previewTemplate();
        });

        // Geri butonu
        document.getElementById('btn-back')?.addEventListener('click', (e) => {
            if (this.isModified) {
                e.preventDefault();
                if (confirm('Kaydedilmemiş değişiklikler var. Çıkmak istediğinize emin misiniz?')) {
                    window.location.href = this.config.basePath + '/#/web-templates';
                }
            }
        });

        // Şablon adı değişikliği
        document.getElementById('template-name')?.addEventListener('input', () => {
            this.markAsModified();
        });

        // VvvebJs değişiklik takibi
        if (typeof Vvveb !== 'undefined') {
            // Builder hazır olduğunda
            document.addEventListener('vvveb.builder.init', () => {
                this.setupChangeTracking();
            });
        }

        // Sayfa kapatma uyarısı
        window.addEventListener('beforeunload', (e) => {
            if (this.isModified) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+S - Kaydet
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveTemplate(false);
            }
            // Ctrl+P - Önizleme
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                this.previewTemplate();
            }
        });
    },

    /**
     * Değişiklik takibini ayarla
     */
    setupChangeTracking: function() {
        if (typeof Vvveb !== 'undefined' && Vvveb.Builder) {
            // Undo eklendiğinde değişiklik var demektir
            const originalAddUndo = Vvveb.Undo.add;
            Vvveb.Undo.add = (...args) => {
                originalAddUndo.apply(Vvveb.Undo, args);
                this.markAsModified();
            };
        }
    },

    /**
     * Değişiklik olarak işaretle
     */
    markAsModified: function() {
        this.isModified = true;
        const saveBtn = document.getElementById('btn-save');
        if (saveBtn) {
            saveBtn.classList.add('has-changes');
        }
    },

    /**
     * Yeni şablon başlat
     */
    initNewTemplate: function() {
        const nameInput = document.getElementById('template-name');
        if (nameInput) {
            nameInput.value = 'Yeni Web Şablonu';
        }

        // Boş sayfa yükle
        if (typeof Vvveb !== 'undefined' && Vvveb.Builder) {
            Vvveb.Builder.init('html-editor/blank.html', () => {
                console.log('Blank template loaded');
            });
        }
    },

    /**
     * Şablonu yükle
     */
    loadTemplate: async function(id) {
        this.showLoading(true);

        try {
            const response = await this.apiRequest('GET', `/web-templates/${id}`);

            if (response.success && response.data) {
                const template = response.data;

                // Şablon adını set et
                const nameInput = document.getElementById('template-name');
                if (nameInput) {
                    nameInput.value = template.name || 'İsimsiz Şablon';
                }

                // HTML içeriği yükle
                if (template.html_content && typeof Vvveb !== 'undefined') {
                    Vvveb.Builder.setHtml(template.html_content);
                }

                // CSS içeriği varsa uygula
                if (template.css_content && typeof Vvveb !== 'undefined') {
                    Vvveb.StyleManager.setCss(template.css_content);
                }

                this.isModified = false;
                console.log('Template loaded:', template.name);
            } else {
                this.showError('Şablon yüklenemedi');
            }
        } catch (error) {
            console.error('Load template error:', error);
            this.showError('Şablon yüklenirken hata oluştu');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Şablonu kaydet
     */
    saveTemplate: async function(publish = false) {
        this.showLoading(true);

        try {
            const nameInput = document.getElementById('template-name');
            const name = nameInput?.value?.trim() || 'İsimsiz Şablon';

            // HTML ve CSS al
            let htmlContent = '';
            let cssContent = '';

            if (typeof Vvveb !== 'undefined' && Vvveb.Builder) {
                htmlContent = Vvveb.Builder.getHtml();
                cssContent = Vvveb.StyleManager?.getCss() || '';
            }

            const data = {
                name: name,
                html_content: htmlContent,
                css_content: cssContent,
                status: publish ? 'published' : 'draft'
            };

            let response;
            if (this.templateId) {
                // Güncelle
                response = await this.apiRequest('PUT', `/web-templates/${this.templateId}`, data);
            } else {
                // Yeni oluştur
                response = await this.apiRequest('POST', '/web-templates', data);
            }

            if (response.success) {
                // Yeni şablon ise ID'yi kaydet
                if (!this.templateId && response.data?.id) {
                    this.templateId = response.data.id;
                    // URL'yi güncelle
                    const newUrl = window.location.pathname + '?id=' + this.templateId;
                    window.history.replaceState({}, '', newUrl);
                }

                this.isModified = false;
                const saveBtn = document.getElementById('btn-save');
                if (saveBtn) {
                    saveBtn.classList.remove('has-changes');
                }

                this.showSuccess(publish ? 'Şablon yayınlandı' : 'Şablon kaydedildi');
            } else {
                this.showError(response.message || 'Kaydetme başarısız');
            }
        } catch (error) {
            console.error('Save template error:', error);
            this.showError('Şablon kaydedilirken hata oluştu');
        } finally {
            this.showLoading(false);
        }
    },

    /**
     * Şablonu önizle
     */
    previewTemplate: function() {
        if (typeof Vvveb !== 'undefined' && Vvveb.Builder) {
            const html = Vvveb.Builder.getHtml();

            // Yeni pencerede önizle
            const previewWindow = window.open('', '_blank');
            if (previewWindow) {
                previewWindow.document.write(html);
                previewWindow.document.close();
            }
        }
    },

    /**
     * Auto-save başlat
     */
    startAutoSave: function() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        this.autoSaveInterval = setInterval(() => {
            if (this.isModified && this.templateId) {
                console.log('Auto-saving...');
                this.saveTemplate(false);
            }
        }, this.config.autoSaveDelay);
    },

    /**
     * API isteği gönder
     */
    apiRequest: async function(method, endpoint, data = null) {
        const url = this.config.apiUrl + endpoint;
        const token = localStorage.getItem('omnex_token');

        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = 'Bearer ' + token;
        }

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        return response.json();
    },

    /**
     * Loading göster/gizle
     */
    showLoading: function(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    },

    /**
     * Başarı mesajı göster
     */
    showSuccess: function(message) {
        this.showToast(message, 'success');
    },

    /**
     * Hata mesajı göster
     */
    showError: function(message) {
        this.showToast(message, 'error');
    },

    /**
     * Toast bildirim göster
     */
    showToast: function(message, type = 'info') {
        // Mevcut toast varsa kaldır
        const existingToast = document.querySelector('.omnex-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `omnex-toast omnex-toast-${type}`;
        toast.innerHTML = `
            <i class="ti ti-${type === 'success' ? 'check' : type === 'error' ? 'x' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);

        // Animasyon ile göster
        setTimeout(() => toast.classList.add('show'), 10);

        // 3 saniye sonra kaldır
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// DOM hazır olduğunda başlat
document.addEventListener('DOMContentLoaded', function() {
    OmnexAdapter.init();
});

// Global erişim için export
window.OmnexAdapter = OmnexAdapter;
