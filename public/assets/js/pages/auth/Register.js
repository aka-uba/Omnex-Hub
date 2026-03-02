/**
 * Register Page Component
 *
 * @package OmnexDisplayHub
 */

import { Toast } from '../../components/Toast.js';
import { AuthToolbar } from './AuthToolbar.js';

export class RegisterPage {
    constructor(app) {
        this.app = app;
        this.isLoading = false;
        this.step = 1;
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
     * Render register page
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
                            <h2 class="auth-title">${this.__('register.subtitle')}</h2>
                            <p class="auth-subtitle">${this.__('register.subtitleFree')}</p>
                        </div>

                        <!-- Register Form -->
                        <form id="register-form" class="auth-form">
                            <!-- Company Name -->
                            <div class="form-group">
                                <label for="company_name" class="form-label">${this.__('register.fields.companyName')}</label>
                                <div class="input-icon-wrapper">
                                    <span class="input-icon-left">
                                        <i class="ti ti-building"></i>
                                    </span>
                                    <input
                                        type="text"
                                        id="company_name"
                                        name="company_name"
                                        class="form-input has-icon-left"
                                        placeholder="${this.__('register.placeholders.companyName')}"
                                        required
                                    />
                                </div>
                                <span class="form-error" id="company_name-error"></span>
                            </div>

                            <!-- Name Fields -->
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="first_name" class="form-label">${this.__('register.fields.firstName')}</label>
                                    <input
                                        type="text"
                                        id="first_name"
                                        name="first_name"
                                        class="form-input"
                                        placeholder="${this.__('register.placeholders.firstName')}"
                                        required
                                    />
                                    <span class="form-error" id="first_name-error"></span>
                                </div>
                                <div class="form-group">
                                    <label for="last_name" class="form-label">${this.__('register.fields.lastName')}</label>
                                    <input
                                        type="text"
                                        id="last_name"
                                        name="last_name"
                                        class="form-input"
                                        placeholder="${this.__('register.placeholders.lastName')}"
                                        required
                                    />
                                    <span class="form-error" id="last_name-error"></span>
                                </div>
                            </div>

                            <!-- Email -->
                            <div class="form-group">
                                <label for="email" class="form-label">${this.__('register.fields.email')}</label>
                                <div class="input-icon-wrapper">
                                    <span class="input-icon-left">
                                        <i class="ti ti-mail"></i>
                                    </span>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        class="form-input has-icon-left"
                                        placeholder="${this.__('register.placeholders.email')}"
                                        required
                                        autocomplete="email"
                                    />
                                </div>
                                <span class="form-error" id="email-error"></span>
                            </div>

                            <!-- Password -->
                            <div class="form-group">
                                <label for="password" class="form-label">${this.__('register.fields.password')}</label>
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
                                        autocomplete="new-password"
                                    />
                                    <button type="button" id="toggle-password" class="password-toggle">
                                        <i class="ti ti-eye"></i>
                                    </button>
                                </div>
                                <span class="form-error" id="password-error"></span>
                                <div class="password-strength" id="password-strength"></div>
                            </div>

                            <!-- Password Confirm -->
                            <div class="form-group">
                                <label for="password_confirm" class="form-label">${this.__('register.fields.confirmPassword')}</label>
                                <div class="input-icon-wrapper">
                                    <span class="input-icon-left">
                                        <i class="ti ti-lock-check"></i>
                                    </span>
                                    <input
                                        type="password"
                                        id="password_confirm"
                                        name="password_confirm"
                                        class="form-input has-icon-left"
                                        placeholder="••••••••"
                                        required
                                        autocomplete="new-password"
                                    />
                                </div>
                                <span class="form-error" id="password_confirm-error"></span>
                            </div>

                            <!-- Terms -->
                            <div class="form-group">
                                <label class="auth-terms">
                                    <input type="checkbox" id="terms" name="terms" required />
                                    <span>
                                        <a href="#/terms">${this.__('register.terms.termsLink')}</a>
                                        ${this.__('register.terms.and')}
                                        <a href="#/privacy">${this.__('register.terms.privacyLink')}</a>
                                        ${this.__('register.terms.read')} ${this.__('register.terms.accept')}.
                                    </span>
                                </label>
                                <span class="form-error" id="terms-error"></span>
                            </div>

                            <!-- Submit -->
                            <button type="submit" id="submit-btn" class="btn btn-primary auth-submit">
                                <span class="btn-text">${this.__('register.submit')}</span>
                                <span class="btn-loading" style="display: none;">
                                    <i class="ti ti-loader-2 animate-spin"></i>
                                    ${this.__('register.submitting')}
                                </span>
                            </button>
                        </form>

                        <!-- Divider -->
                        <div class="auth-divider">${this.__('register.orDivider')}</div>

                        <!-- Login Link -->
                        <div class="auth-footer">
                            ${this.__('register.hasAccount')}
                            <a href="#/login">${this.__('login.title')}</a>
                        </div>
                    </div>
                </div>

                <!-- Branding Side -->
                <div class="auth-side">
                    <div class="auth-side-content">
                        <h2 class="auth-side-title">OmneX Display Hub</h2>
                        <p class="auth-side-text">
                            ${this.__('register.features.title')}
                        </p>
                        <ul class="auth-side-features">
                            <li class="auth-side-feature">
                                <i class="ti ti-device-desktop"></i>
                                <span>${this.__('register.features.esl.title')}</span>
                            </li>
                            <li class="auth-side-feature">
                                <i class="ti ti-device-tv"></i>
                                <span>${this.__('register.features.signage.title')}</span>
                            </li>
                            <li class="auth-side-feature">
                                <i class="ti ti-brush"></i>
                                <span>${this.__('register.features.editor.title')}</span>
                            </li>
                            <li class="auth-side-feature">
                                <i class="ti ti-cloud-upload"></i>
                                <span>${this.__('register.features.content.title')}</span>
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
        this.form = document.getElementById('register-form');
        this.submitBtn = document.getElementById('submit-btn');
        this.togglePasswordBtn = document.getElementById('toggle-password');
        this.passwordInput = document.getElementById('password');

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

        // Password strength indicator
        this.passwordInput?.addEventListener('input', (e) => this.updatePasswordStrength(e.target.value));

        // Clear errors on input
        this.form?.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => this.clearError(input.name));
        });
    }

    /**
     * Toggle password visibility
     */
    togglePassword() {
        const icon = this.togglePasswordBtn.querySelector('i');

        if (this.passwordInput.type === 'password') {
            this.passwordInput.type = 'text';
            icon.className = 'ti ti-eye-off';
        } else {
            this.passwordInput.type = 'password';
            icon.className = 'ti ti-eye';
        }
    }

    /**
     * Update password strength indicator
     */
    updatePasswordStrength(password) {
        const container = document.getElementById('password-strength');
        if (!container) return;

        const strength = this.calculatePasswordStrength(password);
        const levels = [
            this.__('register.passwordStrength.veryWeak'),
            this.__('register.passwordStrength.weak'),
            this.__('register.passwordStrength.medium'),
            this.__('register.passwordStrength.strong'),
            this.__('register.passwordStrength.veryStrong')
        ];
        const classes = ['weak', 'weak', 'fair', 'good', 'strong'];

        if (password.length === 0) {
            container.innerHTML = '';
            container.className = 'password-strength';
            return;
        }

        container.className = `password-strength ${classes[strength]}`;
        container.innerHTML = `
            <div class="password-strength-bar">
                <div class="password-strength-segment"></div>
                <div class="password-strength-segment"></div>
                <div class="password-strength-segment"></div>
                <div class="password-strength-segment"></div>
            </div>
            <span class="password-strength-text">${levels[strength]}</span>
        `;
    }

    /**
     * Calculate password strength
     */
    calculatePasswordStrength(password) {
        let score = 0;

        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        return Math.min(4, score);
    }

    /**
     * Handle form submit
     */
    async handleSubmit(e) {
        e.preventDefault();

        if (this.isLoading) return;

        // Get form data
        const formData = new FormData(this.form);
        const data = {
            company_name: formData.get('company_name')?.trim(),
            first_name: formData.get('first_name')?.trim(),
            last_name: formData.get('last_name')?.trim(),
            email: formData.get('email')?.trim(),
            password: formData.get('password'),
            password_confirm: formData.get('password_confirm'),
            terms: formData.get('terms') === 'on'
        };

        // Validate
        if (!this.validate(data)) return;

        // Submit
        this.setLoading(true);

        try {
            const response = await this.app.api.post('/auth/register', {
                company_name: data.company_name,
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email,
                password: data.password
            }, { noAuth: true });

            // Save tokens
            this.app.api.saveTokens(response.data.access_token, response.data.refresh_token);
            this.app.auth.setUser(response.data.user);

            Toast.success(this.__('register.toast.success'));

            // Redirect to dashboard
            setTimeout(() => {
                window.location.hash = '#/dashboard';
            }, 500);

        } catch (error) {
            const message = error.message || this.__('register.toast.error');
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
     * Validate form data
     */
    validate(data) {
        let hasError = false;

        // Company name
        if (!data.company_name) {
            this.showError('company_name', this.__('validation.companyRequired'));
            hasError = true;
        } else if (data.company_name.length < 2) {
            this.showError('company_name', this.__('validation.companyMinLength'));
            hasError = true;
        }

        // First name
        if (!data.first_name) {
            this.showError('first_name', this.__('validation.firstNameRequired'));
            hasError = true;
        } else if (data.first_name.length < 2) {
            this.showError('first_name', this.__('validation.firstNameMinLength'));
            hasError = true;
        }

        // Last name
        if (!data.last_name) {
            this.showError('last_name', this.__('validation.lastNameRequired'));
            hasError = true;
        } else if (data.last_name.length < 2) {
            this.showError('last_name', this.__('validation.lastNameMinLength'));
            hasError = true;
        }

        // Email
        if (!data.email) {
            this.showError('email', this.__('validation.emailRequired'));
            hasError = true;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            this.showError('email', this.__('validation.emailInvalid'));
            hasError = true;
        }

        // Password
        if (!data.password) {
            this.showError('password', this.__('validation.passwordRequired'));
            hasError = true;
        } else if (data.password.length < 8) {
            this.showError('password', this.__('validation.passwordMinLength'));
            hasError = true;
        } else if (this.calculatePasswordStrength(data.password) < 2) {
            this.showError('password', this.__('validation.passwordWeak'));
            hasError = true;
        }

        // Password confirm
        if (!data.password_confirm) {
            this.showError('password_confirm', this.__('validation.passwordConfirmRequired'));
            hasError = true;
        } else if (data.password !== data.password_confirm) {
            this.showError('password_confirm', this.__('validation.passwordMismatch'));
            hasError = true;
        }

        // Terms
        if (!data.terms) {
            this.showError('terms', this.__('validation.termsRequired'));
            hasError = true;
        }

        return !hasError;
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
     * Cleanup on unmount
     */
    destroy() {
        this.app.i18n.clearPageTranslations();
        this.authToolbar.destroy();
    }
}

export default RegisterPage;
