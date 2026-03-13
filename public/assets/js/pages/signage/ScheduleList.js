/**
 * Schedule List Page Component
 * Uses centralized DataTable component
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { DataTable } from '../../components/DataTable.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class ScheduleListPage {
    constructor(app) {
        this.app = app;
        this.dataTable = null;
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.__('schedules.title')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon orange">
                            <i class="ti ti-calendar-event"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.__('schedules.title')}</h1>
                            <p class="page-subtitle">${this.__('schedules.subtitle')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="new-schedule-btn" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.__('schedules.addSchedule')}
                        </button>
                    </div>
                </div>
            </div>

            <div class="card card-table">
                <div id="schedules-table"></div>
            </div>
        `;
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('signage');
    }

    async init() {
        this.initDataTable();
        this.bindEvents();
    }

    initDataTable() {
        const container = document.getElementById('schedules-table');
        if (!container) return;

        this.dataTable = new DataTable(container, {
            serverSide: true,
            fetchData: (params) => this.fetchSchedules(params),
            columns: [
                {
                    key: 'icon',
                    label: this.__('schedules.columns.preview'),
                    sortable: false,
                    preview: true,
                    render: () => `
                        <div class="data-table-icon-cell">
                            <i class="ti ti-calendar-event"></i>
                        </div>
                    `
                },
                {
                    key: 'name',
                    label: this.__('schedules.columns.name'),
                    title: true,
                    render: (value) => `<span class="font-medium">${escapeHTML(value)}</span>`
                },
                {
                    key: 'playlist_name',
                    label: this.__('schedules.columns.playlist'),
                    render: (value) => value ? escapeHTML(value) : '-'
                },
                {
                    key: 'device_count',
                    label: this.__('schedules.columns.devices'),
                    render: (value) => this.__('schedules.columns.deviceCount', { count: value || 0 })
                },
                {
                    key: 'start_date',
                    label: this.__('schedules.columns.startDate'),
                    type: 'date'
                },
                {
                    key: 'end_date',
                    label: this.__('schedules.columns.endDate'),
                    render: (value) => value ? new Date(value).toLocaleDateString('tr-TR') : this.__('schedules.columns.continuous')
                },
                {
                    key: 'status',
                    label: this.__('schedules.columns.status'),
                    type: 'status',
                    statusConfig: {
                        active: { label: this.__('schedules.status.active'), class: 'badge-success' },
                        scheduled: { label: this.__('schedules.status.scheduled'), class: 'badge-warning' },
                        inactive: { label: this.__('schedules.status.inactive'), class: 'badge-secondary' },
                        completed: { label: this.__('schedules.status.completed'), class: 'badge-info' }
                    }
                }
            ],
            actions: [
                {
                    name: 'history',
                    icon: 'ti-history',
                    label: this.__('schedules.actions.history'),
                    onClick: (row) => this.showHistory(row)
                },
                {
                    name: 'view',
                    icon: 'ti-eye',
                    label: this.__('schedules.actions.view'),
                    onClick: (row) => window.location.hash = `#/signage/schedules/${row.id}`
                },
                {
                    name: 'edit',
                    icon: 'ti-edit',
                    label: this.__('schedules.actions.edit'),
                    onClick: (row) => window.location.hash = `#/signage/schedules/${row.id}`
                },
                {
                    name: 'delete',
                    icon: 'ti-trash',
                    label: this.__('schedules.actions.delete'),
                    class: 'btn-ghost text-danger',
                    onClick: (row) => this.delete(row)
                }
            ],
            toolbar: {
                show: true,
                exports: true,
                filters: false
            },
            searchPlaceholder: this.__('schedules.searchPlaceholder'),
            emptyText: this.__('schedules.emptyText'),
            emptyIcon: 'ti-calendar-off'
        });
    }

    async fetchSchedules(params) {
        try {
            const queryParams = new URLSearchParams({
                page: params.page,
                per_page: params.limit
            });

            if (params.search) queryParams.append('search', params.search);
            if (params.sort_by) queryParams.append('sort_by', params.sort_by);
            if (params.sort_dir) queryParams.append('sort_dir', params.sort_dir);

            const response = await this.app.api.get(`/schedules?${queryParams}`);
            return {
                data: response.data || [],
                total: response.meta?.total || response.data?.length || 0
            };
        } catch (error) {
            Logger.error('Schedules fetch error:', error);
            return { data: [], total: 0 };
        }
    }

    bindEvents() {
        document.getElementById('new-schedule-btn')?.addEventListener('click', () => {
            window.location.hash = '#/signage/schedules/new';
        });
    }

    showHistory(schedule) {
        Toast.info(this.__('schedules.historyFeature'));
    }

    async delete(schedule) {
        Modal.confirm({
            title: this.__('schedules.deleteSchedule'),
            message: this.__('schedules.deleteConfirm', { name: schedule.name }),
            type: 'danger',
            confirmText: this.__('modal.delete'),
            cancelText: this.__('modal.cancel'),
            onConfirm: async () => {
                try {
                    await this.app.api.delete(`/schedules/${schedule.id}`);
                    Toast.success(this.__('schedules.toast.deleted'));
                    this.dataTable?.refresh();
                } catch (error) {
                    Toast.error(this.__('messages.deleteFailed') + ': ' + (error.message || ''));
                    throw error;
                }
            }
        });
    }

    destroy() {
        if (this.dataTable) {
            this.dataTable.destroy();
            this.dataTable = null;
        }
        this.app.i18n.clearPageTranslations();
    }
}

export default ScheduleListPage;
