import { Logger } from './Logger.js';
import { Toast } from '../components/Toast.js';

/**
 * NotificationManager - Singleton class for managing frontend notifications
 * Handles polling, state management, and event dispatching for notifications
 */
export class NotificationManager {
    constructor(app) {
        this.app = app;
        this.pollingInterval = null;
        this.pollDelay = 30000; // 30 seconds
        this.state = {
            unreadCount: 0,
            notifications: [],
            isDropdownOpen: false
        };
        this.listeners = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize the notification manager
     * Starts polling and loads initial data
     */
    async init() {
        if (this.isInitialized) {
            Logger.warn('NotificationManager already initialized');
            return;
        }

        Logger.log('NotificationManager initializing...');

        try {
            // Load initial data
            await Promise.all([
                this.loadNotifications(),
                this.loadUnreadCount()
            ]);

            // Start polling
            this.startPolling();
            this.isInitialized = true;

            Logger.log('NotificationManager initialized successfully');
        } catch (error) {
            Logger.error('Failed to initialize NotificationManager:', error);
            // Don't throw - let the app continue without notifications
        }
    }

    /**
     * Destroy the notification manager
     * Stops polling and cleans up resources
     */
    destroy() {
        Logger.log('NotificationManager destroying...');

        this.stopPolling();
        this.listeners.clear();
        this.state = {
            unreadCount: 0,
            notifications: [],
            isDropdownOpen: false
        };
        this.isInitialized = false;

        Logger.log('NotificationManager destroyed');
    }

    /**
     * Start the polling mechanism
     */
    startPolling() {
        if (this.pollingInterval) {
            return;
        }

        Logger.debug('Starting notification polling (interval: ' + this.pollDelay + 'ms)');

        this.pollingInterval = setInterval(async () => {
            await this.poll();
        }, this.pollDelay);
    }

    /**
     * Stop the polling mechanism
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            Logger.debug('Notification polling stopped');
        }
    }

    /**
     * Poll for new notifications
     */
    async poll() {
        // Skip polling if not authenticated
        if (!this.app.auth.isAuthenticated()) {
            return;
        }

        try {
            const previousCount = this.state.unreadCount;
            const previousNotifications = [...this.state.notifications];

            await Promise.all([
                this.loadNotifications(),
                this.loadUnreadCount()
            ]);

            // Check for new notifications
            if (this.state.notifications.length > 0 && previousNotifications.length > 0) {
                const newNotifications = this.state.notifications.filter(
                    notification => !previousNotifications.find(prev => prev.id === notification.id)
                );

                // Show toast for each new notification and dispatch event
                newNotifications.forEach(notification => {
                    // Dispatch event first
                    this.dispatchEvent('newNotification', notification);

                    // Show toast notification
                    Toast.showNotification(notification);

                    // Show desktop notification if enabled
                    this.showDesktopNotification(notification);
                });
            }
        } catch (error) {
            Logger.error('Notification polling failed:', error);
            // Don't stop polling on error - will retry on next interval
        }
    }

    /**
     * Load notifications from the API
     * @returns {Promise<Array>} Array of notifications
     */
    async loadNotifications() {
        try {
            const response = await this.app.api.get('/notifications', { limit: 10, status: 'active' });

            if (response.success && Array.isArray(response.data)) {
                const previousNotifications = this.state.notifications;
                this.state.notifications = response.data.map(n => ({
                    id: n.id,
                    type: n.type || 'info',
                    title: n.title,
                    message: n.message,
                    read: n.status === 'read' || n.read_at !== null,
                    read_at: n.read_at,
                    created_at: n.created_at,
                    link: n.link
                }));

                // Check if notifications changed
                if (JSON.stringify(previousNotifications) !== JSON.stringify(this.state.notifications)) {
                    this.dispatchEvent('notificationsUpdated', this.state.notifications);
                }

                return this.state.notifications;
            }

            const previousNotifications = this.state.notifications;
            this.state.notifications = [];
            if (JSON.stringify(previousNotifications) !== JSON.stringify(this.state.notifications)) {
                this.dispatchEvent('notificationsUpdated', this.state.notifications);
            }
            return this.state.notifications;
        } catch (error) {
            Logger.error('Failed to load notifications:', error);
            return [];
        }
    }

    /**
     * Load unread notification count from the API
     * @returns {Promise<number>} Unread count
     */
    async loadUnreadCount() {
        try {
            const response = await this.app.api.get('/notifications/unread-count');

            if (response.success && typeof response.data?.count === 'number') {
                const previousCount = this.state.unreadCount;
                this.state.unreadCount = response.data.count;

                // Check if count changed
                if (previousCount !== this.state.unreadCount) {
                    this.dispatchEvent('unreadCountChanged', this.state.unreadCount);
                }

                return this.state.unreadCount;
            }

            // Calculate from local notifications if API fails
            return this.calculateUnreadFromNotifications();
        } catch (error) {
            Logger.error('Failed to load unread count:', error);
            // Calculate from local notifications
            return this.calculateUnreadFromNotifications();
        }
    }

    /**
     * Calculate unread count from current notifications
     * @returns {number} Unread count
     */
    calculateUnreadFromNotifications() {
        const unreadCount = this.state.notifications.filter(n => !n.read && !n.read_at).length;
        const previousCount = this.state.unreadCount;
        this.state.unreadCount = unreadCount;

        if (previousCount !== unreadCount) {
            this.dispatchEvent('unreadCountChanged', unreadCount);
        }

        return unreadCount;
    }

    /**
     * Mark a notification as read
     * @param {string} notificationId - ID of the notification to mark as read
     * @returns {Promise<boolean>} Success status
     */
    async markAsRead(notificationId) {
        try {
            const response = await this.app.api.put(`/notifications/${encodeURIComponent(notificationId)}/read`);

            if (response.success) {
                // Update local state
                const notification = this.state.notifications.find(n => n.id === notificationId);
                if (notification && !notification.read_at) {
                    notification.read = true;
                    notification.read_at = new Date().toISOString();
                    this.state.unreadCount = Math.max(0, this.state.unreadCount - 1);

                    this.dispatchEvent('notificationsUpdated', this.state.notifications);
                    this.dispatchEvent('unreadCountChanged', this.state.unreadCount);
                }

                Logger.debug('Notification marked as read:', notificationId);
                return true;
            }

            return false;
        } catch (error) {
            Logger.error('Failed to mark notification as read:', error);
            return false;
        }
    }

    /**
     * Mark all notifications as read
     * @returns {Promise<boolean>} Success status
     */
    async markAllAsRead() {
        try {
            const response = await this.app.api.put('/notifications/mark-all-read');

            if (response.success) {
                // Update local state
                this.state.notifications.forEach(notification => {
                    if (!notification.read_at) {
                        notification.read = true;
                        notification.read_at = new Date().toISOString();
                    }
                });
                this.state.unreadCount = 0;

                this.dispatchEvent('notificationsUpdated', this.state.notifications);
                this.dispatchEvent('unreadCountChanged', this.state.unreadCount);

                Logger.debug('All notifications marked as read');
                return true;
            }

            return false;
        } catch (error) {
            Logger.error('Failed to mark all notifications as read:', error);
            return false;
        }
    }

    /**
     * Archive a notification
     * @param {string} id - ID of the notification to archive
     * @returns {Promise<boolean>} Success status
     */
    async archiveNotification(id) {
        try {
            const response = await this.app.api.put(`/notifications/${encodeURIComponent(id)}/archive`, {
                archived: true
            });

            if (response.success) {
                // Remove from local state
                const index = this.state.notifications.findIndex(n => n.id === id);
                if (index !== -1) {
                    const notification = this.state.notifications[index];
                    if (!notification.read_at) {
                        this.state.unreadCount = Math.max(0, this.state.unreadCount - 1);
                        this.dispatchEvent('unreadCountChanged', this.state.unreadCount);
                    }
                    this.state.notifications.splice(index, 1);
                    this.dispatchEvent('notificationsUpdated', this.state.notifications);
                }

                Logger.debug('Notification archived:', id);
                return true;
            }

            return false;
        } catch (error) {
            Logger.error('Failed to archive notification:', error);
            return false;
        }
    }

    /**
     * Delete a notification
     * @param {string} id - ID of the notification to delete
     * @returns {Promise<boolean>} Success status
     */
    async deleteNotification(id) {
        try {
            const response = await this.app.api.delete(`/notifications/${encodeURIComponent(id)}`);

            if (response.success) {
                // Remove from local state
                const index = this.state.notifications.findIndex(n => n.id === id);
                if (index !== -1) {
                    const notification = this.state.notifications[index];
                    if (!notification.read_at) {
                        this.state.unreadCount = Math.max(0, this.state.unreadCount - 1);
                        this.dispatchEvent('unreadCountChanged', this.state.unreadCount);
                    }
                    this.state.notifications.splice(index, 1);
                    this.dispatchEvent('notificationsUpdated', this.state.notifications);
                }

                Logger.debug('Notification deleted:', id);
                return true;
            }

            return false;
        } catch (error) {
            Logger.error('Failed to delete notification:', error);
            return false;
        }
    }

    /**
     * Get cached notifications
     * @returns {Array} Array of notifications
     */
    getNotifications() {
        return this.state.notifications;
    }

    /**
     * Get cached unread count
     * @returns {number} Unread count
     */
    getUnreadCount() {
        return this.state.unreadCount;
    }

    /**
     * Set dropdown open state
     * @param {boolean} isOpen - Whether dropdown is open
     */
    setDropdownOpen(isOpen) {
        this.state.isDropdownOpen = isOpen;
    }

    /**
     * Get dropdown open state
     * @returns {boolean} Whether dropdown is open
     */
    isDropdownOpen() {
        return this.state.isDropdownOpen;
    }

    /**
     * Register an event listener for notification events
     * @param {string} eventType - Type of event to listen for
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    onNotificationReceived(callback) {
        return this.addEventListener('newNotification', callback);
    }

    /**
     * Add an event listener
     * @param {string} eventType - Type of event
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    addEventListener(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType).add(callback);

        // Return unsubscribe function
        return () => {
            const listeners = this.listeners.get(eventType);
            if (listeners) {
                listeners.delete(callback);
            }
        };
    }

    /**
     * Remove an event listener
     * @param {string} eventType - Type of event
     * @param {Function} callback - Callback function
     */
    removeEventListener(eventType, callback) {
        const listeners = this.listeners.get(eventType);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    /**
     * Dispatch a custom event
     * @param {string} type - Event type
     * @param {*} data - Event data
     */
    dispatchEvent(type, data) {
        const listeners = this.listeners.get(type);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    Logger.error(`Error in notification event listener (${type}):`, error);
                }
            });
        }

        // Also dispatch as a custom DOM event for broader compatibility
        try {
            const event = new CustomEvent(`notification:${type}`, {
                detail: data,
                bubbles: true
            });
            window.dispatchEvent(event);
        } catch (error) {
            Logger.error('Failed to dispatch DOM event:', error);
        }
    }

    /**
     * Show a desktop notification using the browser's Notification API
     * @param {Object} notification - Notification object
     */
    showDesktopNotification(notification) {
        // Check if browser supports notifications
        if (!('Notification' in window)) {
            Logger.debug('Desktop notifications not supported');
            return;
        }

        // Check if permission is granted
        if (Notification.permission !== 'granted') {
            Logger.debug('Desktop notification permission not granted');
            return;
        }

        // Check user settings (desktop notifications enabled)
        try {
            const settingsStr = localStorage.getItem('notification_settings');
            if (settingsStr) {
                const settings = JSON.parse(settingsStr);
                if (!settings.desktop) {
                    Logger.debug('Desktop notifications disabled in settings');
                    return;
                }

                // Check DND (Do Not Disturb) mode
                if (settings.dnd_enabled) {
                    const now = new Date();
                    const currentTime = now.getHours() * 60 + now.getMinutes();
                    const [startH, startM] = (settings.dnd_start || '22:00').split(':').map(Number);
                    const [endH, endM] = (settings.dnd_end || '08:00').split(':').map(Number);
                    const startTime = startH * 60 + startM;
                    const endTime = endH * 60 + endM;

                    // Check if current time is within DND period
                    let isInDND = false;
                    if (startTime > endTime) {
                        // DND spans midnight (e.g., 22:00 - 08:00)
                        isInDND = currentTime >= startTime || currentTime < endTime;
                    } else {
                        // DND within same day
                        isInDND = currentTime >= startTime && currentTime < endTime;
                    }

                    if (isInDND) {
                        Logger.debug('Skipping desktop notification - DND mode active');
                        return;
                    }
                }
            }
        } catch (e) {
            Logger.error('Error checking notification settings:', e);
        }

        try {
            // Get notification icon based on type
            const iconMap = {
                info: 'info-circle',
                success: 'circle-check',
                warning: 'alert-triangle',
                error: 'alert-circle',
                system: 'settings'
            };

            const basePath = window.OmnexConfig?.basePath || '';
            const iconUrl = `${basePath}/branding/favicon.svg`;

            // Create desktop notification
            const desktopNotification = new Notification(notification.title || 'Omnex Display Hub', {
                body: notification.message || '',
                icon: iconUrl,
                badge: iconUrl,
                tag: notification.id, // Prevents duplicate notifications with same ID
                requireInteraction: false,
                silent: false
            });

            // Handle notification click
            desktopNotification.onclick = () => {
                // Focus the window
                window.focus();

                // Navigate to link if exists
                if (notification.link) {
                    window.location.hash = notification.link;
                } else {
                    // Navigate to notifications page
                    window.location.hash = '#/notifications';
                }

                // Close the notification
                desktopNotification.close();
            };

            // Auto-close after 10 seconds
            setTimeout(() => {
                desktopNotification.close();
            }, 10000);

            Logger.debug('Desktop notification shown:', notification.title);
        } catch (error) {
            Logger.error('Error showing desktop notification:', error);
        }
    }

    /**
     * Set polling interval
     * @param {number} delay - Polling delay in milliseconds
     */
    setPollingDelay(delay) {
        this.pollDelay = delay;

        // Restart polling if already running
        if (this.pollingInterval) {
            this.stopPolling();
            this.startPolling();
        }
    }

    /**
     * Manually refresh notifications
     * @returns {Promise<void>}
     */
    async refresh() {
        await this.poll();
    }
}

export default NotificationManager;
