/**
 * Router - Hash-based client-side routing
 *
 * @package OmnexDisplayHub
 */

export class Router {
    constructor(app) {
        this.app = app;
        this.routes = [];
        this.notFoundHandler = null;
        this.currentRoute = null;
        this.params = {};

        // Listen for hash change events
        window.addEventListener('hashchange', () => this.handleRoute());
        document.addEventListener('click', (e) => this.handleClick(e));
    }

    /**
     * Add route
     */
    addRoute(path, handler) {
        const pattern = this.pathToRegex(path);
        this.routes.push({ path, pattern, handler });
        return this;
    }

    /**
     * Set 404 handler
     */
    setNotFound(handler) {
        this.notFoundHandler = handler;
        return this;
    }

    /**
     * Navigate to path
     * @param {string} path - Target path
     * @param {Object} state - Optional state object
     * @param {boolean} force - Force reload even if same path (default: false)
     */
    navigate(path, state = {}, force = false) {
        const cleanPath = path.startsWith('/') ? path : '/' + path;

        if (this.getPath() !== cleanPath) {
            window.location.hash = '#' + cleanPath;
        } else if (force) {
            // Only reload if explicitly forced
            this.handleRoute();
        }
        // If same path and not forced, do nothing (prevents double load)
    }

    /**
     * Replace current route
     */
    replace(path, state = {}) {
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        const url = window.location.href.split('#')[0] + '#' + cleanPath;
        window.location.replace(url);
    }

    /**
     * Go back
     */
    back() {
        window.history.back();
    }

    /**
     * Go forward
     */
    forward() {
        window.history.forward();
    }

    /**
     * Get current path from hash
     */
    getPath() {
        const hash = window.location.hash.slice(1); // Remove #
        return hash || '/';
    }

    /**
     * Get route params
     */
    getParams() {
        return this.params;
    }

    /**
     * Get query params
     */
    getQuery() {
        const hash = window.location.hash.slice(1);
        const queryStart = hash.indexOf('?');

        if (queryStart === -1) return {};

        const queryString = hash.slice(queryStart + 1);
        const params = new URLSearchParams(queryString);
        const query = {};

        for (const [key, value] of params) {
            query[key] = value;
        }

        return query;
    }

    /**
     * Handle route change
     */
    handleRoute() {
        let path = this.getPath();

        // Remove query string for matching
        const queryStart = path.indexOf('?');
        if (queryStart !== -1) {
            path = path.slice(0, queryStart);
        }

        // Find matching route
        for (const route of this.routes) {
            const match = path.match(route.pattern);

            if (match) {
                this.currentRoute = route;
                this.params = this.extractParams(route.path, match);

                // Execute handler
                route.handler(this.params);
                return;
            }
        }

        // No route found - 404
        if (this.notFoundHandler) {
            this.notFoundHandler();
        }
    }

    /**
     * Handle link clicks
     */
    handleClick(e) {
        // Find closest anchor tag
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Handle hash links
        if (href.startsWith('#/')) {
            e.preventDefault();
            const path = href.slice(1); // Remove #
            this.navigate(path);
            return;
        }

        // Skip external links
        if (link.hostname && link.hostname !== window.location.hostname) return;

        // Skip links with target
        if (link.target === '_blank') return;

        // Skip download links
        if (link.hasAttribute('download')) return;

        // Skip links with data-no-router
        if (link.hasAttribute('data-no-router')) return;

        // Skip special links
        if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;

        // Handle relative paths
        if (href.startsWith('/') && !href.startsWith('//')) {
            e.preventDefault();
            this.navigate(href);
        }
    }

    /**
     * Convert path pattern to regex
     */
    pathToRegex(path) {
        const pattern = path
            // Escape special regex chars except : and *
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            // Convert :param to named capture group
            .replace(/:(\w+)/g, '(?<$1>[^/]+)')
            // Convert * to wildcard
            .replace(/\*/g, '.*');

        return new RegExp(`^${pattern}$`);
    }

    /**
     * Extract params from match
     */
    extractParams(path, match) {
        const params = {};
        const paramNames = [...path.matchAll(/:(\w+)/g)].map(m => m[1]);

        paramNames.forEach((name, i) => {
            params[name] = match[i + 1];
        });

        // Also include named groups
        if (match.groups) {
            Object.assign(params, match.groups);
        }

        return params;
    }

    /**
     * Start router and handle initial route
     */
    start() {
        this.handleRoute();
        return this;
    }
}

export default Router;
