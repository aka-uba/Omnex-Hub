/**
 * Schedule Form Page Component
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';

export class ScheduleFormPage {
    constructor(app) {
        this.app = app;
        this.schedule = null;
        this.playlists = [];
        this.devices = [];
        this.selectedDevices = [];
        this.isNew = false;
    }

    /**
     * i18n helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('signage');
    }

    render() {
        const id = this.app.router.params?.id;
        this.isNew = !id || id === 'new';

        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <a href="#/signage/schedules">${this.__('schedules.title')}</a>
                    <span class="breadcrumb-separator">›</span>
                    <span class="breadcrumb-current">${this.isNew ? this.__('schedules.newSchedule') : this.__('actions.edit')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon orange">
                            <i class="ti ti-${this.isNew ? 'plus' : 'edit'}"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.isNew ? this.__('schedules.newSchedule') : this.__('schedules.editSchedule')}</h1>
                            <p class="page-subtitle">${this.isNew ? this.__('schedules.createDesc') : this.__('schedules.editDesc')}</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="btn-cancel" class="btn btn-outline">
                            <i class="ti ti-x"></i>
                            <span>${this.__('actions.cancel')}</span>
                        </button>
                        <button id="btn-save" class="btn btn-primary">
                            <i class="ti ti-check"></i>
                            <span>${this.__('actions.save')}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Schedule Info -->
                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">${this.__('schedules.scheduleInfo')}</h3>
                        </div>
                        <div class="card-body">
                            <form id="schedule-form" class="space-y-4">
                                <div class="form-group">
                                    <label class="form-label form-label-required">${this.__('schedules.form.fields.name')}</label>
                                    <input type="text" id="schedule-name" class="form-input"
                                        placeholder="${this.__('schedules.form.placeholders.name')}" required>
                                </div>

                                <div class="form-group">
                                    <label class="form-label form-label-required">${this.__('schedules.form.fields.playlist')}</label>
                                    <select id="schedule-playlist" class="form-select" required>
                                        <option value="">${this.__('schedules.form.placeholders.selectPlaylist')}</option>
                                    </select>
                                </div>

                                <div class="grid grid-cols-2 gap-4">
                                    <div class="form-group">
                                        <label class="form-label form-label-required">${this.__('schedules.form.fields.startDate')}</label>
                                        <input type="date" id="schedule-start-date" class="form-input" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('schedules.form.fields.startTime')}</label>
                                        <input type="time" id="schedule-start-time" class="form-input" value="00:00">
                                    </div>
                                </div>

                                <div class="grid grid-cols-2 gap-4">
                                    <div class="form-group">
                                        <label class="form-label">${this.__('schedules.form.fields.endDate')}</label>
                                        <input type="date" id="schedule-end-date" class="form-input">
                                        <p class="form-hint">${this.__('schedules.form.hints.endDate')}</p>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">${this.__('schedules.form.fields.endTime')}</label>
                                        <input type="time" id="schedule-end-time" class="form-input" value="23:59">
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">${this.__('schedules.form.fields.repeat')}</label>
                                    <select id="schedule-repeat" class="form-select">
                                        <option value="none">${this.__('schedules.form.repeat.none')}</option>
                                        <option value="daily">${this.__('schedules.form.repeat.daily')}</option>
                                        <option value="weekly">${this.__('schedules.form.repeat.weekly')}</option>
                                        <option value="monthly">${this.__('schedules.form.repeat.monthly')}</option>
                                    </select>
                                </div>

                                <div class="form-group" id="weekdays-group" style="display:none;">
                                    <label class="form-label">${this.__('schedules.form.fields.weekdays')}</label>
                                    <div class="weekday-selector">
                                        <label class="weekday-item">
                                            <input type="checkbox" name="weekday" value="1"> ${this.__('schedules.form.weekdays.mon')}
                                        </label>
                                        <label class="weekday-item">
                                            <input type="checkbox" name="weekday" value="2"> ${this.__('schedules.form.weekdays.tue')}
                                        </label>
                                        <label class="weekday-item">
                                            <input type="checkbox" name="weekday" value="3"> ${this.__('schedules.form.weekdays.wed')}
                                        </label>
                                        <label class="weekday-item">
                                            <input type="checkbox" name="weekday" value="4"> ${this.__('schedules.form.weekdays.thu')}
                                        </label>
                                        <label class="weekday-item">
                                            <input type="checkbox" name="weekday" value="5"> ${this.__('schedules.form.weekdays.fri')}
                                        </label>
                                        <label class="weekday-item">
                                            <input type="checkbox" name="weekday" value="6"> ${this.__('schedules.form.weekdays.sat')}
                                        </label>
                                        <label class="weekday-item">
                                            <input type="checkbox" name="weekday" value="0"> ${this.__('schedules.form.weekdays.sun')}
                                        </label>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">${this.__('schedules.form.fields.status')}</label>
                                    <select id="schedule-status" class="form-select">
                                        <option value="active">${this.__('schedules.form.status.active')}</option>
                                        <option value="scheduled">${this.__('schedules.form.status.scheduled')}</option>
                                        <option value="inactive">${this.__('schedules.form.status.inactive')}</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">${this.__('schedules.form.fields.priority')}</label>
                                    <input type="number" id="schedule-priority" class="form-input"
                                        value="0" min="0" max="100">
                                    <p class="form-hint">${this.__('schedules.form.hints.priority')}</p>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- Device Selection -->
                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">${this.__('schedules.targetDevices')}</h3>
                            <span class="badge badge-primary" id="selected-count">${this.__('schedules.selectedCount', { count: 0 })}</span>
                        </div>
                        <div class="card-body">
                            <div class="mb-4">
                                <input type="text" id="device-search" class="form-input"
                                    placeholder="${this.__('schedules.searchDevice')}">
                            </div>
                            <div id="devices-container" class="device-selection-list">
                                ${this.renderLoading()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderLoading() {
        return `
            <div class="flex items-center justify-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        `;
    }

    renderDevices(filter = '') {
        let filteredDevices = this.devices.filter(d => d.type === 'tv');

        if (filter) {
            const search = filter.toLowerCase();
            filteredDevices = filteredDevices.filter(d =>
                d.name.toLowerCase().includes(search) ||
                d.location?.toLowerCase().includes(search)
            );
        }

        if (!filteredDevices.length) {
            return `
                <div class="text-center py-8 text-gray-500">
                    <i class="ti ti-device-tv text-4xl mb-2"></i>
                    <p>${filter ? this.__('schedules.noMatch') : this.__('schedules.noTvDevices')}</p>
                </div>
            `;
        }

        return filteredDevices.map(device => `
            <label class="device-select-item ${this.selectedDevices.includes(device.id) ? 'selected' : ''}">
                <input type="checkbox" value="${device.id}"
                    ${this.selectedDevices.includes(device.id) ? 'checked' : ''}
                    onchange="window.scheduleFormPage?.toggleDevice('${device.id}')">
                <div class="device-select-info">
                    <span class="status-dot ${device.status === 'online' ? 'status-online' : 'status-offline'}"></span>
                    <div>
                        <h4>${device.name}</h4>
                        <p>${device.location || this.__('schedules.locationNotSpecified')}</p>
                    </div>
                </div>
                <i class="ti ti-check device-select-check"></i>
            </label>
        `).join('');
    }

    async init() {
        window.scheduleFormPage = this;

        await Promise.all([
            this.loadPlaylists(),
            this.loadDevices()
        ]);

        const id = this.app.router.params?.id;
        if (id && id !== 'new') {
            await this.loadSchedule(id);
        }

        document.getElementById('devices-container').innerHTML = this.renderDevices();
        this.bindEvents();
        this.addStyles();
    }

    async loadSchedule(id) {
        try {
            const response = await this.app.api.get(`/schedules/${id}`);
            this.schedule = response.data;
            this.selectedDevices = this.schedule.device_ids || [];

            // Fill form
            document.getElementById('schedule-name').value = this.schedule.name || '';
            document.getElementById('schedule-playlist').value = this.schedule.playlist_id || '';
            document.getElementById('schedule-start-date').value = this.schedule.start_date?.split('T')[0] || '';
            document.getElementById('schedule-start-time').value = this.schedule.start_time || '00:00';
            document.getElementById('schedule-end-date').value = this.schedule.end_date?.split('T')[0] || '';
            document.getElementById('schedule-end-time').value = this.schedule.end_time || '23:59';
            document.getElementById('schedule-repeat').value = this.schedule.repeat_type || 'none';
            document.getElementById('schedule-status').value = this.schedule.status || 'active';
            document.getElementById('schedule-priority').value = this.schedule.priority || 0;

            // Set weekdays if weekly
            if (this.schedule.repeat_type === 'weekly' && this.schedule.weekdays) {
                document.getElementById('weekdays-group').style.display = 'block';
                this.schedule.weekdays.forEach(day => {
                    const checkbox = document.querySelector(`input[name="weekday"][value="${day}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }

            this.updateSelectedCount();
        } catch (error) {
            Logger.error('Schedule load error:', error);
            Toast.error(this.__('schedules.toast.loadFailed') + ': ' + (error.message || ''));
        }
    }

    async loadPlaylists() {
        try {
            const response = await this.app.api.get('/playlists');
            this.playlists = response.data || [];

            const select = document.getElementById('schedule-playlist');
            this.playlists.forEach(p => {
                const option = document.createElement('option');
                option.value = p.id;
                option.textContent = p.name;
                select.appendChild(option);
            });
        } catch (error) {
            Logger.error('Playlists load error:', error);
        }
    }

    async loadDevices() {
        try {
            const response = await this.app.api.get('/devices');
            this.devices = response.data || [];
        } catch (error) {
            Logger.error('Devices load error:', error);
        }
    }

    bindEvents() {
        document.getElementById('btn-cancel')?.addEventListener('click', () => {
            window.location.hash = '#/signage/schedules';
        });

        document.getElementById('btn-save')?.addEventListener('click', () => {
            this.save();
        });

        document.getElementById('device-search')?.addEventListener('input', (e) => {
            document.getElementById('devices-container').innerHTML = this.renderDevices(e.target.value);
        });

        document.getElementById('schedule-repeat')?.addEventListener('change', (e) => {
            document.getElementById('weekdays-group').style.display =
                e.target.value === 'weekly' ? 'block' : 'none';
        });

        // Clear error highlight on input
        document.querySelectorAll('#schedule-form .form-input, #schedule-form .form-select').forEach(el => {
            el.addEventListener('input', () => el.classList.remove('error'));
            el.addEventListener('change', () => el.classList.remove('error'));
        });
    }

    toggleDevice(deviceId) {
        const index = this.selectedDevices.indexOf(deviceId);
        if (index > -1) {
            this.selectedDevices.splice(index, 1);
        } else {
            this.selectedDevices.push(deviceId);
        }
        this.updateSelectedCount();

        // Update visual state
        const item = document.querySelector(`.device-select-item input[value="${deviceId}"]`)?.closest('.device-select-item');
        if (item) {
            item.classList.toggle('selected', this.selectedDevices.includes(deviceId));
        }
    }

    updateSelectedCount() {
        document.getElementById('selected-count').textContent = this.__('schedules.selectedCount', { count: this.selectedDevices.length });
    }

    async save() {
        const name = document.getElementById('schedule-name')?.value.trim();
        const playlistId = document.getElementById('schedule-playlist')?.value;
        const startDate = document.getElementById('schedule-start-date')?.value;
        const startTime = document.getElementById('schedule-start-time')?.value;
        const endDate = document.getElementById('schedule-end-date')?.value;
        const endTime = document.getElementById('schedule-end-time')?.value;
        const repeatType = document.getElementById('schedule-repeat')?.value;
        const status = document.getElementById('schedule-status')?.value;
        const priority = parseInt(document.getElementById('schedule-priority')?.value) || 0;

        // Clear previous error highlights
        document.querySelectorAll('#schedule-form .error').forEach(el => el.classList.remove('error'));

        // Field-specific validation
        const missing = [];
        if (!name) {
            missing.push(this.__('schedules.form.fields.name'));
            document.getElementById('schedule-name')?.classList.add('error');
        }
        if (!playlistId) {
            missing.push(this.__('schedules.form.fields.playlist'));
            document.getElementById('schedule-playlist')?.classList.add('error');
        }
        if (!startDate) {
            missing.push(this.__('schedules.form.fields.startDate'));
            document.getElementById('schedule-start-date')?.classList.add('error');
        }
        if (missing.length > 0) {
            Toast.error(this.__('validation.requiredField', { field: missing.join(', ') }));
            return;
        }

        if (!this.selectedDevices.length) {
            Toast.error(this.__('schedules.toast.selectDevice'));
            return;
        }

        // Get selected weekdays if weekly
        let weekdays = [];
        if (repeatType === 'weekly') {
            weekdays = Array.from(document.querySelectorAll('input[name="weekday"]:checked'))
                .map(cb => parseInt(cb.value));
        }

        const data = {
            name,
            playlist_id: playlistId,
            start_date: startDate,
            start_time: startTime,
            end_date: endDate || null,
            end_time: endTime,
            repeat_type: repeatType,
            weekdays: weekdays.length ? weekdays : null,
            status,
            priority,
            device_ids: this.selectedDevices
        };

        try {
            if (this.schedule?.id) {
                await this.app.api.put(`/schedules/${this.schedule.id}`, data);
                Toast.success(this.__('schedules.toast.updated'));
            } else {
                await this.app.api.post('/schedules', data);
                Toast.success(this.__('schedules.toast.created'));
            }
            window.location.hash = '#/signage/schedules';
        } catch (error) {
            Logger.error('Save error:', error);
            Toast.error(this.__('schedules.toast.saveFailed') + ': ' + (error.message || ''));
        }
    }

    addStyles() {
        if (document.getElementById('schedule-form-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'schedule-form-styles';
        styles.textContent = `
            .breadcrumb {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.875rem;
                color: var(--text-muted);
                margin-bottom: 8px;
            }

            .breadcrumb a {
                color: var(--text-secondary);
                text-decoration: none;
            }

            .breadcrumb a:hover {
                color: var(--color-primary);
            }

            .weekday-selector {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .weekday-item {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 8px 12px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
                cursor: pointer;
                font-size: 0.875rem;
            }

            .weekday-item:has(input:checked) {
                background: rgba(34, 139, 230, 0.1);
                border-color: var(--color-primary);
            }

            .weekday-item input {
                margin: 0;
            }

            .device-selection-list {
                max-height: 400px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .device-select-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
                cursor: pointer;
                transition: all 0.2s;
            }

            .device-select-item:hover {
                border-color: var(--color-primary);
            }

            .device-select-item.selected {
                background: rgba(34, 139, 230, 0.1);
                border-color: var(--color-primary);
            }

            .device-select-item input {
                display: none;
            }

            .device-select-info {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .device-select-info h4 {
                font-size: 0.875rem;
                font-weight: 500;
                margin: 0;
            }

            .device-select-info p {
                font-size: 0.75rem;
                color: var(--text-muted);
                margin: 0;
            }

            .device-select-check {
                color: var(--color-primary);
                opacity: 0;
                transition: opacity 0.2s;
            }

            .device-select-item.selected .device-select-check {
                opacity: 1;
            }

            .form-hint {
                font-size: 0.75rem;
                color: var(--text-muted);
                margin-top: 4px;
            }
        `;
        document.head.appendChild(styles);
    }

    destroy() {
        window.scheduleFormPage = null;
        this.app.i18n.clearPageTranslations();
    }
}

export default ScheduleFormPage;
