/**
 * NotificationDropdown - Notification Bell Dropdown Component
 *
 * Renders a notification bell icon in the header with a dropdown
 * showing recent notifications. Integrates with NotificationManager
 * for data and actions.
 *
 * @package OmnexDisplayHub
 */

import { Logger } from '../core/Logger.js';
import { Modal } from './Modal.js';
import { escapeHTML, isValidURL } from '../core/SecurityUtils.js';

export class NotificationDropdown {
    constructor(app, notificationManager = null) {
        this.app = app;
        this.notificationManager = notificationManager;
        this.isOpen = false;
        this.maxDisplayCount = 5;
        this._unsubscribers = [];
        this._subscribed = false;

        // Bound methods for event cleanup
        this.handleOutsideClick = this.handleOutsideClick.bind(this);
        this.handleNotificationUpdate = this.handleNotificationUpdate.bind(this);
    }

    /**
     * Initialize the notification dropdown
     */
    async init() {
        if (this._subscribed) {
            return;
        }

        // Prefer direct manager events when available
        let managerBound = false;
        if (this.notificationManager && typeof this.notificationManager.addEventListener === 'function') {
            this._unsubscribers.push(
                this.notificationManager.addEventListener('notificationsUpdated', this.handleNotificationUpdate)
            );
            this._unsubscribers.push(
                this.notificationManager.addEventListener('unreadCountChanged', this.handleNotificationUpdate)
            );
            managerBound = true;
        }

        // Fallback for late-bound scenarios
        if (!managerBound) {
            window.addEventListener('notification:notificationsUpdated', this.handleNotificationUpdate);
            window.addEventListener('notification:unreadCountChanged', this.handleNotificationUpdate);
        }
        this._subscribed = true;

        Logger.debug('NotificationDropdown initialized');
    }

    /**
     * Cleanup event listeners
     */
    destroy() {
        window.removeEventListener('notification:notificationsUpdated', this.handleNotificationUpdate);
        window.removeEventListener('notification:unreadCountChanged', this.handleNotificationUpdate);
        document.removeEventListener('click', this.handleOutsideClick);
        this._unsubscribers.forEach(fn => {
            try { fn(); } catch (e) {}
        });
        this._unsubscribers = [];
        this._subscribed = false;
    }

    /**
     * Handle notification update event
     */
    handleNotificationUpdate(event) {
        const detail = event?.detail ?? event;
        Logger.debug('Notifications updated:', detail);
        this.refresh();
    }

    /**
     * Get notifications from manager or return empty array
     */
    getNotifications() {
        if (this.notificationManager && typeof this.notificationManager.getNotifications === 'function') {
            return this.notificationManager.getNotifications().slice(0, this.maxDisplayCount);
        }
        return [];
    }

    /**
     * Get unread count from manager
     */
    getUnreadCount() {
        if (this.notificationManager && typeof this.notificationManager.getUnreadCount === 'function') {
            return this.notificationManager.getUnreadCount();
        }
        return 0;
    }

    /**
     * Get icon class based on notification type
     */
    getTypeIcon(type) {
        const icons = {
            info: 'ti-info-circle',
            success: 'ti-circle-check',
            warning: 'ti-alert-triangle',
            error: 'ti-alert-circle',
            system: 'ti-settings'
        };
        return icons[type] || icons.info;
    }

    /**
     * Get icon color class based on notification type
     */
    getTypeColor(type) {
        const colors = {
            info: 'notification-icon-info',
            success: 'notification-icon-success',
            warning: 'notification-icon-warning',
            error: 'notification-icon-error',
            system: 'notification-icon-system'
        };
        return colors[type] || colors.info;
    }

    /**
     * Format time as relative string (Turkish)
     */
    formatTimeAgo(dateString) {
        const __ = window.__ || (k => k);
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffSeconds = Math.floor(diffMs / 1000);
            const diffMinutes = Math.floor(diffSeconds / 60);
            const diffHours = Math.floor(diffMinutes / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffSeconds < 60) {
                return __('notifications.time.just_now');
            } else if (diffMinutes < 60) {
                return __('notifications.time.minutes_ago', { count: diffMinutes });
            } else if (diffHours < 24) {
                return __('notifications.time.hours_ago', { count: diffHours });
            } else if (diffDays === 1) {
                return __('notifications.time.yesterday');
            } else if (diffDays < 7) {
                return __('notifications.time.days_ago', { count: diffDays });
            } else {
                // Format as date for older notifications
                return date.toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'short'
                });
            }
        } catch (error) {
            Logger.error('Error formatting time:', error);
            return '';
        }
    }

    /**
     * Truncate message for preview
     */
    truncateMessage(message, maxLength = 50) {
        if (!message) return '';
        if (message.length <= maxLength) return message;
        return message.substring(0, maxLength) + '...';
    }

    /**
     * Render a single notification item
     */
    renderNotificationItem(notification) {
        const iconClass = this.getTypeIcon(notification.type);
        const colorClass = this.getTypeColor(notification.type);
        const unreadClass = notification.read ? '' : 'unread';
        const timeAgo = this.formatTimeAgo(notification.created_at || notification.createdAt);
        const message = this.truncateMessage(notification.message);

        return `
            <div class="notification-dropdown-item ${unreadClass}"
                 data-notification-id="${escapeHTML(notification.id)}"
                 ${notification.link ? `data-link="${escapeHTML(notification.link)}"` : ''}>
                <div class="notification-item-icon ${colorClass}">
                    <i class="ti ${iconClass}"></i>
                </div>
                <div class="notification-item-content">
                    <div class="notification-item-title">${escapeHTML(notification.title || '')}</div>
                    <div class="notification-item-message">${escapeHTML(message)}</div>
                    <div class="notification-item-time">${escapeHTML(timeAgo)}</div>
                </div>
            </div>
        `;
    }

    /**
     * Render empty state
     */
    renderEmptyState() {
        const __ = window.__ || (k => k);
        return `
            <div class="notification-dropdown-empty">
                <div class="notification-empty-icon">
                    <i class="ti ti-bell-off"></i>
                </div>
                <div class="notification-empty-text">${__('notifications.noNotifications')}</div>
            </div>
        `;
    }

    /**
     * Render the notification dropdown HTML
     */
    render() {
        const __ = window.__ || (k => k);
        const notifications = this.getNotifications();
        const unreadCount = this.getUnreadCount();
        const badgeHtml = unreadCount > 0
            ? `<span class="notification-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>`
            : '';

        const notificationListHtml = notifications.length > 0
            ? notifications.map(n => this.renderNotificationItem(n)).join('')
            : this.renderEmptyState();

        return `
            <div class="notification-dropdown-wrapper">
                <button class="notification-dropdown-btn" id="notification-dropdown-btn" title="${__('notifications.title')}">
                    <i class="ti ti-bell"></i>
                    ${badgeHtml}
                </button>
                <div class="notification-dropdown" id="notification-dropdown">
                    <div class="notification-dropdown-header">
                        <span class="notification-dropdown-title">${__('notifications.title')}</span>
                        ${unreadCount > 0 ? `
                            <button class="notification-mark-all-read" id="notification-mark-all-read">
                                ${__('notifications.markAllAsRead')}
                            </button>
                        ` : ''}
                    </div>
                    <div class="notification-dropdown-list">
                        ${notificationListHtml}
                    </div>
                    <div class="notification-dropdown-footer">
                        <a href="#/notifications" class="notification-view-all" id="notification-view-all">
                            <i class="ti ti-list"></i>
                            ${__('notifications.viewAll')}
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Bind event handlers after render
     */
    bindEvents() {
        const btn = document.getElementById('notification-dropdown-btn');
        const dropdown = document.getElementById('notification-dropdown');

        if (!btn || !dropdown) {
            Logger.warn('NotificationDropdown: Required elements not found');
            return;
        }

        // Toggle dropdown on bell click
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Close on outside click
        document.addEventListener('click', this.handleOutsideClick);

        // Mark all as read
        const markAllBtn = document.getElementById('notification-mark-all-read');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.markAllAsRead();
            });
        }

        // View all link
        const viewAllBtn = document.getElementById('notification-view-all');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                this.close();
            });
        }

        // Individual notification clicks
        dropdown.querySelectorAll('.notification-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleNotificationClick(item);
            });
        });
    }

    /**
     * Handle click outside dropdown
     */
    handleOutsideClick(e) {
        const dropdown = document.getElementById('notification-dropdown');
        const btn = document.getElementById('notification-dropdown-btn');

        if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
            this.close();
        }
    }

    /**
     * Handle click on a notification item
     */
    async handleNotificationClick(item) {
        const notificationId = item.dataset.notificationId;

        Logger.debug('Notification clicked:', notificationId);

        // Find the notification data
        const notifications = this.getNotifications();
        const notification = notifications.find(n => String(n.id) === String(notificationId));

        if (!notification) {
            Logger.warn('Notification not found:', notificationId);
            return;
        }

        // Close dropdown
        this.close();

        // Mark as read
        await this.markAsRead(notificationId);

        // Show notification detail modal
        this.showNotificationModal(notification);
    }

    /**
     * Show notification detail modal
     */
    showNotificationModal(notification) {
        const __ = window.__ || (k => k);
        const icon = this.getTypeIcon(notification.type);
        const color = this.getTypeColor(notification.type);
        const colorHex = this.getTypeColorHex(notification.type);
        const formattedDate = this.formatFullDate(notification.created_at);
        const typeLabel = this.getTypeLabel(notification.type);

        const content = `
            <div class="notification-modal-content">
                <div class="notification-modal-header-info">
                    <div class="notification-modal-icon ${color}">
                        <i class="ti ${icon}"></i>
                    </div>
                    <div class="notification-modal-meta">
                        <h4 class="notification-modal-title">${escapeHTML(notification.title || '')}</h4>
                        <p class="notification-modal-time">${escapeHTML(formattedDate)}</p>
                    </div>
                </div>

                <div class="notification-modal-message">
                    <p>${escapeHTML(notification.message || '')}</p>
                </div>

                <div class="notification-modal-details">
                    <div class="notification-detail-item">
                        <span class="notification-detail-label">${__('notificationDropdown.type')}</span>
                        <span class="notification-detail-value">${typeLabel}</span>
                    </div>
                    <div class="notification-detail-item">
                        <span class="notification-detail-label">${__('notificationDropdown.statusLabel')}</span>
                        <span class="notification-detail-value">
                            ${notification.read || notification.read_at ?
                                `<span class="badge badge-secondary">${__('notificationDropdown.read')}</span>` :
                                `<span class="badge badge-primary">${__('notificationDropdown.new')}</span>`
                            }
                        </span>
                    </div>
                </div>

                ${notification.link && isValidURL(notification.link) ? `
                    <div class="notification-modal-action">
                        <a href="${escapeHTML(notification.link)}" class="btn btn-outline btn-sm">
                            <i class="ti ti-external-link"></i>
                            <span>${__('notificationDropdown.viewDetails')}</span>
                        </a>
                    </div>
                ` : ''}
            </div>
        `;

        Modal.show({
            title: __('notificationDropdown.detailTitle'),
            icon: 'ti-bell',
            content: content,
            size: 'md',
            showFooter: true,
            showConfirm: false,
            cancelText: __('modal.close')
        });
    }

    /**
     * Get type color hex for inline styles
     */
    getTypeColorHex(type) {
        const colors = {
            info: '#228be6',
            success: '#40c057',
            warning: '#fab005',
            error: '#fa5252',
            system: '#228be6'
        };
        return colors[type] || colors.info;
    }

    /**
     * Get type label in Turkish
     */
    getTypeLabel(type) {
        const __ = window.__ || (k => k);
        const labels = {
            info: __('notifications.types.info'),
            success: __('notifications.types.success'),
            warning: __('notifications.types.warning'),
            error: __('notifications.types.error'),
            system: __('notifications.types.system')
        };
        return labels[type] || __('notifications.types.info');
    }

    /**
     * Format full date
     */
    formatFullDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            Logger.error('Error formatting date:', error);
            return '';
        }
    }

    /**
     * Mark a single notification as read
     */
    async markAsRead(notificationId) {
        try {
            if (this.notificationManager && typeof this.notificationManager.markAsRead === 'function') {
                await this.notificationManager.markAsRead(notificationId);
            }

            // Update UI immediately
            const item = document.querySelector(`[data-notification-id="${notificationId}"]`);
            if (item) {
                item.classList.remove('unread');
            }

            // Update badge
            this.updateBadge(this.getUnreadCount());
        } catch (error) {
            Logger.error('Error marking notification as read:', error);
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead() {
        try {
            if (this.notificationManager && typeof this.notificationManager.markAllAsRead === 'function') {
                await this.notificationManager.markAllAsRead();
            }

            // Update UI immediately
            const dropdown = document.getElementById('notification-dropdown');
            if (dropdown) {
                dropdown.querySelectorAll('.notification-dropdown-item.unread').forEach(item => {
                    item.classList.remove('unread');
                });
            }

            // Update badge
            this.updateBadge(0);

            // Hide the mark all button
            const markAllBtn = document.getElementById('notification-mark-all-read');
            if (markAllBtn) {
                markAllBtn.style.display = 'none';
            }

            Logger.debug('All notifications marked as read');
        } catch (error) {
            Logger.error('Error marking all notifications as read:', error);
        }
    }

    /**
     * Toggle dropdown open/close
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Open the dropdown
     */
    open() {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            this.isOpen = true;
            dropdown.classList.add('open');
            Logger.debug('Notification dropdown opened');
        }
    }

    /**
     * Close the dropdown
     */
    close() {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            this.isOpen = false;
            dropdown.classList.remove('open');
            Logger.debug('Notification dropdown closed');
        }
    }

    /**
     * Update the badge count
     */
    updateBadge(count) {
        const btn = document.getElementById('notification-dropdown-btn');
        if (!btn) return;

        // Remove existing badge
        const existingBadge = btn.querySelector('.notification-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Add new badge if count > 0
        if (count > 0) {
            const badgeText = count > 99 ? '99+' : count;
            const badge = document.createElement('span');
            badge.className = 'notification-badge';
            badge.textContent = badgeText;
            btn.appendChild(badge);
        }

        Logger.debug('Badge updated:', count);
    }

    /**
     * Refresh the dropdown content
     */
    refresh() {
        const dropdown = document.getElementById('notification-dropdown');
        const listContainer = dropdown?.querySelector('.notification-dropdown-list');

        if (!listContainer) return;

        const notifications = this.getNotifications();

        if (notifications.length > 0) {
            listContainer.innerHTML = notifications.map(n => this.renderNotificationItem(n)).join('');

            // Re-bind click events for new items
            listContainer.querySelectorAll('.notification-dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleNotificationClick(item);
                });
            });
        } else {
            listContainer.innerHTML = this.renderEmptyState();
        }

        // Update badge
        this.updateBadge(this.getUnreadCount());

        // Update mark all button visibility
        const markAllBtn = document.getElementById('notification-mark-all-read');
        if (markAllBtn) {
            markAllBtn.style.display = this.getUnreadCount() > 0 ? '' : 'none';
        }

        Logger.debug('Notification dropdown refreshed');
    }

    /**
     * Set the notification manager (for late binding)
     */
    setNotificationManager(manager) {
        this.notificationManager = manager;
        this.refresh();
    }
}

export default NotificationDropdown;
