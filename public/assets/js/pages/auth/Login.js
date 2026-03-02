/**
 * Login Page Component
 *
 * @package OmnexDisplayHub
 */

import { Toast } from '../../components/Toast.js';
import { AuthToolbar } from './AuthToolbar.js';

export class LoginPage {
    constructor(app) {
        this.app = app;
        this.isLoading = false;
        this.authToolbar = new AuthToolbar(app);
    }

    /**
     * i18n helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('auth');
    }

    /**
     * Render login page
     */
    render() {
        const basePath = window.OmnexConfig?.basePath || '';

        return `
            ${this.authToolbar.render()}
            <div class="auth-layout">
                <!-- Auth Form Side -->
                <div class="auth-container">
                    <div class="auth-wrapper">
                        <!-- Logo -->
                        <div class="auth-logo">
                            <div class="auth-logo-icon">
                                <img src="${basePath}/branding/icon-192.png" alt="OmneX">
                            </div>
                            <span class="auth-logo-text">OmneX Display Hub</span>
                        </div>

                        <!-- Header -->
                        <div class="auth-header">
                            <h2 class="auth-title">${this.__('login.title')}</h2>
                            <p class="auth-subtitle">${this.__('login.subtitle')}</p>
                        </div>

                        <!-- Login Form -->
                        <form id="login-form" class="auth-form">
                            <!-- Email -->
                            <div class="form-group">
                                <label for="email" class="form-label">${this.__('login.fields.email')}</label>
                                <div class="input-icon-wrapper">
                                    <span class="input-icon-left">
                                        <i class="ti ti-mail"></i>
                                    </span>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        class="form-input has-icon-left"
                                        placeholder="${this.__('login.placeholders.email')}"
                                        required
                                        autocomplete="email"
                                    />
                                </div>
                                <span class="form-error" id="email-error"></span>
                            </div>

                            <!-- Password -->
                            <div class="form-group">
                                <label for="password" class="form-label">${this.__('login.fields.password')}</label>
                                <div class="password-input-wrapper">
                                    <span class="input-icon-left">
                                        <i class="ti ti-lock"></i>
                                    </span>
                                    <input
                                        type="password"
                                        id="password"
                                        name="password"
                                        class="form-input has-icon-left"
                                        placeholder="••••••••"
                                        required
                                        autocomplete="current-password"
                                    />
                                    <button type="button" id="toggle-password" class="password-toggle">
                                        <i class="ti ti-eye"></i>
                                    </button>
                                </div>
                                <span class="form-error" id="password-error"></span>
                            </div>

                            <!-- Remember & Forgot -->
                            <div class="auth-form-options">
                                <label class="auth-remember">
                                    <input type="checkbox" id="remember" name="remember" />
                                    <span>${this.__('login.rememberMe')}</span>
                                </label>
                                <a href="#/forgot-password" class="auth-forgot-link">
                                    ${this.__('login.forgotPassword')}
                                </a>
                            </div>

                            <!-- Submit -->
                            <button type="submit" id="submit-btn" class="btn btn-primary auth-submit">
                                <span class="btn-text">${this.__('login.submit')}</span>
                                <span class="btn-loading" style="display: none;">
                                    <i class="ti ti-loader-2 animate-spin"></i>
                                    ${this.__('login.submitting')}
                                </span>
                            </button>
                        </form>

                        <!-- Divider -->
                        <div class="auth-divider">${this.__('login.orDivider')}</div>

                        <!-- Register Link -->
                        <div class="auth-footer">
                            ${this.__('login.noAccount')}
                            <a href="#/register">${this.__('register.title')}</a>
                        </div>
                    </div>
                </div>

                <!-- Branding Side -->
                <div class="auth-side">
                    <div class="auth-side-content">
                        <h2 class="auth-side-title">OmneX Display Hub</h2>
                        <p class="auth-side-text">
                            ${this.__('login.features.title')}
                        </p>
                        <ul class="auth-side-features">
                            <li class="auth-side-feature">
                                <i class="ti ti-device-desktop"></i>
                                <span>${this.__('login.features.esl.title')}</span>
                            </li>
                            <li class="auth-side-feature">
                                <i class="ti ti-device-tv"></i>
                                <span>${this.__('login.features.signage.title')}</span>
                            </li>
                            <li class="auth-side-feature">
                                <i class="ti ti-brush"></i>
                                <span>${this.__('login.features.editor.title')}</span>
                            </li>
                            <li class="auth-side-feature">
                                <i class="ti ti-cloud-upload"></i>
                                <span>${this.__('login.features.content.title')}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Initialize page after render
     */
    init() {
        this.form = document.getElementById('login-form');
        this.submitBtn = document.getElementById('submit-btn');
        this.togglePasswordBtn = document.getElementById('toggle-password');

        this.bindEvents();
        this.authToolbar.init();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Form submit
        this.form?.addEventListener('submit', (e) => this.handleSubmit(e));

        // Toggle password visibility
        this.togglePasswordBtn?.addEventListener('click', () => this.togglePassword());

        // Clear errors on input
        this.form?.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => this.clearError(input.name));
        });
    }

    /**
     * Toggle password visibility
     */
    togglePassword() {
        const passwordInput = document.getElementById('password');
        const icon = this.togglePasswordBtn.querySelector('i');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.className = 'ti ti-eye-off';
        } else {
            passwordInput.type = 'password';
            icon.className = 'ti ti-eye';
        }
    }

    /**
     * Handle form submit
     */
    async handleSubmit(e) {
        e.preventDefault();

        if (this.isLoading) return;

        // Get form data
        const formData = new FormData(this.form);
        const email = formData.get('email')?.trim();
        const password = formData.get('password');
        const remember = formData.get('remember') === 'on';

        // Validate
        let hasError = false;

        if (!email) {
            this.showError('email', this.__('validation.emailRequired'));
            hasError = true;
        } else if (!this.isValidEmail(email)) {
            this.showError('email', this.__('validation.emailInvalid'));
            hasError = true;
        }

        if (!password) {
            this.showError('password', this.__('validation.passwordRequired'));
            hasError = true;
        } else if (password.length < 6) {
            this.showError('password', this.__('validation.passwordMinLength'));
            hasError = true;
        }

        if (hasError) return;

        // Submit
        this.setLoading(true);

        try {
            await this.app.auth.login(email, password, remember);

            // Load layout config from API (includes company defaults)
            // This ensures that even in a new browser, company defaults are applied
            if (this.app.layout) {
                await this.app.layout.loadConfigFromApiWithPriority();
            }

            Toast.success(this.__('login.toast.success'));

            // Redirect to dashboard
            setTimeout(() => {
                window.location.hash = '#/dashboard';
            }, 500);

        } catch (error) {
            const message = error.message || this.__('login.toast.error');
            Toast.error(message);

            // Show field-specific errors if available
            if (error.errors) {
                Object.entries(error.errors).forEach(([field, messages]) => {
                    this.showError(field, messages[0]);
                });
            }
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Set loading state
     */
    setLoading(loading) {
        this.isLoading = loading;

        if (loading) {
            this.submitBtn.disabled = true;
            this.submitBtn.querySelector('.btn-text').style.display = 'none';
            this.submitBtn.querySelector('.btn-loading').style.display = 'flex';
        } else {
            this.submitBtn.disabled = false;
            this.submitBtn.querySelector('.btn-text').style.display = '';
            this.submitBtn.querySelector('.btn-loading').style.display = 'none';
        }
    }

    /**
     * Show field error
     */
    showError(field, message) {
        const input = document.getElementById(field);
        const errorEl = document.getElementById(`${field}-error`);

        if (input) {
            input.classList.add('has-error');
        }

        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('visible');
        }
    }

    /**
     * Clear field error
     */
    clearError(field) {
        const input = document.getElementById(field);
        const errorEl = document.getElementById(`${field}-error`);

        if (input) {
            input.classList.remove('has-error');
        }

        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('visible');
        }
    }

    /**
     * Validate email format
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Cleanup on unmount
     */
    destroy() {
        this.app.i18n.clearPageTranslations();
        this.authToolbar.destroy();
    }
}

export default LoginPage;
