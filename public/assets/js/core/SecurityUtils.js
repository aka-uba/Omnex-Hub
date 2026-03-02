/**
 * Security Utilities
 *
 * Client-side security functions for:
 * - XSS prevention (escapeHTML)
 * - Input sanitization
 * - URL validation
 * - Safe DOM manipulation
 *
 * @package OmnexDisplayHub
 */

/**
 * Escape HTML entities to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHTML(str) {
    if (str === null || str === undefined) {
        return '';
    }

    if (typeof str !== 'string') {
        str = String(str);
    }

    const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    return str.replace(/[&<>"'`=\/]/g, char => escapeMap[char]);
}

/**
 * Escape HTML in template literals
 * Usage: html`<div>${unsafe}</div>`
 * @param {TemplateStringsArray} strings - Template strings
 * @param {...any} values - Values to interpolate
 * @returns {string} Safe HTML string
 */
export function html(strings, ...values) {
    let result = strings[0];

    for (let i = 0; i < values.length; i++) {
        const value = values[i];

        // If value is marked as safe, use it directly
        if (value && value.__safe) {
            result += value.toString();
        }
        // If value is array, escape each element
        else if (Array.isArray(value)) {
            result += value.map(v => escapeHTML(v)).join('');
        }
        // Otherwise escape
        else {
            result += escapeHTML(value);
        }

        result += strings[i + 1];
    }

    return result;
}

/**
 * Mark a string as safe (already escaped)
 * @param {string} str - Pre-escaped string
 * @returns {object} Safe string wrapper
 */
export function safe(str) {
    return {
        __safe: true,
        toString: () => str
    };
}

/**
 * Sanitize string input
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitize(str) {
    if (typeof str !== 'string') {
        return '';
    }

    // Remove null bytes
    str = str.replace(/\0/g, '');

    // Remove control characters (except newlines and tabs)
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize whitespace
    str = str.trim();

    return str;
}

/**
 * Validate URL to prevent javascript: and data: URIs
 * @param {string} url - URL to validate
 * @returns {boolean} True if safe
 */
export function isValidURL(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    // Block dangerous protocols
    const dangerousProtocols = [
        'javascript:',
        'data:',
        'vbscript:',
        'file:'
    ];

    const lowerUrl = url.toLowerCase().trim();

    for (const protocol of dangerousProtocols) {
        if (lowerUrl.startsWith(protocol)) {
            return false;
        }
    }

    // Allow relative URLs, http, https
    if (lowerUrl.startsWith('/') ||
        lowerUrl.startsWith('#') ||
        lowerUrl.startsWith('http://') ||
        lowerUrl.startsWith('https://')) {
        return true;
    }

    // Allow relative paths without leading slash
    if (!lowerUrl.includes(':')) {
        return true;
    }

    return false;
}

/**
 * Create a safe link element
 * @param {string} href - Link URL
 * @param {string} text - Link text
 * @param {object} attrs - Additional attributes
 * @returns {string} Safe HTML link
 */
export function safeLink(href, text, attrs = {}) {
    if (!isValidURL(href)) {
        href = '#';
    }

    const safeAttrs = Object.entries(attrs)
        .filter(([key]) => !key.toLowerCase().startsWith('on')) // Block event handlers
        .map(([key, value]) => `${escapeHTML(key)}="${escapeHTML(value)}"`)
        .join(' ');

    return `<a href="${escapeHTML(href)}"${safeAttrs ? ' ' + safeAttrs : ''}>${escapeHTML(text)}</a>`;
}

/**
 * Safely set innerHTML with sanitization
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML content
 */
export function setInnerHTML(element, htmlContent) {
    if (!element) return;

    // Create a temporary div to sanitize
    const temp = document.createElement('div');
    temp.innerHTML = htmlContent;

    // Remove dangerous elements
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form'];
    dangerousTags.forEach(tag => {
        temp.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Remove event handlers
    temp.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.toLowerCase().startsWith('on')) {
                el.removeAttribute(attr.name);
            }
        });
    });

    // Remove dangerous href/src
    temp.querySelectorAll('[href], [src]').forEach(el => {
        const href = el.getAttribute('href');
        const src = el.getAttribute('src');

        if (href && !isValidURL(href)) {
            el.removeAttribute('href');
        }
        if (src && !isValidURL(src)) {
            el.removeAttribute('src');
        }
    });

    element.innerHTML = temp.innerHTML;
}

/**
 * Create element safely
 * @param {string} tag - Tag name
 * @param {object} attrs - Attributes
 * @param {string|HTMLElement|Array} children - Child content
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = null) {
    const element = document.createElement(tag);

    // Set safe attributes
    Object.entries(attrs).forEach(([key, value]) => {
        // Block event handlers
        if (key.toLowerCase().startsWith('on')) {
            return;
        }

        // Validate URLs
        if ((key === 'href' || key === 'src') && !isValidURL(value)) {
            return;
        }

        // Set attribute
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else {
            element.setAttribute(key, value);
        }
    });

    // Add children
    if (children) {
        if (typeof children === 'string') {
            element.textContent = children; // Safe - no HTML parsing
        } else if (children instanceof HTMLElement) {
            element.appendChild(children);
        } else if (Array.isArray(children)) {
            children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else if (child instanceof HTMLElement) {
                    element.appendChild(child);
                }
            });
        }
    }

    return element;
}

/**
 * Encode data for use in URL
 * @param {object} data - Data to encode
 * @returns {string} URL-safe query string
 */
export function encodeQueryParams(data) {
    return Object.entries(data)
        .filter(([_, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
}

/**
 * Decode URL query string safely
 * @param {string} queryString - Query string to decode
 * @returns {object} Decoded parameters
 */
export function decodeQueryParams(queryString) {
    if (!queryString) return {};

    // Remove leading ? if present
    if (queryString.startsWith('?')) {
        queryString = queryString.slice(1);
    }

    const params = {};
    queryString.split('&').forEach(pair => {
        const [key, value] = pair.split('=').map(decodeURIComponent);
        if (key) {
            params[sanitize(key)] = value ? sanitize(value) : '';
        }
    });

    return params;
}

// Export as global function for convenience
if (typeof window !== 'undefined') {
    window.escapeHTML = escapeHTML;
    window.sanitize = sanitize;
    window.isValidURL = isValidURL;
}

export default {
    escapeHTML,
    html,
    safe,
    sanitize,
    isValidURL,
    safeLink,
    setInnerHTML,
    createElement,
    encodeQueryParams,
    decodeQueryParams
};
