/**
 * BarcodeUtils - Barcode type detection and generation utility
 *
 * Supports: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF-14, QR Code
 *
 * @version 1.0.0
 */

export class BarcodeUtils {
    /**
     * Detect barcode type from content
     * @param {string} content - Barcode content
     * @returns {object} { type, isValid, formattedContent, message }
     */
    static detectType(content) {
        if (!content || typeof content !== 'string') {
            return { type: null, isValid: false, formattedContent: null, message: 'Barkod içeriği boş' };
        }

        // Clean content - remove spaces and dashes
        const cleaned = content.replace(/[\s\-]/g, '');

        // Check if numeric only
        const isNumeric = /^\d+$/.test(cleaned);

        // EAN-13: 13 digits
        if (isNumeric && cleaned.length === 13) {
            const isValid = this.validateEAN13(cleaned);
            return {
                type: 'ean13',
                isValid,
                formattedContent: cleaned,
                message: isValid ? 'Geçerli EAN-13 barkodu' : 'EAN-13 kontrol hanesi hatalı'
            };
        }

        // EAN-8: 8 digits
        if (isNumeric && cleaned.length === 8) {
            const isValid = this.validateEAN8(cleaned);
            return {
                type: 'ean8',
                isValid,
                formattedContent: cleaned,
                message: isValid ? 'Geçerli EAN-8 barkodu' : 'EAN-8 kontrol hanesi hatalı'
            };
        }

        // UPC-A: 12 digits
        if (isNumeric && cleaned.length === 12) {
            const isValid = this.validateUPCA(cleaned);
            return {
                type: 'upca',
                isValid,
                formattedContent: cleaned,
                message: isValid ? 'Geçerli UPC-A barkodu' : 'UPC-A kontrol hanesi hatalı'
            };
        }

        // UPC-E: 6-8 digits (compressed UPC)
        if (isNumeric && (cleaned.length === 6 || cleaned.length === 7 || cleaned.length === 8)) {
            return {
                type: 'upce',
                isValid: true,
                formattedContent: cleaned,
                message: 'UPC-E barkodu'
            };
        }

        // ITF-14: 14 digits (shipping containers)
        if (isNumeric && cleaned.length === 14) {
            return {
                type: 'itf14',
                isValid: true,
                formattedContent: cleaned,
                message: 'ITF-14 barkodu (koli/palet)'
            };
        }

        // Code 39: Alphanumeric + special chars (A-Z, 0-9, -.$/+% SPACE)
        if (/^[A-Z0-9\-\.$/+% ]+$/i.test(content) && content.length <= 43) {
            return {
                type: 'code39',
                isValid: true,
                formattedContent: content.toUpperCase(),
                message: 'Code 39 barkodu'
            };
        }

        // Code 128: Any ASCII character
        if (content.length > 0 && content.length <= 80) {
            return {
                type: 'code128',
                isValid: true,
                formattedContent: content,
                message: 'Code 128 barkodu'
            };
        }

        // Default to QR code for longer or complex content
        return {
            type: 'qrcode',
            isValid: true,
            formattedContent: content,
            message: 'QR Kod olarak oluşturulacak'
        };
    }

    /**
     * Validate EAN-13 check digit
     */
    static validateEAN13(code) {
        if (code.length !== 13) return false;

        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(code[i], 10);
            sum += i % 2 === 0 ? digit : digit * 3;
        }

        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit === parseInt(code[12], 10);
    }

    /**
     * Validate EAN-8 check digit
     */
    static validateEAN8(code) {
        if (code.length !== 8) return false;

        let sum = 0;
        for (let i = 0; i < 7; i++) {
            const digit = parseInt(code[i], 10);
            sum += i % 2 === 0 ? digit * 3 : digit;
        }

        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit === parseInt(code[7], 10);
    }

    /**
     * Validate UPC-A check digit
     */
    static validateUPCA(code) {
        if (code.length !== 12) return false;

        let sum = 0;
        for (let i = 0; i < 11; i++) {
            const digit = parseInt(code[i], 10);
            sum += i % 2 === 0 ? digit * 3 : digit;
        }

        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit === parseInt(code[11], 10);
    }

    /**
     * Calculate check digit for EAN-13
     * @param {string} code - 12 digit code (without check digit)
     * @returns {string} 13 digit code with check digit
     */
    static calculateEAN13CheckDigit(code) {
        if (code.length !== 12 || !/^\d+$/.test(code)) {
            throw new Error('EAN-13 için 12 haneli sayısal kod gerekli');
        }

        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(code[i], 10);
            sum += i % 2 === 0 ? digit : digit * 3;
        }

        const checkDigit = (10 - (sum % 10)) % 10;
        return code + checkDigit;
    }

    /**
     * Calculate check digit for EAN-8
     * @param {string} code - 7 digit code (without check digit)
     * @returns {string} 8 digit code with check digit
     */
    static calculateEAN8CheckDigit(code) {
        if (code.length !== 7 || !/^\d+$/.test(code)) {
            throw new Error('EAN-8 için 7 haneli sayısal kod gerekli');
        }

        let sum = 0;
        for (let i = 0; i < 7; i++) {
            const digit = parseInt(code[i], 10);
            sum += i % 2 === 0 ? digit * 3 : digit;
        }

        const checkDigit = (10 - (sum % 10)) % 10;
        return code + checkDigit;
    }

    /**
     * Get barcode type display name
     */
    static getTypeName(type) {
        const names = {
            'ean13': 'EAN-13',
            'ean8': 'EAN-8',
            'upca': 'UPC-A',
            'upce': 'UPC-E',
            'itf14': 'ITF-14',
            'code39': 'Code 39',
            'code128': 'Code 128',
            'qrcode': 'QR Kod'
        };
        return names[type] || type;
    }

    /**
     * Format barcode for display (add spaces for readability)
     */
    static formatForDisplay(code, type) {
        if (!code) return '';

        switch (type) {
            case 'ean13':
                // Format: X XXXXXX XXXXXX
                return code.slice(0, 1) + ' ' + code.slice(1, 7) + ' ' + code.slice(7);
            case 'ean8':
                // Format: XXXX XXXX
                return code.slice(0, 4) + ' ' + code.slice(4);
            case 'upca':
                // Format: X XXXXX XXXXX X
                return code.slice(0, 1) + ' ' + code.slice(1, 6) + ' ' + code.slice(6, 11) + ' ' + code.slice(11);
            case 'itf14':
                // Format: XX XXXXX XXXXX XX
                return code.slice(0, 2) + ' ' + code.slice(2, 7) + ' ' + code.slice(7, 12) + ' ' + code.slice(12);
            default:
                return code;
        }
    }

    /**
     * Generate barcode image URL using JsBarcode compatible format
     * Returns SVG data URL
     */
    static async generateBarcodeDataUrl(content, type, options = {}) {
        const {
            width = 2,
            height = 100,
            displayValue = true,
            fontSize = 14,
            background = '#ffffff',
            lineColor = '#000000',
            margin = 10
        } = options;

        // For QR codes, we need a different approach
        if (type === 'qrcode') {
            return this.generateQRCodeDataUrl(content, options);
        }

        // Check if JsBarcode is available
        if (typeof JsBarcode === 'undefined') {
            console.warn('JsBarcode not loaded, returning placeholder');
            return null;
        }

        try {
            // Create SVG element
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

            // Map our types to JsBarcode formats
            const formatMap = {
                'ean13': 'EAN13',
                'ean8': 'EAN8',
                'upca': 'UPC',
                'upce': 'UPCE',
                'itf14': 'ITF14',
                'code39': 'CODE39',
                'code128': 'CODE128'
            };

            JsBarcode(svg, content, {
                format: formatMap[type] || 'CODE128',
                width,
                height,
                displayValue,
                fontSize,
                background,
                lineColor,
                margin
            });

            // Convert SVG to data URL
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svg);
            return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
        } catch (error) {
            console.error('Barcode generation error:', error);
            return null;
        }
    }

    /**
     * Generate QR code data URL
     * Uses qrcodejs library (davidshimjs/qrcodejs)
     */
    static async generateQRCodeDataUrl(content, options = {}) {
        const {
            width = 150,
            color = '#000000',
            background = '#ffffff'
        } = options;

        // Check if QRCode is available (qrcodejs)
        if (typeof QRCode === 'undefined') {
            console.warn('QRCode library not loaded');
            return null;
        }

        try {
            // Create a temporary container
            const tempDiv = document.createElement('div');
            tempDiv.style.cssText = 'position: absolute; left: -9999px; top: -9999px;';
            document.body.appendChild(tempDiv);

            // Generate QR code with qrcodejs
            new QRCode(tempDiv, {
                text: content,
                width: width,
                height: width,
                colorDark: color,
                colorLight: background,
                correctLevel: QRCode.CorrectLevel.M
            });

            // Wait for rendering
            await new Promise(resolve => setTimeout(resolve, 100));

            // Get canvas or image from the container
            const canvas = tempDiv.querySelector('canvas');
            const img = tempDiv.querySelector('img');

            let dataUrl = null;
            if (canvas) {
                dataUrl = canvas.toDataURL('image/png');
            } else if (img && img.src) {
                dataUrl = img.src;
            }

            // Cleanup
            document.body.removeChild(tempDiv);

            return dataUrl;
        } catch (error) {
            console.error('QR code generation error:', error);
            return null;
        }
    }

    /**
     * Render barcode to canvas element
     */
    static renderToCanvas(canvas, content, type, options = {}) {
        if (type === 'qrcode') {
            return this.renderQRToCanvas(canvas, content, options);
        }

        if (typeof JsBarcode === 'undefined') {
            console.warn('JsBarcode not loaded');
            return false;
        }

        const formatMap = {
            'ean13': 'EAN13',
            'ean8': 'EAN8',
            'upca': 'UPC',
            'upce': 'UPCE',
            'itf14': 'ITF14',
            'code39': 'CODE39',
            'code128': 'CODE128'
        };

        try {
            JsBarcode(canvas, content, {
                format: formatMap[type] || 'CODE128',
                ...options
            });
            return true;
        } catch (error) {
            console.error('Barcode render error:', error);
            return false;
        }
    }

    /**
     * Render QR code to a container element
     * Uses qrcodejs library (davidshimjs/qrcodejs)
     * Note: qrcodejs renders to a div, not directly to canvas
     */
    static renderQRToCanvas(container, content, options = {}) {
        if (typeof QRCode === 'undefined') {
            console.warn('QRCode library not loaded');
            return false;
        }

        try {
            // Clear container if it's a div
            if (container.tagName === 'DIV') {
                container.innerHTML = '';
            }

            // If container is a canvas, wrap it in a div approach
            const targetElement = container.tagName === 'CANVAS'
                ? container.parentElement || container
                : container;

            new QRCode(targetElement, {
                text: content,
                width: options.width || 150,
                height: options.width || 150,
                colorDark: options.color || '#000000',
                colorLight: options.background || '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
            return true;
        } catch (error) {
            console.error('QR render error:', error);
            return false;
        }
    }

    /**
     * Check if content is likely a Hal Künye No (Turkish agricultural product code)
     * Format: Typically alphanumeric, may contain dashes
     */
    static isHalKunyeNo(content) {
        if (!content) return false;
        // Hal künye numaraları genellikle belirli bir formatta
        // Örnek formatlar: XXX-XXXX-XXXX, XXXXXXXXXX
        return /^[A-Z0-9\-]{8,20}$/i.test(content.replace(/\s/g, ''));
    }

    /**
     * Get recommended barcode type for Hal Künye No
     * QR code is recommended for complex alphanumeric content
     */
    static getRecommendedTypeForKunye(content) {
        if (!content) return 'qrcode';

        const cleaned = content.replace(/[\s\-]/g, '');

        // If it's purely numeric and fits a standard format
        if (/^\d+$/.test(cleaned)) {
            if (cleaned.length === 13) return 'ean13';
            if (cleaned.length === 8) return 'ean8';
            if (cleaned.length <= 14) return 'code128';
        }

        // For alphanumeric künye numbers, use QR code
        return 'qrcode';
    }
}

// Export as default
export default BarcodeUtils;
