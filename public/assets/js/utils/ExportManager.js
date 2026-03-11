/**
 * Omnex Display Hub - Export Manager
 * Merkezi export sistemi - Excel, CSV, HTML, JSON, MD, TXT, Print destekli
 *
 * @version 1.0.0
 */

export class ExportManager {
    constructor(options = {}) {
        // Auto-detect company branding from session
        const branding = ExportManager._getCompanyBranding();

        this.options = {
            filename: options.filename || 'export',
            title: options.title || (typeof window.__ === 'function' ? window.__('export.title') : 'Export'),
            subtitle: options.subtitle || '',
            logo: options.logo || branding.logo || `${window.OmnexConfig?.basePath || ''}/branding/logo-light.png`,
            companyName: options.companyName || branding.companyName || '',
            branchName: options.branchName || branding.branchName || '',
            author: options.author || branding.companyName || 'Omnex Display Hub',
            dateFormat: options.dateFormat || 'tr-TR',
            ...options
        };
    }

    /**
     * Get company branding from user session state
     */
    static _getCompanyBranding() {
        try {
            const userStr = localStorage.getItem('omnex_user');
            if (!userStr) return {};
            const user = JSON.parse(userStr);
            const company = user?.company;
            if (!company) return {};

            // Get light theme logo from company settings
            const settings = company.settings || {};
            const lightLogo = settings.branding?.logo_light || company.logo || null;
            const basePath = window.OmnexConfig?.basePath || '';
            const logoUrl = lightLogo ? (lightLogo.startsWith('http') ? lightLogo : `${basePath}/${lightLogo}`) : null;

            // Get branch name if available
            const branchName = user.branch_name || '';

            return {
                logo: logoUrl,
                companyName: company.name || '',
                branchName: branchName
            };
        } catch (e) {
            return {};
        }
    }

    /**
     * Export tÃ¼rlerini dÃ¶ndÃ¼r
     */
    static getExportTypes() {
        return [
            { id: 'excel', label: 'Excel (.xlsx)', icon: 'ti-file-spreadsheet', color: '#217346' },
            { id: 'csv', label: 'CSV', icon: 'ti-file-text', color: '#4CAF50' },
            { id: 'html', label: 'HTML', icon: 'ti-file-code', color: '#E44D26' },
            { id: 'json', label: 'JSON', icon: 'ti-braces', color: '#F7DF1E' },
            { id: 'md', label: 'Markdown', icon: 'ti-markdown', color: '#083FA1' },
            { id: 'txt', label: 'Text (.txt)', icon: 'ti-file', color: '#6c757d' },
            { id: 'print', label: (typeof window.__ === 'function' ? window.__('export.print') : 'Print'), icon: 'ti-printer', color: '#6366f1' }
        ];
    }

    /**
     * Ana export metodu
     * @param {string} type - Export tÃ¼rÃ¼ (excel, csv, html, json, md, txt, print)
     * @param {Array} data - Export edilecek veri
     * @param {Array} columns - Kolon tanÄ±mlarÄ± [{key, label, render?}]
     */
    async export(type, data, columns) {
        switch (type) {
            case 'excel':
                return this.exportExcel(data, columns);
            case 'csv':
                return this.exportCSV(data, columns);
            case 'html':
                return this.exportHTML(data, columns);
            case 'json':
                return this.exportJSON(data, columns);
            case 'md':
                return this.exportMarkdown(data, columns);
            case 'txt':
                return this.exportText(data, columns);
            case 'print':
                return this.print(data, columns);
            default:
                throw new Error(`Desteklenmeyen export tÃ¼rÃ¼: ${type}`);
        }
    }

    /**
     * Excel export (XLSX)
     */
    async exportExcel(data, columns) {
        // SheetJS (xlsx) kÃ¼tÃ¼phanesini dinamik yÃ¼kle (Local Vendor)
        if (!window.XLSX) {
            const basePath = window.OmnexConfig?.basePath || '';
            await this._loadScript(`${basePath}/assets/vendor/xlsx/xlsx.full.min.js`);
        }

        const rows = this._prepareData(data, columns, 'excel');
        const headers = columns.map(c => c.label);

        // Worksheet oluÅŸtur
        const ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);

        // Kolon geniÅŸlikleri
        ws['!cols'] = columns.map(c => ({ wch: Math.max(c.label.length, 15) }));

        // Workbook oluÅŸtur
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, this.options.title.substring(0, 31));

        // Ä°ndir
        const filename = `${this.options.filename}_${this._getTimestamp()}.xlsx`;
        window.XLSX.writeFile(wb, filename);

        return { success: true, filename };
    }

    /**
     * CSV export
     */
    exportCSV(data, columns) {
        const rows = this._prepareData(data, columns, 'csv');
        const headers = columns.map(c => this._escapeCSV(c.label));

        let csv = '\uFEFF'; // UTF-8 BOM for Excel
        csv += headers.join(';') + '\n';

        rows.forEach(row => {
            csv += row.map(cell => this._escapeCSV(cell)).join(';') + '\n';
        });

        const filename = `${this.options.filename}_${this._getTimestamp()}.csv`;
        this._downloadFile(csv, filename, 'text/csv;charset=utf-8');

        return { success: true, filename };
    }

    /**
     * HTML export - Yeni sekmede aÃ§ar
     */
    exportHTML(data, columns) {
        const rows = this._prepareData(data, columns, 'html');
        const now = new Date().toLocaleString(this.options.dateFormat);

        let html = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this._escapeHTML(this.options.title)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            padding: 2rem;
            color: #1a1a2e;
        }
        .container { width: 100%; max-width: 1360px; margin: 0 auto; }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #e9ecef;
        }
        .header-left { display: flex; align-items: center; min-width: 250px; max-width: 250px; }
        .header-center { text-align: center; flex: 1; }
        .company-name { font-size: 1.125rem; font-weight: 700; color: #1a1a2e; }
        .branch-name { font-size: 0.8125rem; color: #6c757d; margin-top: 0.125rem; }
        .logo {
            width: 250px;
            height: 100px;
            object-fit: contain;
            object-position: center;
            display: block;
        }
        .report-title { font-size: 1.5rem; font-weight: 700; color: #1a1a2e; margin-top: 0.5rem; }
        .subtitle { font-size: 0.875rem; color: #6c757d; }
        .meta { font-size: 0.75rem; color: #6c757d; text-align: right; }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        th {
            background: #228be6;
            color: white;
            padding: 0.75rem 1rem;
            text-align: left;
            font-weight: 600;
            font-size: 0.875rem;
        }
        td {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid #e9ecef;
            font-size: 0.875rem;
        }
        tr:nth-child(even) { background: #f8f9fa; }
        tr:hover { background: #e7f5ff; }
        .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #e9ecef;
            text-align: center;
            font-size: 0.75rem;
            color: #6c757d;
        }
        .badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        .badge-success { background: #d3f9d8; color: #2b8a3e; }
        .badge-warning { background: #fff3bf; color: #e67700; }
        .badge-danger { background: #ffe3e3; color: #c92a2a; }
        .badge-info { background: #d0ebff; color: #1864ab; }
        i { margin-right: 0.25rem; }
        @media print {
            body { background: white; padding: 0; }
            table { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-left">
                ${this.options.logo ? `<img src="${this.options.logo}" alt="Logo" class="logo">` : ''}
            </div>
            <div class="header-center">
                <div class="company-name">${this._escapeHTML(this.options.companyName || 'Omnex Display Hub')}</div>
                ${this.options.branchName ? `<div class="branch-name">${this._escapeHTML(this.options.branchName)}</div>` : ''}
                <div class="report-title">${this._escapeHTML(this.options.title)}</div>
                ${this.options.subtitle ? `<div class="subtitle">${this._escapeHTML(this.options.subtitle)}</div>` : ''}
            </div>
            <div class="meta">
                <div>Olu\u015Fturulma: ${now}</div>
                <div>Toplam: ${data.length} kay\u0131t</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    ${columns.map(c => `<th>${this._escapeHTML(c.label)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr>
                        ${row.map(cell => `<td>${cell}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            ${this.options.author} - ${now}
        </div>
    </div>
</body>
</html>`;

        // HTML export yeni sekmede aÃ§Ä±lÄ±r (indirmez)
        const htmlWindow = window.open('', '_blank');
        if (htmlWindow) {
            htmlWindow.document.write(html);
            htmlWindow.document.close();
        } else {
            // Popup engellenirse fallback olarak indir
            const filename = `${this.options.filename}_${this._getTimestamp()}.html`;
            this._downloadFile(html, filename, 'text/html;charset=utf-8');
        }

        return { success: true };
    }

    /**
     * JSON export
     */
    exportJSON(data, columns) {
        const exportData = {
            meta: {
                title: this.options.title,
                subtitle: this.options.subtitle,
                author: this.options.author,
                exportedAt: new Date().toISOString(),
                totalRecords: data.length
            },
            columns: columns.map(c => ({
                key: c.key,
                label: c.label
            })),
            data: data.map(item => {
                const obj = {};
                columns.forEach(col => {
                    obj[col.key] = this._getCellValue(item, col, 'json');
                });
                return obj;
            })
        };

        const json = JSON.stringify(exportData, null, 2);
        const filename = `${this.options.filename}_${this._getTimestamp()}.json`;
        this._downloadFile(json, filename, 'application/json;charset=utf-8');

        return { success: true, filename };
    }

    /**
     * Markdown export
     */
    exportMarkdown(data, columns) {
        const rows = this._prepareData(data, columns, 'md');
        const now = new Date().toLocaleString(this.options.dateFormat);

        let md = `# ${this.options.title}\n\n`;

        if (this.options.subtitle) {
            md += `> ${this.options.subtitle}\n\n`;
        }

        md += `**OluÅŸturulma:** ${now}  \n`;
        md += `**Toplam KayÄ±t:** ${data.length}\n\n`;
        md += `---\n\n`;

        // Tablo baÅŸlÄ±klarÄ±
        md += '| ' + columns.map(c => c.label).join(' | ') + ' |\n';
        md += '| ' + columns.map(() => '---').join(' | ') + ' |\n';

        // Tablo satÄ±rlarÄ±
        rows.forEach(row => {
            md += '| ' + row.map(cell => this._escapeMarkdown(String(cell))).join(' | ') + ' |\n';
        });

        md += `\n---\n\n`;
        md += `*${this.options.author}*\n`;

        const filename = `${this.options.filename}_${this._getTimestamp()}.md`;
        this._downloadFile(md, filename, 'text/markdown;charset=utf-8');

        return { success: true, filename };
    }

    /**
     * Text export
     */
    exportText(data, columns) {
        const rows = this._prepareData(data, columns, 'txt');
        const now = new Date().toLocaleString(this.options.dateFormat);

        // Kolon geniÅŸliklerini hesapla
        const widths = columns.map((col, i) => {
            const headerLen = col.label.length;
            const maxDataLen = Math.max(...rows.map(row => String(row[i]).length));
            return Math.max(headerLen, maxDataLen, 10);
        });

        let txt = `${'='.repeat(widths.reduce((a, b) => a + b, 0) + columns.length * 3 + 1)}\n`;
        txt += `${this.options.title}\n`;
        if (this.options.subtitle) txt += `${this.options.subtitle}\n`;
        txt += `OluÅŸturulma: ${now}\n`;
        txt += `Toplam KayÄ±t: ${data.length}\n`;
        txt += `${'='.repeat(widths.reduce((a, b) => a + b, 0) + columns.length * 3 + 1)}\n\n`;

        // BaÅŸlÄ±klar
        txt += '| ' + columns.map((c, i) => c.label.padEnd(widths[i])).join(' | ') + ' |\n';
        txt += '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |\n';

        // SatÄ±rlar
        rows.forEach(row => {
            txt += '| ' + row.map((cell, i) => String(cell).padEnd(widths[i])).join(' | ') + ' |\n';
        });

        txt += `\n${'='.repeat(widths.reduce((a, b) => a + b, 0) + columns.length * 3 + 1)}\n`;
        txt += `${this.options.author}\n`;

        const filename = `${this.options.filename}_${this._getTimestamp()}.txt`;
        this._downloadFile(txt, filename, 'text/plain;charset=utf-8');

        return { success: true, filename };
    }

    /**
     * Print - YazdÄ±rma penceresi aÃ§
     */
    print(data, columns) {
        const rows = this._prepareData(data, columns, 'html');
        const now = new Date().toLocaleString(this.options.dateFormat);

        const printWindow = window.open('', '_blank');

        printWindow.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>${this._escapeHTML(this.options.title)} - YazdÄ±r</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 1.5rem;
            color: #1a1a2e;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #1a1a2e;
        }
        .header-left { display: flex; align-items: center; min-width: 250px; max-width: 250px; }
        .header-center { text-align: center; flex: 1; }
        .company-name { font-size: 1rem; font-weight: 700; }
        .branch-name { font-size: 0.7rem; color: #6c757d; margin-top: 0.125rem; }
        .logo {
            width: 250px;
            height: 100px;
            object-fit: contain;
            object-position: center;
            display: block;
        }
        .report-title { font-size: 1.25rem; font-weight: 700; margin-top: 0.35rem; }
        .subtitle { font-size: 0.75rem; color: #6c757d; }
        .meta { font-size: 0.7rem; color: #6c757d; text-align: right; }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.8rem;
        }
        th {
            background: #f1f3f5;
            padding: 0.5rem;
            text-align: left;
            font-weight: 600;
            border: 1px solid #dee2e6;
        }
        td {
            padding: 0.4rem 0.5rem;
            border: 1px solid #dee2e6;
        }
        tr:nth-child(even) { background: #f8f9fa; }
        .footer {
            margin-top: 1.5rem;
            padding-top: 0.5rem;
            border-top: 1px solid #dee2e6;
            text-align: center;
            font-size: 0.7rem;
            color: #6c757d;
        }
        .badge {
            display: inline-block;
            padding: 0.15rem 0.4rem;
            border-radius: 3px;
            font-size: 0.7rem;
            font-weight: 500;
        }
        .badge-success { background: #d3f9d8; color: #2b8a3e; }
        .badge-warning { background: #fff3bf; color: #e67700; }
        .badge-danger { background: #ffe3e3; color: #c92a2a; }
        .badge-info { background: #d0ebff; color: #1864ab; }
        i { margin-right: 0.15rem; font-size: 0.85em; }
        @page {
            margin: 1cm;
            size: A4 landscape;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            ${this.options.logo ? `<img src="${this.options.logo}" alt="Logo" class="logo">` : ''}
        </div>
        <div class="header-center">
            <div class="company-name">${this._escapeHTML(this.options.companyName || 'Omnex Display Hub')}</div>
            ${this.options.branchName ? `<div class="branch-name">${this._escapeHTML(this.options.branchName)}</div>` : ''}
            <div class="report-title">${this._escapeHTML(this.options.title)}</div>
            ${this.options.subtitle ? `<div class="subtitle">${this._escapeHTML(this.options.subtitle)}</div>` : ''}
        </div>
        <div class="meta">
            <div>${now}</div>
            <div>${data.length} kay\u0131t</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                ${columns.map(c => `<th>${this._escapeHTML(c.label)}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${rows.map(row => `
                <tr>
                    ${row.map(cell => `<td>${cell}</td>`).join('')}
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="footer">
        ${this.options.author}
    </div>

    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>`);

        printWindow.document.close();

        return { success: true };
    }

    /**
     * Export menÃ¼sÃ¼ HTML'i oluÅŸtur
     * @param {string} containerId - MenÃ¼nÃ¼n ekleneceÄŸi container ID
     * @param {Function} onExport - Export fonksiyonu callback
     */
    static renderExportMenu(containerId, onExport) {
        const types = ExportManager.getExportTypes();

        return `
            <div class="export-dropdown" id="${containerId}">
                <button class="btn btn-outline export-dropdown-btn" type="button">
                    <i class="ti ti-download"></i>
                    <span>D\u0131\u015Fa Aktar</span>
                    <i class="ti ti-chevron-down"></i>
                </button>
                <div class="export-dropdown-menu">
                    ${types.map(type => `
                        <button class="export-dropdown-item" data-export-type="${type.id}">
                            <i class="${type.icon}" style="color: ${type.color}"></i>
                            <span>${type.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Export dropdown event binding
     */
    static bindExportDropdown(containerId, callback) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const btn = container.querySelector('.export-dropdown-btn');
        const menu = container.querySelector('.export-dropdown-menu');

        // Toggle menu
        btn?.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
        });

        // Close on outside click
        if (container.__exportOutsideClickHandler) {
            document.removeEventListener('click', container.__exportOutsideClickHandler);
        }
        container.__exportOutsideClickHandler = () => {
            menu?.classList.remove('show');
        };
        document.addEventListener('click', container.__exportOutsideClickHandler);

        // Export item click
        container.querySelectorAll('.export-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.exportType;
                menu.classList.remove('show');
                callback(type);
            });
        });

        return () => {
            if (container.__exportOutsideClickHandler) {
                document.removeEventListener('click', container.__exportOutsideClickHandler);
                container.__exportOutsideClickHandler = null;
            }
        };
    }

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    /**
     * Veriyi export formatÄ±na hazÄ±rla
     */
    _prepareData(data, columns, format) {
        return data.map(item => {
            return columns.map(col => this._getCellValue(item, col, format));
        });
    }

    /**
     * HÃ¼cre deÄŸerini al
     */
    _getCellValue(item, column, format) {
        let value = item[column.key];

        // Nested key desteÄŸi (Ã¶rn: "user.name")
        if (column.key.includes('.')) {
            value = column.key.split('.').reduce((obj, key) => obj?.[key], item);
        }

        // Ã–zel render fonksiyonu varsa
        if (column.exportRender && typeof column.exportRender === 'function') {
            return column.exportRender(value, item, format);
        }

        // Format-specific iÅŸlemler
        if (format === 'html' || format === 'print') {
            // HTML iÃ§in badge ve icon desteÄŸi
            if (column.badge) {
                const badgeConfig = typeof column.badge === 'function'
                    ? column.badge(value, item)
                    : column.badge[value];
                if (badgeConfig) {
                    return `<span class="badge badge-${badgeConfig.type || 'info'}">${badgeConfig.icon ? `<i class="${badgeConfig.icon}"></i>` : ''}${badgeConfig.label || value}</span>`;
                }
            }
            if (column.icon) {
                const icon = typeof column.icon === 'function' ? column.icon(value, item) : column.icon;
                return `<i class="${icon}"></i> ${this._escapeHTML(String(value ?? ''))}`;
            }
            return this._escapeHTML(String(value ?? ''));
        }

        // DiÄŸer formatlar iÃ§in dÃ¼z deÄŸer
        if (value === null || value === undefined) return '';
        if (typeof value === 'boolean') return value ? (typeof window.__ === 'function' ? window.__('export.yes') : 'Yes') : (typeof window.__ === 'function' ? window.__('export.no') : 'No');
        if (value instanceof Date) return value.toLocaleString(this.options.dateFormat);

        return String(value);
    }

    /**
     * CSV iÃ§in escape
     */
    _escapeCSV(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    /**
     * HTML iÃ§in escape
     */
    _escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Markdown iÃ§in escape
     */
    _escapeMarkdown(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/\|/g, '\\|')
            .replace(/\n/g, ' ');
    }

    /**
     * Dosya indirme
     */
    _downloadFile(content, filename, mimeType) {
        // Dosya adÄ±nÄ± sanitize et (TÃ¼rkÃ§e karakterleri ve Ã¶zel karakterleri temizle)
        const sanitizedFilename = this._sanitizeFilename(filename);

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = sanitizedFilename;
        link.style.display = 'none';
        document.body.appendChild(link);

        // Timeout ile indirme baÅŸlat (bazÄ± tarayÄ±cÄ±larda gerekli)
        setTimeout(() => {
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Dosya adÄ±nÄ± gÃ¼venli hale getir
     */
    _sanitizeFilename(filename) {
        // TÃ¼rkÃ§e karakterleri deÄŸiÅŸtir
        const turkishMap = {
            '\u0131': 'i', '\u0130': 'I', '\u011F': 'g', '\u011E': 'G',
            '\u00FC': 'u', '\u00DC': 'U', '\u015F': 's', '\u015E': 'S',
            '\u00F6': 'o', '\u00D6': 'O', '\u00E7': 'c', '\u00C7': 'C'
        };

        let safe = filename;
        for (const [from, to] of Object.entries(turkishMap)) {
            safe = safe.replace(new RegExp(from, 'g'), to);
        }

        // GÃ¼venli olmayan karakterleri kaldÄ±r
        safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_');

        // Ã‡ift alt Ã§izgileri temizle
        safe = safe.replace(/_+/g, '_');

        return safe;
    }

    /**
     * Dinamik script yÃ¼kleme
     */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Timestamp oluÅŸtur (dosya adÄ± iÃ§in)
     */
    _getTimestamp() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    }
}

// Global eriÅŸim iÃ§in window'a ekle
window.ExportManager = ExportManager;

