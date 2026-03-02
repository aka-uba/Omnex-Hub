/**
 * MediaUtils - Media URL handling utility
 *
 * Handles media URL resolution across different environments (local, server)
 * Normalizes paths to work regardless of basePath differences
 *
 * @version 1.0.0
 */

export class MediaUtils {
    /**
     * Known base paths that might be stored in URLs
     * These will be stripped when normalizing URLs
     */
    static KNOWN_BASE_PATHS = [
        '/market-etiket-sistemi',
        '/signage',
        '/omnex',
        '/display-hub'
    ];

    /**
     * Normalize a media URL by removing any embedded basePath
     * This ensures URLs work across different environments
     *
     * @param {string} url - The URL to normalize
     * @returns {string} Normalized URL (relative path starting with storage/ or just filename)
     */
    static normalizeUrl(url) {
        if (!url || typeof url !== 'string') {
            return url;
        }

        let normalized = url.trim();

        // Handle file:// URLs (Windows absolute paths)
        if (normalized.startsWith('file://')) {
            normalized = decodeURIComponent(normalized.replace(/^file:\/+/, ''));
            if (normalized.startsWith('/') && /^[A-Za-z]:/.test(normalized.slice(1))) {
                normalized = normalized.slice(1);
            }
        }

        // Handle serve.php proxy URLs - extract the actual path
        if (normalized.includes('serve.php') && normalized.includes('path=')) {
            try {
                const urlObj = new URL(normalized, window.location.origin);
                const path = urlObj.searchParams.get('path');
                if (path) {
                    normalized = decodeURIComponent(path);
                }
            } catch (e) {
                // If URL parsing fails, try regex
                const match = normalized.match(/path=([^&]+)/);
                if (match) {
                    normalized = decodeURIComponent(match[1]);
                }
            }
        }

        // Remove known base paths
        for (const basePath of this.KNOWN_BASE_PATHS) {
            if (normalized.startsWith(basePath + '/')) {
                normalized = normalized.substring(basePath.length);
                break;
            }
        }

        // Also remove current basePath if different from known ones
        const currentBasePath = window.OmnexConfig?.basePath || '';
        if (currentBasePath && normalized.startsWith(currentBasePath + '/')) {
            normalized = normalized.substring(currentBasePath.length);
        }

        // Remove leading slash if followed by storage
        if (normalized.startsWith('/storage/')) {
            normalized = normalized.substring(1); // Remove leading /
        }

        // If path starts with just /, remove it for relative processing
        if (normalized.startsWith('/')) {
            normalized = normalized.substring(1);
        }

        return normalized;
    }

    /**
     * Get the display URL for a media file
     * This resolves the URL to work in the current environment
     *
     * @param {string} url - The URL to resolve (can be normalized or with old basePath)
     * @returns {string} Full URL that works in current environment
     */
    static getDisplayUrl(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }

        // Skip raw UUIDs - they are IDs, not file paths
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url)) {
            return '';
        }

        // Skip JSON-like strings
        if (url.startsWith('{') || url.startsWith('[')) {
            return '';
        }

        const basePath = window.OmnexConfig?.basePath || '';

        // If it's a data URL, return as-is
        if (url.startsWith('data:')) {
            return url;
        }

        // If it's a file:// URL, proxy via serve.php
        if (url.startsWith('file://')) {
            let filePath = decodeURIComponent(url.replace(/^file:\/+/, ''));
            if (filePath.startsWith('/') && /^[A-Za-z]:/.test(filePath.slice(1))) {
                filePath = filePath.slice(1);
            }
            if (/^[A-Za-z]:[\\\/]/.test(filePath)) {
                return `${basePath}/api/media/serve.php?path=${encodeURIComponent(filePath)}`;
            }
        }

        // If it's already a full HTTP(S) URL, fix the basePath if needed
        if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
                const urlObj = new URL(url);
                let pathname = urlObj.pathname;

                // Check if URL contains a wrong basePath that needs fixing
                for (const knownPath of this.KNOWN_BASE_PATHS) {
                    if (pathname.startsWith(knownPath + '/storage/')) {
                        // Replace the wrong basePath with current one
                        const relativePath = pathname.substring(knownPath.length);
                        return `${urlObj.origin}${basePath}${relativePath}`;
                    }
                }

                // URL looks fine, return as-is
                return url;
            } catch (e) {
                // URL parsing failed, return as-is
                return url;
            }
        }

        // Normalize the URL first (remove any old basePath)
        const normalized = this.normalizeUrl(url);

        // Absolute Windows path (e.g., C:\...)
        if (/^[A-Za-z]:[\\\/]/.test(normalized)) {
            return `${basePath}/api/media/serve.php?path=${encodeURIComponent(normalized)}`;
        }

        // Now build the correct URL with current basePath
        if (normalized.startsWith('storage/')) {
            return `${basePath}/${normalized}`;
        }

        // If it's just a filename or relative path, assume it's in storage/media
        if (!normalized.includes('/')) {
            return `${basePath}/storage/media/${normalized}`;
        }

        // Other paths - add basePath and storage prefix if needed
        if (normalized.startsWith('media/') || normalized.startsWith('uploads/')) {
            return `${basePath}/storage/${normalized}`;
        }

        // Default: assume storage path
        return `${basePath}/storage/${normalized}`;
    }

    /**
     * Get URL for storing in database
     * This returns a normalized path without basePath for portability
     *
     * @param {string} url - The URL to normalize for storage
     * @returns {string} Normalized path for database storage
     */
    static getStorageUrl(url) {
        if (!url || typeof url !== 'string') {
            return url;
        }

        // Normalize first
        let normalized = this.normalizeUrl(url);

        // Ensure it starts with storage/ for consistency
        if (!normalized.startsWith('storage/') && !normalized.startsWith('http')) {
            // Check if it's just a filename
            if (!normalized.includes('/')) {
                normalized = `storage/media/${normalized}`;
            } else if (normalized.startsWith('media/') || normalized.startsWith('uploads/')) {
                normalized = `storage/${normalized}`;
            }
        }

        return normalized;
    }

    /**
     * Extract filename from URL
     *
     * @param {string} url - The URL
     * @returns {string} Filename
     */
    static getFilename(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }

        // Handle query strings
        let path = url.split('?')[0];

        // Get the last segment
        const segments = path.split('/').filter(s => s);
        return segments.length > 0 ? segments[segments.length - 1] : '';
    }

    /**
     * Check if URL is an image
     *
     * @param {string} url - The URL to check
     * @returns {boolean}
     */
    static isImage(url) {
        if (!url) return false;
        const ext = this.getFilename(url).toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    }

    /**
     * Check if URL is a video
     *
     * @param {string} url - The URL to check
     * @returns {boolean}
     */
    static isVideo(url) {
        if (!url) return false;
        const ext = this.getFilename(url).toLowerCase().split('.').pop();
        return ['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv'].includes(ext);
    }
}

// Also export as default for convenience
export default MediaUtils;
