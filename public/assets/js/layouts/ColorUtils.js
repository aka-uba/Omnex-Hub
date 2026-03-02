/**
 * ColorUtils - WCAG Color Contrast Utilities
 *
 * @package OmnexDisplayHub
 */

export class ColorUtils {
    /**
     * Convert hex color to RGB
     */
    static hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace(/^#/, '');

        // Handle shorthand hex (e.g., #fff)
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }

        const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * Convert RGB to hex
     */
    static rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * Get relative luminance (WCAG formula)
     */
    static getLuminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928
                ? c / 12.92
                : Math.pow((c + 0.055) / 1.055, 2.4);
        });

        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    /**
     * Get contrast ratio between two colors
     */
    static getContrastRatio(color1, color2) {
        const rgb1 = typeof color1 === 'string' ? this.hexToRgb(color1) : color1;
        const rgb2 = typeof color2 === 'string' ? this.hexToRgb(color2) : color2;

        if (!rgb1 || !rgb2) return 1;

        const l1 = this.getLuminance(rgb1.r, rgb1.g, rgb1.b);
        const l2 = this.getLuminance(rgb2.r, rgb2.g, rgb2.b);

        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);

        return (lighter + 0.05) / (darker + 0.05);
    }

    /**
     * Check if color is light (luminance > 0.5)
     */
    static isLightColor(color) {
        const rgb = typeof color === 'string' ? this.hexToRgb(color) : color;

        if (!rgb) return true; // Default to light

        const luminance = this.getLuminance(rgb.r, rgb.g, rgb.b);
        return luminance > 0.5;
    }

    /**
     * Check if color is dark (luminance <= 0.5)
     */
    static isDarkColor(color) {
        return !this.isLightColor(color);
    }

    /**
     * Get appropriate text color for background (black or white)
     */
    static getContrastTextColor(bgColor) {
        const rgb = typeof bgColor === 'string' ? this.hexToRgb(bgColor) : bgColor;

        if (!rgb) return '#212529';

        const luminance = this.getLuminance(rgb.r, rgb.g, rgb.b);

        // Use white text for dark backgrounds, dark text for light backgrounds
        return luminance > 0.5 ? '#212529' : '#ffffff';
    }

    /**
     * Get icon color based on background
     */
    static getIconColor(bgColor) {
        const rgb = typeof bgColor === 'string' ? this.hexToRgb(bgColor) : bgColor;

        if (!rgb) return '#495057';

        const luminance = this.getLuminance(rgb.r, rgb.g, rgb.b);

        return luminance > 0.5 ? '#495057' : 'rgba(255, 255, 255, 0.8)';
    }

    /**
     * Get hover background color
     */
    static getHoverBackgroundColor(bgColor) {
        const rgb = typeof bgColor === 'string' ? this.hexToRgb(bgColor) : bgColor;

        if (!rgb) return 'rgba(0, 0, 0, 0.05)';

        const luminance = this.getLuminance(rgb.r, rgb.g, rgb.b);

        if (luminance > 0.5) {
            // Light background - darken
            return `rgba(0, 0, 0, 0.05)`;
        } else {
            // Dark background - lighten
            return `rgba(255, 255, 255, 0.1)`;
        }
    }

    /**
     * Get active background color
     */
    static getActiveBackgroundColor(bgColor, brandColor = '#228be6') {
        const rgb = typeof bgColor === 'string' ? this.hexToRgb(bgColor) : bgColor;
        const brandRgb = this.hexToRgb(brandColor);

        if (!rgb) return 'rgba(34, 139, 230, 0.1)';

        const luminance = this.getLuminance(rgb.r, rgb.g, rgb.b);

        if (luminance > 0.5) {
            return `rgba(${brandRgb.r}, ${brandRgb.g}, ${brandRgb.b}, 0.1)`;
        } else {
            return `rgba(${brandRgb.r}, ${brandRgb.g}, ${brandRgb.b}, 0.2)`;
        }
    }

    /**
     * Darken color by percentage
     */
    static darken(color, percent) {
        const rgb = typeof color === 'string' ? this.hexToRgb(color) : color;

        if (!rgb) return color;

        const factor = 1 - percent / 100;

        return this.rgbToHex(
            Math.round(rgb.r * factor),
            Math.round(rgb.g * factor),
            Math.round(rgb.b * factor)
        );
    }

    /**
     * Lighten color by percentage
     */
    static lighten(color, percent) {
        const rgb = typeof color === 'string' ? this.hexToRgb(color) : color;

        if (!rgb) return color;

        const factor = percent / 100;

        return this.rgbToHex(
            Math.round(rgb.r + (255 - rgb.r) * factor),
            Math.round(rgb.g + (255 - rgb.g) * factor),
            Math.round(rgb.b + (255 - rgb.b) * factor)
        );
    }

    /**
     * Mix two colors
     */
    static mix(color1, color2, weight = 50) {
        const rgb1 = typeof color1 === 'string' ? this.hexToRgb(color1) : color1;
        const rgb2 = typeof color2 === 'string' ? this.hexToRgb(color2) : color2;

        if (!rgb1 || !rgb2) return color1;

        const w = weight / 100;

        return this.rgbToHex(
            Math.round(rgb1.r * w + rgb2.r * (1 - w)),
            Math.round(rgb1.g * w + rgb2.g * (1 - w)),
            Math.round(rgb1.b * w + rgb2.b * (1 - w))
        );
    }

    /**
     * Check if color meets WCAG contrast requirements
     */
    static meetsContrastRequirement(bgColor, textColor, level = 'AA', size = 'normal') {
        const ratio = this.getContrastRatio(bgColor, textColor);

        // WCAG requirements
        const requirements = {
            AA: { normal: 4.5, large: 3 },
            AAA: { normal: 7, large: 4.5 }
        };

        return ratio >= requirements[level][size];
    }

    /**
     * Apply sidebar colors to CSS variables
     */
    static applySidebarColors(bgColor) {
        const textColor = this.getContrastTextColor(bgColor);
        const iconColor = this.getIconColor(bgColor);
        const hoverBg = this.getHoverBackgroundColor(bgColor);
        const activeBg = this.getActiveBackgroundColor(bgColor);

        const root = document.documentElement;

        root.style.setProperty('--sidebar-bg', bgColor);
        root.style.setProperty('--sidebar-text', textColor);
        root.style.setProperty('--sidebar-icon', iconColor);
        root.style.setProperty('--sidebar-hover', hoverBg);
        root.style.setProperty('--sidebar-active', activeBg);
    }

    /**
     * Generate color palette from base color
     */
    static generatePalette(baseColor) {
        return {
            50: this.lighten(baseColor, 95),
            100: this.lighten(baseColor, 85),
            200: this.lighten(baseColor, 70),
            300: this.lighten(baseColor, 50),
            400: this.lighten(baseColor, 25),
            500: baseColor,
            600: this.darken(baseColor, 10),
            700: this.darken(baseColor, 25),
            800: this.darken(baseColor, 40),
            900: this.darken(baseColor, 55)
        };
    }
}

export default ColorUtils;
