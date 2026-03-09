/**
 * CompanySelector - Active Company Selector Component
 *
 * Allows SuperAdmin to select which company they are working on behalf of.
 * For regular users, shows their company name (read-only).
 *
 * @package OmnexDisplayHub
 */

import { Logger } from '../core/Logger.js';

export class CompanySelector {
    constructor(app) {
        this.app = app;
        this.companies = [];
        this.isOpen = false;
        this.storageKey = 'omnex_active_company';
        this._outsideClickHandler = null;
    }

    /**
     * Initialize the company selector
     */
    async init() {
        const user = this.app.auth.getUser();

        // Only show for SuperAdmin or users who can manage multiple companies
        if (user?.role === 'SuperAdmin') {
            await this.loadCompanies();
        }

        // Set initial active company
        this.initActiveCompany();
    }

    /**
     * Load companies list (for SuperAdmin)
     */
    async loadCompanies() {
        try {
            const response = await this.app.api.get('/companies');
            this.companies = response.data || [];
        } catch (error) {
            Logger.error('Failed to load companies:', error);
            this.companies = [];
        }
    }

    /**
     * Initialize active company from storage or user's company
     */
    initActiveCompany() {
        const user = this.app.auth.getUser();
        let activeCompanyId = localStorage.getItem(this.storageKey);

        if (user?.role === 'SuperAdmin') {
            // SuperAdmin: use stored company or first available
            if (!activeCompanyId && this.companies.length > 0) {
                activeCompanyId = this.companies[0].id;
                localStorage.setItem(this.storageKey, activeCompanyId);
            }
        } else {
            // Regular user: always use their company
            activeCompanyId = user?.company_id || null;
            if (activeCompanyId) {
                localStorage.setItem(this.storageKey, activeCompanyId);
            }
        }

        // Set in state
        const companyFallbackName = (window.__ ? window.__('layout.header.company', 'Company') : 'Company');
        const activeCompany = this.companies.find(c => c.id === activeCompanyId) ||
                             (user?.company_id ? { id: user.company_id, name: user.company_name || companyFallbackName } : null);

        this.app.state.set('activeCompany', activeCompany, true);
    }

    /**
     * Get active company ID
     */
    getActiveCompanyId() {
        const activeCompany = this.app.state.get('activeCompany');
        return activeCompany?.id || localStorage.getItem(this.storageKey) || null;
    }

    /**
     * Get active company
     */
    getActiveCompany() {
        return this.app.state.get('activeCompany');
    }

    /**
     * Set active company
     */
    setActiveCompany(companyId) {
        const company = this.companies.find(c => c.id === companyId);
        if (company) {
            localStorage.setItem(this.storageKey, companyId);
            this.app.state.set('activeCompany', company, true);

            // Refresh current page to reload data with new company context
            this.refreshCurrentPage();
        }
    }

    /**
     * Refresh current page after company change
     */
    refreshCurrentPage() {
        // Dispatch custom event for pages to handle (before reload)
        window.dispatchEvent(new CustomEvent('companyChanged', {
            detail: { company: this.getActiveCompany() }
        }));

        // Force full page reload to ensure all data is refreshed
        // This is the cleanest way to ensure all components reload with new company context
        window.location.reload();
    }

    /**
     * Render the company selector for header
     */
    render() {
        const user = this.app.auth.getUser();
        const activeCompany = this.getActiveCompany();
        const basePath = window.OmnexConfig?.basePath || '';
        const t = (key, fallback) => (window.__ ? window.__(key, fallback) : fallback);
        const companyLabel = t('layout.header.company', 'Company');
        const selectCompanyLabel = t('layout.header.selectCompany', 'Select Company');
        const activeCompanyLabel = t('layout.header.activeCompany', 'Active Company');

        // If not SuperAdmin, just show company name (no dropdown)
        if (user?.role !== 'SuperAdmin') {
            if (!activeCompany) return '';

            // Use favicon for header indicator
            const faviconPath = activeCompany.favicon || activeCompany.icon;
            const faviconHtml = faviconPath
                ? `<img src="${basePath}/${faviconPath}" alt="${activeCompany.name}" class="company-indicator-icon">`
                : `<i class="ti ti-building"></i>`;

            return `
                <div class="company-indicator">
                    ${faviconHtml}
                    <span class="company-name">${activeCompany.name || companyLabel}</span>
                </div>
            `;
        }

        // Use favicon for active company in header button
        const activeFaviconPath = activeCompany?.favicon || activeCompany?.icon;
        const activeFaviconHtml = activeFaviconPath
            ? `<img src="${basePath}/${activeFaviconPath}" alt="${activeCompany?.name}" class="company-selector-icon">`
            : `<i class="ti ti-building"></i>`;

        // SuperAdmin gets a dropdown selector (styled like user dropdown)
        return `
            <div class="company-selector-wrapper">
                <button class="company-selector-btn" id="company-selector-btn" title="${selectCompanyLabel}">
                    <div class="company-selector-avatar">
                        ${activeFaviconHtml}
                    </div>
                    <span class="company-name">${activeCompany?.name || selectCompanyLabel}</span>
                    <i class="ti ti-chevron-down"></i>
                </button>
                <div class="company-dropdown" id="company-dropdown">
                    <div class="company-dropdown-header">
                        <div class="company-dropdown-avatar">
                            ${activeFaviconHtml}
                        </div>
                        <div class="company-dropdown-info">
                            <span class="company-dropdown-name">${activeCompany?.name || selectCompanyLabel}</span>
                            <span class="company-dropdown-code">${activeCompany?.code || activeCompanyLabel}</span>
                        </div>
                    </div>
                    <div class="company-dropdown-list">
                        ${this.companies.map(company => {
                            // Use favicon for each company in dropdown list
                            const companyFaviconPath = company.favicon || company.icon;
                            const companyFaviconHtml = companyFaviconPath
                                ? `<img src="${basePath}/${companyFaviconPath}" alt="${company.name}" class="company-item-img">`
                                : `<i class="ti ti-building"></i>`;

                            return `
                            <button class="company-dropdown-item ${company.id === activeCompany?.id ? 'active' : ''}"
                                    data-company-id="${company.id}">
                                <div class="company-item-icon">
                                    ${companyFaviconHtml}
                                </div>
                                <div class="company-item-info">
                                    <div class="company-item-name">${company.name}</div>
                                    <div class="company-item-code">${company.code || ''}</div>
                                </div>
                                ${company.id === activeCompany?.id ? '<i class="ti ti-check text-primary"></i>' : ''}
                            </button>
                        `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get initials from company name
     */
    getCompanyInitials(name) {
        if (!name) return 'F';
        const words = name.split(' ').filter(w => w.length > 0);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    /**
     * Bind events after render
     */
    bindEvents() {
        const btn = document.getElementById('company-selector-btn');
        const dropdown = document.getElementById('company-dropdown');

        if (!btn || !dropdown) return;

        // Toggle dropdown
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
            dropdown.classList.toggle('open', this.isOpen);
        });

        // Close on outside click
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
        }
        this._outsideClickHandler = (e) => {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                this.isOpen = false;
                dropdown.classList.remove('open');
            }
        };
        document.addEventListener('click', this._outsideClickHandler);

        // Handle company selection
        dropdown.querySelectorAll('.company-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const companyId = item.dataset.companyId;
                this.setActiveCompany(companyId);
                this.isOpen = false;
                dropdown.classList.remove('open');

                // Update button text and dropdown header
                const company = this.companies.find(c => c.id === companyId);
                if (company) {
                    const activeCompanyLabel = (window.__ ? window.__('layout.header.activeCompany', 'Active Company') : 'Active Company');
                    // Update button company name
                    btn.querySelector('.company-name').textContent = company.name;

                    // Update dropdown header info
                    const dropdownName = dropdown.querySelector('.company-dropdown-name');
                    const dropdownCode = dropdown.querySelector('.company-dropdown-code');
                    if (dropdownName) {
                        dropdownName.textContent = company.name;
                    }
                    if (dropdownCode) {
                        dropdownCode.textContent = company.code || activeCompanyLabel;
                    }
                }

                // Update active state
                dropdown.querySelectorAll('.company-dropdown-item').forEach(i => {
                    i.classList.remove('active');
                    i.querySelector('.ti-check')?.remove();
                });
                item.classList.add('active');
                item.insertAdjacentHTML('beforeend', '<i class="ti ti-check text-primary"></i>');
            });
        });
    }

    destroy() {
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
            this._outsideClickHandler = null;
        }
    }
}

export default CompanySelector;
