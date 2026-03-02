/**
 * PWA Install Prompt Component
 * Provides PWA installation functionality for header icon
 */

import { Logger } from '../core/Logger.js';

export class PwaInstallPrompt {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        this.isAndroid = /Android/.test(navigator.userAgent);
        this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           window.navigator.standalone === true;
        this.onInstallReady = null;
    }

    init() {
        // Don't show if already installed as PWA
        if (this.isStandalone) {
            this.isInstalled = true;
            return;
        }

        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;

            // Notify that install is ready
            if (this.onInstallReady) {
                this.onInstallReady(true);
            }

            // Show install button in header
            this.updateHeaderButton(true);
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.deferredPrompt = null;
            this.updateHeaderButton(false);
            Logger.log('PWA was installed');
        });

        // For iOS and Android, always show the button (manual instructions)
        // This is needed because beforeinstallprompt may not fire without HTTPS
        if ((this.isIOS || this.isAndroid) && !this.isStandalone) {
            setTimeout(() => {
                // Give time for beforeinstallprompt to potentially fire
                if (!this.deferredPrompt) {
                    this.updateHeaderButton(true);
                }
            }, 1000);
        }

        // Add styles
        this.addStyles();
    }

    /**
     * Update header install button visibility
     */
    updateHeaderButton(show) {
        const btn = document.getElementById('pwa-install-header-btn');
        if (btn) {
            btn.style.display = show ? '' : 'none';
        }
    }

    /**
     * Check if install is available
     */
    canInstall() {
        return !this.isInstalled && (this.deferredPrompt || this.isIOS);
    }

    /**
     * Trigger install prompt or show instructions
     */
    async promptInstall() {
        if (this.deferredPrompt) {
            // Chrome/Edge/etc - native install prompt
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                Logger.log('User accepted the install prompt');
            }

            this.deferredPrompt = null;
        } else {
            // Show manual instructions (iOS or fallback)
            this.showManualInstructions();
        }
    }

    /**
     * Show manual installation instructions modal
     */
    showManualInstructions() {
        // Remove existing modal if any
        document.getElementById('pwa-install-modal')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'pwa-install-modal';
        overlay.className = 'pwa-install-modal';

        let instructions = '';

        if (this.isIOS) {
            instructions = `
                <div class="pwa-instruction">
                    <div class="pwa-step">
                        <span class="step-number">1</span>
                        <p>Safari'nin alt menusundeki <i class="ti ti-share"></i> <strong>Paylas</strong> butonuna dokunun</p>
                    </div>
                    <div class="pwa-step">
                        <span class="step-number">2</span>
                        <p>Acilan menude <i class="ti ti-plus"></i> <strong>Ana Ekrana Ekle</strong> secenegine dokunun</p>
                    </div>
                    <div class="pwa-step">
                        <span class="step-number">3</span>
                        <p>Sag ustteki <strong>Ekle</strong> butonuna dokunun</p>
                    </div>
                </div>
            `;
        } else if (this.isAndroid) {
            instructions = `
                <div class="pwa-instruction">
                    <div class="pwa-step">
                        <span class="step-number">1</span>
                        <p>Tarayici menusunu acin <i class="ti ti-dots-vertical"></i></p>
                    </div>
                    <div class="pwa-step">
                        <span class="step-number">2</span>
                        <p><i class="ti ti-plus"></i> <strong>Ana ekrana ekle</strong> veya <strong>Uygulamayi yukle</strong> secenegine dokunun</p>
                    </div>
                    <div class="pwa-step">
                        <span class="step-number">3</span>
                        <p><strong>Yukle</strong> butonuna dokunun</p>
                    </div>
                </div>
            `;
        } else {
            instructions = `
                <div class="pwa-instruction">
                    <div class="pwa-step">
                        <span class="step-number">1</span>
                        <p>Adres cubugunun saginda <i class="ti ti-download"></i> <strong>Yukle</strong> simgesine tiklayin</p>
                    </div>
                    <div class="pwa-step">
                        <span class="step-number">2</span>
                        <p>Veya tarayici menusunden <strong>Uygulamayi yukle</strong> secenegini secin</p>
                    </div>
                    <div class="pwa-step">
                        <span class="step-number">3</span>
                        <p>Acilan pencerede <strong>Yukle</strong> butonuna tiklayin</p>
                    </div>
                </div>
            `;
        }

        overlay.innerHTML = `
            <div class="pwa-install-modal-content">
                <div class="pwa-modal-header">
                    <div class="pwa-app-info">
                        <img src="branding/icon-192.svg" alt="Omnex Hub" class="pwa-app-icon">
                        <div>
                            <h3>Omnex Display Hub</h3>
                            <p>Uygulamayi cihaziniza yukleyin</p>
                        </div>
                    </div>
                    <button class="pwa-modal-close" id="pwa-modal-close">
                        <i class="ti ti-x"></i>
                    </button>
                </div>
                <div class="pwa-modal-body">
                    <p class="pwa-benefits">
                        <span><i class="ti ti-check"></i> Hizli erisim</span>
                        <span><i class="ti ti-check"></i> Cevrimdisi kullanim</span>
                        <span><i class="ti ti-check"></i> Bildirimler</span>
                    </p>
                    <h4>Nasil Yuklenir?</h4>
                    ${instructions}
                </div>
                <div class="pwa-modal-footer">
                    <button class="btn btn-outline" id="pwa-modal-later">Kapat</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Close handlers
        document.getElementById('pwa-modal-close').addEventListener('click', () => overlay.remove());
        document.getElementById('pwa-modal-later').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    addStyles() {
        if (document.getElementById('pwa-install-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'pwa-install-styles';
        styles.textContent = `
            /* PWA Install Modal */
            .pwa-install-modal {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                animation: pwa-fade-in 0.2s ease;
            }

            @keyframes pwa-fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            .pwa-install-modal-content {
                width: 100%;
                max-width: 400px;
                background: var(--bg-primary, white);
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                animation: pwa-scale-in 0.2s ease;
            }

            @keyframes pwa-scale-in {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }

            .pwa-modal-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                padding: 20px;
                border-bottom: 1px solid var(--border-color, #e5e5e5);
            }

            .pwa-app-info {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .pwa-app-icon {
                width: 48px;
                height: 48px;
                border-radius: 12px;
            }

            .pwa-app-info h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary, #1a1a2e);
            }

            .pwa-app-info p {
                margin: 4px 0 0;
                font-size: 13px;
                color: var(--text-secondary, #666);
            }

            .pwa-modal-close {
                padding: 8px;
                background: none;
                border: none;
                color: var(--text-secondary, #666);
                cursor: pointer;
                border-radius: 8px;
                transition: background 0.2s;
            }

            .pwa-modal-close:hover {
                background: var(--bg-secondary, #f5f5f5);
            }

            .pwa-modal-close i {
                font-size: 20px;
            }

            .pwa-modal-body {
                padding: 20px;
            }

            .pwa-benefits {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                margin: 0 0 20px;
                padding: 12px;
                background: var(--bg-secondary, #f5f5f5);
                border-radius: 8px;
                font-size: 13px;
                color: var(--text-secondary, #666);
            }

            .pwa-benefits span {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .pwa-benefits i {
                color: var(--color-success, #22c55e);
            }

            .pwa-modal-body h4 {
                margin: 0 0 16px;
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary, #1a1a2e);
            }

            .pwa-instruction {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .pwa-step {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }

            .step-number {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                min-width: 24px;
                background: var(--color-primary, #228be6);
                color: white;
                font-size: 12px;
                font-weight: 600;
                border-radius: 50%;
            }

            .pwa-step p {
                margin: 0;
                font-size: 14px;
                line-height: 1.5;
                color: var(--text-primary, #1a1a2e);
            }

            .pwa-step i {
                color: var(--color-primary, #228be6);
            }

            .pwa-modal-footer {
                padding: 16px 20px;
                border-top: 1px solid var(--border-color, #e5e5e5);
                text-align: center;
            }

            .pwa-modal-footer .btn {
                min-width: 120px;
            }

            /* Mobile adjustments */
            @media (max-width: 768px) {
                .pwa-install-modal {
                    align-items: flex-end;
                    padding: 0;
                }

                .pwa-install-modal-content {
                    max-width: 100%;
                    border-radius: 16px 16px 0 0;
                    animation: pwa-slide-up-modal 0.3s ease;
                }

                @keyframes pwa-slide-up-modal {
                    from { opacity: 0; transform: translateY(100%); }
                    to { opacity: 1; transform: translateY(0); }
                }
            }

            /* Dark mode */
            [data-theme="dark"] .pwa-install-modal-content {
                background: var(--bg-primary, #1a1a2e);
            }

            [data-theme="dark"] .pwa-modal-header {
                border-color: var(--border-color, #2d2d44);
            }

            [data-theme="dark"] .pwa-app-info h3,
            [data-theme="dark"] .pwa-modal-body h4,
            [data-theme="dark"] .pwa-step p {
                color: var(--text-primary, #fff);
            }

            [data-theme="dark"] .pwa-benefits {
                background: var(--bg-secondary, #2d2d44);
            }

            [data-theme="dark"] .pwa-modal-footer {
                border-color: var(--border-color, #2d2d44);
            }
        `;
        document.head.appendChild(styles);
    }
}

export default PwaInstallPrompt;
