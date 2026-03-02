/**
 * 404 Not Found Page
 *
 * @package OmnexDisplayHub
 */

export class NotFoundPage {
    constructor(app) {
        this.app = app;
    }

    /**
     * Render page
     */
    render() {
        const __ = (key) => (typeof window.__ === 'function' ? window.__(key) : null);

        return `
            <div class="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                <div class="text-center px-4">
                    <div class="text-8xl font-bold text-gray-300 dark:text-gray-700 mb-4">404</div>
                    <h1 class="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                        ${__('notFound.title') || 'Sayfa Bulunamadı'}
                    </h1>
                    <p class="text-gray-600 dark:text-gray-400 mb-8">
                        ${__('notFound.description') || 'Aradığınız sayfa mevcut değil veya taşınmış olabilir.'}
                    </p>
                    <div class="flex items-center justify-center gap-4">
                        <a href="#/dashboard" class="btn btn-primary">
                            <i class="ti ti-home"></i>
                            ${__('notFound.home') || 'Ana Sayfa'}
                        </a>
                        <button onclick="history.back()" class="btn btn-outline">
                            <i class="ti ti-arrow-left"></i>
                            ${__('notFound.back') || 'Geri Dön'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Initialize page
     */
    init() {
        // No initialization needed
    }

    /**
     * Cleanup
     */
    destroy() {}
}

export default NotFoundPage;
