/**
 * BranchSelector - Active Branch Selector Component
 *
 * Allows users to select which branch they are working on.
 * Shows accessible branches based on user role and permissions.
 *
 * @package OmnexDisplayHub
 * @version 2.0.18
 */

import { Logger } from '../core/Logger.js';

export class BranchSelector {
    constructor(app) {
        this.app = app;
        this.branches = [];
        this.hierarchy = null;
        this.isOpen = false;
        this.storageKey = 'omnex_active_branch';
    }

    /**
     * Initialize the branch selector
     */
    async init() {
        await this.loadBranches();
        this.initActiveBranch();
    }

    /**
     * Load branches list for current user
     */
    async loadBranches() {
        try {
            const response = await this.app.api.get('/branches?hierarchy=1');
            if (response.success) {
                this.branches = response.data?.all || response.data || [];
                this.hierarchy = response.data;
            }
        } catch (error) {
            Logger.error('Failed to load branches:', error);
            this.branches = [];
        }
    }

    /**
     * Initialize active branch from storage or default
     */
    initActiveBranch() {
        let activeBranchId = localStorage.getItem(this.storageKey);

        // Validate stored branch is still accessible
        if (activeBranchId) {
            const branch = this.branches.find(b => b.id === activeBranchId);
            if (!branch) {
                activeBranchId = null;
                localStorage.removeItem(this.storageKey);
            }
        }

        // If no branch selected, keep it as null (means "All Branches")
        // Don't auto-select a branch - respect user's choice of "Tüm Şubeler"

        // Set in state
        const activeBranch = activeBranchId ? this.branches.find(b => b.id === activeBranchId) : null;
        this.app.state.set('activeBranch', activeBranch, true);
    }

    /**
     * Get active branch ID
     */
    getActiveBranchId() {
        const activeBranch = this.app.state.get('activeBranch');
        return activeBranch?.id || localStorage.getItem(this.storageKey) || null;
    }

    /**
     * Get active branch
     */
    getActiveBranch() {
        return this.app.state.get('activeBranch');
    }

    /**
     * Set active branch
     */
    setActiveBranch(branchId) {
        const branch = this.branches.find(b => b.id === branchId);
        if (branch) {
            localStorage.setItem(this.storageKey, branchId);
            this.app.state.set('activeBranch', branch, true);

            // Refresh current page to reload data with new branch context
            this.refreshCurrentPage();
        }
    }

    /**
     * Clear active branch (show all/master data)
     */
    clearActiveBranch() {
        localStorage.removeItem(this.storageKey);
        this.app.state.set('activeBranch', null, true);
        this.refreshCurrentPage();
    }

    /**
     * Refresh current page after branch change
     */
    refreshCurrentPage() {
        // Dispatch custom event for pages to handle (before reload)
        window.dispatchEvent(new CustomEvent('branchChanged', {
            detail: { branch: this.getActiveBranch() }
        }));

        // Force full page reload to ensure all data is refreshed
        // This is the cleanest way to ensure all components reload with new branch context
        window.location.reload();
    }

    /**
     * Get branch type icon
     */
    getBranchIcon(type) {
        const icons = {
            'region': 'ti ti-map-2',
            'store': 'ti ti-building-store',
            'warehouse': 'ti ti-building-warehouse',
            'online': 'ti ti-world'
        };
        return icons[type] || 'ti ti-building';
    }

    /**
     * Get branch type label
     */
    getBranchTypeLabel(type) {
        const labels = {
            'region': window.__?.('branches.types.region') || 'Bolge',
            'store': window.__?.('branches.types.store') || 'Magaza',
            'warehouse': window.__?.('branches.types.warehouse') || 'Depo',
            'online': window.__?.('branches.types.online') || 'Online'
        };
        return labels[type] || type;
    }

    /**
     * Render the branch selector for header
     */
    render() {
        // If no branches, don't show selector
        if (this.branches.length === 0) {
            return '';
        }

        const activeBranch = this.getActiveBranch();
        const icon = activeBranch ? this.getBranchIcon(activeBranch.type) : 'ti ti-database';
        const allLabel = window.__?.('branches.allBranches') || 'Tum Subeler';

        return `
            <div class="branch-selector-wrapper">
                <button class="branch-selector-btn" id="branch-selector-btn" title="${window.__?.('branches.selectBranch') || 'Sube Sec'}">
                    <div class="branch-selector-avatar">
                        <i class="${icon}"></i>
                    </div>
                    <span class="branch-name">${activeBranch?.name || allLabel}</span>
                    <i class="ti ti-chevron-down"></i>
                </button>
                <div class="branch-dropdown" id="branch-dropdown">
                    <div class="branch-dropdown-header">
                        <div class="branch-dropdown-avatar">
                            <i class="${icon}"></i>
                        </div>
                        <div class="branch-dropdown-info">
                            <span class="branch-dropdown-name">${activeBranch?.name || allLabel}</span>
                            <span class="branch-dropdown-type">${activeBranch ? this.getBranchTypeLabel(activeBranch.type) : (window.__?.('branches.masterData') || 'Ana Veri')}</span>
                        </div>
                    </div>
                    <div class="branch-dropdown-list">
                        ${this.renderBranchList()}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render branch list with hierarchy
     */
    renderBranchList() {
        const activeBranch = this.getActiveBranch();
        const allLabel = window.__?.('branches.allBranches') || 'Tum Subeler';
        let html = '';

        // "All branches" option (master data)
        html += `
            <button class="branch-dropdown-item ${!activeBranch ? 'active' : ''}"
                    data-branch-id="">
                <div class="branch-item-icon">
                    <i class="ti ti-database"></i>
                </div>
                <div class="branch-item-info">
                    <div class="branch-item-name">${allLabel}</div>
                    <div class="branch-item-type">${window.__?.('branches.masterData') || 'Ana Veri'}</div>
                </div>
                ${!activeBranch ? '<i class="ti ti-check text-primary"></i>' : ''}
            </button>
        `;

        // Render hierarchically if available
        if (this.hierarchy?.regions?.length > 0) {
            // Regions first
            this.hierarchy.regions.forEach(region => {
                html += this.renderBranchItem(region, activeBranch, false);
                // Children under region
                if (region.children?.length > 0) {
                    region.children.forEach(child => {
                        html += this.renderBranchItem(child, activeBranch, true);
                    });
                }
            });

            // Orphans (stores without region)
            if (this.hierarchy.orphans?.length > 0) {
                this.hierarchy.orphans.forEach(branch => {
                    html += this.renderBranchItem(branch, activeBranch, false);
                });
            }
        } else {
            // Flat list
            this.branches.forEach(branch => {
                html += this.renderBranchItem(branch, activeBranch, false);
            });
        }

        return html;
    }

    /**
     * Render single branch item
     */
    renderBranchItem(branch, activeBranch, isChild) {
        const isActive = activeBranch?.id === branch.id;
        const icon = this.getBranchIcon(branch.type);
        const typeLabel = this.getBranchTypeLabel(branch.type);

        return `
            <button class="branch-dropdown-item ${isActive ? 'active' : ''} ${isChild ? 'child' : ''} ${branch.type === 'region' ? 'region' : ''}"
                    data-branch-id="${branch.id}">
                <div class="branch-item-icon">
                    <i class="${icon}"></i>
                </div>
                <div class="branch-item-info">
                    <div class="branch-item-name">${branch.name}</div>
                    <div class="branch-item-type">${typeLabel}${branch.code ? ' - ' + branch.code : ''}</div>
                </div>
                ${isActive ? '<i class="ti ti-check text-primary"></i>' : ''}
            </button>
        `;
    }

    /**
     * Bind events after render
     */
    bindEvents() {
        const btn = document.getElementById('branch-selector-btn');
        const dropdown = document.getElementById('branch-dropdown');

        if (!btn || !dropdown) return;

        // Toggle dropdown
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
            dropdown.classList.toggle('open', this.isOpen);
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                this.isOpen = false;
                dropdown.classList.remove('open');
            }
        });

        // Handle branch selection
        dropdown.querySelectorAll('.branch-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const branchId = item.dataset.branchId;

                if (branchId) {
                    this.setActiveBranch(branchId);
                } else {
                    this.clearActiveBranch();
                }

                this.isOpen = false;
                dropdown.classList.remove('open');

                // Update UI
                const branch = branchId ? this.branches.find(b => b.id === branchId) : null;
                const icon = branch ? this.getBranchIcon(branch.type) : 'ti ti-database';
                const allLabel = window.__?.('branches.allBranches') || 'Tum Subeler';

                // Update button
                btn.querySelector('.branch-name').textContent = branch?.name || allLabel;
                btn.querySelector('.branch-selector-avatar i').className = icon;

                // Update dropdown header
                const dropdownName = dropdown.querySelector('.branch-dropdown-name');
                const dropdownType = dropdown.querySelector('.branch-dropdown-type');
                const dropdownIcon = dropdown.querySelector('.branch-dropdown-avatar i');

                if (dropdownName) dropdownName.textContent = branch?.name || allLabel;
                if (dropdownType) dropdownType.textContent = branch ? this.getBranchTypeLabel(branch.type) : (window.__?.('branches.masterData') || 'Ana Veri');
                if (dropdownIcon) dropdownIcon.className = icon;

                // Update active states
                dropdown.querySelectorAll('.branch-dropdown-item').forEach(i => {
                    i.classList.remove('active');
                    i.querySelector('.ti-check')?.remove();
                });
                item.classList.add('active');
                item.insertAdjacentHTML('beforeend', '<i class="ti ti-check text-primary"></i>');
            });
        });
    }
}

export default BranchSelector;
