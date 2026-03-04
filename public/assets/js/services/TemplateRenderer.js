/**
 * TemplateRenderer Service
 *
 * Şablonları ürün verileriyle dinamik olarak render eder.
 * Fabric.js canvas kullanarak placeholder'ları gerçek değerlerle değiştirir.
 */

import { MediaUtils } from '../utils/MediaUtils.js';
import { BarcodeUtils } from '../utils/BarcodeUtils.js';

export class TemplateRenderer {
    constructor() {
        this.canvas = null;
        this.fabricLoaded = false;
        this._codeLibrariesLoaded = false;
        this._codeLibrariesPromise = null;
    }

    /**
     * Fabric.js kütüphanesini yükle
     * @returns {Promise<void>}
     */
    async _loadFabric() {
        // Zaten yüklüyse tekrar yükleme
        if (typeof fabric !== 'undefined') {
            this.fabricLoaded = true;
            return;
        }

        // Zaten yükleniyor mu kontrol et
        if (this._fabricLoadPromise) {
            return this._fabricLoadPromise;
        }

        this._fabricLoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const basePath = window.OmnexConfig?.basePath || '';
            script.src = `${basePath}/assets/vendor/fabric/fabric.min.js`;
            script.async = true;

            script.onload = () => {
                this.fabricLoaded = true;
                resolve();
            };

            script.onerror = () => {
                reject(new Error((typeof window.__ === 'function' ? window.__('render.errors.fabricLoadFailed') : null) || 'Fabric.js load failed'));
            };

            document.head.appendChild(script);
        });

        return this._fabricLoadPromise;
    }

    /**
     * Barcode / QR scriptlerini gerektiğinde yükle.
     * Render worker sayfalarında da kod görselleri dinamik üretilebilsin.
     * @returns {Promise<void>}
     */
    async _loadCodeLibraries() {
        if (this._codeLibrariesLoaded) return;
        if (this._codeLibrariesPromise) return this._codeLibrariesPromise;

        const needsJsBarcode = (typeof JsBarcode === 'undefined');
        const needsQrCode = (typeof QRCode === 'undefined');
        if (!needsJsBarcode && !needsQrCode) {
            this._codeLibrariesLoaded = true;
            return;
        }

        const basePath = window.OmnexConfig?.basePath || '';
        const ensureScript = (src, key) => new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-render-lib="${key}"]`);
            if (existing) {
                if (existing.dataset.loaded === '1') {
                    resolve();
                    return;
                }
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.renderLib = key;
            script.onload = () => {
                script.dataset.loaded = '1';
                resolve();
            };
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });

        const tasks = [];
        if (needsJsBarcode) {
            tasks.push(ensureScript(`${basePath}/assets/vendor/jsbarcode/JsBarcode.all.min.js`, 'jsbarcode'));
        }
        if (needsQrCode) {
            tasks.push(ensureScript(`${basePath}/assets/vendor/qrcode/qrcode.min.js`, 'qrcode'));
        }

        this._codeLibrariesPromise = Promise.allSettled(tasks)
            .then(() => {
                this._codeLibrariesLoaded = (typeof JsBarcode !== 'undefined') && (typeof QRCode !== 'undefined');
            })
            .finally(() => {
                this._codeLibrariesPromise = null;
            });

        await this._codeLibrariesPromise;
    }

    _isTextObject(obj) {
        const type = String(obj?.type || '').toLowerCase();
        return type === 'text' || type === 'textbox' || type === 'i-text' || type === 'itext';
    }

    _isImageObject(obj) {
        return String(obj?.type || '').toLowerCase() === 'image';
    }

    _getAllCanvasObjects() {
        if (!this.canvas || !this.canvas.getObjects) return [];
        const allObjects = [];

        const walk = (obj) => {
            if (!obj) return;
            allObjects.push(obj);

            const children = Array.isArray(obj._objects)
                ? obj._objects
                : (Array.isArray(obj.objects) ? obj.objects : []);
            if (children.length > 0) {
                children.forEach((child) => walk(child));
            }
        };

        this.canvas.getObjects().forEach((obj) => walk(obj));
        return allObjects;
    }

    _resolveBarcodeType(obj, value) {
        const formatMap = {
            'EAN13': 'ean13',
            'EAN8': 'ean8',
            'UPC': 'upca',
            'UPCA': 'upca',
            'UPC_A': 'upca',
            'UPCE': 'upce',
            'UPC_E': 'upce',
            'ITF14': 'itf14',
            'ITF': 'itf14',
            'CODE39': 'code39',
            'CODE128': 'code128'
        };

        const rawFormat = String(obj?.barcodeFormat || '').trim().toUpperCase();
        if (rawFormat && rawFormat !== 'AUTO') {
            return formatMap[rawFormat] || rawFormat.toLowerCase();
        }

        const detected = BarcodeUtils.detectType(String(value || ''));
        const detectedType = detected?.type || 'code128';
        return detectedType === 'qrcode' ? 'code128' : detectedType;
    }

    async _generateBarcodeDataUrl(obj, value) {
        const lineWidth = Number(obj?.barcodeLineWidth);
        const barcodeHeight = Number(obj?.barcodeHeight);
        const fontSize = Number(obj?.fontSize);
        const barcodeType = this._resolveBarcodeType(obj, value);

        return BarcodeUtils.generateBarcodeDataUrl(String(value), barcodeType, {
            width: Number.isFinite(lineWidth) && lineWidth > 0 ? lineWidth : 2,
            height: Number.isFinite(barcodeHeight) && barcodeHeight > 0 ? barcodeHeight : 80,
            displayValue: obj?.barcodeDisplayValue !== false,
            fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 14,
            background: obj?.barcodeBackground || '#ffffff',
            lineColor: obj?.barcodeLineColor || '#000000',
            margin: 10
        });
    }

    async _generateQrDataUrl(obj, value) {
        const width = (Number(obj?.width) || 120) * (Number(obj?.scaleX) || 1);
        const height = (Number(obj?.height) || 120) * (Number(obj?.scaleY) || 1);
        const qrSize = Math.max(48, Math.round(Math.min(width, height)));

        return BarcodeUtils.generateQRCodeDataUrl(String(value), {
            width: qrSize,
            color: obj?.qrForeground || '#000000',
            background: obj?.qrBackground || '#ffffff'
        });
    }

    _extractFieldKeyFromPlaceholder(rawText) {
        if (!rawText || typeof rawText !== 'string') return '';
        const match = rawText.match(/\{\{\s*([^}]+?)\s*\}\}/);
        return match ? String(match[1] || '').trim() : '';
    }

    _normalizeFieldKey(rawValue) {
        if (rawValue === null || rawValue === undefined) return '';
        const raw = String(rawValue).trim();
        if (!raw) return '';
        const fromPlaceholder = this._extractFieldKeyFromPlaceholder(raw);
        if (fromPlaceholder) return fromPlaceholder;
        return raw.replace(/\{\{|\}\}/g, '').trim();
    }

    _getObjectFieldKey(obj, textContent = '') {
        if (!obj || typeof obj !== 'object') return '';

        const dynamicField = this._normalizeFieldKey(
            obj.dynamicField || obj.dynamic_field || obj.dataField || obj.data_field || ''
        );
        if (dynamicField) return dynamicField;

        if (textContent && /\{\{\s*[^}]+\s*\}\}/.test(textContent)) {
            const keyFromText = this._extractFieldKeyFromPlaceholder(textContent);
            if (keyFromText) return keyFromText;
        }

        const keyFromPlaceholder = this._normalizeFieldKey(
            obj.placeholder || obj.placeholderText || obj.placeholder_text || ''
        );
        if (keyFromPlaceholder) return keyFromPlaceholder;

        const keyFromCode = this._normalizeFieldKey(obj.barcodeValue || obj.qrValue || '');
        if (keyFromCode) return keyFromCode;

        return '';
    }

    _isImageFieldKey(fieldKey) {
        const key = String(fieldKey || '').trim().toLowerCase();
        return key === 'image_url' || key === 'bundle_image_url';
    }

    _transparentPixelDataUrl() {
        return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    }

    _getHalFieldLabels() {
        return {
            'kunye_no': 'K\u00FCnye No',
            'uretici_adi': '\u00DCretici Ad\u0131',
            'malin_adi': 'Mal\u0131n Ad\u0131',
            'malin_cinsi': 'Mal\u0131n Cinsi',
            'malin_turu': 'Mal\u0131n T\u00FCr\u00FC',
            'uretim_yeri': '\u00DCretim Yeri',
            'uretim_sekli': '\u00DCretim \u015Eekli',
            'ilk_bildirim_tarihi': '\u0130lk Bildirim Tarihi',
            'malin_sahibi': 'Mal\u0131n Sahibi',
            'tuketim_yeri': 'T\u00FCketim Yeri',
            'tuketim_bildirim_tarihi': 'T\u00FCketim Bildirim Tarihi',
            'gumruk_kapisi': 'G\u00FCmr\u00FCk Kap\u0131s\u0131',
            'uretim_ithal_tarihi': '\u00DCretim/\u0130thal Tarihi',
            'miktar': 'Miktar',
            'alis_fiyati': 'Al\u0131\u015F Fiyat\u0131',
            'isletme_adi': '\u0130\u015Fletme Ad\u0131',
            'sertifikasyon_kurulusu': 'Sertifikasyon Kurulu\u015Fu',
            'sertifika_no': 'Sertifika No',
            'diger_bilgiler': 'Di\u011Fer Bilgiler'
        };
    }

    _getHalFieldI18nKeys() {
        return {
            'kunye_no': 'hal.fields.kunyeNo',
            'uretici_adi': 'hal.fields.ureticiAdi',
            'malin_adi': 'hal.fields.malinAdi',
            'malin_cinsi': 'hal.fields.malinCinsi',
            'malin_turu': 'hal.fields.malinTuru',
            'uretim_yeri': 'hal.fields.uretimYeri',
            'uretim_sekli': 'hal.fields.uretimSekli',
            'ilk_bildirim_tarihi': 'hal.fields.ilkBildirimTarihi',
            'malin_sahibi': 'hal.fields.malinSahibi',
            'tuketim_yeri': 'hal.fields.tuketimYeri',
            'tuketim_bildirim_tarihi': 'hal.fields.tuketimBildirimTarihi',
            'gumruk_kapisi': 'hal.fields.gumrukKapisi',
            'uretim_ithal_tarihi': 'hal.fields.uretimIthalTarihi',
            'miktar': 'hal.fields.miktar',
            'alis_fiyati': 'hal.fields.alisFiyati',
            'isletme_adi': 'hal.fields.isletmeAdi',
            'sertifikasyon_kurulusu': 'hal.fields.sertifikasyonKurulusu',
            'sertifika_no': 'hal.fields.sertifikaNo',
            'diger_bilgiler': 'hal.fields.digerBilgiler'
        };
    }

    _normalizeHalLabelKey(key) {
        const raw = String(key || '').trim();
        if (!raw) return '';

        // camelCase -> snake_case
        let normalized = raw
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .replace(/[\s\-]+/g, '_')
            .replace(/^hal[_\.]/i, '')
            .replace(/^hal/i, '')
            .toLowerCase();

        normalized = normalized
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c');

        return normalized.replace(/__+/g, '_').replace(/^_+|_+$/g, '');
    }

    _getHalFieldLabelsFromProduct(product) {
        const candidates = [
            product?.hal_field_labels,
            product?.hal_labels,
            product?.hal_data_labels,
            product?.hal_data?.field_labels,
            product?.hal_data?.labels,
            product?.hal_data?.fieldLabels,
            product?.hal_data?.field_titles,
            product?.hal_data?.fieldTitles
        ];

        const labels = {};
        candidates.forEach((source) => {
            if (!source || typeof source !== 'object') return;
            Object.entries(source).forEach(([key, value]) => {
                const normalized = this._normalizeHalLabelKey(key);
                const label = this._toSingleLineText(value);
                if (!normalized || !label) return;
                labels[normalized] = label;
            });
        });

        return labels;
    }

    _getHalLabelFromI18n(fieldKey) {
        const key = String(fieldKey || '').trim().toLowerCase();
        const i18nKey = this._getHalFieldI18nKeys()[key];
        if (!i18nKey) return '';
        if (typeof window === 'undefined') return '';

        const translatedFromApp = window.app?.i18n?.t ? window.app.i18n.t(i18nKey) : '';
        if (translatedFromApp && translatedFromApp !== i18nKey) {
            return this._toSingleLineText(translatedFromApp);
        }

        if (typeof window.__ === 'function') {
            const translated = window.__(i18nKey);
            if (translated && translated !== i18nKey) {
                return this._toSingleLineText(translated);
            }
        }

        // Legacy fallback
        const legacyKey = String(i18nKey).replace(/^hal\.fields\./, 'editor.dynamicFields.');
        if (typeof window.__ === 'function') {
            const legacy = window.__(legacyKey);
            if (legacy && legacy !== legacyKey) {
                return this._toSingleLineText(legacy);
            }
        }

        return '';
    }

    _isHalFieldKey(fieldKey) {
        const key = String(fieldKey || '').trim().toLowerCase();
        return Object.prototype.hasOwnProperty.call(this._getHalFieldLabels(), key);
    }

    _isHalProduct(product) {
        if (!product || typeof product !== 'object') return false;

        if (product.hal_data && typeof product.hal_data === 'object') {
            return true;
        }

        const halKeys = Object.keys(this._getHalFieldLabels()).filter((k) => k !== 'kunye_no');
        return halKeys.some((key) => {
            const value = product[key];
            return value !== null && value !== undefined && String(value).trim() !== '';
        });
    }

    _getHalFieldLabel(fieldKey, product = null) {
        const key = String(fieldKey || '').trim().toLowerCase();
        if (!key) return '';

        const fromProduct = this._getHalFieldLabelsFromProduct(product)[key];
        if (fromProduct) return fromProduct;

        const fromI18n = this._getHalLabelFromI18n(key);
        if (fromI18n) return fromI18n;

        return this._getHalFieldLabels()[key] || key;
    }

    _isQrCodeObject(obj) {
        const customType = String(obj?.customType || obj?.custom_type || '').toLowerCase();
        return customType === 'qrcode' || customType === 'slot-qrcode';
    }

    _toSingleLineText(value) {
        return String(value ?? '').replace(/\s+/g, ' ').trim();
    }

    _isStandalonePlaceholderText(textContent) {
        return /^\s*\{\{\s*[^}]+\s*\}\}\s*$/.test(String(textContent || ''));
    }

    _formatHalDate(value) {
        if (value === null || value === undefined) return '';
        const raw = String(value).trim();
        if (!raw) return '';

        const toDdMmYyyy = (year, month, day) => `${day}.${month}.${year}`;
        const formatDateObj = (dateObj) => {
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = String(dateObj.getFullYear());
            return toDdMmYyyy(year, month, day);
        };

        // 25.02.2026
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) return raw;

        // 25/02/2026 -> 25.02.2026
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
            const [day, month, year] = raw.split('/');
            return toDdMmYyyy(year, month, day);
        }

        // YYYY-MM-DD[ HH:mm:ss[.sss]][Z|+03:00]
        const isoLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/);
        if (isoLike) {
            const [, year, month, day] = isoLike;
            return toDdMmYyyy(year, month, day);
        }

        // YYYY/MM/DD or YYYY.MM.DD
        const ymdLike = raw.match(/^(\d{4})[\/.](\d{2})[\/.](\d{2})$/);
        if (ymdLike) {
            const [, year, month, day] = ymdLike;
            return toDdMmYyyy(year, month, day);
        }

        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            return formatDateObj(parsed);
        }

        return raw;
    }

    _formatHalFieldValue(fieldKey, value) {
        if (value === null || value === undefined) return '';
        const key = String(fieldKey || '').trim().toLowerCase();

        if (['ilk_bildirim_tarihi', 'tuketim_bildirim_tarihi', 'uretim_ithal_tarihi'].includes(key)) {
            return this._formatHalDate(value);
        }

        if (key === 'alis_fiyati') {
            const formatted = this._formatPriceWithCurrency(value);
            return formatted || String(value);
        }

        return this._toSingleLineText(value);
    }

    _formatFieldValueForText(fieldKey, value, product) {
        if (this._isHalProduct(product) && this._isHalFieldKey(fieldKey)) {
            return this._formatHalFieldValue(fieldKey, value);
        }
        return String(value ?? '');
    }

    _resolveHalLabelFromText(fieldKey, textContent, formattedValue, product) {
        const fallback = this._getHalFieldLabel(fieldKey, product);
        if (fallback) return fallback;
        const raw = this._toSingleLineText(textContent);
        if (!raw || /\{\{\s*[^}]+\s*\}\}/.test(raw)) return fallback;

        const colonIndex = raw.indexOf(':');
        if (colonIndex > 0) {
            const left = this._toSingleLineText(raw.slice(0, colonIndex));
            const right = this._toSingleLineText(raw.slice(colonIndex + 1));
            if (!right || right === formattedValue) {
                return left || fallback;
            }
        }

        if (raw === formattedValue) return fallback;
        return this._toSingleLineText(raw.replace(/[:\uFF1A]\s*$/, '')) || fallback;
        return raw.replace(/[:：]\s*$/, '') || fallback;
    }

    _formatDisplayValueForObject(obj, fieldKey, value, product, textContent = '') {
        const normalizedKey = String(fieldKey || '').trim().toLowerCase();
        const formattedValue = this._toSingleLineText(this._formatFieldValueForText(normalizedKey, value, product));
        if (formattedValue === '') return '';

        if (!this._isHalProduct(product) || !this._isHalFieldKey(normalizedKey)) {
            return formattedValue;
        }
        if (normalizedKey === 'kunye_no') {
            return formattedValue;
        }

        // QR objesinde değer QR içeriği olarak kullanılmalı, label metne yazılmaz.
        if (this._isQrCodeObject(obj)) {
            return formattedValue;
        }

        const label = this._toSingleLineText(this._resolveHalLabelFromText(normalizedKey, textContent, formattedValue, product));
        return `${label}: ${formattedValue}`;
    }

    _computeObjectTopCenter(obj) {
        const width = (Number(obj?.width) || 0) * (Number(obj?.scaleX) || 1);
        const height = (Number(obj?.height) || 0) * (Number(obj?.scaleY) || 1);
        const originX = String(obj?.originX || 'left').toLowerCase();
        const originY = String(obj?.originY || 'top').toLowerCase();
        const left = Number(obj?.left) || 0;
        const top = Number(obj?.top) || 0;

        let centerX = left + (width / 2);
        if (originX === 'center') centerX = left;
        if (originX === 'right') centerX = left - (width / 2);

        let topY = top;
        if (originY === 'center') topY = top - (height / 2);
        if (originY === 'bottom') topY = top - height;

        return { centerX, topY, width, height };
    }

    _getPreferredKunyeTitleStyle(objList, qrObj) {
        const fallback = {
            fontSize: 14,
            fontFamily: 'Arial',
            fontWeight: '700',
            fontStyle: 'normal',
            fill: '#000000',
            stroke: null,
            strokeWidth: 0,
            charSpacing: 0,
            lineHeight: 1.16
        };

        if (!Array.isArray(objList) || !qrObj) return fallback;

        const { centerX, topY } = this._computeObjectTopCenter(qrObj);
        let best = null;
        let bestScore = Number.POSITIVE_INFINITY;

        objList.forEach((candidate) => {
            if (!candidate || typeof candidate !== 'object') return;
            if (!this._isTextObject(candidate)) return;
            if (candidate.customType === 'hal-kunye-qr-title-auto') return;
            const text = this._toSingleLineText(candidate.text);
            if (!text) return;

            const cLeft = Number(candidate.left) || 0;
            const cTop = Number(candidate.top) || 0;
            const score = Math.abs(cLeft - centerX) + Math.abs(cTop - topY);
            if (score < bestScore) {
                bestScore = score;
                best = candidate;
            }
        });

        if (!best) return fallback;

        return {
            fontSize: Number(best.fontSize) > 0 ? Number(best.fontSize) : fallback.fontSize,
            fontFamily: best.fontFamily || fallback.fontFamily,
            fontWeight: best.fontWeight || fallback.fontWeight,
            fontStyle: best.fontStyle || fallback.fontStyle,
            fill: best.fill || fallback.fill,
            stroke: best.stroke ?? fallback.stroke,
            strokeWidth: Number(best.strokeWidth) || fallback.strokeWidth,
            charSpacing: Number(best.charSpacing) || fallback.charSpacing,
            lineHeight: Number(best.lineHeight) || fallback.lineHeight
        };
    }

    _estimateTextWidth(text, fontSize, fontWeight = 'normal', charSpacing = 0) {
        const raw = String(text || '');
        if (!raw) return 0;

        const size = Math.max(1, Number(fontSize) || 1);
        const isBold = /bold|[6-9]00/.test(String(fontWeight || '').toLowerCase());
        const baseFactor = isBold ? 0.62 : 0.56;
        const chars = Array.from(raw).length;
        const spacing = (Number(charSpacing) || 0) / 1000 * size * Math.max(0, chars - 1);
        return (chars * size * baseFactor) + spacing;
    }

    _fitTextFontSizeToWidth(text, maxWidth, preferredFontSize, fontWeight = 'normal', charSpacing = 0) {
        const safeWidth = Math.max(1, Number(maxWidth) || 1);
        let size = Math.max(8, Math.round(Number(preferredFontSize) || 12));

        for (let i = 0; i < 24; i += 1) {
            const estimated = this._estimateTextWidth(text, size, fontWeight, charSpacing);
            if (estimated <= safeWidth) return size;

            const ratio = safeWidth / Math.max(estimated, 1);
            const next = Math.max(8, Math.floor(size * ratio));
            size = next < size ? next : (size - 1);
            if (size <= 8) return 8;
        }

        return size;
    }

    _ensureHalKunyeQrTitleInJson(objList, obj, fieldKey, product) {
        if (!Array.isArray(objList) || !obj || !product) return;
        if (!this._isHalProduct(product)) return;

        const normalizedKey = String(fieldKey || '').trim().toLowerCase();
        if (normalizedKey !== 'kunye_no') return;
        if (!this._isQrCodeObject(obj)) return;

        const type = String(obj.type || '').toLowerCase();
        if (!['image', 'rect'].includes(type)) return;
        if (obj.__halKunyeTitleAdded) return;

        const labelText = this._getHalFieldLabel('kunye_no', product);
        const { centerX, topY, height, width } = this._computeObjectTopCenter(obj);
        const preferredStyle = this._getPreferredKunyeTitleStyle(objList, obj);
        const preferredFontSize = Number(preferredStyle.fontSize) > 0
            ? Number(preferredStyle.fontSize)
            : Math.max(12, Math.round(Math.min(24, (height || 100) * 0.12)));
        const maxTitleWidth = Math.max(24, Math.round((Number(width) || 0) - 4));
        const fontSize = this._fitTextFontSizeToWidth(
            labelText,
            maxTitleWidth,
            preferredFontSize,
            preferredStyle.fontWeight,
            preferredStyle.charSpacing
        );
        const margin = Math.max(8, Math.round(fontSize * 0.45));

        const exists = objList.some((candidate) => {
            if (!candidate || typeof candidate !== 'object') return false;
            if (!this._isTextObject(candidate)) return false;
            const text = String(candidate.text || '').trim().toLowerCase();
            if (!text) return false;
            const isKunyeText = text.includes('k\u00FCnye') || text.includes('kunye');
            if (!isKunyeText) return false;
            const cLeft = Number(candidate.left) || 0;
            const cTop = Number(candidate.top) || 0;
            return Math.abs(cLeft - centerX) <= 6 && Math.abs(cTop - (topY - margin)) <= 36;
        });

        if (!exists) {
            objList.push({
                type: 'text',
                customType: 'hal-kunye-qr-title-auto',
                text: labelText,
                left: centerX,
                top: Math.max(0, topY - fontSize - margin),
                originX: 'center',
                originY: 'top',
                textAlign: 'center',
                width: maxTitleWidth,
                fontSize,
                fontFamily: preferredStyle.fontFamily,
                fontWeight: preferredStyle.fontWeight,
                fontStyle: preferredStyle.fontStyle,
                fill: preferredStyle.fill,
                stroke: preferredStyle.stroke,
                strokeWidth: preferredStyle.strokeWidth,
                charSpacing: preferredStyle.charSpacing,
                lineHeight: preferredStyle.lineHeight,
                selectable: false,
                evented: false
            });
        }

        obj.__halKunyeTitleAdded = true;
    }

    /**
     * Single-product render icin JSON seviyesinde dinamik alanlari uygula.
     * Bu adim Fabric nesnesine custom property tasinmasinda sorun olsa bile
     * metin/barkod/qr alanlarinin dolmasini garanti eder.
     * @param {Array} objects
     * @param {Object} product
     */
    async _replaceSingleFieldsInJSON(objects, product) {
        if (!Array.isArray(objects) || !product) return;

        const codeTasks = [];
        let needsCodeLibraries = false;

        const walk = (objList) => {
            if (!Array.isArray(objList)) return;

            objList.forEach((obj) => {
                if (!obj || typeof obj !== 'object') return;
                if (obj.isRegionOverlay) return;

                const type = String(obj.type || '').toLowerCase();
                const customType = String(obj.customType || obj.custom_type || '').toLowerCase();
                const dynamicFieldRaw = String(obj.dynamicField || obj.dynamic_field || '').trim();
                const textContent = typeof obj.text === 'string' ? obj.text : '';
                const hasPlaceholder = /\{\{\s*[^}]+\s*\}\}/.test(textContent);
                const isTextType = ['text', 'textbox', 'i-text', 'itext'].includes(type);
                const fieldKey = this._getObjectFieldKey(obj, textContent);

                const value = fieldKey ? this._getProductValue(product, fieldKey) : '';
                const hasValue = value !== null && value !== undefined && String(value).trim() !== '';

                if (isTextType) {
                    if (hasPlaceholder && !dynamicFieldRaw) {
                        const isStandalonePlaceholder = this._isStandalonePlaceholderText(textContent);
                        obj.text = textContent.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key) => {
                            const normalizedKey = String(key || '').trim();
                            const val = this._getProductValue(product, normalizedKey);
                            if (isStandalonePlaceholder) {
                                return this._formatDisplayValueForObject(obj, normalizedKey, val, product, textContent);
                            }
                            return this._formatFieldValueForText(normalizedKey, val, product);
                        });
                    } else if (fieldKey) {
                        obj.text = this._formatDisplayValueForObject(obj, fieldKey, value, product, textContent);
                    }
                }

                const isSlotMedia = customType === 'slot-media';
                const isDynamicImageType =
                    ['dynamic-image', 'slot-image', 'image-placeholder'].includes(customType) ||
                    (isSlotMedia && this._isImageFieldKey(fieldKey));
                if (isDynamicImageType) {
                    if (!hasValue) {
                        obj.visible = false;
                        obj.opacity = 0;
                        if (type === 'image') {
                            obj.src = this._transparentPixelDataUrl();
                        }
                    }
                }

                const isBarcodeType = customType === 'barcode' || customType === 'slot-barcode';
                if (isBarcodeType && hasValue) {
                    obj.barcodeValue = String(value);
                    needsCodeLibraries = true;
                    codeTasks.push(async () => {
                        try {
                            const dataUrl = await this._generateBarcodeDataUrl(obj, value);
                            if (dataUrl) obj.src = dataUrl;
                        } catch (error) {
                            console.warn('[TemplateRenderer] JSON barcode render hatasi:', error);
                        }
                    });
                }

                const isQrcodeType = customType === 'qrcode' || customType === 'slot-qrcode';
                if (isQrcodeType && hasValue) {
                    obj.qrValue = String(value);
                    this._ensureHalKunyeQrTitleInJson(objList, obj, fieldKey, product);
                    needsCodeLibraries = true;
                    codeTasks.push(async () => {
                        try {
                            const dataUrl = await this._generateQrDataUrl(obj, value);
                            if (dataUrl) obj.src = dataUrl;
                        } catch (error) {
                            console.warn('[TemplateRenderer] JSON qrcode render hatasi:', error);
                        }
                    });
                }

                if (Array.isArray(obj.objects)) {
                    walk(obj.objects);
                }
            });
        };

        walk(objects);

        if (needsCodeLibraries) {
            await this._loadCodeLibraries();
        }

        if (codeTasks.length > 0) {
            await Promise.allSettled(codeTasks.map((task) => task()));
        }
    }

    /**
     * Şablonu ürün verileriyle render et
     * @param {Object} template - Şablon verisi (design_data içermeli)
     * @param {Object} product - Ürün verisi
     * @returns {Promise<string>} - PNG base64 data URL
     */
    async render(template, product) {
        // Önce Fabric.js'in yüklü olduğundan emin ol
        await this._loadFabric();

        return new Promise(async (resolve, reject) => {
            let canvasEl = null;
            let localCanvas = null;

            try {
                // design_data'yı parse et
                let designData = template.design_data || template.content;
                if (typeof designData === 'string') {
                    designData = JSON.parse(designData);
                }

                if (!designData || !designData.objects) {
                    reject(new Error((typeof window.__ === 'function' ? window.__('render.errors.noTemplateData') : null) || 'No template design data'));
                    return;
                }

                // Orijinal template verisini mutate etmemek için kopya üzerinde çalış
                designData = JSON.parse(JSON.stringify(designData));

                // Normalize image sources (file:// and basePath fixes)
                this._normalizeDesignDataSources(designData);
                this._hideNonRenderableObjects(designData.objects);
                await this._replaceSingleFieldsInJSON(designData.objects, product);

                // Orijinal obje verilerini sakla (custom properties için)
                this._originalObjects = designData.objects;

                // Canvas boyutları
                const width = template.width || 800;
                const height = template.height || 1280;

                // Off-screen canvas oluştur
                canvasEl = document.createElement('canvas');
                canvasEl.id = 'template-render-canvas-' + Date.now();
                canvasEl.width = width;
                canvasEl.height = height;
                canvasEl.style.display = 'none';
                document.body.appendChild(canvasEl);

                // Fabric canvas oluştur
                localCanvas = new fabric.Canvas(canvasEl, {
                    width: width,
                    height: height,
                    backgroundColor: designData.background || '#ffffff'
                });
                this.canvas = localCanvas;

                // Custom properties listesi
                const customProps = ['customType', 'isDataField', 'dynamicField', 'regionId', 'isRegionOverlay', 'isBackground', 'isVideoPlaceholder', 'isMultipleVideos'];

                // Fabric.js V7: loadFromJSON Promise döner
                try {
                    // Reviver fonksiyonu - her obje yüklendiğinde custom properties'i kopyala
                    const reviver = (jsonObj, fabricObj) => {
                        if (jsonObj && fabricObj) {
                            customProps.forEach(prop => {
                                if (jsonObj[prop] !== undefined) {
                                    fabricObj[prop] = jsonObj[prop];
                                }
                            });
                        }
                    };

                    await localCanvas.loadFromJSON(designData, reviver);
                } catch (loadError) {
                    console.warn('[TemplateRenderer] loadFromJSON hatası:', loadError);
                    throw loadError;
                }

                // Canvas hala geçerli mi kontrol et
                if (!localCanvas || !localCanvas.getObjects) {
                    throw new Error((typeof window.__ === 'function' ? window.__('render.errors.canvasInvalidAfterLoad') : null) || 'Canvas invalid after loadFromJSON');
                }

                // Custom properties'i geri yükle
                this._restoreCustomProperties(customProps);

                // Dinamik alanları ürün verileriyle değiştir (runtime fallback)
                await this._replaceDynamicFieldsAsync(product);

                // Canvas hala geçerli mi tekrar kontrol et
                if (!localCanvas || !localCanvas.renderAll) {
                    throw new Error((typeof window.__ === 'function' ? window.__('render.errors.canvasInvalidAfterDynamic') : null) || 'Canvas invalid after dynamic field processing');
                }

                // Canvas'ı render et
                localCanvas.renderAll();

                // PNG olarak export et
                const dataUrl = localCanvas.toDataURL({
                    format: 'png',
                    quality: 1,
                    multiplier: 1
                });

                // Temizlik
                try {
                    if (localCanvas && localCanvas.dispose) {
                        localCanvas.dispose();
                    }
                } catch (disposeError) {
                    console.warn('[TemplateRenderer] Canvas dispose hatası:', disposeError);
                }

                if (canvasEl && canvasEl.parentNode) {
                    canvasEl.remove();
                }

                this.canvas = null;
                this._originalObjects = null;

                resolve(dataUrl);

            } catch (error) {
                // Temizlik
                try {
                    if (localCanvas && localCanvas.dispose) {
                        localCanvas.dispose();
                    }
                } catch (e) {}

                if (canvasEl && canvasEl.parentNode) {
                    canvasEl.remove();
                }

                this.canvas = null;
                this._originalObjects = null;

                reject(error);
            }
        });
    }

    /**
     * Custom properties'i orijinal JSON'dan geri yükle
     * @param {string[]} customProps - Custom property isimleri
     */
    _restoreCustomProperties(customProps) {
        if (!this.canvas || !this._originalObjects) return;

        const canvasObjects = this.canvas.getObjects();

        // Her canvas objesi için orijinal JSON'daki karşılığını bul
        canvasObjects.forEach((obj, index) => {
            const originalObj = this._originalObjects[index];
            if (originalObj) {
                customProps.forEach(prop => {
                    if (originalObj[prop] !== undefined) {
                        obj[prop] = originalObj[prop];
                    }
                });
            }
        });
    }

    /**
     * Dinamik alanları ürün verileriyle değiştir (senkron - metin alanları için)
     * @param {Object} product - Ürün verisi
     */
    _replaceDynamicFields(product) {
        if (!this.canvas) return;

        const objects = this._getAllCanvasObjects();

        objects.forEach((obj) => {
            if (obj.isRegionOverlay) return;

            const dynamicField = obj.dynamicField || obj.dynamic_field;
            const isDataField = obj.isDataField;
            const isTextType = this._isTextObject(obj);
            const customType = String(obj.customType || obj.custom_type || '').toLowerCase();

            let textContent = '';
            if (isTextType) textContent = obj.text || '';
            const hasPlaceholder = /\{\{\s*[^}]+\s*\}\}/.test(textContent);
            const fieldKey = this._getObjectFieldKey(obj, textContent);

            if (!dynamicField && !isDataField && !hasPlaceholder && !fieldKey) return;
            if (!fieldKey) return;

            const value = this._getProductValue(product, fieldKey);

            if (isTextType) {
                if (hasPlaceholder && !dynamicField) {
                    const isStandalonePlaceholder = this._isStandalonePlaceholderText(textContent);
                    let newText = textContent;
                    const matches = textContent.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g);
                    for (const match of matches) {
                        const key = String(match[1] || '').trim();
                        const val = this._getProductValue(product, key);
                        const formatted = isStandalonePlaceholder
                            ? this._formatDisplayValueForObject(obj, key, val, product, textContent)
                            : this._formatFieldValueForText(key, val, product);
                        newText = newText.replace(match[0], formatted);
                    }
                    obj.set('text', newText);
                } else {
                    const displayText = this._formatDisplayValueForObject(obj, fieldKey, value, product, textContent);
                    obj.set('text', displayText);
                }
                return;
            }

            const isSlotMedia = customType === 'slot-media';
            const isDynamicImageType =
                ['dynamic-image', 'slot-image', 'image-placeholder'].includes(customType) ||
                (isSlotMedia && this._isImageFieldKey(fieldKey));

            if (isDynamicImageType && value) {
                this._loadImageForObject(obj, value);
                return;
            }

            if (isDynamicImageType) {
                obj.visible = false;
                obj.opacity = 0;
                return;
            }

            if ((customType === 'barcode' || customType === 'slot-barcode') && value) {
                obj.barcodeValue = String(value);
                return;
            }

            if ((customType === 'qrcode' || customType === 'slot-qrcode') && value) {
                obj.qrValue = String(value);
            }
        });
    }

    /**
     * Dinamik alanları ürün verileriyle değiştir (async - görsel yüklemelerini bekler)
     * @param {Object} product - Ürün verisi
     * @returns {Promise<void>}
     */
    async _replaceDynamicFieldsAsync(product) {
        if (!this.canvas) return;

        const objects = this._getAllCanvasObjects();
        const imageLoadPromises = [];
        const hasDynamicCodeObject = objects.some((obj) => {
            const customType = String(obj?.customType || obj?.custom_type || '').toLowerCase();
            return customType === 'barcode' || customType === 'qrcode';
        });

        if (hasDynamicCodeObject) {
            await this._loadCodeLibraries();
        }

        objects.forEach((obj, index) => {
            // Region overlay'leri atla
            if (obj.isRegionOverlay) {
                return;
            }

            // Dinamik alan mı kontrol et
            const dynamicField = obj.dynamicField || obj.dynamic_field;
            const isDataField = obj.isDataField;
            const isTextType = this._isTextObject(obj);
            const customType = String(obj.customType || obj.custom_type || '').toLowerCase();

            // Metin içinde {{...}} pattern var mı kontrol et
            let textContent = '';
            if (isTextType) {
                textContent = obj.text || '';
            }
            const hasPlaceholder = /\{\{\s*[^}]+\s*\}\}/.test(textContent);
            const fieldKey = this._getObjectFieldKey(obj, textContent);

            if (!dynamicField && !isDataField && !hasPlaceholder && !fieldKey) {
                return;
            }

            // Field key'ini belirle
            if (!fieldKey) {
                return;
            }

            // Ürün verisinden değeri al
            let value = this._getProductValue(product, fieldKey);

            // Değeri uygula
            if (isTextType) {
                // Metin alanları - senkron
                if (hasPlaceholder && !dynamicField) {
                    const isStandalonePlaceholder = this._isStandalonePlaceholderText(textContent);
                    let newText = textContent;
                    const matches = textContent.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g);
                    for (const match of matches) {
                        const key = String(match[1] || '').trim();
                        const val = this._getProductValue(product, key);
                        const formatted = isStandalonePlaceholder
                            ? this._formatDisplayValueForObject(obj, key, val, product, textContent)
                            : this._formatFieldValueForText(key, val, product);
                        newText = newText.replace(match[0], formatted);
                    }
                    obj.set('text', newText);
                } else {
                    const displayText = this._formatDisplayValueForObject(obj, fieldKey, value, product, textContent);
                    obj.set('text', displayText);
                }
            } else if ((['dynamic-image', 'slot-image', 'image-placeholder'].includes(customType) || (customType === 'slot-media' && this._isImageFieldKey(fieldKey))) && value) {
                // Görsel alanı için URL'yi yükle - async
                // imageIndex kontrolü: 0 = kapak görseli (varsayılan), 1+ = diğer görseller
                const imageIndex = parseInt(obj.imageIndex ?? 0) || 0;
                let imageUrl = value; // Varsayılan: kapak görseli URL'si

                if (imageIndex > 0 && product) {
                    // Belirli indeksteki görseli resolve et
                    const resolvedUrl = this._resolveProductImageByIndex(product, imageIndex);
                    if (resolvedUrl) {
                        imageUrl = resolvedUrl;
                    }
                    // resolvedUrl boşsa fallback olarak kapak görseli (value) kullanılır
                }

                const loadPromise = this._loadImageForObjectAsync(obj, imageUrl, index);
                imageLoadPromises.push(loadPromise);
            } else if (['dynamic-image', 'slot-image', 'image-placeholder'].includes(customType) || (customType === 'slot-media' && this._isImageFieldKey(fieldKey))) {
                obj.visible = false;
                obj.opacity = 0;
            } else if ((customType === 'barcode' || customType === 'slot-barcode') && value) {
                obj.barcodeValue = String(value);

                if (this._isImageObject(obj) && typeof JsBarcode !== 'undefined') {
                    const loadPromise = (async () => {
                        try {
                            const barcodeDataUrl = await this._generateBarcodeDataUrl(obj, value);
                            if (barcodeDataUrl) {
                                await this._loadImageForObjectAsync(obj, barcodeDataUrl, index);
                            }
                        } catch (error) {
                            console.warn('[TemplateRenderer] Barkod render hatası:', error);
                        }
                    })();
                    imageLoadPromises.push(loadPromise);
                }
            } else if ((customType === 'qrcode' || customType === 'slot-qrcode') && value) {
                obj.qrValue = String(value);

                if (this._isImageObject(obj) && typeof QRCode !== 'undefined') {
                    const loadPromise = (async () => {
                        try {
                            const qrDataUrl = await this._generateQrDataUrl(obj, value);
                            if (qrDataUrl) {
                                await this._loadImageForObjectAsync(obj, qrDataUrl, index);
                            }
                        } catch (error) {
                            console.warn('[TemplateRenderer] QR render hatası:', error);
                        }
                    })();
                    imageLoadPromises.push(loadPromise);
                }
            }
        });

        // Tüm görsel yüklemelerinin tamamlanmasını bekle
        if (imageLoadPromises.length > 0) {
            await Promise.all(imageLoadPromises);
        }
    }

    /**
     * Ürün verisinden alan değerini al
     * @param {Object} product - Ürün verisi
     * @param {string} fieldKey - Alan anahtarı
     * @returns {string} - Alan değeri
     */
    _getProductValue(product, fieldKey) {
        // Özel alanlar
        const specialFields = {
            'date_today': new Date().toLocaleDateString('tr-TR'),
            'date_time': new Date().toLocaleString('tr-TR'),
            'price_with_currency': this._formatPriceWithCurrency(product.current_price),
            'discount_percent': this._calculateDiscount(product)
        };

        if (fieldKey in specialFields) {
            return specialFields[fieldKey] ?? '';
        }

        // Ürün alanları - NOT: değer null/undefined olsa bile key tanımlı
        const fieldMappings = {
            'product_name': product.name,
            'name': product.name,
            'sku': product.sku,
            'barcode': product.barcode,
            'description': product.description,
            'slug': product.slug,
            'current_price': this._formatPriceWithCurrency(product.current_price),
            'previous_price': this._getPreviousPriceValue(product),
            'vat_rate': product.vat_rate ? `%${product.vat_rate}` : '',
            'category': product.category || product.category_name,
            'subcategory': product.subcategory,
            'brand': product.brand,
            'unit': product.unit,
            'weight': product.weight,
            'stock': product.stock,
            'origin': product.origin,
            'production_type': product.production_type,
            'shelf_location': product.shelf_location,
            'supplier_code': product.supplier_code,
            'kunye_no': product.kunye_no,
            'campaign_text': product.campaign_text || '',
            'price_updated_at': this._formatDate(product.price_updated_at),
            'price_valid_until': this._formatDate(product.price_valid_until),
            'image_url': this._resolveProductImage(product),
            'bundle_image_url': this._resolveProductImage(product),
            'video_url': product.video_url
        };

        // fieldMappings'de tanımlı mı kontrol et ('in' operatörü ile)
        if (fieldKey in fieldMappings) {
            const value = fieldMappings[fieldKey];
            // null, undefined, empty string için boş döndür
            return (value !== null && value !== undefined) ? String(value) : '';
        }

        // Ürün objesinde direkt ara
        if (product && fieldKey in product) {
            const value = product[fieldKey];
            return (value !== null && value !== undefined) ? String(value) : '';
        }

        // Bulunamadı - boş döndür (placeholder gösterme)
        // Kullanıcı değer yoksa alanın gizlenmesini istiyor
        return '';
    }

    /**
     * Fiyatı formatla
     * @param {number|string} price - Fiyat değeri
     * @returns {string} - Formatlanmış fiyat
     */
    _formatPrice(price) {
        if (price === null || price === undefined || price === '') {
            return '';
        }
        const num = parseFloat(price);
        if (isNaN(num)) return '';
        const i18n = window.app?.i18n;
        if (i18n?.formatNumber) {
            return i18n.formatNumber(num, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /**
     * Fiyatı para birimi ile formatla
     * @param {number|string} price
     * @returns {string}
     */
    _formatPriceWithCurrency(price) {
        if (price === null || price === undefined || price === '') {
            return '';
        }
        const i18n = window.app?.i18n;
        if (i18n?.formatPrice) {
            return i18n.formatPrice(price);
        }
        const symbol = i18n?.getCurrencySymbol ? i18n.getCurrencySymbol() : '₺';
        const plain = this._formatPrice(price);
        return plain ? `${plain} ${symbol}` : '';
    }

    /**
     * Tarihi formatla
     * @param {string} date - Tarih değeri
     * @returns {string} - Formatlanmış tarih
     */
    _formatDate(date) {
        if (!date) return '';
        try {
            return new Date(date).toLocaleDateString('tr-TR');
        } catch {
            return date;
        }
    }

    /**
     * İndirim yüzdesini hesapla
     * @param {Object} product - Ürün verisi
     * @returns {string} - İndirim yüzdesi
     */
    _calculateDiscount(product) {
        const current = parseFloat(product.current_price);
        const previous = parseFloat(product.previous_price);

        if (!previous || !current || previous <= current) {
            return '';
        }

        const discount = Math.round(((previous - current) / previous) * 100);
        return `%${discount}`;
    }

    /**
     * Eski fiyat gösterim koşulu.
     * previous_price boş/0/geçersizse veya current_price'dan büyük değilse gizlenir.
     * @param {Object} product
     * @returns {string}
     */
    _getPreviousPriceValue(product) {
        const previous = parseFloat(product?.previous_price);
        const current = parseFloat(product?.current_price);
        if (!Number.isFinite(previous) || previous <= 0) return '';
        if (Number.isFinite(current) && previous <= current) return '';
        return this._formatPriceWithCurrency(previous);
    }

    /**
     * Ürün görselini image_url > image/image_path > images[0] sırasıyla çöz.
     * @param {Object} product
     * @returns {string}
     */
    _resolveProductImage(product) {
        if (!product) return '';

        if (product.image_url) return product.image_url;
        if (product.cover_image) return product.cover_image;
        if (product.image) return product.image;
        if (product.product_image) return product.product_image;
        if (product.image_path) return product.image_path;
        if (product.erp_image_url) return product.erp_image_url;
        if (product.default_image_url) return product.default_image_url;
        if (product.thumbnail) return product.thumbnail;

        let images = product.images;
        if (typeof images === 'string') {
            try {
                images = JSON.parse(images);
            } catch (e) {
                images = [];
            }
        }

        if (Array.isArray(images) && images.length > 0) {
            const coverIndex = Number(product.cover_image_index);
            const candidate = Number.isInteger(coverIndex) && coverIndex >= 0 && coverIndex < images.length
                ? images[coverIndex]
                : images[0];

            if (typeof candidate === 'string') return candidate;
            if (candidate && typeof candidate === 'object') {
                return candidate.url ||
                    candidate.src ||
                    candidate.path ||
                    candidate.file_path ||
                    candidate.filename ||
                    candidate.storage_path ||
                    candidate.source_url ||
                    candidate.image_url ||
                    candidate.image ||
                    '';
            }
        }

        if (product.extra_data) {
            try {
                const extra = typeof product.extra_data === 'string'
                    ? JSON.parse(product.extra_data)
                    : product.extra_data;
                if (extra && typeof extra === 'object') {
                    return extra.image_url || extra.image || extra.cover_image || '';
                }
            } catch (e) {
                // ignore malformed extra_data
            }
        }

        return '';
    }

    /**
     * Belirli bir indeksteki ürün görselini resolve et (çoklu görsel desteği)
     * @param {Object} product - Ürün verisi
     * @param {number} index - Görsel indeksi (0=kapak, 1=2.görsel, 2=3.görsel, ...)
     * @returns {string} Görsel URL'si veya boş string (fallback için)
     */
    _resolveProductImageByIndex(product, index) {
        if (!product) return '';

        let images = product.images;
        if (typeof images === 'string') {
            try { images = JSON.parse(images); } catch (e) { images = []; }
        }

        if (!Array.isArray(images) || images.length === 0) return '';

        // İndeks sınır kontrolü — yoksa boş döner, caller kapak görseline fallback yapar
        if (index >= images.length) return '';

        const candidate = images[index];
        if (typeof candidate === 'string') return candidate;
        if (candidate && typeof candidate === 'object') {
            return candidate.url || candidate.src || candidate.path ||
                candidate.file_path || candidate.filename ||
                candidate.storage_path || candidate.source_url ||
                candidate.image_url || candidate.image || '';
        }
        return '';
    }

    /**
     * Görsel nesnesine resim yükle (senkron placeholder - gerçek yükleme için async versiyon kullan)
     * @param {fabric.Object} obj - Fabric nesnesi
     * @param {string} imageUrl - Görsel URL'si
     */
    _loadImageForObject(obj, imageUrl) {
        // Senkron versiyon - sadece placeholder için
        // Gerçek render için _loadImageForObjectAsync kullanılmalı
    }

    /**
     * Görsel nesnesine resim yükle (async - Promise döner)
     * @param {fabric.Object} obj - Fabric nesnesi
     * @param {string} imageUrl - Görsel URL'si
     * @param {number} index - Nesne index'i (debug için)
     * @returns {Promise<void>}
     */
    _loadImageForObjectAsync(obj, imageUrl, index = 0) {
        return new Promise((resolve) => {
            if (!obj || !imageUrl || !this.canvas) {
                resolve();
                return;
            }

            // Görsel URL'sini düzelt - MediaUtils ile cross-environment uyumluluk
            let fullUrl = imageUrl;
            if (imageUrl && !imageUrl.startsWith('data:')) {
                fullUrl = MediaUtils.getDisplayUrl(imageUrl);
            }

            // Orijinal pozisyon, boyut ve GÖRSEL özellikleri sakla
            const originalProps = {
                left: obj.left,
                top: obj.top,
                width: obj.width * (obj.scaleX || 1),
                height: obj.height * (obj.scaleY || 1),
                angle: obj.angle || 0,
                originX: obj.originX || 'left',
                originY: obj.originY || 'top',
                // Görsel özellikler (denetçi panelinden ayarlanan)
                opacity: obj.opacity ?? 1,
                shadow: obj.shadow || null,
                stroke: obj.stroke || null,
                strokeWidth: obj.strokeWidth || 0,
                strokeDashArray: obj.strokeDashArray || null,
                rx: obj.rx || 0,
                ry: obj.ry || 0,
                flipX: obj.flipX || false,
                flipY: obj.flipY || false,
                skewX: obj.skewX || 0,
                skewY: obj.skewY || 0,
                clipPath: obj.clipPath || null,
                visible: obj.visible !== false,
                backgroundColor: obj.backgroundColor || ''
            };

            // Canvas'taki objenin index'ini bul
            const currentCanvas = this.canvas;
            const objIndex = currentCanvas ? currentCanvas.getObjects().indexOf(obj) : -1;

            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                resolve();
            };

            const applyImageToCanvas = (img) => {
                // Canvas hala geçerli mi kontrol et
                if (!currentCanvas || !currentCanvas.getObjects) {
                    console.warn('[TemplateRenderer] Canvas artık geçerli değil, görsel yükleme atlandı');
                    finish();
                    return;
                }

                if (!img) {
                    console.error(`[TemplateRenderer] Failed to load image: ${fullUrl}`);
                    finish();
                    return;
                }

                // Görsel boyutunu placeholder boyutuna sığdır
                const imgWidth = Number(img.width) || 1;
                const imgHeight = Number(img.height) || 1;
                const scaleX = originalProps.width / imgWidth;
                const scaleY = originalProps.height / imgHeight;

                // rx/ry varsa stroke'u Image'a DEĞİL ayrı border Rect'e uygula.
                // Sebep: Image nesnesinde stroke her zaman dikdörtgen bounding box'u takip eder,
                // clipPath'in oval/rounded şeklini takip etmez. Ayrı Rect overlay ile stroke
                // doğal olarak rx/ry şeklini takip eder.
                const hasRoundedCorners = (originalProps.rx > 0 || originalProps.ry > 0);
                const hasStroke = originalProps.stroke && originalProps.strokeWidth > 0;
                const needsBorderOverlay = hasRoundedCorners && hasStroke;

                // Pozisyon + tüm görsel özelliklerini uygula
                const imgProps = {
                    left: originalProps.left,
                    top: originalProps.top,
                    scaleX: scaleX,
                    scaleY: scaleY,
                    angle: originalProps.angle,
                    originX: originalProps.originX,
                    originY: originalProps.originY,
                    selectable: false,
                    evented: false,
                    // Görsel özellikler
                    opacity: originalProps.opacity,
                    // Oval + stroke varsa: stroke'u Image'a KOYMA, ayrı border Rect kullan
                    stroke: needsBorderOverlay ? null : originalProps.stroke,
                    strokeWidth: needsBorderOverlay ? 0 : originalProps.strokeWidth,
                    flipX: originalProps.flipX,
                    flipY: originalProps.flipY,
                    skewX: originalProps.skewX,
                    skewY: originalProps.skewY,
                    visible: originalProps.visible,
                    backgroundColor: originalProps.backgroundColor
                };

                // Gölge
                if (originalProps.shadow) {
                    imgProps.shadow = originalProps.shadow;
                }

                // Kesikli kenarlık (oval border overlay yoksa)
                if (originalProps.strokeDashArray && !needsBorderOverlay) {
                    imgProps.strokeDashArray = originalProps.strokeDashArray;
                }

                img.set(imgProps);

                // Köşe yuvarlaklığı (rx/ry): Image için clipPath ile uygulanır
                if (hasRoundedCorners && fabric?.Rect) {
                    const clipRx = originalProps.rx || originalProps.ry || 0;
                    const clipRy = originalProps.ry || originalProps.rx || 0;
                    try {
                        const clipRect = new fabric.Rect({
                            width: imgWidth,
                            height: imgHeight,
                            rx: clipRx / scaleX,  // Scale'e göre ayarla
                            ry: clipRy / scaleY,
                            originX: 'center',
                            originY: 'center',
                            left: 0,
                            top: 0
                        });
                        img.set('clipPath', clipRect);
                    } catch (clipErr) {
                        // clipPath oluşturulamazsa devam et
                    }
                } else if (originalProps.clipPath) {
                    // Mevcut clipPath'i koru
                    img.set('clipPath', originalProps.clipPath);
                }

                // Eski placeholder'ı kaldır ve yeni görseli aynı pozisyona ekle
                try {
                    if (objIndex >= 0 && currentCanvas && currentCanvas.remove) {
                        currentCanvas.remove(obj);
                        currentCanvas.add(img);
                        if (img.moveTo) {
                            img.moveTo(objIndex);
                        }

                        // Oval + stroke varsa: ayrı border Rect overlay ekle
                        // Bu Rect'in fill'i yok (sadece kenarlık), rx/ry ile oval şekli takip eder.
                        // Orijinal placeholder'ın width/height/scaleX/scaleY değerlerini kullanarak
                        // rx/ry'nin Fabric.js tarafından doğru ölçeklenmesini sağla.
                        if (needsBorderOverlay && fabric?.Rect) {
                            try {
                                const borderRect = new fabric.Rect({
                                    left: originalProps.left,
                                    top: originalProps.top,
                                    // Orijinal placeholder'ın unscaled boyut + scale değerleri —
                                    // Fabric.js rx/ry'yi scaleX/scaleY ile otomatik ölçekler
                                    width: obj.width,
                                    height: obj.height,
                                    scaleX: obj.scaleX || 1,
                                    scaleY: obj.scaleY || 1,
                                    rx: obj.rx || originalProps.rx,
                                    ry: obj.ry || originalProps.ry,
                                    fill: 'transparent',
                                    stroke: originalProps.stroke,
                                    strokeWidth: originalProps.strokeWidth,
                                    strokeDashArray: originalProps.strokeDashArray || null,
                                    angle: originalProps.angle,
                                    originX: originalProps.originX,
                                    originY: originalProps.originY,
                                    opacity: originalProps.opacity,
                                    selectable: false,
                                    evented: false,
                                    // Gölge border overlay'e de uygulanabilir (opsiyonel)
                                    // shadow: originalProps.shadow  // Gölge Image'da zaten var
                                });
                                currentCanvas.add(borderRect);
                                // Border'ı Image'ın hemen üstüne yerleştir
                                if (borderRect.moveTo) {
                                    borderRect.moveTo(objIndex + 1);
                                }
                            } catch (borderErr) {
                                console.warn('[TemplateRenderer] Border overlay oluşturma hatası:', borderErr);
                            }
                        }

                        if (currentCanvas.renderAll) {
                            currentCanvas.renderAll();
                        }
                    }
                } catch (canvasError) {
                    console.warn('[TemplateRenderer] Canvas işlem hatası:', canvasError);
                }

                finish();
            };

            // Sonsuz beklemeyi önle
            const timeoutId = setTimeout(() => {
                console.warn('[TemplateRenderer] Görsel yükleme timeout:', fullUrl);
                finish();
            }, 12000);

            const clearAndApply = (img) => {
                clearTimeout(timeoutId);
                applyImageToCanvas(img);
            };
            const clearAndFinish = () => {
                clearTimeout(timeoutId);
                finish();
            };

            try {
                if (fabric?.Image?.fromURL) {
                    const p = fabric.Image.fromURL(fullUrl, { crossOrigin: 'anonymous' });
                    if (!p || typeof p.then !== 'function') {
                        throw new Error('Fabric v7 Image.fromURL Promise dönmedi');
                    }
                    p.then((img) => clearAndApply(img))
                        .catch((error) => {
                            console.warn('[TemplateRenderer] Promise image load hatası:', error);
                            clearAndFinish();
                        });
                } else {
                    console.warn('[TemplateRenderer] fabric.Image.fromURL mevcut değil');
                    clearAndFinish();
                }
            } catch (loadError) {
                console.warn('[TemplateRenderer] Görsel yükleme hatası:', loadError);
                clearAndFinish();
            }
        });
    }

    /**
     * Şablonu önizleme için render et (küçük boyut)
     * @param {Object} template - Şablon verisi
     * @param {Object} product - Ürün verisi
     * @param {number} scale - Ölçek (0.1 - 1)
     * @returns {Promise<string>} - PNG base64 data URL
     */
    async renderPreview(template, product, scale = 0.3) {
        // Önce Fabric.js'in yüklü olduğundan emin ol
        await this._loadFabric();

        return new Promise(async (resolve, reject) => {
            let canvasEl = null;
            let localCanvas = null;

            try {
                let designData = template.design_data || template.content;
                if (typeof designData === 'string') {
                    designData = JSON.parse(designData);
                }

                if (!designData || !designData.objects) {
                    reject(new Error((typeof window.__ === 'function' ? window.__('render.errors.noTemplateData') : null) || 'No template design data'));
                    return;
                }

                designData = JSON.parse(JSON.stringify(designData));

                // Normalize image sources (file:// and basePath fixes)
                this._normalizeDesignDataSources(designData);
                this._hideNonRenderableObjects(designData.objects);
                await this._replaceSingleFieldsInJSON(designData.objects, product);

                // Orijinal obje verilerini sakla (custom properties için)
                this._originalObjects = designData.objects;

                const origWidth = template.width || 800;
                const origHeight = template.height || 1280;
                const width = origWidth * scale;
                const height = origHeight * scale;

                canvasEl = document.createElement('canvas');
                canvasEl.width = width;
                canvasEl.height = height;
                canvasEl.style.display = 'none';
                document.body.appendChild(canvasEl);

                localCanvas = new fabric.Canvas(canvasEl, {
                    width: width,
                    height: height,
                    backgroundColor: designData.background || '#ffffff'
                });
                this.canvas = localCanvas;

                // Custom properties listesi
                const customProps = ['customType', 'isDataField', 'dynamicField', 'regionId', 'isRegionOverlay', 'isBackground', 'isVideoPlaceholder', 'isMultipleVideos'];

                // Fabric.js V7: loadFromJSON Promise döner
                try {
                    // Reviver fonksiyonu
                    const reviver = (jsonObj, fabricObj) => {
                        if (jsonObj && fabricObj) {
                            customProps.forEach(prop => {
                                if (jsonObj[prop] !== undefined) {
                                    fabricObj[prop] = jsonObj[prop];
                                }
                            });
                        }
                    };

                    await localCanvas.loadFromJSON(designData, reviver);
                } catch (loadError) {
                    console.warn('[TemplateRenderer] renderPreview loadFromJSON hatası:', loadError);
                    throw loadError;
                }

                // Canvas hala geçerli mi kontrol et
                if (!localCanvas || !localCanvas.getObjects) {
                    throw new Error((typeof window.__ === 'function' ? window.__('render.errors.canvasInvalidAfterLoad') : null) || 'Canvas invalid after loadFromJSON');
                }

                // Custom properties'i geri yükle
                this._restoreCustomProperties(customProps);

                // Dinamik alanları değiştir (async - görsel yüklemelerini bekle)
                await this._replaceDynamicFieldsAsync(product);

                // Canvas hala geçerli mi tekrar kontrol et
                if (!localCanvas || !localCanvas.getObjects) {
                    throw new Error((typeof window.__ === 'function' ? window.__('render.errors.canvasInvalidAfterDynamic') : null) || 'Canvas invalid after dynamic field processing');
                }

                // Tüm objeleri ölçekle
                localCanvas.getObjects().forEach(obj => {
                    obj.scaleX = (obj.scaleX || 1) * scale;
                    obj.scaleY = (obj.scaleY || 1) * scale;
                    obj.left = (obj.left || 0) * scale;
                    obj.top = (obj.top || 0) * scale;

                    if (this._isTextObject(obj)) {
                        obj.fontSize = (obj.fontSize || 16) * scale;
                    }
                });

                localCanvas.renderAll();

                const dataUrl = localCanvas.toDataURL({
                    format: 'png',
                    quality: 0.8
                });

                // Temizlik
                try {
                    if (localCanvas && localCanvas.dispose) {
                        localCanvas.dispose();
                    }
                } catch (disposeError) {
                    console.warn('[TemplateRenderer] Canvas dispose hatası:', disposeError);
                }

                if (canvasEl && canvasEl.parentNode) {
                    canvasEl.remove();
                }

                this.canvas = null;
                this._originalObjects = null;

                resolve(dataUrl);

            } catch (error) {
                // Temizlik
                try {
                    if (localCanvas && localCanvas.dispose) {
                        localCanvas.dispose();
                    }
                } catch (e) {}

                if (canvasEl && canvasEl.parentNode) {
                    canvasEl.remove();
                }

                this.canvas = null;
                this._originalObjects = null;

                reject(error);
            }
        });
    }

    /**
     * Çoklu ürün şablonunu render et — JSON seviyesinde dinamik alan değişikliği yapıp canvas'a yükler
     *
     * Strateji: designData JSON'ını doğrudan manipüle edip sonra canvas'a yüklüyoruz.
     * Bu sayede:
     * - Tüm objelerin pozisyonları korunur (Group local coords + canvas absolute coords)
     * - Multi-product-frame grid çerçeveleri (isSlotBackground rect'leri) doğru render edilir
     * - Sadece metin değerleri, barkod değerleri vb. JSON seviyesinde değişir
     *
     * @param {Object} template - Şablon verisi (design_data içermeli)
     * @param {Object} slotProductMap - { slotId: productData, ... } (slotId: 1-based integer)
     * @returns {Promise<string>} - PNG base64 data URL
     */
    async renderMultiProduct(template, slotProductMap) {
        await this._loadFabric();

        return new Promise(async (resolve, reject) => {
            let canvasEl = null;
            let localCanvas = null;

            try {
                let designData = template.design_data || template.content;
                if (typeof designData === 'string') {
                    designData = JSON.parse(designData);
                }

                if (!designData || !designData.objects) {
                    reject(new Error((typeof window.__ === 'function' ? window.__('render.errors.noTemplateData') : null) || 'No template design data'));
                    return;
                }

                // Deep clone — orijinal veriyi değiştirmemek için
                designData = JSON.parse(JSON.stringify(designData));

                this._normalizeDesignDataSources(designData);
                this._hideNonRenderableObjects(designData.objects);

                // ============================================================
                // ADIM 1: JSON seviyesinde dinamik alanları değiştir
                // ============================================================
                this._pendingSlotImages = []; // Görsel placeholder bilgilerini topla
                this._replaceSlotFieldsInJSON(designData.objects, slotProductMap);

                // ============================================================
                // ADIM 2: Değiştirilmiş JSON'ı canvas'a yükle
                // ============================================================
                const width = template.width || 800;
                const height = template.height || 1280;

                canvasEl = document.createElement('canvas');
                canvasEl.id = 'template-multi-render-' + Date.now();
                canvasEl.width = width;
                canvasEl.height = height;
                canvasEl.style.display = 'none';
                document.body.appendChild(canvasEl);

                localCanvas = new fabric.Canvas(canvasEl, {
                    width, height,
                    backgroundColor: designData.background || '#ffffff'
                });
                this.canvas = localCanvas;

                try {
                    await localCanvas.loadFromJSON(designData);
                } catch (loadError) {
                    console.warn('[TemplateRenderer] renderMultiProduct loadFromJSON hatası:', loadError);
                    throw loadError;
                }

                if (!localCanvas || !localCanvas.getObjects) {
                    throw new Error((typeof window.__ === 'function' ? window.__('render.errors.canvasInvalidAfterLoad') : null) || 'Canvas invalid after loadFromJSON');
                }

                // ============================================================
                // ADIM 3: Slot görsel placeholder'larını gerçek Image ile değiştir
                // ============================================================
                await this._replaceSlotImagePlaceholders(localCanvas);

                // ============================================================
                // ADIM 4: Render & Export
                // ============================================================
                localCanvas.renderAll();

                // Görsellerin yüklenmesi için ek bekleme
                await new Promise(r => setTimeout(r, 500));
                localCanvas.renderAll();

                const dataUrl = localCanvas.toDataURL({
                    format: 'png',
                    quality: 1,
                    multiplier: 1
                });

                try {
                    if (localCanvas && localCanvas.dispose) localCanvas.dispose();
                } catch (e) {}
                if (canvasEl && canvasEl.parentNode) canvasEl.remove();
                this.canvas = null;

                resolve(dataUrl);

            } catch (error) {
                try {
                    if (localCanvas && localCanvas.dispose) localCanvas.dispose();
                } catch (e) {}
                if (canvasEl && canvasEl.parentNode) canvasEl.remove();
                this.canvas = null;
                reject(error);
            }
        });
    }

    /**
     * JSON seviyesinde slot dinamik alanlarını değiştir.
     *
     * designData.objects dizisindeki objeleri dolaşır:
     * - Group (multi-product-frame) içindeki child objeleri de işler
     * - Top-level objelerde slotId varsa onları da işler
     * - Objelerin pozisyonlarına dokunmaz, sadece metin/değer günceller
     *
     * @param {Array} objects - designData.objects dizisi (mutate edilir)
     * @param {Object} slotProductMap - { slotId: productData }
     */
    _replaceSlotFieldsInJSON(objects, slotProductMap) {
        if (!objects || !Array.isArray(objects)) return;
        const slotSafeLeftPad = 10; // Cihaz sol fiziksel kirpma toleransi

        const getFrameRect = (frameObj) => {
            const rawWidth = Number(frameObj.frameWidth ?? frameObj.width ?? 0);
            const rawHeight = Number(frameObj.frameHeight ?? frameObj.height ?? 0);
            const scaleX = Number(frameObj.scaleX ?? 1);
            const scaleY = Number(frameObj.scaleY ?? 1);
            const width = rawWidth * scaleX;
            const height = rawHeight * scaleY;
            let left = Number(frameObj.left ?? 0);
            let top = Number(frameObj.top ?? 0);
            const originX = frameObj.originX || 'center';
            const originY = frameObj.originY || 'center';

            if (originX === 'center') left -= width / 2;
            else if (originX === 'right') left -= width;
            if (originY === 'center') top -= height / 2;
            else if (originY === 'bottom') top -= height;

            return { left, top, width, height };
        };

        const slotBoundsByFrame = new Map();
        let fallbackSlotBounds = null;

        // ============================================================
        // ADIM 0: Yardımcı frame/slot objelerini gizle ve slot sınırlarını çıkar.
        // ============================================================
        objects.forEach(obj => {
            const isMultiFrame = obj.customType === 'multi-product-frame' || (obj.frameCols && obj.frameRows);
            if (isMultiFrame) {
                const cols = Number(obj.frameCols || 0);
                const rows = Number(obj.frameRows || 0);
                if (cols > 0 && rows > 0) {
                    const frameRect = getFrameRect(obj);
                    const slotWidth = frameRect.width / cols;
                    const slotHeight = frameRect.height / rows;
                    const slotBounds = {};
                    let slotNo = 1;
                    for (let row = 0; row < rows; row++) {
                        for (let col = 0; col < cols; col++) {
                            slotBounds[slotNo] = {
                                left: frameRect.left + col * slotWidth,
                                top: frameRect.top + row * slotHeight,
                                width: slotWidth,
                                height: slotHeight
                            };
                            slotNo++;
                        }
                    }
                    const frameKey = obj.id || obj.parentFrameId || '__default__';
                    slotBoundsByFrame.set(frameKey, slotBounds);
                    if (!fallbackSlotBounds) fallbackSlotBounds = slotBounds;
                }

                if (obj.objects) {
                    obj.objects.forEach(childObj => {
                        if (
                            childObj.isSlotBackground ||
                            childObj.isSlotLabel ||
                            childObj.isSlotPlaceholder ||
                            childObj.excludeFromExport === true ||
                            childObj.isTransient === true
                        ) {
                            childObj.visible = false;
                            childObj.opacity = 0;
                            childObj.fill = 'transparent';
                            childObj.stroke = 'transparent';
                        }
                    });
                }

                // Frame sadece editörde görünmeli, render çıktısında görünmemeli
                if (obj.stroke) obj.stroke = 'transparent';
                if (obj.fill && obj.fill !== '') obj.fill = 'transparent';
                if (obj.strokeWidth) obj.strokeWidth = 0;
                obj.visible = false;
                obj.opacity = 0;
            }

            if (
                obj.isSlotBackground ||
                obj.isSlotLabel ||
                obj.isSlotPlaceholder ||
                obj.excludeFromExport === true ||
                obj.isTransient === true ||
                obj.customType === 'slot-label' ||
                obj.custom_type === 'slot-label'
            ) {
                obj.visible = false;
                obj.opacity = 0;
            }
        });

        const processObj = (obj, objectListRef) => {
            if (!obj) return;
            if (obj.isSlotBackground || obj.isSlotLabel || obj.isSlotPlaceholder) return;
            if (obj.isRegionOverlay) return;

            const slotId = Number(obj.slotId);
            if (!slotId) return;

            const product = slotProductMap[slotId];
            if (!product) return;

            const frameSlotBounds = (obj.parentFrameId && slotBoundsByFrame.get(obj.parentFrameId))
                ? slotBoundsByFrame.get(obj.parentFrameId)
                : null;
            const slotBounds = (frameSlotBounds && frameSlotBounds[slotId])
                ? frameSlotBounds[slotId]
                : (fallbackSlotBounds ? fallbackSlotBounds[slotId] : null);

            const dynamicField = obj.dynamicField || obj.dynamic_field;
            const isDataField = obj.isDataField;
            const customType = String(obj.customType || obj.custom_type || '');
            const textContent = obj.text || '';
            const hasPlaceholder = /\{\{\s*[^}]+\s*\}\}/.test(textContent);
            const fieldKey = this._getObjectFieldKey(obj, textContent);

            const isSlotText = customType === 'slot-text';
            const isSlotBarcode = customType === 'slot-barcode' || (customType === 'barcode' && obj.inMultiFrame);
            const isSlotQrcode = customType === 'slot-qrcode' || (customType === 'qrcode' && obj.inMultiFrame);
            const isSlotImage =
                customType === 'slot-image' ||
                customType === 'image-placeholder' ||
                (customType === 'dynamic-image' && obj.inMultiFrame) ||
                (customType === 'slot-media' && this._isImageFieldKey(fieldKey));

            if (!dynamicField && !isDataField && !hasPlaceholder && !isSlotText && !isSlotBarcode && !isSlotQrcode && !isSlotImage) return;

            if (!fieldKey && !isSlotBarcode && !isSlotQrcode && !isSlotImage) return;

            const value = fieldKey ? this._getProductValue(product, fieldKey) : '';
            const hasRenderableValue = value !== null && value !== undefined && String(value).trim() !== '';

            if (slotBounds) {
                obj.clipPath = {
                    type: 'rect',
                    left: slotBounds.left + 1,
                    top: slotBounds.top + 1,
                    width: Math.max(1, slotBounds.width - 2),
                    height: Math.max(1, slotBounds.height - 2),
                    originX: 'left',
                    originY: 'top',
                    absolutePositioned: true
                };

                // Slot icindeki tum dinamik objeleri hafif saga it.
                // Editor duvarina yapisik tasarimlarin cihazda soldan kirpilmasini azaltir.
                if (!obj.__slotSafePadApplied) {
                    obj.left = Number(obj.left ?? 0) + slotSafeLeftPad;
                    obj.__slotSafePadApplied = true;
                }
            }

            const isTextType = ['i-text', 'text', 'textbox', 'IText', 'Text', 'Textbox'].includes(obj.type);
            if (isTextType) {
                if (hasPlaceholder && !dynamicField) {
                    const isStandalonePlaceholder = this._isStandalonePlaceholderText(textContent);
                    let newText = textContent;
                    const matches = textContent.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g);
                    for (const match of matches) {
                        const key = String(match[1] || '').trim();
                        const val = this._getProductValue(product, key);
                        const formatted = isStandalonePlaceholder
                            ? this._formatDisplayValueForObject(obj, key, val, product, textContent)
                            : this._formatFieldValueForText(key, val, product);
                        newText = newText.replace(match[0], formatted);
                    }
                    obj.text = newText;
                } else if (fieldKey) {
                    obj.text = this._formatDisplayValueForObject(obj, fieldKey, value, product, textContent);
                }

                if (fieldKey === 'previous_price') {
                    obj.visible = hasRenderableValue;
                    obj.opacity = hasRenderableValue ? 1 : 0;
                }
            }

            if (isSlotBarcode && fieldKey) {
                obj.barcodeValue = String(value);
                if (isTextType) obj.text = String(value);
            }

            if (isSlotQrcode && fieldKey) {
                obj.qrValue = String(value);
                this._ensureHalKunyeQrTitleInJson(objectListRef, obj, fieldKey, product);
                if (isTextType) obj.text = this._formatFieldValueForText(fieldKey, value, product);
            }

            const isImageType = isSlotImage || customType === 'dynamic-image' || customType === 'image-placeholder';
            if (isImageType && hasRenderableValue) {
                const imageUrl = MediaUtils.getDisplayUrl(value);
                if (obj.type === 'rect' || obj.type === 'Rect') {
                    if (this._pendingSlotImages) {
                        this._pendingSlotImages.push({
                            imageUrl,
                            left: obj.left,
                            top: obj.top,
                            width: obj.width,
                            height: obj.height,
                            scaleX: obj.scaleX || 1,
                            scaleY: obj.scaleY || 1,
                            originX: obj.originX || 'center',
                            originY: obj.originY || 'center',
                            angle: obj.angle || 0,
                            opacity: obj.opacity || 1,
                            slotId: slotId,
                            clipPath: obj.clipPath || null
                        });
                    }
                    obj.visible = false;
                    obj.opacity = 0;
                } else {
                    obj.src = imageUrl;
                }
                if (obj.originalSrc) obj.originalSrc = value;
            } else if (isImageType) {
                obj.visible = false;
                obj.opacity = 0;
            }
        };

        objects.forEach(obj => {
            if ((obj.customType === 'multi-product-frame' || obj.custom_type === 'multi-product-frame') && obj.objects) {
                obj.objects.forEach(childObj => processObj(childObj, obj.objects));
            }
            processObj(obj, objects);
        });
    }

    /**
     * Canvas yüklendikten sonra bekleyen görsel placeholder'ları gerçek fabric.Image ile değiştir.
     * _pendingSlotImages dizisinden pozisyon bilgilerini alır, görselleri yükler ve canvas'a ekler.
     * @param {Object} canvas - Fabric.js Canvas instance
     */
    async _replaceSlotImagePlaceholders(canvas) {
        if (!canvas || !this._pendingSlotImages || this._pendingSlotImages.length === 0) return;

        const FabricImage = fabric.Image || fabric.FabricImage;
        if (!FabricImage) {
            console.warn('[TemplateRenderer] fabric.Image bulunamadı, görseller yüklenemiyor');
            return;
        }

        const imageLoadPromises = this._pendingSlotImages.map(info => {
            return new Promise((resolve) => {
                const imgEl = new window.Image();
                imgEl.crossOrigin = 'anonymous';
                imgEl.onload = () => {
                    try {
                        const fabricImage = new FabricImage(imgEl, {
                            left: info.left,
                            top: info.top,
                            originX: info.originX,
                            originY: info.originY,
                            angle: info.angle,
                            opacity: info.opacity
                        });

                        // Boyutlandır — placeholder boyutuna sığdır
                        const targetW = info.width * info.scaleX;
                        const targetH = info.height * info.scaleY;
                        const imgW = imgEl.naturalWidth || imgEl.width;
                        const imgH = imgEl.naturalHeight || imgEl.height;
                        if (imgW > 0 && imgH > 0) {
                            const scaleX = targetW / imgW;
                            const scaleY = targetH / imgH;
                            const scale = Math.max(scaleX, scaleY);
                            fabricImage.set({ scaleX: scale, scaleY: scale });
                        }

                        if (info.clipPath) {
                            const hasFabricRect = (typeof fabric !== 'undefined' && fabric.Rect);
                            const clip = (hasFabricRect && !(info.clipPath instanceof fabric.Rect))
                                ? new fabric.Rect(info.clipPath)
                                : info.clipPath;
                            fabricImage.set({ clipPath: clip });
                        }

                        canvas.add(fabricImage);
                        resolve(true);
                    } catch (err) {
                        console.warn('[TemplateRenderer] Slot görsel oluşturma hatası:', err);
                        resolve(false);
                    }
                };
                imgEl.onerror = () => {
                    console.warn('[TemplateRenderer] Slot görsel yüklenemedi:', info.imageUrl);
                    resolve(false);
                };
                imgEl.src = info.imageUrl;
            });
        });

        await Promise.allSettled(imageLoadPromises);
        this._pendingSlotImages = [];
    }

    /**
     * Render çıktısında görünmemesi gereken yardımcı objeleri gizle.
     * @param {Array} objects
     */
    _hideNonRenderableObjects(objects) {
        if (!Array.isArray(objects)) return;

        for (const obj of objects) {
            if (!obj || typeof obj !== 'object') continue;

            const isMultiFrame = obj.customType === 'multi-product-frame' || (obj.frameCols && obj.frameRows);
            if (isMultiFrame) {
                if (Array.isArray(obj.objects)) {
                    for (const child of obj.objects) {
                        if (!child || typeof child !== 'object') continue;
                        const childDynamicField = String(child.dynamicField || '').toLowerCase();
                        const childIsVideoHelper =
                            child.isVideoPlaceholder === true ||
                            child.isMultipleVideos === true ||
                            child.customType === 'video-placeholder' ||
                            childDynamicField.includes('video_url') ||
                            childDynamicField.includes('videos');
                        const hideChild =
                            child.isSlotBackground ||
                            child.isSlotLabel ||
                            child.isSlotPlaceholder ||
                            child.excludeFromExport === true ||
                            child.isTransient === true ||
                            childIsVideoHelper;

                        if (hideChild) {
                            child.visible = false;
                            child.opacity = 0;
                            if (child.fill) child.fill = 'transparent';
                            if (child.stroke) child.stroke = 'transparent';
                        }
                    }
                }

                if (obj.stroke) obj.stroke = 'transparent';
                if (obj.fill && obj.fill !== '') obj.fill = 'transparent';
                if (obj.strokeWidth) obj.strokeWidth = 0;
                obj.visible = false;
                obj.opacity = 0;
            }

            const shouldHide =
                obj.isSlotBackground ||
                obj.isSlotLabel ||
                obj.isSlotPlaceholder ||
                obj.excludeFromExport === true ||
                obj.isTransient === true ||
                obj.isHelper === true ||
                obj.isRegionOverlay === true ||
                obj.customType === 'slot-label' ||
                obj.isVideoPlaceholder === true ||
                obj.isMultipleVideos === true ||
                obj.customType === 'video-placeholder' ||
                String(obj.dynamicField || '').toLowerCase().includes('video_url') ||
                String(obj.dynamicField || '').toLowerCase().includes('videos');

            if (shouldHide) {
                obj.visible = false;
                obj.opacity = 0;
                if (obj.fill) obj.fill = 'transparent';
                if (obj.stroke) obj.stroke = 'transparent';
            }

            if (Array.isArray(obj.objects)) {
                this._hideNonRenderableObjects(obj.objects);
            }
        }
    }

    /**
     * Normalize image sources inside design data (handles file:// and basePath)
     * @param {Object} designData - Fabric.js JSON
     */
    _normalizeDesignDataSources(designData) {
        if (!designData) return;

        const normalizeUrl = (value) => {
            if (!value || typeof value !== 'string') return value;
            if (
                value.startsWith('file://') ||
                value.startsWith('http://') ||
                value.startsWith('https://') ||
                value.startsWith('/storage/') ||
                value.startsWith('storage/') ||
                /^[A-Za-z]:[\\\/]/.test(value)
            ) {
                return MediaUtils.getDisplayUrl(value);
            }
            return value;
        };

        const normalizeObject = (obj) => {
            if (!obj || typeof obj !== 'object') return;

            if (obj.textBaseline === 'alphabetical') {
                obj.textBaseline = 'alphabetic';
            }

            Object.keys(obj).forEach((key) => {
                const value = obj[key];
                if (typeof value === 'string') {
                    obj[key] = normalizeUrl(value);
                } else if (Array.isArray(value)) {
                    value.forEach(normalizeObject);
                } else if (value && typeof value === 'object') {
                    normalizeObject(value);
                }
            });
        };

        if (designData.backgroundImage && designData.backgroundImage.src) {
            designData.backgroundImage.src = normalizeUrl(designData.backgroundImage.src);
        }

        if (Array.isArray(designData.objects)) {
            designData.objects.forEach(normalizeObject);
        }
    }
}

// Singleton instance
let rendererInstance = null;

export function getTemplateRenderer() {
    if (!rendererInstance) {
        rendererInstance = new TemplateRenderer();
    }
    return rendererInstance;
}

export default TemplateRenderer;
