/**
 * Modal - Merkezi Dialog Bileseni
 * Tum sayfalarda ayni sekilde kullanilir
 *
 * Kullanim:
 * Modal.show({ title: 'Baslik', content: '<p>Icerik</p>' });
 * Modal.confirm({ title: 'Emin misiniz?', onConfirm: () => {} });
 * Modal.alert({ title: 'Bilgi', message: 'Mesaj' });
 *
 * @package OmnexDisplayHub
 */

import { Logger } from '../core/Logger.js';
import { escapeHTML } from '../core/SecurityUtils.js';

export class Modal {
    static activeModals = [];

    /**
     * Modal goster
     * @param {Object} options - Modal secenekleri
     * @returns {Object} Modal instance
     */
    static show(options = {}) {
        const {
            id = 'modal-' + Date.now(),
            title = '',
            icon = null,
            content = '',
            size = 'md',
            closable = true,
            closeOnEscape = true,
            closeOnBackdrop = true,
            footer = null,
            onClose = null,
            onConfirm = null,
            confirmText = (typeof window.__ === 'function' ? window.__('modal.confirm') : null) || 'Onayla',
            cancelText = (typeof window.__ === 'function' ? window.__('modal.cancel') : null) || 'İptal',
            confirmClass = 'btn-primary',
            showFooter = true,
            showHeader = true,
            showConfirm = true,
            showCancel = true
        } = options;

        // DOM'daki orphan modal'lari temizle (activeModals'da olmayan ama DOM'da kalan)
        let hasOrphans = false;
        document.querySelectorAll('.modal-overlay').forEach(el => {
            const isTracked = this.activeModals.some(m => m.element === el);
            if (!isTracked) {
                el.remove();
                hasOrphans = true;
            }
        });

        // Orphan varsa ve activeModals bossa, body class'ini temizle
        if (hasOrphans && this.activeModals.length === 0) {
            document.body.classList.remove('modal-open');
        }

        // Size class
        const sizeClass = size !== 'md' ? `modal-${size}` : '';

        // Overlay olustur
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.className = `modal-overlay ${sizeClass}`.trim();

        // Header HTML
        let headerHtml = '';
        if (showHeader && (title || closable)) {
            let iconHtml = '';
            if (icon) {
                // Tip bazli ikonlar (primary, success, warning, danger, info)
                const typeIcons = ['primary', 'success', 'warning', 'danger', 'info'];
                const isTypeIcon = typeIcons.includes(icon);

                const iconClass = isTypeIcon ? `icon-${icon}` : 'icon-primary';
                const iconName = isTypeIcon ? {
                    'primary': 'ti-info-circle',
                    'success': 'ti-circle-check',
                    'warning': 'ti-alert-triangle',
                    'danger': 'ti-alert-circle',
                    'info': 'ti-info-circle'
                }[icon] : icon;

                iconHtml = `
                    <div class="modal-icon ${iconClass}">
                        <i class="ti ${iconName}"></i>
                    </div>
                `;
            }

            headerHtml = `
                <div class="modal-header">
                    <div class="modal-header-left">
                        ${iconHtml}
                        ${title ? `<h3 class="modal-title">${escapeHTML(title)}</h3>` : ''}
                    </div>
                    ${closable ? `
                        <button type="button" class="modal-close" data-modal-close>
                            <i class="ti ti-x"></i>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        // Footer HTML
        let footerHtml = '';
        if (showFooter) {
            let footerContent = '';
            if (footer !== null) {
                footerContent = footer;
            } else {
                if (showCancel) {
                    footerContent += `
                        <button type="button" class="btn btn-outline" data-modal-close>
                            ${cancelText}
                        </button>
                    `;
                }
                if (showConfirm && onConfirm) {
                    footerContent += `
                        <button type="button" class="btn ${confirmClass}" data-modal-confirm>
                            ${confirmText}
                        </button>
                    `;
                } else if (showConfirm && !onConfirm) {
                    // Sadece kapat butonu goster (onConfirm yok ama showConfirm true)
                    footerContent += `
                        <button type="button" class="btn ${confirmClass}" data-modal-close>
                            ${confirmText}
                        </button>
                    `;
                }
            }
            footerHtml = `
                <div class="modal-footer">
                    ${footerContent}
                </div>
            `;
        }

        overlay.innerHTML = `
            <div class="modal-container">
                ${headerHtml}
                <div class="modal-body">
                    ${content}
                </div>
                ${footerHtml}
            </div>
        `;

        // DOM'a ekle
        document.body.appendChild(overlay);
        document.body.classList.add('modal-open');

        // Instance kaydet
        const modalInstance = {
            id,
            element: overlay,
            onClose,
            onConfirm,
            closeOnEscape,
            closeOnBackdrop
        };
        this.activeModals.push(modalInstance);

        // Event'leri bagla
        this.bindModalEvents(modalInstance);

        // Animasyonlu ac
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        return {
            id,
            element: overlay,
            close: () => this.close(id),
            setContent: (html) => this.setContent(id, html),
            setLoading: (loading) => this.setLoading(id, loading),
            setTitle: (title) => this.setTitle(id, title)
        };
    }

    /**
     * Modal event'lerini bagla
     */
    static bindModalEvents(modalInstance) {
        const { element, closeOnEscape, closeOnBackdrop, onConfirm } = modalInstance;

        // Kapat butonlari
        element.querySelectorAll('[data-modal-close]').forEach(btn => {
            btn.addEventListener('click', () => this.close(modalInstance.id));
        });

        // Onay butonu
        const confirmBtn = element.querySelector('[data-modal-confirm]');
        if (confirmBtn && onConfirm) {
            confirmBtn.dataset.originalText = confirmBtn.innerHTML;
            confirmBtn.addEventListener('click', async () => {
                try {
                    confirmBtn.disabled = true;
                    const processingText = (typeof window.__ === 'function' ? window.__('modal.processing') : null) || 'İşleniyor...';
                    confirmBtn.innerHTML = `<i class="ti ti-loader-2 animate-spin"></i> ${processingText}`;
                    await onConfirm();
                    this.close(modalInstance.id);
                } catch (error) {
                    Logger.error('Modal confirm error:', error);
                    confirmBtn.disabled = false;
                    const defaultConfirmText = (typeof window.__ === 'function' ? window.__('modal.confirm') : null) || 'Onayla';
                    confirmBtn.innerHTML = confirmBtn.dataset.originalText || defaultConfirmText;
                }
            });
        }

        // Overlay'e tiklandiginda kapat
        if (closeOnBackdrop) {
            element.addEventListener('click', (e) => {
                if (e.target === element) {
                    this.close(modalInstance.id);
                }
            });
        }

        // ESC tusu ile kapat
        if (closeOnEscape) {
            const escHandler = (e) => {
                if (e.key === 'Escape' && this.activeModals.length > 0) {
                    const topModal = this.activeModals[this.activeModals.length - 1];
                    if (topModal.id === modalInstance.id && topModal.closeOnEscape) {
                        this.close(modalInstance.id);
                    }
                }
            };
            document.addEventListener('keydown', escHandler);
            modalInstance.escHandler = escHandler;
        }
    }

    /**
     * Modal kapat
     */
    static close(id) {
        const index = this.activeModals.findIndex(m => m.id === id);
        if (index === -1) return;

        const modalInstance = this.activeModals[index];
        const { element, onClose, escHandler } = modalInstance;

        // Cift kapatma koruması - zaten kapaniyorsa cik
        if (modalInstance.closing) return;
        modalInstance.closing = true;

        // ESC handler'i hemen kaldir
        if (escHandler) {
            document.removeEventListener('keydown', escHandler);
        }

        // Animasyonlu kapat
        element.classList.remove('active');

        // Animasyon sonrasi kaldir
        setTimeout(() => {
            // Element hala DOM'da mi kontrol et
            if (element && element.parentNode) {
                element.remove();
            }

            // Array'den cikar (index degismis olabilir, tekrar bul)
            const currentIndex = this.activeModals.findIndex(m => m.id === id);
            if (currentIndex !== -1) {
                this.activeModals.splice(currentIndex, 1);
            }

            // Baska modal yoksa body scroll'u ac
            if (this.activeModals.length === 0) {
                document.body.classList.remove('modal-open');
            }

            // Callback
            if (onClose) {
                onClose();
            }
        }, 200);
    }

    /**
     * Tum modalleri kapat
     * @param {boolean} immediate - Animasyonsuz aninda kapat
     */
    static closeAll(immediate = false) {
        // ESC handler'lari temizle
        this.activeModals.forEach(modal => {
            if (modal.escHandler) {
                document.removeEventListener('keydown', modal.escHandler);
            }
        });

        if (immediate) {
            // Aninda kapat - DOM'dan hemen kaldir
            this.activeModals.forEach(modal => {
                if (modal.element && modal.element.parentNode) {
                    modal.element.remove();
                }
            });
            this.activeModals = [];
            document.body.classList.remove('modal-open');
        } else {
            // Animasyonlu kapat
            [...this.activeModals].forEach(modal => {
                this.close(modal.id);
            });
        }

        // DOM'da kalan orphan modal'lari da temizle
        document.querySelectorAll('.modal-overlay').forEach(el => {
            el.remove();
        });
        document.body.classList.remove('modal-open');
    }

    /**
     * Modal icerigini guncelle
     */
    static setContent(id, html) {
        const modal = this.activeModals.find(m => m.id === id);
        if (modal) {
            const body = modal.element.querySelector('.modal-body');
            if (body) {
                body.innerHTML = html;
            }
        }
    }

    /**
     * Modal basligini guncelle
     */
    static setTitle(id, title) {
        const modal = this.activeModals.find(m => m.id === id);
        if (modal) {
            const titleEl = modal.element.querySelector('.modal-title');
            if (titleEl) {
                titleEl.textContent = title;
            }
        }
    }

    /**
     * Modal yukleniyor durumunu ayarla
     */
    static setLoading(id, loading) {
        const modal = this.activeModals.find(m => m.id === id);
        if (modal) {
            const body = modal.element.querySelector('.modal-body');
            if (loading) {
                body.dataset.originalContent = body.innerHTML;
                body.innerHTML = `
                    <div class="flex items-center justify-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
                    </div>
                `;
            } else if (body.dataset.originalContent) {
                body.innerHTML = body.dataset.originalContent;
                delete body.dataset.originalContent;
            }
        }
    }

    /**
     * Onay dialog kisayolu
     */
    static confirm(options = {}) {
        const {
            title = (typeof window.__ === 'function' ? window.__('modal.confirmTitle') : null) || 'Onay',
            message = (typeof window.__ === 'function' ? window.__('modal.confirmMessage') : null) || 'Bu işlemi gerçekleştirmek istediğinizden emin misiniz?',
            confirmText = (typeof window.__ === 'function' ? window.__('modal.yes') : null) || 'Evet',
            cancelText = (typeof window.__ === 'function' ? window.__('modal.no') : null) || 'Hayır',
            type = 'warning',
            onConfirm,
            onCancel
        } = options;

        const confirmClasses = {
            info: 'btn-primary',
            success: 'btn-success',
            warning: 'btn-primary',
            danger: 'btn-danger'
        };

        return this.show({
            title,
            icon: type,
            size: 'sm',
            content: `<p class="text-gray-600 dark:text-gray-400">${escapeHTML(message)}</p>`,
            confirmText,
            cancelText,
            confirmClass: confirmClasses[type] || confirmClasses.info,
            onConfirm,
            onClose: onCancel
        });
    }

    /**
     * Uyari dialog kisayolu
     */
    static alert(options = {}) {
        const {
            title = (typeof window.__ === 'function' ? window.__('modal.infoTitle') : null) || 'Bilgi',
            message = '',
            type = 'info',
            buttonText = (typeof window.__ === 'function' ? window.__('modal.ok') : null) || 'Tamam'
        } = options;

        return this.show({
            title,
            icon: type === 'error' ? 'danger' : type,
            size: 'sm',
            content: `<p class="text-gray-600 dark:text-gray-400">${escapeHTML(message)}</p>`,
            showFooter: true,
            footer: `
                <button type="button" class="btn btn-primary" data-modal-close>
                    ${buttonText}
                </button>
            `
        });
    }

    /**
     * Giris dialog kisayolu
     */
    static prompt(options = {}) {
        const {
            title = (typeof window.__ === 'function' ? window.__('modal.inputTitle') : null) || 'Giris',
            message = '',
            placeholder = '',
            defaultValue = '',
            inputType = 'text',
            confirmText = (typeof window.__ === 'function' ? window.__('modal.ok') : null) || 'Tamam',
            cancelText = (typeof window.__ === 'function' ? window.__('modal.cancel') : null) || 'İptal',
            onConfirm
        } = options;

        const inputId = 'prompt-input-' + Date.now();

        const modal = this.show({
            title,
            icon: 'info',
            size: 'sm',
            content: `
                <div>
                    ${message ? `<p class="text-gray-600 dark:text-gray-400 mb-4">${escapeHTML(message)}</p>` : ''}
                    <input
                        type="${escapeHTML(inputType)}"
                        id="${inputId}"
                        class="form-input w-full"
                        placeholder="${escapeHTML(placeholder)}"
                        value="${escapeHTML(defaultValue)}"
                    />
                </div>
            `,
            confirmText,
            cancelText,
            onConfirm: async () => {
                const input = document.getElementById(inputId);
                if (onConfirm && input) {
                    await onConfirm(input.value);
                }
            }
        });

        // Input'a focus ver
        setTimeout(() => {
            const input = document.getElementById(inputId);
            if (input) input.focus();
        }, 100);

        return modal;
    }
}

export default Modal;
