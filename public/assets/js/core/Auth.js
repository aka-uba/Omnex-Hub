/**
 * Auth - Authentication Handler
 *
 * @package OmnexDisplayHub
 */

import { Logger } from './Logger.js';

export class Auth {
    constructor(api, state) {
        this.api = api;
        this.state = state;
        this.user = null;
        this.storageKey = window.OmnexConfig?.storageKeys?.user || 'omnex_user';
    }

    /**
     * Check if user is authenticated
     */
    async check() {
        // Try to load user from storage
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                this.user = JSON.parse(stored);
                this.state.set('user', this.user);
            } catch (e) {
                localStorage.removeItem(this.storageKey);
            }
        }

        // Verify with server if we have a token
        if (this.api.token) {
            try {
                Logger.debug('Auth: Checking session with API...');
                const response = await this.api.get('/auth/session');
                if (response.success && response.data?.user) {
                    this.setUser(response.data.user);
                    Logger.debug('Auth: Session valid');
                    return true;
                }
            } catch (e) {
                Logger.warn('Auth: Session check failed', e);
                if (e.status === 401) {
                    // Token invalid or expired - clear everything
                    Logger.debug('Auth: 401 response, clearing tokens and user');
                    this.api.clearTokens();
                    this.clearUser();
                    return false;
                } else if (e.offline) {
                    // Network error - continue with stored user if available
                    Logger.warn('Auth: Network error, using stored user');
                }
            }
        }

        return this.isAuthenticated();
    }

    /**
     * Login user
     */
    async login(email, password, remember = false) {
        const response = await this.api.post('/auth/login', {
            email,
            password,
            remember
        }, { noAuth: true });

        if (response.success && response.data) {
            // Save tokens
            this.api.saveTokens(
                response.data.access_token,
                response.data.refresh_token
            );

            // Save user
            this.setUser(response.data.user);

            return response.data.user;
        }

        throw new Error(response.message || (typeof window.__ === 'function' ? window.__('auth.loginFailed') : 'Login failed'));
    }

    /**
     * Register new user
     */
    async register(data) {
        const response = await this.api.post('/auth/register', data, { noAuth: true });

        if (response.success) {
            return response.data;
        }

        throw new Error(response.message || (typeof window.__ === 'function' ? window.__('auth.registerFailed') : 'Register failed'));
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            await this.api.post('/auth/logout');
        } catch (e) {
            // Ignore errors - logout locally anyway
        }

        this.api.clearTokens();
        this.clearUser();

        // Redirect to login
        window.location.hash = '#/login';
    }

    /**
     * Request password reset
     */
    async forgotPassword(email) {
        const response = await this.api.post('/auth/forgot-password', { email }, { noAuth: true });

        if (response.success) {
            return true;
        }

        throw new Error(response.message || (typeof window.__ === 'function' ? window.__('auth.operationFailed') : 'Operation failed'));
    }

    /**
     * Reset password
     */
    async resetPassword(token, password, passwordConfirmation) {
        const response = await this.api.post('/auth/reset-password', {
            token,
            password,
            password_confirmation: passwordConfirmation
        }, { noAuth: true });

        if (response.success) {
            return true;
        }

        throw new Error(response.message || (typeof window.__ === 'function' ? window.__('auth.operationFailed') : 'Operation failed'));
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.user !== null && this.api.token !== null;
    }

    /**
     * Get current user
     */
    getUser() {
        return this.user;
    }

    /**
     * Get user ID
     */
    getUserId() {
        return this.user?.id || null;
    }

    /**
     * Get user role
     */
    getRole() {
        return this.user?.role || null;
    }

    /**
     * Get company ID
     */
    getCompanyId() {
        return this.user?.company_id || null;
    }

    /**
     * Check if user has role
     */
    hasRole(roles) {
        if (!this.user) return false;

        const roleArray = Array.isArray(roles) ? roles : [roles];
        return roleArray.includes(this.user.role);
    }

    /**
     * Check if user is SuperAdmin
     */
    isSuperAdmin() {
        return this.hasRole('SuperAdmin');
    }

    /**
     * Check if user is Admin
     */
    isAdmin() {
        return this.hasRole(['SuperAdmin', 'Admin']);
    }

    /**
     * Check if user can perform action on resource
     */
    can(action, resource) {
        if (!this.user) return false;

        // SuperAdmin can do everything
        if (this.user.role === 'SuperAdmin') return true;

        // Check permissions from user object
        const permissions = this.user.permissions || {};
        const resourcePerms = permissions[resource];

        if (!resourcePerms) return false;

        return resourcePerms.includes(action) || resourcePerms.includes('*');
    }

    /**
     * Set user
     */
    setUser(user) {
        this.user = user;
        this.state.set('user', user);
        localStorage.setItem(this.storageKey, JSON.stringify(user));
    }

    /**
     * Clear user
     */
    clearUser() {
        this.user = null;
        this.state.delete('user');
        localStorage.removeItem(this.storageKey);
    }

    /**
     * Update user profile
     */
    async updateProfile(data) {
        const response = await this.api.put('/users/' + this.user.id, data);

        if (response.success && response.data) {
            this.setUser({ ...this.user, ...response.data });
            return response.data;
        }

        throw new Error(response.message || (typeof window.__ === 'function' ? window.__('auth.updateFailed2') : 'Update failed'));
    }

    /**
     * Change password
     */
    async changePassword(currentPassword, newPassword, confirmPassword) {
        const response = await this.api.post('/auth/change-password', {
            current_password: currentPassword,
            password: newPassword,
            password_confirmation: confirmPassword
        });

        if (response.success) {
            return true;
        }

        throw new Error(response.message || (typeof window.__ === 'function' ? window.__('auth.changePasswordFailed') : 'Password change failed'));
    }
}

export default Auth;
