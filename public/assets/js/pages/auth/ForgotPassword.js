/**
 * Forgot Password Page Component
 */

import { Toast } from '../../components/Toast.js';
import { AuthToolbar } from './AuthToolbar.js';

export class ForgotPasswordPage {
    constructor(app) {
        this.app = app;
        this.submitted = false;
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

                        <!-- Content -->
                        <div id="form-container">
                            ${this.renderForm()}
                        </div>

                        <!-- Back to Login -->
                        <div class="auth-footer" style="margin-top: var(--space-6);">
                            <a href="#/login">
                                <i class="ti ti-arrow-left"></i>
                                ${this.__('forgotPassword.backToLogin')}
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Branding Side -->
                <div class="auth-side">
                    <div class="auth-side-content">
                        <h2 class="auth-side-title">OmneX Display Hub</h2>
                        <p class="auth-side-text">
                            ${this.__('forgotPassword.features.title')}
                        </p>
                        <ul class="auth-side-features">
                            <li class="auth-side-feature">
                                <i class="ti ti-device-desktop"></i>
                                <span>${this.__('forgotPassword.features.esl')}</span>
                            </li>
                            <li class="auth-side-feature">
                                <i class="ti ti-device-tv"></i>
                                <span>${this.__('forgotPassword.features.signage')}</span>
                            </li>
                            <li class="auth-side-feature">
                                <i class="ti ti-brush"></i>
                                <span>${this.__('forgotPassword.features.editor')}</span>
                            </li>
                            <li class="auth-side-feature">
                                <i class="ti ti-cloud-upload"></i>
                                <span>${this.__('forgotPassword.features.content')}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    renderForm() {
        if (this.submitted) {
            return `
                <div class="auth-success">
                    <div class="auth-success-icon">
                        <i class="ti ti-mail-check"></i>
                    </div>
                    <h2 class="auth-title">${this.__('forgotPassword.successTitle')}</h2>
                    <p class="auth-subtitle">
                        ${this.__('forgotPassword.successMessage')}
                    </p>
                    <p class="auth-hint">
                        ${this.__('forgotPassword.spamHint')}
                        <button type="button" id="resend-btn" class="link-btn">
                            ${this.__('forgotPassword.resendLink')}
                        </button>
                    </p>
                </div>
            `;
        }

        return `
            <div class="auth-header">
                <h2 class="auth-title">${this.__('forgotPassword.title')}</h2>
                <p class="auth-subtitle">
                    ${this.__('forgotPassword.subtitle')}
                </p>
            </div>

            <form id="forgot-form" class="auth-form">
                <div class="form-group">
                    <label class="form-label">${this.__('forgotPassword.fields.email')}</label>
                    <div class="input-icon-wrapper">
                        <span class="input-icon-left">
                            <i class="ti ti-mail"></i>
                        </span>
                        <input
                            type="email"
                            id="email"
                            class="form-input has-icon-left"
                            placeholder="${this.__('forgotPassword.placeholders.email')}"
                            required
                        >
                    </div>
                </div>

                <button type="submit" id="submit-btn" class="btn btn-primary auth-submit">
                    <span class="btn-text">${this.__('forgotPassword.submit')}</span>
                    <span class="btn-loading" style="display: none;">
                        <i class="ti ti-loader-2 animate-spin"></i>
                        ${this.__('forgotPassword.submitting')}
                    </span>
                </button>
            </form>
        `;
    }

    async init() {
        window.forgotPasswordPage = this;
        this.bindEvents();
        this.authToolbar.init();
    }

    bindEvents() {
        document.getElementById('forgot-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submit();
        });

        document.getElementById('resend-btn')?.addEventListener('click', () => {
            this.resend();
        });
    }

    async submit() {
        const email = document.getElementById('email')?.value;
        if (!email) return;

        const btn = document.getElementById('submit-btn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoading = btn.querySelector('.btn-loading');

        btn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';

        try {
            await this.app.api.post('/auth/forgot-password', { email });
            this.submitted = true;
            this.submittedEmail = email;
            document.getElementById('form-container').innerHTML = this.renderForm();
            this.bindEvents();
        } catch (error) {
            Toast.error(error.message || this.__('forgotPassword.toast.error'));
            btn.disabled = false;
            btnText.style.display = '';
            btnLoading.style.display = 'none';
        }
    }

    async resend() {
        if (!this.submittedEmail) return;

        try {
            await this.app.api.post('/auth/forgot-password', { email: this.submittedEmail });
            Toast.success(this.__('forgotPassword.toast.resent'));
        } catch (error) {
            Toast.error(this.__('forgotPassword.toast.resendFailed'));
        }
    }

    destroy() {
        window.forgotPasswordPage = null;
        this.app.i18n.clearPageTranslations();
        this.authToolbar.destroy();
    }
}

export default ForgotPasswordPage;
