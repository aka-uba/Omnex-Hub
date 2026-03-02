/**
 * Reset Password Page Component
 */

import { Toast } from '../../components/Toast.js';

export class ResetPasswordPage {
    constructor(app) {
        this.app = app;
        this.token = null;
        this.success = false;
    }

    render() {
        return `
            <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                <div class="max-w-md w-full">
                    <div class="text-center mb-8">
                        <h1 class="text-3xl font-bold text-primary-600">Omnex</h1>
                        <p class="text-gray-500 mt-2">Display Hub</p>
                    </div>

                    <div class="card">
                        <div class="card-body">
                            <div id="form-container">
                                ${this.renderForm()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderForm() {
        if (this.success) {
            return `
                <div class="text-center py-6">
                    <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="ti ti-check text-3xl text-green-600"></i>
                    </div>
                    <h2 class="text-xl font-semibold mb-2">Sifre Degistirildi</h2>
                    <p class="text-gray-500 mb-6">
                        Sifreniz basariyla degistirildi. Simdi yeni sifrenizle giris yapabilirsiniz.
                    </p>
                    <a href="#/login" class="btn btn-primary">
                        <i class="ti ti-login"></i>
                        Giris Yap
                    </a>
                </div>
            `;
        }

        if (!this.token) {
            return `
                <div class="text-center py-6">
                    <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="ti ti-alert-triangle text-3xl text-red-600"></i>
                    </div>
                    <h2 class="text-xl font-semibold mb-2">Gecersiz Baglanti</h2>
                    <p class="text-gray-500 mb-6">
                        Sifre sifirlama baglantisi gecersiz veya suresi dolmus.
                        Lutfen tekrar deneyin.
                    </p>
                    <a href="#/forgot-password" class="btn btn-primary">
                        <i class="ti ti-refresh"></i>
                        Tekrar Dene
                    </a>
                </div>
            `;
        }

        return `
            <h2 class="text-xl font-semibold mb-2">Yeni Sifre Belirle</h2>
            <p class="text-gray-500 mb-6">
                Lutfen yeni sifrenizi girin.
            </p>

            <form id="reset-form">
                <div class="form-group">
                    <label class="form-label">Yeni Sifre</label>
                    <div class="relative">
                        <i class="ti ti-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input type="password" id="password" class="form-input pl-10" placeholder="••••••••" required minlength="8">
                    </div>
                    <p class="text-xs text-gray-500 mt-1">En az 8 karakter olmali</p>
                </div>

                <div class="form-group">
                    <label class="form-label">Sifre Tekrar</label>
                    <div class="relative">
                        <i class="ti ti-lock-check absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input type="password" id="password_confirmation" class="form-input pl-10" placeholder="••••••••" required>
                    </div>
                </div>

                <div id="error-message" class="hidden bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg p-3 mb-4 text-sm">
                </div>

                <button type="submit" id="submit-btn" class="btn btn-primary w-full">
                    <span id="btn-text">Sifreyi Degistir</span>
                    <span id="btn-loading" class="hidden">
                        <i class="ti ti-loader animate-spin"></i>
                        Kaydediliyor...
                    </span>
                </button>
            </form>
        `;
    }

    async init() {
        window.resetPasswordPage = this;

        // Get token from URL
        const hash = window.location.hash;
        const match = hash.match(/token=([^&]+)/);
        if (match) {
            this.token = match[1];
        }

        // Re-render with token status
        document.getElementById('form-container').innerHTML = this.renderForm();
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('reset-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submit();
        });

        // Real-time password match validation
        document.getElementById('password_confirmation')?.addEventListener('input', () => {
            this.validatePasswords();
        });
    }

    validatePasswords() {
        const password = document.getElementById('password')?.value;
        const confirm = document.getElementById('password_confirmation')?.value;
        const errorDiv = document.getElementById('error-message');

        if (confirm && password !== confirm) {
            errorDiv.textContent = 'Sifreler eslesmeli';
            errorDiv.classList.remove('hidden');
            return false;
        } else {
            errorDiv.classList.add('hidden');
            return true;
        }
    }

    async submit() {
        const password = document.getElementById('password')?.value;
        const confirm = document.getElementById('password_confirmation')?.value;
        const errorDiv = document.getElementById('error-message');

        // Validate
        if (password.length < 8) {
            errorDiv.textContent = 'Sifre en az 8 karakter olmali';
            errorDiv.classList.remove('hidden');
            return;
        }

        if (password !== confirm) {
            errorDiv.textContent = 'Sifreler eslesmeli';
            errorDiv.classList.remove('hidden');
            return;
        }

        const btn = document.getElementById('submit-btn');
        const btnText = document.getElementById('btn-text');
        const btnLoading = document.getElementById('btn-loading');

        btn.disabled = true;
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        errorDiv.classList.add('hidden');

        try {
            await this.app.api.post('/auth/reset-password', {
                token: this.token,
                password: password,
                password_confirmation: confirm
            });

            this.success = true;
            document.getElementById('form-container').innerHTML = this.renderForm();
        } catch (error) {
            errorDiv.textContent = error.message || this.__('messages.error');
            errorDiv.classList.remove('hidden');
            btn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
        }
    }

    destroy() {
        window.resetPasswordPage = null;
    }
}

export default ResetPasswordPage;
