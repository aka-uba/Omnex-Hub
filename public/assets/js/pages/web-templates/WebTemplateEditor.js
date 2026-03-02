/**
 * Web Template Editor Wrapper
 * VvvebJs editörüne yönlendirme yapar
 */

export class WebTemplateEditor {
    constructor(app) {
        this.app = app;
        this.templateId = null;
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
                <div class="loading-state full-page">
                    <div class="spinner"></div>
                    <p>${this.__('messages.redirecting')}</p>
                </div>
        `;
    }

    /**
     * Sayfa başlatma - VvvebJs editörüne yönlendir
     */
    async init() {
        // URL'den template ID al
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        this.templateId = urlParams.get('id');

        // Editöre yönlendir
        const basePath = this.app.config.basePath || '';
        const editorUrl = this.templateId
            ? `${basePath}/html-editor/?id=${this.templateId}`
            : `${basePath}/html-editor/`;

        // Kısa bir gecikme ile yönlendir (UX için)
        setTimeout(() => {
            window.location.href = editorUrl;
        }, 300);
    }

    /**
     * Sayfa temizleme
     */
    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}

export default WebTemplateEditor;
