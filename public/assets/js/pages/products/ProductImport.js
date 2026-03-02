/**
 * Product Import Page Component
 * Advanced import with smart field mapping, multiple format support, and detailed reports
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';

export class ProductImportPage {
    constructor(app) {
        this.app = app;
        this.file = null;
        this.fileType = null;
        this.analysisData = null;
        this.fieldMappings = {};
        this.step = 1; // 1: Upload, 2: Mapping, 3: Preview, 4: Import/Report
        this.importing = false;
        this.importProgress = 0;
        this.importReport = null;
        this.importOptionDefaults = this.loadImportOptionDefaults();
        this.mappingDefaults = this.loadMappingDefaults();
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('products');
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.dashboard')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/products">${this.__('breadcrumb.products')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('import.title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon blue">
                            <i class="ti ti-file-import"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('import.title')}</h1>
                            <p class="page-subtitle">${this.__('import.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <a href="#/products" class="btn btn-outline">
                            <i class="ti ti-arrow-left"></i>
                            ${this.__('actions.back')}
                        </a>
                    </div>
                </div>
            </div>

            <!-- Progress Steps -->
            <div class="card mb-6">
                <div class="card-body">
                    <div class="import-steps">
                        <div class="import-step ${this.step >= 1 ? 'active' : ''} ${this.step > 1 ? 'completed' : ''}">
                            <div class="step-number">${this.step > 1 ? '<i class="ti ti-check"></i>' : '1'}</div>
                            <div class="step-label">${this.__('import.steps.selectFile')}</div>
                        </div>
                        <div class="step-line ${this.step > 1 ? 'completed' : ''}"></div>
                        <div class="import-step ${this.step >= 2 ? 'active' : ''} ${this.step > 2 ? 'completed' : ''}">
                            <div class="step-number">${this.step > 2 ? '<i class="ti ti-check"></i>' : '2'}</div>
                            <div class="step-label">${this.__('import.steps.fieldMapping')}</div>
                        </div>
                        <div class="step-line ${this.step > 2 ? 'completed' : ''}"></div>
                        <div class="import-step ${this.step >= 3 ? 'active' : ''} ${this.step > 3 ? 'completed' : ''}">
                            <div class="step-number">${this.step > 3 ? '<i class="ti ti-check"></i>' : '3'}</div>
                            <div class="step-label">${this.__('import.steps.preview')}</div>
                        </div>
                        <div class="step-line ${this.step > 3 ? 'completed' : ''}"></div>
                        <div class="import-step ${this.step >= 4 ? 'active' : ''}">
                            <div class="step-number">4</div>
                            <div class="step-label">${this.__('import.steps.report')}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step Content -->
            <div id="step-content">
                ${this.renderStepContent()}
            </div>
        `;
    }

    renderStepContent() {
        switch (this.step) {
            case 1:
                return this.renderUploadStep();
            case 2:
                return this.renderMappingStep();
            case 3:
                return this.renderPreviewStep();
            case 4:
                return this.renderReportStep();
            default:
                return '';
        }
    }

    renderUploadStep() {
        return `
            <div class="card">
                <div class="card-body">
                    <div class="upload-zone" id="upload-zone">
                        <i class="ti ti-cloud-upload upload-icon"></i>
                        <h3>${this.__('import.upload.title')}</h3>
                        <p class="upload-hint">${this.__('import.upload.hint')}</p>
                        <input type="file" id="file-input" class="hidden"
                            accept=".txt,.json,.csv,.xml,.xlsx,.xls">
                        <button type="button" class="btn btn-primary" id="select-file-btn">
                            <i class="ti ti-upload"></i>
                            ${this.__('import.upload.selectFile')}
                        </button>
                        <p class="upload-formats">
                            ${this.__('import.upload.supportedFormats')}
                        </p>
                    </div>

                    ${this.file ? `
                        <div class="selected-file mt-6">
                            <div class="file-info">
                                <div class="file-icon ${this.fileType}">
                                    <i class="ti ti-${this.getFileIcon()}"></i>
                                </div>
                                <div class="file-details">
                                    <p class="file-name">${this.file.name}</p>
                                    <p class="file-meta">${this.formatFileSize(this.file.size)} • ${this.fileType?.toUpperCase() || this.__('import.unknownFormat')}</p>
                                </div>
                                <button type="button" class="btn btn-sm btn-ghost text-red-500" id="remove-file-btn">
                                    <i class="ti ti-x"></i>
                                </button>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Format Options -->
                    <div class="format-options mt-6">
                        <div class="format-option ${this.fileType === 'txt' ? 'selected' : ''}" data-type="txt">
                            <i class="ti ti-file-text"></i>
                            <span>TXT</span>
                        </div>
                        <div class="format-option ${this.fileType === 'csv' ? 'selected' : ''}" data-type="csv">
                            <i class="ti ti-table"></i>
                            <span>CSV</span>
                        </div>
                        <div class="format-option ${this.fileType === 'json' ? 'selected' : ''}" data-type="json">
                            <i class="ti ti-braces"></i>
                            <span>JSON</span>
                        </div>
                        <div class="format-option ${this.fileType === 'xml' ? 'selected' : ''}" data-type="xml">
                            <i class="ti ti-file-code"></i>
                            <span>XML</span>
                        </div>
                        <div class="format-option ${this.fileType === 'xlsx' ? 'selected' : ''}" data-type="xlsx">
                            <i class="ti ti-file-spreadsheet"></i>
                            <span>XLSX</span>
                        </div>
                    </div>

                    <div class="flex justify-end mt-6">
                        <button type="button" class="btn btn-primary" id="analyze-file-btn"
                            ${!this.file ? 'disabled' : ''}>
                            <i class="ti ti-scan"></i>
                            ${this.__('import.upload.analyzeAndContinue')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderMappingStep() {
        if (!this.analysisData) {
            return `<div class="card"><div class="card-body">${this.__('messages.loading')}</div></div>`;
        }

        const { headers, sample_data } = this.analysisData.analysis;
        const { auto_detected, suggestions, target_fields } = this.analysisData.mapping;
        const suggestedCount = Object.keys(auto_detected || {}).filter(k => auto_detected[k]).length;
        const mappingDefaults = this.mappingDefaults;

        // Define field groups for better organization
        const fieldGroups = {
            basic: {
                title: this.__('import.fieldGroups.basic'),
                icon: 'ti-info-circle',
                fields: ['sku', 'name', 'barcode', 'category', 'subcategory', 'brand', 'origin', 'unit']
            },
            pricing: {
                title: this.__('import.fieldGroups.pricing'),
                icon: 'ti-currency-lira',
                fields: ['current_price', 'previous_price', 'campaign_price', 'vat_rate', 'discount_percent',
                    'price_updated_at', 'previous_price_updated_at']
            },
            stock: {
                title: this.__('import.fieldGroups.stock'),
                icon: 'ti-package',
                fields: ['stock', 'weight', 'shelf_location', 'supplier_code', 'kunye_no']
            },
            additional: {
                title: this.__('import.fieldGroups.additional'),
                icon: 'ti-dots',
                fields: ['description', 'image_url', 'campaign_text', 'production_type',
                    'valid_from', 'valid_until', 'is_active', 'is_featured']
            }
        };

        // Count mapped fields
        const mappedCount = Object.keys(this.fieldMappings).filter(k => this.fieldMappings[k]).length;
        const totalFields = Object.keys(target_fields).length;

        return `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">
                            <i class="ti ti-link"></i>
                            ${this.__('import.mapping.title')}
                        </h3>
                        <p class="card-subtitle">
                            ${this.__('import.mapping.fieldsDetected', { count: headers.length, suggested: suggestedCount })}
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <button type="button" class="btn btn-sm btn-outline" id="clear-mappings-btn">
                            <i class="ti ti-eraser"></i>
                            ${this.__('actions.clear')}
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <!-- Mapping Info -->
                    <div class="mapping-info mb-6">
                        <div class="info-box success">
                            <i class="ti ti-check"></i>
                            <span>${this.__('import.mapping.fieldsMatched', { mapped: `<strong id="mapped-count">${mappedCount}</strong>`, total: totalFields })}</span>
                        </div>
                        <div class="info-box ${this.areRequiredFieldsMapped() ? 'success' : 'warning'}">
                            <i class="ti ti-${this.areRequiredFieldsMapped() ? 'check' : 'alert-triangle'}"></i>
                            <span>${this.__('import.mapping.requiredFields')}: ${this.areRequiredFieldsMapped() ? this.__('import.mapping.requiredFieldsComplete') : this.__('import.mapping.requiredFieldsMissing')}</span>
                        </div>
                    </div>
                    <div class="mt-4">
                        <label class="option-item">
                            <input type="checkbox" id="remember-mapping-defaults" class="form-checkbox" ${mappingDefaults.remember ? 'checked' : ''}>
                            <div class="option-content">
                                <span class="option-label">${this.__('import.mapping.rememberDefaults')}</span>
                                <span class="option-hint">${this.__('import.mapping.rememberDefaultsHint')}</span>
                            </div>
                        </label>
                    </div>

                    ${Object.entries(fieldGroups).map(([groupKey, group]) => {
            const groupFields = group.fields
                .filter(fieldKey => target_fields[fieldKey])
                .map(fieldKey => [fieldKey, target_fields[fieldKey]]);

            if (groupFields.length === 0) return '';

            return `
                            <div class="mapping-section ${groupKey === 'basic' ? '' : 'mt-6'}">
                                <h4 class="section-title">
                                    <i class="ti ${group.icon}"></i>
                                    ${group.title}
                                </h4>
                                <div class="mapping-grid">
                                    ${groupFields.map(([key, field]) =>
                this.renderMappingRow(key, field, headers, suggestions[key], auto_detected[key])
            ).join('')}
                                </div>
                            </div>
                        `;
        }).join('')}

                    <!-- Sample Data Preview -->
                    <div class="sample-preview mt-6">
                        <h4 class="section-title">
                            <i class="ti ti-table"></i>
                            ${this.__('import.mapping.sampleData', { count: sample_data.length })}
                        </h4>
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        ${headers.slice(0, 8).map(h => `<th title="${h}">${this.truncate(h, 15)}</th>`).join('')}
                                        ${headers.length > 8 ? '<th>...</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sample_data.slice(0, 3).map(row => `
                                        <tr>
                                            ${headers.slice(0, 8).map(h => `<td title="${row[h] || ''}">${this.truncate(String(row[h] || ''), 15)}</td>`).join('')}
                                            ${headers.length > 8 ? '<td>...</td>' : ''}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="flex justify-between mt-6">
                        <button type="button" class="btn btn-outline" id="prev-step-btn">
                            <i class="ti ti-arrow-left"></i>
                            ${this.__('actions.back')}
                        </button>
                        <button type="button" class="btn btn-primary" id="next-step-btn"
                            ${!this.areRequiredFieldsMapped() ? 'disabled' : ''}>
                            ${this.__('import.steps.preview')}
                            <i class="ti ti-arrow-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderMappingRow(targetKey, targetField, sourceHeaders, suggestion, autoDetectedSource) {
        const currentMapping = this.fieldMappings[targetKey] || '';
        const confidence = suggestion?.best_match?.confidence || 0;
        const hasMatch = currentMapping !== '';
        const isAutoDetected = autoDetectedSource && autoDetectedSource === currentMapping;

        return `
            <div class="mapping-row ${hasMatch ? 'mapped' : ''} ${targetField.required ? 'required' : ''}">
                <div class="mapping-target">
                    <span class="target-label">
                        ${targetField.name}
                        ${targetField.required ? '<span class="required-star">*</span>' : ''}
                    </span>
                    <span class="target-type">${this.getTypeLabel(targetField.type)}</span>
                </div>
                <div class="mapping-arrow">
                    <i class="ti ti-arrow-left ${hasMatch ? 'text-success' : ''}"></i>
                </div>
                <div class="mapping-source">
                    <select class="form-select mapping-select" data-target="${targetKey}">
                        <option value="">${this.__('import.mapping.noMapping')}</option>
                        ${sourceHeaders.map(h => `
                            <option value="${h}" ${currentMapping === h ? 'selected' : ''}>
                                ${h}
                            </option>
                        `).join('')}
                    </select>
                    ${isAutoDetected && confidence >= 70 ? `
                        <span class="mapping-badge auto" title="${this.__('import.mapping.autoMappedBadge', { confidence })}">
                            <i class="ti ti-wand"></i>
                            ${confidence}%
                        </span>
                    ` : hasMatch && !isAutoDetected ? `
                        <span class="mapping-badge manual" title="${this.__('import.mapping.manualMappedBadge')}">
                            <i class="ti ti-hand-click"></i>
                            ${this.__('import.mapping.manual')}
                        </span>
                    ` : confidence >= 70 && !hasMatch ? `
                        <button type="button" class="btn btn-xs btn-ghost suggest-btn"
                            data-target="${targetKey}" data-source="${suggestion.best_match.field}"
                            title="${this.__('import.mapping.suggestedMapping', { field: suggestion.best_match.field, confidence })}">
                            <i class="ti ti-bulb text-yellow-500"></i>
                            ${this.__('import.mapping.suggestion')}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderPreviewStep() {
        const mappedData = this.getMappedPreviewData();
        const options = this.importOptionDefaults;

        return `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">
                            <i class="ti ti-eye"></i>
                            ${this.__('import.preview.title')}
                        </h3>
                        <p class="card-subtitle">
                            ${this.__('import.preview.totalFound', { total: this.analysisData.analysis.total_rows, showing: Math.min(10, mappedData.length) })}
                        </p>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>${this.__('list.columns.sku')}</th>
                                    <th>${this.__('list.columns.name')}</th>
                                    <th>${this.__('list.columns.price')}</th>
                                    <th>${this.__('list.columns.barcode')}</th>
                                    <th>${this.__('list.columns.category')}</th>
                                    <th>${this.__('form.fields.unit')}</th>
                                    <th>${this.__('list.columns.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${mappedData.slice(0, 10).map((item, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td><code>${item.sku || '-'}</code></td>
                                        <td>${this.truncate(item.name || '-', 30)}</td>
                                        <td>${item.current_price ? this.formatPrice(item.current_price) : '-'}</td>
                                        <td>${item.barcode || '-'}</td>
                                        <td>${item.category || '-'}</td>
                                        <td>${item.unit || '-'}</td>
                                        <td>
                                            ${this.validateItem(item)
                ? `<span class="badge badge-success"><i class="ti ti-check"></i> ${this.__('import.preview.valid')}</span>`
                : `<span class="badge badge-danger"><i class="ti ti-x"></i> ${this.__('import.preview.invalid')}</span>`
            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Import Options -->
                    <div class="import-options mt-6">
                        <h4 class="section-title">
                            <i class="ti ti-settings"></i>
                            ${this.__('import.options.title')}
                        </h4>
                        <div class="options-grid">
                            <label class="option-item">
                                <input type="checkbox" id="update-existing" class="form-checkbox" ${options.update_existing ? 'checked' : ''}>
                                <div class="option-content">
                                    <span class="option-label">${this.__('import.options.updateExisting')}</span>
                                    <span class="option-hint">${this.__('import.options.updateExistingHint')}</span>
                                </div>
                            </label>
                            <label class="option-item">
                                <input type="checkbox" id="skip-errors" class="form-checkbox" ${options.skip_errors ? 'checked' : ''}>
                                <div class="option-content">
                                    <span class="option-label">${this.__('import.options.skipErrors')}</span>
                                    <span class="option-hint">${this.__('import.options.skipErrorsHint')}</span>
                                </div>
                            </label>
                            <label class="option-item">
                                <input type="checkbox" id="create-new" class="form-checkbox" ${options.create_new ? 'checked' : ''}>
                                <div class="option-content">
                                    <span class="option-label">${this.__('import.options.createNew')}</span>
                                    <span class="option-hint">${this.__('import.options.createNewHint')}</span>
                                </div>
                            </label>
                        </div>
                        <div class="mt-4">
                            <label class="option-item">
                                <input type="checkbox" id="remember-import-options" class="form-checkbox" ${options.remember ? 'checked' : ''}>
                                <div class="option-content">
                                    <span class="option-label">${this.__('import.options.rememberOptions')}</span>
                                    <span class="option-hint">${this.__('import.options.rememberOptionsHint')}</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="flex justify-between mt-6">
                        <button type="button" class="btn btn-outline" id="prev-step-btn">
                            <i class="ti ti-arrow-left"></i>
                            ${this.__('actions.back')}
                        </button>
                        <button type="button" class="btn btn-primary btn-lg" id="start-import-btn">
                            <i class="ti ti-upload"></i>
                            ${this.__('import.options.startImport', { count: this.analysisData.analysis.total_rows })}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderReportStep() {
        if (this.importing) {
            return `
                <div class="card">
                    <div class="card-body import-progress">
                        <div class="progress-spinner"></div>
                        <h3>${this.__('import.report.importing')}</h3>
                        <p class="text-muted">${this.__('import.report.pleaseWait')}</p>
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width: ${this.importProgress}%"></div>
                        </div>
                        <span class="progress-text">${this.importProgress}%</span>
                    </div>
                </div>
            `;
        }

        if (!this.importReport) {
            return `<div class="card"><div class="card-body">${this.__('import.report.loading')}</div></div>`;
        }

        const { summary, failed_rows } = this.importReport;
        const successRate = summary.total_rows > 0
            ? Math.round(((summary.inserted + summary.updated) / summary.total_rows) * 100)
            : 0;

        return `
            <div class="card">
                <div class="card-body">
                    <!-- Success Header -->
                    <div class="report-header ${this.importReport.success ? 'success' : 'error'}">
                        <div class="report-icon">
                            <i class="ti ti-${this.importReport.success ? 'check' : 'x'}"></i>
                        </div>
                        <h3>${this.importReport.success ? this.__('import.report.importComplete') : this.__('import.report.importFailed')}</h3>
                        <p class="text-muted">
                            ${this.importReport.duration_ms ? this.__('import.report.duration', { seconds: (this.importReport.duration_ms / 1000).toFixed(2) }) : ''}
                        </p>
                    </div>

                    <!-- Statistics -->
                    <div class="report-stats">
                        <div class="stat-card total">
                            <div class="stat-value">${summary.total_rows}</div>
                            <div class="stat-label">${this.__('import.report.totalRows')}</div>
                        </div>
                        <div class="stat-card success">
                            <div class="stat-value">${summary.inserted}</div>
                            <div class="stat-label">${this.__('import.report.inserted')}</div>
                        </div>
                        <div class="stat-card info">
                            <div class="stat-value">${summary.updated}</div>
                            <div class="stat-label">${this.__('import.report.updated')}</div>
                        </div>
                        <div class="stat-card warning">
                            <div class="stat-value">${summary.skipped}</div>
                            <div class="stat-label">${this.__('import.report.skipped')}</div>
                        </div>
                        <div class="stat-card danger">
                            <div class="stat-value">${summary.failed}</div>
                            <div class="stat-label">${this.__('import.report.failed')}</div>
                        </div>
                    </div>

                    <!-- Success Rate -->
                    <div class="success-rate-container mt-6">
                        <div class="success-rate-bar">
                            <div class="rate-fill" style="width: ${successRate}%"></div>
                        </div>
                        <span class="rate-text">${this.__('import.report.successRate', { rate: successRate })}</span>
                    </div>

                    <!-- Failed Rows Detail -->
                    ${failed_rows && failed_rows.length > 0 ? `
                        <div class="failed-rows mt-6">
                            <h4 class="section-title text-red-500">
                                <i class="ti ti-alert-triangle"></i>
                                ${this.__('import.report.failedRows', { count: failed_rows.length })}
                            </h4>
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>${this.__('import.report.rowHeader')}</th>
                                            <th>${this.__('import.report.skuHeader')}</th>
                                            <th>${this.__('import.report.productNameHeader')}</th>
                                            <th>${this.__('import.report.errorHeader')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${failed_rows.slice(0, 20).map(row => `
                                            <tr>
                                                <td><span class="badge">#${row.row}</span></td>
                                                <td><code>${row.sku || row.data?.[Object.keys(row.data)[0]] || 'N/A'}</code></td>
                                                <td>${row.name || row.data?.[Object.keys(row.data)[1]] || 'N/A'}</td>
                                                <td class="text-red-500">${this.formatImportErrors(row.errors)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            ${failed_rows.length > 20 ? `
                                <p class="text-muted text-center mt-2">
                                    ${this.__('import.report.moreRows', { count: failed_rows.length - 20 })}
                                </p>
                            ` : ''}
                        </div>
                    ` : ''}

                    <!-- Actions -->
                    <div class="flex justify-center gap-4 mt-8">
                        <a href="#/products" class="btn btn-primary">
                            <i class="ti ti-list"></i>
                            ${this.__('import.report.viewProducts')}
                        </a>
                        <button type="button" class="btn btn-outline" id="new-import-btn">
                            <i class="ti ti-upload"></i>
                            ${this.__('import.report.newImport')}
                        </button>
                        ${failed_rows && failed_rows.length > 0 ? `
                            <button type="button" class="btn btn-outline" id="download-errors-btn">
                                <i class="ti ti-download"></i>
                                ${this.__('import.report.downloadErrors')}
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    getFileIcon() {
        const icons = {
            'txt': 'file-text',
            'csv': 'table',
            'json': 'braces',
            'xml': 'file-code',
            'xlsx': 'file-spreadsheet',
            'xls': 'file-spreadsheet'
        };
        return icons[this.fileType] || 'file';
    }

    getTypeLabel(type) {
        const labels = {
            'numeric': this.__('import.types.numeric'),
            'string': this.__('import.types.string'),
            'date': this.__('import.types.date'),
            'barcode': this.__('import.types.barcode')
        };
        return labels[type] || type;
    }

    truncate(str, length) {
        if (!str) return '';
        return str.length > length ? str.substring(0, length) + '...' : str;
    }

    formatPrice(price) {
        return this.app.i18n.formatPrice(price);
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    formatImportErrors(errors) {
        if (!errors || errors.length === 0) return this.__('import.unknownError');
        return errors.map(e => {
            if (typeof e === 'string') return e;
            if (e && e.code) {
                return this.__(`import.validation.${e.code}`, e);
            }
            return this.__('import.unknownError');
        }).join(', ');
    }

    areRequiredFieldsMapped() {
        return this.fieldMappings.sku &&
            this.fieldMappings.name &&
            this.fieldMappings.current_price;
    }

    validateItem(item) {
        return item.sku && item.name && item.current_price !== undefined && item.current_price !== null;
    }

    getMappedPreviewData() {
        if (!this.analysisData?.analysis?.sample_data) return [];

        return this.analysisData.analysis.sample_data.map(row => {
            const mapped = {};
            for (const [target, source] of Object.entries(this.fieldMappings)) {
                if (source && row[source] !== undefined) {
                    mapped[target] = row[source];
                }
            }
            return mapped;
        });
    }

    async init() {
        this.bindEvents();
        this.addStyles();
    }

    bindEvents() {
        // File upload
        document.getElementById('select-file-btn')?.addEventListener('click', () => {
            document.getElementById('file-input')?.click();
        });

        document.getElementById('file-input')?.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        document.getElementById('remove-file-btn')?.addEventListener('click', () => {
            this.file = null;
            this.fileType = null;
            this.updateStepContent();
        });

        // Drag and drop
        const uploadZone = document.getElementById('upload-zone');
        if (uploadZone) {
            uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadZone.classList.add('dragover');
            });
            uploadZone.addEventListener('dragleave', () => {
                uploadZone.classList.remove('dragover');
            });
            uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
                if (e.dataTransfer.files[0]) {
                    this.handleFileSelect(e.dataTransfer.files[0]);
                }
            });
        }

        // Format options
        document.querySelectorAll('.format-option').forEach(opt => {
            opt.addEventListener('click', () => {
                if (this.file) {
                    this.fileType = opt.dataset.type;
                    this.updateStepContent();
                }
            });
        });

        // Analyze button
        document.getElementById('analyze-file-btn')?.addEventListener('click', () => this.analyzeFile());

        // Navigation
        document.getElementById('next-step-btn')?.addEventListener('click', () => this.nextStep());
        document.getElementById('prev-step-btn')?.addEventListener('click', () => this.prevStep());
        document.getElementById('start-import-btn')?.addEventListener('click', () => this.startImport());
        document.getElementById('new-import-btn')?.addEventListener('click', () => this.reset());
        document.getElementById('download-errors-btn')?.addEventListener('click', () => this.downloadErrors());

        // Mapping controls
        document.getElementById('clear-mappings-btn')?.addEventListener('click', () => this.clearMappings());

        // Mapping selects
        document.querySelectorAll('.mapping-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.fieldMappings[e.target.dataset.target] = e.target.value;
                this.updateMappingUI();
                this.persistMappingDefaultsIfEnabled();
            });
        });

        // Suggest buttons
        document.querySelectorAll('.suggest-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.target;
                const source = e.currentTarget.dataset.source;
                this.fieldMappings[target] = source;
                this.updateStepContent();
                this.persistMappingDefaultsIfEnabled();
            });
        });

        document.getElementById('remember-import-options')?.addEventListener('change', (e) => {
            const remember = e.target.checked;
            if (remember) {
                this.saveImportOptionDefaults(this.readImportOptions());
            } else {
                this.clearImportOptionDefaults();
            }
        });

        document.getElementById('remember-mapping-defaults')?.addEventListener('change', (e) => {
            const remember = e.target.checked;
            if (remember) {
                this.saveMappingDefaults(this.fieldMappings);
            } else {
                this.clearMappingDefaults();
            }
        });

        ['update-existing', 'skip-errors', 'create-new'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                const remember = document.getElementById('remember-import-options')?.checked ?? false;
                if (remember) {
                    this.saveImportOptionDefaults(this.readImportOptions());
                }
            });
        });
    }

    handleFileSelect(file) {
        this.file = file;

        // Auto-detect file type
        const ext = file.name.split('.').pop().toLowerCase();
        if (['txt', 'csv', 'json', 'xml', 'xlsx', 'xls'].includes(ext)) {
            this.fileType = ext === 'xls' ? 'xlsx' : ext;
        }

        this.updateStepContent();
    }

    async analyzeFile() {
        if (!this.file) {
            Toast.error(this.__('import.toast.selectFile'));
            return;
        }

        try {
            Toast.info(this.__('import.toast.analyzing'));

            const formData = new FormData();
            formData.append('file', this.file);

            const response = await fetch(`${this.app.config.apiUrl}/products/import/analyze`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('omnex_token')}`
                },
                body: formData
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || this.__('import.analysisFailed'));
            }

            this.analysisData = result.data;

            // Start with saved manual defaults (if enabled) to keep manual selection
            this.fieldMappings = this.applyMappingDefaults(result.data.analysis?.headers || []);

            this.step = 2;
            this.updateStepContent();

            Toast.success(this.__('import.toast.rowsDetected', { count: result.data.analysis.total_rows }));

        } catch (error) {
            Logger.error('File analysis failed:', error);
            Toast.error(this.__('import.toast.analysisFailed') + ': ' + error.message);
        }
    }

    async nextStep() {
        if (this.step === 2) {
            if (!this.areRequiredFieldsMapped()) {
                Toast.error(this.__('import.toast.mapRequiredFields'));
                return;
            }
        }

        this.step++;
        this.updateStepContent();
    }

    prevStep() {
        this.step--;
        this.updateStepContent();
    }

    updateStepContent() {
        const container = document.getElementById('step-content');
        if (container) {
            container.innerHTML = this.renderStepContent();
            this.bindEvents();
        }
        this.updateStepIndicators();
    }

    updateStepIndicators() {
        document.querySelectorAll('.import-step').forEach((step, index) => {
            step.classList.toggle('active', index + 1 <= this.step);
            step.classList.toggle('completed', index + 1 < this.step);
        });
        document.querySelectorAll('.step-line').forEach((line, index) => {
            line.classList.toggle('completed', index + 1 < this.step);
        });
    }

    updateMappingUI() {
        // Update mapped count
        const mappedCount = Object.keys(this.fieldMappings).filter(k => this.fieldMappings[k]).length;
        const countEl = document.getElementById('mapped-count');
        if (countEl) countEl.textContent = mappedCount;

        // Update next button state
        const nextBtn = document.getElementById('next-step-btn');
        if (nextBtn) {
            nextBtn.disabled = !this.areRequiredFieldsMapped();
        }

        // Update row styles
        document.querySelectorAll('.mapping-row').forEach(row => {
            const select = row.querySelector('.mapping-select');
            if (select) {
                row.classList.toggle('mapped', select.value !== '');
            }
        });
    }

    autoMap() {
        if (this.analysisData?.mapping?.auto_detected) {
            this.fieldMappings = { ...this.analysisData.mapping.auto_detected };
            this.updateStepContent();
            Toast.success(this.__('import.toast.autoMapped'));
        }
    }

    clearMappings() {
        this.fieldMappings = {};
        this.updateStepContent();
        Toast.info(this.__('import.toast.mappingsCleared'));
        this.persistMappingDefaultsIfEnabled();
    }

    loadMappingDefaults() {
        const defaults = { remember: false, mappings: {} };
        try {
            const raw = localStorage.getItem('product_import_mapping_defaults');
            if (!raw) return defaults;
            const parsed = JSON.parse(raw);
            return {
                remember: !!parsed.remember,
                mappings: parsed.mappings && typeof parsed.mappings === 'object' ? parsed.mappings : {}
            };
        } catch (error) {
            Logger.warn('Failed to load mapping defaults:', error);
            return defaults;
        }
    }

    saveMappingDefaults(mappings) {
        const cleaned = Object.fromEntries(
            Object.entries(mappings || {}).filter(([, value]) => value)
        );
        this.mappingDefaults = { remember: true, mappings: cleaned };
        localStorage.setItem('product_import_mapping_defaults', JSON.stringify(this.mappingDefaults));
    }

    clearMappingDefaults() {
        this.mappingDefaults = { remember: false, mappings: {} };
        localStorage.removeItem('product_import_mapping_defaults');
    }

    applyMappingDefaults(headers) {
        if (!this.mappingDefaults?.remember) return {};
        const headerSet = new Set(headers || []);
        const mapped = {};
        Object.entries(this.mappingDefaults.mappings || {}).forEach(([target, source]) => {
            if (source && headerSet.has(source)) {
                mapped[target] = source;
            }
        });
        return mapped;
    }

    persistMappingDefaultsIfEnabled() {
        const remember = document.getElementById('remember-mapping-defaults')?.checked ?? false;
        if (remember) {
            this.saveMappingDefaults(this.fieldMappings);
        }
    }

    loadImportOptionDefaults() {
        const defaults = {
            remember: false,
            update_existing: true,
            skip_errors: true,
            create_new: true
        };
        try {
            const raw = localStorage.getItem('product_import_options');
            if (!raw) return defaults;
            const parsed = JSON.parse(raw);
            return {
                remember: !!parsed.remember,
                update_existing: parsed.update_existing ?? true,
                skip_errors: parsed.skip_errors ?? true,
                create_new: parsed.create_new ?? true
            };
        } catch (error) {
            Logger.warn('Failed to load import options:', error);
            return defaults;
        }
    }

    saveImportOptionDefaults(options) {
        const payload = {
            remember: true,
            update_existing: !!options.update_existing,
            skip_errors: !!options.skip_errors,
            create_new: !!options.create_new
        };
        this.importOptionDefaults = payload;
        localStorage.setItem('product_import_options', JSON.stringify(payload));
    }

    clearImportOptionDefaults() {
        this.importOptionDefaults = {
            remember: false,
            update_existing: true,
            skip_errors: true,
            create_new: true
        };
        localStorage.removeItem('product_import_options');
    }

    readImportOptions() {
        return {
            update_existing: document.getElementById('update-existing')?.checked ?? true,
            skip_errors: document.getElementById('skip-errors')?.checked ?? true,
            create_new: document.getElementById('create-new')?.checked ?? true
        };
    }

    async startImport() {
        const updateExisting = document.getElementById('update-existing')?.checked ?? true;
        const skipErrors = document.getElementById('skip-errors')?.checked ?? true;
        const createNew = document.getElementById('create-new')?.checked ?? true;
        const rememberOptions = document.getElementById('remember-import-options')?.checked ?? false;

        if (rememberOptions) {
            this.saveImportOptionDefaults({ update_existing: updateExisting, skip_errors: skipErrors, create_new: createNew });
        } else {
            this.clearImportOptionDefaults();
        }

        this.importing = true;
        this.importProgress = 0;
        this.step = 4;
        this.updateStepContent();

        try {
            const formData = new FormData();
            formData.append('file', this.file);
            formData.append('mappings', JSON.stringify(this.fieldMappings));
            formData.append('options', JSON.stringify({
                update_existing: updateExisting,
                skip_errors: skipErrors,
                create_new: createNew
            }));

            // Simulate progress
            const progressInterval = setInterval(() => {
                if (this.importProgress < 90) {
                    this.importProgress += Math.random() * 10;
                    this.updateProgressUI();
                }
            }, 500);

            const response = await fetch(`${this.app.config.apiUrl}/products/import`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('omnex_token')}`
                },
                body: formData
            });

            clearInterval(progressInterval);
            this.importProgress = 100;
            this.updateProgressUI();

            const result = await response.json();

            await new Promise(resolve => setTimeout(resolve, 500));

            this.importing = false;
            this.importReport = result.data || result;
            this.updateStepContent();

            if (result.success) {
                const { inserted, updated, failed } = this.importReport.summary;
                if (failed > 0) {
                    Toast.warning(this.__('import.toast.importedWithErrors', { success: inserted + updated, failed }));
                } else {
                    Toast.success(this.__('import.toast.importedSuccess', { count: inserted + updated }));
                }
            } else {
                Toast.error(this.__('import.importFailed') + ': ' + (result.message || this.__('import.unknownError')));
            }

        } catch (error) {
            Logger.error('Import failed:', error);
            this.importing = false;
            this.importReport = {
                success: false,
                summary: { total_rows: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 },
                errors: [error.message],
                failed_rows: []
            };
            this.updateStepContent();
            Toast.error(this.__('import.toast.importFailed') + ': ' + error.message);
        }
    }

    updateProgressUI() {
        const progressBar = document.querySelector('.progress-bar');
        const progressText = document.querySelector('.progress-text');
        if (progressBar) progressBar.style.width = this.importProgress + '%';
        if (progressText) progressText.textContent = Math.round(this.importProgress) + '%';
    }

    downloadErrors() {
        if (!this.importReport?.failed_rows?.length) return;

        const csv = [
            [
                this.__('import.report.rowHeader'),
                this.__('import.report.skuHeader'),
                this.__('import.report.productNameHeader'),
                this.__('import.report.errorHeader')
            ].join(','),
            ...this.importReport.failed_rows.map(row => [
                row.row,
                `"${row.sku || ''}"`,
                `"${row.name || ''}"`,
                `"${this.formatImportErrors(row.errors).replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `import_errors_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        Toast.success(this.__('import.toast.errorsDownloaded'));
    }

    reset() {
        this.file = null;
        this.fileType = null;
        this.analysisData = null;
        this.fieldMappings = {};
        this.step = 1;
        this.importing = false;
        this.importProgress = 0;
        this.importReport = null;

        const container = document.getElementById('app-content') || document.getElementById('page-content');
        if (container) {
            container.innerHTML = this.render();
            this.bindEvents();
        }
    }

    addStyles() {
        if (document.getElementById('product-import-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'product-import-styles';
        styles.textContent = `
            /* Import Steps */
            .import-steps {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0;
            }

            .import-step {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }

            .step-number {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: var(--bg-secondary);
                border: 2px solid var(--border-color);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 1rem;
                transition: all 0.3s;
            }

            .import-step.active .step-number {
                background: var(--color-primary);
                border-color: var(--color-primary);
                color: white;
            }

            .import-step.completed .step-number {
                background: var(--color-success);
                border-color: var(--color-success);
                color: white;
            }

            .step-label {
                font-size: 0.875rem;
                color: var(--text-muted);
                font-weight: 500;
            }

            .import-step.active .step-label {
                color: var(--text-primary);
            }

            .step-line {
                width: 80px;
                height: 2px;
                background: var(--border-color);
                margin: 0 12px;
                margin-bottom: 28px;
                transition: background 0.3s;
            }

            .step-line.completed {
                background: var(--color-success);
            }

            /* Upload Zone */
            .upload-zone {
                border: 2px dashed var(--border-color);
                border-radius: var(--radius-lg);
                padding: 60px 40px;
                text-align: center;
                transition: all 0.3s;
                background: var(--bg-secondary);
            }

            .upload-zone:hover,
            .upload-zone.dragover {
                border-color: var(--color-primary);
                background: rgba(34, 139, 230, 0.05);
            }

            .upload-icon {
                font-size: 4rem;
                color: var(--text-muted);
                margin-bottom: 1rem;
            }

            .upload-zone h3 {
                font-size: 1.25rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
            }

            .upload-hint {
                color: var(--text-muted);
                margin-bottom: 1.5rem;
            }

            .upload-formats {
                font-size: 0.875rem;
                color: var(--text-muted);
                margin-top: 1.5rem;
            }

            /* Selected File */
            .selected-file {
                background: var(--bg-secondary);
                border-radius: var(--radius-lg);
                padding: 1rem;
            }

            .file-info {
                display: flex;
                align-items: center;
                gap: 1rem;
            }

            .file-icon {
                width: 48px;
                height: 48px;
                border-radius: var(--radius-md);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                background: var(--color-primary);
                color: white;
            }

            .file-icon.txt { background: #3b82f6; }
            .file-icon.csv { background: #10b981; }
            .file-icon.json { background: #f59e0b; }
            .file-icon.xml { background: #8b5cf6; }
            .file-icon.xlsx { background: #059669; }

            .file-details {
                flex: 1;
            }

            .file-name {
                font-weight: 600;
                margin-bottom: 0.25rem;
            }

            .file-meta {
                font-size: 0.875rem;
                color: var(--text-muted);
            }

            /* Format Options */
            .format-options {
                display: flex;
                gap: 0.75rem;
                justify-content: center;
            }

            .format-option {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.5rem;
                padding: 1rem 1.5rem;
                border: 2px solid var(--border-color);
                border-radius: var(--radius-md);
                cursor: pointer;
                transition: all 0.2s;
                min-width: 80px;
            }

            .format-option:hover {
                border-color: var(--color-primary);
            }

            .format-option.selected {
                border-color: var(--color-primary);
                background: rgba(34, 139, 230, 0.1);
            }

            .format-option i {
                font-size: 1.5rem;
            }

            .format-option span {
                font-weight: 500;
                font-size: 0.875rem;
            }

            /* Mapping */
            .mapping-info {
                display: flex;
                gap: 1rem;
            }

            .info-box {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1rem;
                border-radius: var(--radius-md);
                font-size: 0.875rem;
            }

            .info-box.success {
                background: rgba(16, 185, 129, 0.1);
                color: #059669;
            }

            .info-box.warning {
                background: rgba(245, 158, 11, 0.1);
                color: #d97706;
            }

            .section-title {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 1rem;
                font-weight: 600;
                margin-bottom: 1rem;
                color: var(--text-primary);
            }

            .mapping-grid {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }

            .mapping-row {
                display: grid;
                grid-template-columns: 1fr auto 1.5fr;
                gap: 1rem;
                align-items: center;
                padding: 0.75rem 1rem;
                background: var(--bg-secondary);
                border-radius: var(--radius-md);
                border: 1px solid transparent;
                transition: all 0.2s;
            }

            .mapping-row.mapped {
                border-color: var(--color-success);
                background: rgba(16, 185, 129, 0.05);
            }

            .mapping-row.required .target-label {
                font-weight: 600;
            }

            .mapping-target {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }

            .target-label {
                font-size: 0.9375rem;
            }

            .target-type {
                font-size: 0.75rem;
                color: var(--text-muted);
            }

            .required-star {
                color: #ef4444;
                margin-left: 0.25rem;
            }

            .mapping-arrow {
                color: var(--text-muted);
                font-size: 1.25rem;
            }

            .mapping-arrow .text-success {
                color: var(--color-success);
            }

            .mapping-source {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }

            .mapping-source .form-select {
                flex: 1;
            }

            .mapping-badge {
                display: inline-flex;
                align-items: center;
                gap: 0.25rem;
                padding: 0.25rem 0.5rem;
                border-radius: var(--radius-sm);
                font-size: 0.75rem;
                font-weight: 500;
                white-space: nowrap;
            }

            .mapping-badge.auto {
                background: rgba(34, 139, 230, 0.1);
                color: #228be6;
                border: 1px solid rgba(34, 139, 230, 0.3);
            }

            .mapping-badge.manual {
                background: rgba(124, 58, 237, 0.1);
                color: #7c3aed;
                border: 1px solid rgba(124, 58, 237, 0.3);
            }

            .mapping-badge i {
                font-size: 0.875rem;
            }

            .suggest-btn {
                padding: 0.25rem;
            }

            /* Sample Preview */
            .sample-preview {
                background: var(--bg-secondary);
                padding: 1rem;
                border-radius: var(--radius-md);
            }

            /* Import Options */
            .options-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1rem;
            }

            .option-item {
                display: flex;
                gap: 0.75rem;
                padding: 1rem;
                background: var(--bg-secondary);
                border-radius: var(--radius-md);
                cursor: pointer;
                transition: background 0.2s;
            }

            .option-item:hover {
                background: var(--bg-tertiary);
            }

            .option-content {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }

            .option-label {
                font-weight: 500;
            }

            .option-hint {
                font-size: 0.75rem;
                color: var(--text-muted);
            }

            /* Import Progress */
            .import-progress {
                text-align: center;
                padding: 4rem 2rem;
            }

            .progress-spinner {
                width: 64px;
                height: 64px;
                border: 4px solid var(--border-color);
                border-top-color: var(--color-primary);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1.5rem;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            .progress-bar-container {
                max-width: 400px;
                margin: 1.5rem auto 0.5rem;
                height: 8px;
                background: var(--bg-secondary);
                border-radius: 4px;
                overflow: hidden;
            }

            .progress-bar {
                height: 100%;
                background: var(--color-primary);
                border-radius: 4px;
                transition: width 0.3s;
            }

            .progress-text {
                font-weight: 600;
                color: var(--color-primary);
            }

            /* Report */
            .report-header {
                text-align: center;
                padding: 2rem;
                border-radius: var(--radius-lg);
                margin-bottom: 2rem;
            }

            .report-header.success {
                background: rgba(16, 185, 129, 0.1);
            }

            .report-header.error {
                background: rgba(239, 68, 68, 0.1);
            }

            .report-icon {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2.5rem;
                margin: 0 auto 1rem;
            }

            .report-header.success .report-icon {
                background: rgba(16, 185, 129, 0.2);
                color: #059669;
            }

            .report-header.error .report-icon {
                background: rgba(239, 68, 68, 0.2);
                color: #dc2626;
            }

            .report-header h3 {
                font-size: 1.5rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
            }

            .report-stats {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 1rem;
            }

            .stat-card {
                text-align: center;
                padding: 1.5rem 1rem;
                border-radius: var(--radius-lg);
                background: var(--bg-secondary);
            }

            .stat-card.total { border-left: 4px solid var(--color-primary); }
            .stat-card.success { border-left: 4px solid #10b981; }
            .stat-card.info { border-left: 4px solid #3b82f6; }
            .stat-card.warning { border-left: 4px solid #f59e0b; }
            .stat-card.danger { border-left: 4px solid #ef4444; }

            .stat-value {
                font-size: 2rem;
                font-weight: 700;
                margin-bottom: 0.25rem;
            }

            .stat-label {
                font-size: 0.875rem;
                color: var(--text-muted);
            }

            .success-rate-container {
                text-align: center;
            }

            .success-rate-bar {
                height: 12px;
                background: var(--bg-secondary);
                border-radius: 6px;
                overflow: hidden;
                margin-bottom: 0.5rem;
            }

            .rate-fill {
                height: 100%;
                background: linear-gradient(90deg, #10b981, #059669);
                border-radius: 6px;
                transition: width 0.5s;
            }

            .rate-text {
                font-weight: 600;
                color: var(--color-success);
            }

            .failed-rows {
                background: var(--bg-secondary);
                padding: 1rem;
                border-radius: var(--radius-md);
            }

            /* Responsive */
            @media (max-width: 768px) {
                .import-steps {
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .step-line {
                    display: none;
                }

                .mapping-row {
                    grid-template-columns: 1fr;
                    gap: 0.5rem;
                }

                .mapping-arrow {
                    transform: rotate(-90deg);
                    justify-self: center;
                }

                .report-stats {
                    grid-template-columns: repeat(2, 1fr);
                }

                .format-options {
                    flex-wrap: wrap;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    destroy() {
        // Cleanup
    }
}

export default ProductImportPage;
