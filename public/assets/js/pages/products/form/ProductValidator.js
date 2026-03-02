/**
 * ProductValidator - Ürün Form Doğrulama Modülü
 *
 * ProductForm'dan ayrılmış bağımsız modül.
 * Form validasyon kuralları ve hata mesajları sağlar.
 *
 * @version 1.0.0
 * @example
 * import { validate, validateField, rules, setTranslator } from './form/ProductValidator.js';
 *
 * // i18n translator ayarla
 * setTranslator((key, params) => app.i18n.t(key, params));
 *
 * // Tüm formu doğrula
 * const result = validate(formData);
 * if (!result.valid) {
 *     console.log(result.errors);
 * }
 *
 * // Tek alan doğrula
 * const fieldResult = validateField('name', 'Test');
 */

/**
 * Translator fonksiyonu - dışarıdan set edilir
 */
let translator = null;

/**
 * Translator fonksiyonunu ayarla
 * @param {Function} fn - (key, params) => string
 */
export function setTranslator(fn) {
    translator = fn;
}

/**
 * i18n çeviri helper
 */
function __(key, params = {}) {
    return translator ? translator(key, params) : key;
}

/**
 * Doğrulama kuralları - i18n key'leri
 */
export const rules = {
    name: {
        required: true,
        minLength: 2,
        maxLength: 255,
        messageKey: {
            required: 'validation.name.required',
            minLength: 'validation.name.minLength',
            maxLength: 'validation.name.maxLength'
        }
    },
    sku: {
        required: true,
        minLength: 1,
        maxLength: 100,
        pattern: /^[A-Za-z0-9\-_]+$/,
        messageKey: {
            required: 'validation.sku.required',
            minLength: 'validation.sku.minLength',
            maxLength: 'validation.sku.maxLength',
            pattern: 'validation.sku.pattern'
        }
    },
    current_price: {
        required: true,
        min: 0,
        type: 'number',
        messageKey: {
            required: 'validation.currentPrice.required',
            min: 'validation.currentPrice.min',
            type: 'validation.currentPrice.type'
        }
    },
    previous_price: {
        min: 0,
        type: 'number',
        messageKey: {
            min: 'validation.previousPrice.min',
            type: 'validation.previousPrice.type'
        }
    },
    barcode: {
        maxLength: 50,
        pattern: /^[A-Za-z0-9\-]+$/,
        messageKey: {
            maxLength: 'validation.barcode.maxLength',
            pattern: 'validation.barcode.pattern'
        }
    },
    kunye_no: {
        minLength: 19,
        maxLength: 19,
        pattern: /^[0-9]+$/,
        messageKey: {
            minLength: 'validation.kunyeNo.minLength',
            maxLength: 'validation.kunyeNo.maxLength',
            pattern: 'validation.kunyeNo.pattern'
        }
    },
    vat_rate: {
        min: 0,
        max: 100,
        type: 'number',
        messageKey: {
            min: 'validation.vatRate.min',
            max: 'validation.vatRate.max',
            type: 'validation.vatRate.type'
        }
    },
    discount_percent: {
        min: 0,
        max: 100,
        type: 'number',
        messageKey: {
            min: 'validation.discountPercent.min',
            max: 'validation.discountPercent.max',
            type: 'validation.discountPercent.type'
        }
    },
    stock: {
        min: 0,
        type: 'integer',
        messageKey: {
            min: 'validation.stock.min',
            type: 'validation.stock.type'
        }
    },
    weight: {
        min: 0,
        type: 'number',
        messageKey: {
            min: 'validation.weight.min',
            type: 'validation.weight.type'
        }
    },
    slug: {
        maxLength: 255,
        pattern: /^[a-z0-9\-]+$/,
        messageKey: {
            maxLength: 'validation.slug.maxLength',
            pattern: 'validation.slug.pattern'
        }
    }
};

/**
 * Tek alan doğrula
 * @param {string} field - Alan adı
 * @param {*} value - Alan değeri
 * @returns {Object} { valid: boolean, error: string|null }
 */
export function validateField(field, value) {
    const rule = rules[field];
    if (!rule) {
        return { valid: true, error: null };
    }

    // Empty değer kontrolü
    const isEmpty = value === null || value === undefined || value === '';

    // Required check
    if (rule.required && isEmpty) {
        return {
            valid: false,
            error: rule.messageKey?.required ? __(rule.messageKey.required) : __('validation.fieldRequired', { field })
        };
    }

    // Boş değer ve required değilse valid
    if (isEmpty) {
        return { valid: true, error: null };
    }

    // Type check
    if (rule.type) {
        if (rule.type === 'number' && (isNaN(value) || typeof parseFloat(value) !== 'number')) {
            return {
                valid: false,
                error: rule.messageKey?.type ? __(rule.messageKey.type) : __('validation.mustBeNumber', { field })
            };
        }
        if (rule.type === 'integer' && !Number.isInteger(Number(value))) {
            return {
                valid: false,
                error: rule.messageKey?.type ? __(rule.messageKey.type) : __('validation.mustBeInteger', { field })
            };
        }
    }

    // String değer için kontroller
    const strValue = String(value);

    // MinLength check
    if (rule.minLength && strValue.length < rule.minLength) {
        return {
            valid: false,
            error: rule.messageKey?.minLength ? __(rule.messageKey.minLength, { min: rule.minLength }) : __('validation.minLength', { field, min: rule.minLength })
        };
    }

    // MaxLength check
    if (rule.maxLength && strValue.length > rule.maxLength) {
        return {
            valid: false,
            error: rule.messageKey?.maxLength ? __(rule.messageKey.maxLength, { max: rule.maxLength }) : __('validation.maxLength', { field, max: rule.maxLength })
        };
    }

    // Pattern check
    if (rule.pattern && !rule.pattern.test(strValue)) {
        return {
            valid: false,
            error: rule.messageKey?.pattern ? __(rule.messageKey.pattern) : __('validation.invalidFormat', { field })
        };
    }

    // Numeric değer için kontroller
    const numValue = parseFloat(value);

    // Min check
    if (rule.min !== undefined && !isNaN(numValue) && numValue < rule.min) {
        return {
            valid: false,
            error: rule.messageKey?.min ? __(rule.messageKey.min, { min: rule.min }) : __('validation.minValue', { field, min: rule.min })
        };
    }

    // Max check
    if (rule.max !== undefined && !isNaN(numValue) && numValue > rule.max) {
        return {
            valid: false,
            error: rule.messageKey?.max ? __(rule.messageKey.max, { max: rule.max }) : __('validation.maxValue', { field, max: rule.max })
        };
    }

    return { valid: true, error: null };
}

/**
 * Tüm form verisini doğrula
 * @param {Object} formData - Form verisi
 * @returns {Object} { valid: boolean, errors: Object }
 */
export function validate(formData) {
    const errors = {};

    for (const [field, value] of Object.entries(formData)) {
        const result = validateField(field, value);
        if (!result.valid) {
            errors[field] = result.error;
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Sadece kritik alanları doğrula (hızlı validasyon)
 * NOT: Bu fonksiyon sadece ZORUNLULUK kontrolü yapar, pattern kontrolü YAPMAZ.
 * Tam validasyon için validate() kullanın.
 * @param {Object} formData - Form verisi
 * @returns {Object} { valid: boolean, errors: Object }
 */
export function validateRequired(formData) {
    const requiredFields = ['name', 'sku', 'current_price'];
    const errors = {};

    for (const field of requiredFields) {
        const rule = rules[field];
        const value = formData[field];
        const isEmpty = value === null || value === undefined || value === '';

        // Sadece required kontrolü - pattern vs. kontrol etme
        if (rule?.required && isEmpty) {
            errors[field] = rule.messageKey?.required ? __(rule.messageKey.required) : __('validation.fieldRequired', { field });
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Form elemanına hata göster
 * @param {string} fieldId - Form element ID
 * @param {string} error - Hata mesajı
 */
export function showFieldError(fieldId, error) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    // Remove existing error
    clearFieldError(fieldId);

    // Add error class
    field.classList.add('form-input-error');

    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error-message';
    errorDiv.textContent = error;
    errorDiv.id = `${fieldId}-error`;

    field.parentNode.appendChild(errorDiv);
}

/**
 * Form elemanından hata kaldır
 * @param {string} fieldId - Form element ID
 */
export function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    field.classList.remove('form-input-error');

    const errorDiv = document.getElementById(`${fieldId}-error`);
    if (errorDiv) {
        errorDiv.remove();
    }
}

/**
 * Tüm hataları temizle
 */
export function clearAllErrors() {
    // Remove all error classes
    document.querySelectorAll('.form-input-error').forEach(el => {
        el.classList.remove('form-input-error');
    });

    // Remove all error messages
    document.querySelectorAll('.form-error-message').forEach(el => {
        el.remove();
    });
}

/**
 * Hataları form'da göster
 * @param {Object} errors - Hata objesi { field: message }
 */
export function showErrors(errors) {
    clearAllErrors();

    for (const [field, message] of Object.entries(errors)) {
        showFieldError(field, message);
    }

    // İlk hatalı alana focus
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
        const field = document.getElementById(firstErrorField);
        if (field) {
            field.focus();
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}
