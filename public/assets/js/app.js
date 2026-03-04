/**
 * Omnex Display Hub - Main Application
 *
 * @package OmnexDisplayHub
 * @version 1.0.0
 */

import { Router } from './core/Router.js';
import { State } from './core/State.js';
import { Api } from './core/Api.js';
import { Auth } from './core/Auth.js';
import { i18n } from './core/i18n.js';
import { Logger } from './core/Logger.js';
import { StyleLoader } from './core/StyleLoader.js';
import { LayoutManager } from './layouts/LayoutManager.js';
import { Toast } from './components/Toast.js';
import { Modal } from './components/Modal.js';
import { PwaInstallPrompt } from './components/PwaInstallPrompt.js';

// Cache buster version - update when deploying
const APP_VERSION = '1.0.59';

// Development mode detection
const isDevelopment = () => {
    const hostname = window.location.hostname;
    return hostname === 'localhost' ||
           hostname === '127.0.0.1' ||
           hostname.startsWith('192.168.') ||
           hostname.startsWith('10.') ||
           hostname.endsWith('.local');
};

// Get cache buster - timestamp in dev, version in prod
const getCacheBuster = () => isDevelopment() ? Date.now() : APP_VERSION;

class App {
    constructor() {
        this.config = window.OmnexConfig || {};
        this.version = APP_VERSION;
        this.router = null;
        this.state = null;
        this.api = null;
        this.auth = null;
        this.layout = null;
        this.i18n = null;
    }

    /**
     * Initialize application
     */
    async init() {
        // Set timeout to hide loading screen after 10 seconds max
        const loadingTimeout = setTimeout(() => {
            Logger.warn('App: Initialization timeout, hiding loading screen');
            this.hideLoadingScreen();
        }, 10000);

        try {
            Logger.log('Omnex Display Hub initializing...');
            Logger.debug('Config:', this.config);

            // Ensure stylesheets are loaded before proceeding
            await StyleLoader.ensureStylesLoaded();
            Logger.debug('Stylesheets loaded');

            // Clean up any stale modals from previous session/refresh
            Modal.closeAll(true);

            // Register components globally for Api.js and other non-import contexts
            window.OmnexComponents = { Toast, Modal };

            // Initialize core modules
            this.state = new State();
            this.api = new Api(this.config.apiUrl);
            Logger.debug('API initialized with URL:', this.config.apiUrl);
            this.auth = new Auth(this.api, this.state);
            this.i18n = new i18n();
            this.router = new Router(this);
            this.layout = new LayoutManager(this);

            // OPTIMIZATION: Load translations and check auth in PARALLEL
            // This saves ~500ms on initial load
            Logger.debug('Loading translations and checking auth in parallel...');

            let isAuthenticated = false;

            try {
                const [, authResult] = await Promise.all([
                    // i18n load with timeout
                    Promise.race([
                        this.i18n.load(this.i18n.locale),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Translation timeout')), 5000))
                    ]).catch(e => {
                        Logger.warn('Translation load failed or timeout, continuing...', e);
                        return null;
                    }),

                    // Auth check with timeout
                    Promise.race([
                        this.auth.check(),
                        new Promise((resolve) => setTimeout(() => {
                            Logger.warn('Auth check timeout, assuming not authenticated');
                            resolve(false);
                        }, 5000))
                    ]).catch(e => {
                        Logger.warn('Auth check failed, assuming not authenticated', e);
                        return false;
                    })
                ]);

                isAuthenticated = authResult || false;
            } catch (e) {
                Logger.warn('Parallel init failed:', e);
                isAuthenticated = false;
            }

            Logger.debug('Authentication result:', isAuthenticated);

            // Load user settings (currency, timezone, etc.) for formatting
            if (isAuthenticated) {
                try {
                    await this.loadUserSettings();
                } catch (e) {
                    Logger.warn('Failed to load user settings:', e);
                }
            }

            // Preload other languages in idle time (non-blocking)
            this.i18n.preloadOtherLanguages();

            // Initialize layout (must await to ensure selectors are ready)
            await this.layout.init();

            // Initialize PWA install prompt
            this.pwaPrompt = new PwaInstallPrompt();
            await this.pwaPrompt.init();

            // Setup routes
            this.setupRoutes();

            // Clear timeout since we completed successfully
            clearTimeout(loadingTimeout);

            // Hide loading screen
            this.hideLoadingScreen();

            // Determine correct initial route based on auth state BEFORE starting router
            const currentHash = window.location.hash.replace('#', '') || '/dashboard';
            let targetRoute = currentHash;

            if (isAuthenticated) {
                // Authenticated user trying to access login/register -> redirect to dashboard
                if (currentHash === '/login' || currentHash === '/register') {
                    targetRoute = '/dashboard';
                }
            } else {
                // Not authenticated -> redirect to login unless on public route
                const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
                if (!publicRoutes.includes(currentHash)) {
                    targetRoute = '/login';
                }
            }

            // Set the correct hash BEFORE starting router (prevents double load)
            if (targetRoute !== currentHash) {
                window.location.hash = '#' + targetRoute;
            }

            // Start router - this will load the page once
            this.router.start();

            Logger.log('Omnex Display Hub initialized successfully');

        } catch (error) {
            Logger.error('Initialization error:', error);
            clearTimeout(loadingTimeout);
            this.hideLoadingScreen();

            // Show error but continue
            try {
                Toast.error(this.i18n?.t('messages.appInitError') || 'Application error');
            } catch (e) {
                // Toast might not be available yet
                Logger.error('Could not show error toast:', e);
            }

            // Still try to start router so user can at least see something
            try {
                this.router.start();
                this.router.navigate('/login');
            } catch (e) {
                Logger.error('Could not start router:', e);
            }
        }
    }

    /**
     * Load user settings into state/localStorage
     */
    async loadUserSettings() {
        const response = await this.api.get('/settings');
        if (response.success && response.data) {
            this.state.set('settings', response.data, true);
            localStorage.setItem('omnex_settings', JSON.stringify(response.data));
        }
    }

    /**
     * Setup application routes
     */
    setupRoutes() {
        // Public routes (auth pages - hide layout)
        this.router.addRoute('/login', () => this.loadAuthPage('auth/Login'));
        this.router.addRoute('/register', () => this.loadAuthPage('auth/Register'));
        this.router.addRoute('/forgot-password', () => this.loadAuthPage('auth/ForgotPassword'));
        this.router.addRoute('/reset-password', () => this.loadAuthPage('auth/ResetPassword'));

        // Protected routes
        this.router.addRoute('/', () => this.loadProtectedPage('Dashboard'));
        this.router.addRoute('/dashboard', () => this.loadProtectedPage('Dashboard'));
        this.router.addRoute('/products', () => this.loadProtectedPage('products/ProductList'));
        this.router.addRoute('/products/new', () => this.loadProtectedPage('products/ProductForm'));
        this.router.addRoute('/products/import', () => this.loadProtectedPage('products/ProductImport'));
        this.router.addRoute('/products/kunye-distribution', () => this.loadProtectedPage('hal/KunyeDistribution'));
        this.router.addRoute('/products/:id', () => this.loadProtectedPage('products/ProductDetail'));
        this.router.addRoute('/products/:id/edit', () => this.loadProtectedPage('products/ProductForm'));

        // Bundles (Paket/Koli/Menü)
        this.router.addRoute('/bundles', () => this.loadProtectedPage('bundles/BundleList'));
        this.router.addRoute('/bundles/new', () => this.loadProtectedPage('bundles/BundleForm'));
        this.router.addRoute('/bundles/:id', () => this.loadProtectedPage('bundles/BundleForm'));
        this.router.addRoute('/bundles/:id/edit', () => this.loadProtectedPage('bundles/BundleForm'));

        this.router.addRoute('/templates', () => this.loadProtectedPage('templates/TemplateList'));
        this.router.addRoute('/templates/editor', () => this.loadProtectedPage('templates/EditorWrapper'));
        this.router.addRoute('/templates/:id/edit', () => this.loadProtectedPage('templates/EditorWrapper'));
        this.router.addRoute('/media', () => this.loadProtectedPage('media/MediaLibrary'));
        this.router.addRoute('/devices', () => this.loadProtectedPage('devices/DeviceList'));
        this.router.addRoute('/devices/groups', () => this.loadProtectedPage('devices/DeviceGroups'));
        this.router.addRoute('/devices/:id', () => this.loadProtectedPage('devices/DeviceDetail'));
        this.router.addRoute('/signage', () => this.loadProtectedPage('signage/PlaylistList'));
        this.router.addRoute('/signage/playlists', () => this.loadProtectedPage('signage/PlaylistList'));
        this.router.addRoute('/signage/playlists/ops', () => this.loadProtectedPage('signage/PlaylistListOps'));
        this.router.addRoute('/signage/playlists/cards', () => this.loadProtectedPage('signage/PlaylistListCards'));
        this.router.addRoute('/signage/playlists/studio', () => this.loadProtectedPage('signage/PlaylistListStudio'));
        this.router.addRoute('/signage/playlists/new', () => this.loadProtectedPage('signage/PlaylistDetail'));
        this.router.addRoute('/signage/playlists/:id', () => this.loadProtectedPage('signage/PlaylistDetail'));
        this.router.addRoute('/signage/schedules', () => this.loadProtectedPage('signage/ScheduleList'));
        this.router.addRoute('/signage/schedules/new', () => this.loadProtectedPage('signage/ScheduleForm'));
        this.router.addRoute('/signage/schedules/:id', () => this.loadProtectedPage('signage/ScheduleForm'));
        this.router.addRoute('/categories', () => this.loadProtectedPage('categories/CategoryList'));
        this.router.addRoute('/reports', () => this.loadProtectedPage('reports/DashboardAnalytics'));
        this.router.addRoute('/profile', () => this.loadProtectedPage('settings/Profile'));
        this.router.addRoute('/settings', () => this.loadProtectedPage('settings/GeneralSettings'));
        this.router.addRoute('/settings/users', () => this.loadProtectedPage('settings/UserSettings'));
        this.router.addRoute('/settings/integrations', () => this.loadProtectedPage('settings/IntegrationSettings'));
        this.router.addRoute('/settings/gateways', () => this.loadProtectedPage('settings/GatewaySettings'));
        this.router.addRoute('/settings/labels', () => this.loadProtectedPage('settings/LabelSettings'));

        // Notifications
        this.router.addRoute('/notifications', () => this.loadProtectedPage('notifications/NotificationList'));
        this.router.addRoute('/notifications/settings', () => this.loadProtectedPage('notifications/NotificationSettings'));

        // Web Templates (VvvebJs HTML Editor)
        this.router.addRoute('/web-templates', () => this.loadProtectedPage('web-templates/WebTemplateList'));
        this.router.addRoute('/web-templates/new', () => this.loadProtectedPage('web-templates/WebTemplateEditor'));
        this.router.addRoute('/web-templates/:id/edit', () => this.loadProtectedPage('web-templates/WebTemplateEditor'));

        // Admin routes
        this.router.addRoute('/admin/users', () => this.loadAdminPage('admin/UserManagement'));
        this.router.addRoute('/admin/companies', () => this.loadAdminPage('admin/CompanyManagement'));
        this.router.addRoute('/admin/licenses', () => this.loadAdminPage('admin/LicenseManagement'));
        this.router.addRoute('/admin/licenses/plans/new', () => this.loadAdminPage('admin/LicensePlanForm'));
        this.router.addRoute('/admin/licenses/plans/:id/edit', () => this.loadAdminPage('admin/LicensePlanForm'));
        this.router.addRoute('/admin/audit-log', () => this.loadAdminPage('admin/AuditLog'));
        this.router.addRoute('/admin/system-status', () => this.loadAdminPage('admin/SystemStatus'));
        this.router.addRoute('/admin/logs', () => this.loadAdminPage('admin/LogManagement'));
        this.router.addRoute('/admin/setup-wizard', () => this.loadAdminPage('admin/SetupWizard'));
        this.router.addRoute('/admin/queue', () => this.loadAdminPage('queue/QueueDashboard'));
        this.router.addRoute('/admin/branches', () => this.loadAdminPage('admin/BranchManagement'));

        // About page (all users)
        this.router.addRoute('/about', () => this.loadProtectedPage('About'));

        // Payment result page
        this.router.addRoute('/payments/result', () => this.loadProtectedPage('payments/PaymentResult'));

        // 404
        this.router.setNotFound(() => this.loadPage('errors/NotFound'));
    }

    /**
     * Load page module
     */
    async loadPage(pageName, options = {}) {
        try {
            // Cleanup previous page first
            if (this.currentPage && typeof this.currentPage.destroy === 'function') {
                this.currentPage.destroy();
            }

            // Close all open modals before loading new page
            this.closeAllModals();

            const module = await import(`./pages/${pageName}.js?v=${getCacheBuster()}`);
            let PageClass = module.default;

            // Fallback: if no default export, try first named export that is a class
            if (!PageClass) {
                const namedExport = Object.values(module).find(v => typeof v === 'function');
                if (namedExport) {
                    PageClass = namedExport;
                }
            }

            if (!PageClass || typeof PageClass !== 'function') {
                throw new Error(`Page module "${pageName}" has no valid export`);
            }

            const page = new PageClass(this, options);

            // Preload resources (translations, etc.) before rendering
            if (typeof page.preload === 'function') {
                await page.preload();
            }

            // Get content container
            const container = document.getElementById('page-content') || document.getElementById('app');

            // Render page
            const html = page.render();
            container.innerHTML = html;

            // Initialize page if method exists
            if (typeof page.init === 'function') {
                await page.init();
            }

            // Store current page
            this.currentPage = page;

        } catch (error) {
            Logger.error(`Error loading page ${pageName}:`, error);
            this.showError(this.i18n?.t('messages.pageLoadError') || 'Page load error');
        }
    }

    /**
     * Close all open modals
     * @param {boolean} immediate - Skip animation for faster cleanup
     */
    closeAllModals(immediate = true) {
        // Use Modal class method to properly close all modals
        // This clears both DOM, ESC handlers, and internal activeModals array
        Modal.closeAll(immediate);
    }

    /**
     * Load auth page (login, register, etc.) - hides layout
     */
    async loadAuthPage(pageName) {
        // Hide layout and show full-screen auth page
        this.layout.hideLayout();

        try {
            // Cleanup previous page first
            if (this.currentPage && typeof this.currentPage.destroy === 'function') {
                this.currentPage.destroy();
            }

            const module = await import(`./pages/${pageName}.js?v=${getCacheBuster()}`);
            const PageClass = module.default;
            const page = new PageClass(this);

            // Preload resources (translations, etc.) before rendering
            if (typeof page.preload === 'function') {
                await page.preload();
            }

            // Render directly in app container (not page-content)
            const container = document.getElementById('app');
            container.innerHTML = page.render();

            // Initialize page
            if (typeof page.init === 'function') {
                await page.init();
            }

            // Store current page
            this.currentPage = page;

        } catch (error) {
            Logger.error(`Error loading auth page ${pageName}:`, error);
            this.showError(this.i18n?.t('messages.pageLoadError') || 'Page load error');
        }
    }

    /**
     * Load protected page (requires authentication)
     * @param {string} pageName - Page module name
     * @param {Object} options - Optional page options (passed to page constructor)
     */
    async loadProtectedPage(pageName, options = {}) {
        if (!this.auth.isAuthenticated()) {
            this.router.navigate('/login', { redirect: window.location.pathname });
            return;
        }

        // Await showLayout to ensure icon fonts are loaded before rendering
        await this.layout.showLayout();
        await this.loadPage(pageName, options);
    }

    /**
     * Load admin page (requires admin role)
     */
    async loadAdminPage(pageName) {
        if (!this.auth.isAuthenticated()) {
            this.router.navigate('/login');
            return;
        }

        if (!this.auth.hasRole(['SuperAdmin', 'Admin'])) {
            Toast.error(this.i18n?.t('messages.accessDenied') || 'Access denied');
            this.router.navigate('/dashboard');
            return;
        }

        // Await showLayout to ensure icon fonts are loaded before rendering
        await this.layout.showLayout();
        await this.loadPage(pageName);
    }

    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => loadingScreen.remove(), 300);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="flex items-center justify-center h-screen">
                <div class="text-center">
                    <div class="text-6xl mb-4">⚠️</div>
                    <h1 class="text-xl font-semibold mb-2">${this.i18n?.t('messages.errorOccurred') || 'Error'}</h1>
                    <p class="text-gray-500">${message}</p>
                    <button onclick="location.reload()" class="btn btn-primary mt-4">
                        ${this.i18n?.t('messages.refreshPage') || 'Refresh'}
                    </button>
                </div>
            </div>
        `;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});

export default App;
