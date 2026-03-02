/**
 * Toast - Notification Component
 *
 * @package OmnexDisplayHub
 */

import { escapeHTML } from '../core/SecurityUtils.js';

export class Toast {
    static container = null;
    static defaultDuration = 4000;
    static position = 'top-right'; // Default position

    /**
     * Get or create toast container
     */
    static getContainer() {
        if (!this.container) {
            this.container = document.getElementById('toast-container');
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'toast-container';
                this.container.className = `toast-container ${this.position}`;
                document.body.appendChild(this.container);
            }
        }
        return this.container;
    }

    /**
     * Set toast container position
     * @param {string} position - Position: top-right, top-left, top-center, bottom-right, bottom-left, bottom-center
     */
    static setPosition(position) {
        this.position = position;
        if (this.container) {
            this.container.className = `toast-container ${position}`;
        }
    }

    /**
     * Show toast
     * @param {Object|string} options - Toast options or message string
     * @param {string} options.type - Toast type: info, success, warning, error
     * @param {string} options.title - Optional title (shown bold above message)
     * @param {string} options.message - Toast message (required)
     * @param {number} options.duration - Auto-dismiss time in ms, 0 for no auto-dismiss
     * @param {boolean} options.closable - Show close button
     * @param {Function} options.onClick - Callback when toast body is clicked
     * @param {Array} options.actions - Array of {label, onClick} for action buttons
     * @param {boolean} options.isNotification - Whether this is a notification toast
     * @param {boolean} options.showProgress - Whether to show progress bar
     */
    static show(options) {
        const {
            type = 'info',
            title = '',
            message = '',
            duration = this.defaultDuration,
            closable = true,
            onClick = null,
            actions = [],
            isNotification = false,
            showProgress = false
        } = typeof options === 'string' ? { message: options } : options;

        const icons = {
            success: '<i class="ti ti-circle-check"></i>',
            error: '<i class="ti ti-circle-x"></i>',
            warning: '<i class="ti ti-alert-triangle"></i>',
            info: '<i class="ti ti-info-circle"></i>'
        };

        // Build actions HTML
        let actionsHtml = '';
        if (actions && actions.length > 0) {
            actionsHtml = `
                <div class="toast-actions">
                    ${actions.map((action, index) => `
                        <button class="toast-action-btn" data-action-index="${index}">
                            ${action.icon ? `<i class="${escapeHTML(action.icon)}"></i>` : ''}
                            ${escapeHTML(action.label)}
                        </button>
                    `).join('')}
                </div>
            `;
        }

        // Build progress bar HTML
        const progressHtml = showProgress && duration > 0
            ? `<div class="toast-progress" style="animation-duration: ${duration}ms;"></div>`
            : '';

        const toast = document.createElement('div');
        const toastClasses = [
            'toast',
            `toast-${type}`,
            isNotification ? 'toast-notification' : '',
            onClick ? 'toast-clickable' : '',
            showProgress ? 'toast-with-progress' : ''
        ].filter(Boolean).join(' ');

        toast.className = toastClasses;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${escapeHTML(title)}</div>` : ''}
                <div class="toast-message">${escapeHTML(message)}</div>
                ${actionsHtml}
            </div>
            ${closable ? '<button class="toast-close"><i class="ti ti-x"></i></button>' : ''}
            ${progressHtml}
        `;

        // Add to container
        const container = this.getContainer();
        container.appendChild(toast);

        // Close handler
        const close = () => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        };

        // Close button
        if (closable) {
            const closeBtn = toast.querySelector('.toast-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    close();
                });
            }
        }

        // Click handler for toast body
        if (onClick) {
            toast.addEventListener('click', (e) => {
                // Don't trigger onClick if clicking close button or action buttons
                if (e.target.closest('.toast-close') || e.target.closest('.toast-action-btn')) {
                    return;
                }
                onClick();
                close();
            });
        }

        // Action button handlers
        if (actions && actions.length > 0) {
            actions.forEach((action, index) => {
                const btn = toast.querySelector(`[data-action-index="${index}"]`);
                if (btn && action.onClick) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        action.onClick();
                        close();
                    });
                }
            });
        }

        // Auto dismiss
        let timeoutId = null;
        if (duration > 0) {
            timeoutId = setTimeout(close, duration);
        }

        // Return control object
        return {
            close,
            element: toast,
            cancelAutoClose: () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
            }
        };
    }

    /**
     * Show a notification as a toast
     * @param {Object} notification - Notification object from API
     * @param {string} notification.id - Notification ID
     * @param {string} notification.title - Notification title
     * @param {string} notification.message - Notification message
     * @param {string} notification.type - Notification type (info, success, warning, error)
     * @param {string} notification.action_url - URL to navigate to when clicked
     * @returns {Object} Toast control object with close method
     */
    static showNotification(notification) {
        const __ = window.__ || ((key) => key);

        const actions = notification.action_url ? [
            {
                label: __('actions.view') || 'Goruntule',
                icon: 'ti ti-external-link',
                onClick: () => {
                    window.location.hash = notification.action_url;
                }
            }
        ] : [];

        return this.show({
            title: notification.title,
            message: notification.message,
            type: notification.type || 'info',
            duration: 8000, // Longer duration for notifications
            closable: true,
            isNotification: true,
            showProgress: true,
            onClick: () => {
                // Mark as read and navigate if action_url exists
                if (notification.action_url) {
                    window.location.hash = notification.action_url;
                }
            },
            actions: actions
        });
    }

    /**
     * Success toast
     */
    static success(message, title = '') {
        return this.show({ type: 'success', title, message });
    }

    /**
     * Error toast
     */
    static error(message, title = '') {
        return this.show({ type: 'error', title, message, duration: 6000 });
    }

    /**
     * Warning toast
     */
    static warning(message, title = '') {
        return this.show({ type: 'warning', title, message });
    }

    /**
     * Info toast
     */
    static info(message, title = '') {
        return this.show({ type: 'info', title, message });
    }

    /**
     * Promise toast (for async operations)
     */
    static async promise(promise, options = {}) {
        const __ = window.__ || ((key) => key);
        const {
            loading = __('messages.processing'),
            success = __('status.success'),
            error = __('messages.serverError')
        } = options;

        const toast = this.show({
            type: 'info',
            message: loading,
            duration: 0,
            closable: false
        });

        try {
            const result = await promise;
            toast.close();
            this.success(typeof success === 'function' ? success(result) : success);
            return result;
        } catch (e) {
            toast.close();
            this.error(typeof error === 'function' ? error(e) : (e.message || error));
            throw e;
        }
    }

    /**
     * Clear all toasts
     */
    static clear() {
        const container = this.getContainer();
        container.innerHTML = '';
    }
}

export default Toast;
