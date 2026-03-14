/**
 * System Status Page
 * Displays server metrics: CPU, RAM, Disk, Uptime, API stats
 *
 * @version 1.0.0
 */

export class SystemStatusPage {
    constructor(app) {
        this.app = app;
        this.refreshInterval = null;
        this.liveMetricsInterval = null;
        this.autoRefreshEnabled = true;
        this.refreshRate = 30000; // 30 seconds for full refresh
        this.liveRefreshRate = 3000; // 3 seconds for live metrics
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Preload translations before render
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('admin');
    }

    /**
     * Render page HTML
     */
    render() {
        return `
                <!-- Page Header -->
                <div class="page-header">
                    <div class="page-header-breadcrumb">
                        <a href="#/dashboard">${this.__('systemStatus.breadcrumb.panel')}</a>
                        <span class="breadcrumb-separator">›</span>
                        <a href="#/admin/users">${this.__('systemStatus.breadcrumb.admin')}</a>
                        <span class="breadcrumb-separator">›</span>
                        <span class="breadcrumb-current">${this.__('systemStatus.breadcrumb.current')}</span>
                    </div>
                    <div class="page-header-main">
                        <div class="page-header-left">
                            <div class="page-header-icon emerald">
                                <i class="ti ti-server-2"></i>
                            </div>
                            <div class="page-header-info">
                                <h1 class="page-title">${this.__('systemStatus.title')}</h1>
                                <p class="page-subtitle">${this.__('systemStatus.subtitle')}</p>
                            </div>
                        </div>
                        <div class="page-header-right">
                            <div class="auto-refresh-toggle">
                                <label class="toggle-switch">
                                    <input type="checkbox" id="auto-refresh-toggle" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                                <span class="toggle-label">${this.__('systemStatus.autoRefresh')}</span>
                            </div>
                            <button id="refresh-btn" class="btn btn-outline">
                                <i class="ti ti-refresh"></i>
                                ${this.__('systemStatus.refresh')}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Loading State -->
                <div id="loading-state" class="loading-container">
                    <div class="loading-spinner"></div>
                    <p>${this.__('messages.loading')}</p>
                </div>

                <!-- Content -->
                <div id="system-content" class="system-status-content" style="display: none;">
                    <!-- Last Update Info -->
                    <div class="last-update-bar">
                        <span class="last-update-text">
                            <i class="ti ti-clock"></i>
                            ${this.__('systemStatus.lastUpdate')}: <span id="last-update-time">-</span>
                        </span>
                    </div>

                    <!-- Quick Stats Row -->
                    <div class="stats-grid stats-grid-4">
                        <div class="stat-card" id="stat-uptime">
                            <div class="stat-icon cyan">
                                <i class="ti ti-clock-play"></i>
                            </div>
                            <div class="stat-info">
                                <span class="stat-label">${this.__('systemStatus.metrics.uptime')}</span>
                                <span class="stat-value" id="uptime-value">-</span>
                            </div>
                        </div>
                        <div class="stat-card" id="stat-cpu">
                            <div class="stat-icon blue">
                                <i class="ti ti-cpu"></i>
                            </div>
                            <div class="stat-info">
                                <span class="stat-label">${this.__('systemStatus.metrics.cpu')}</span>
                                <span class="stat-value" id="cpu-value">-</span>
                            </div>
                        </div>
                        <div class="stat-card" id="stat-memory">
                            <div class="stat-icon purple">
                                <i class="ti ti-database"></i>
                            </div>
                            <div class="stat-info">
                                <span class="stat-label">${this.__('systemStatus.metrics.memory')}</span>
                                <span class="stat-value" id="memory-value">-</span>
                            </div>
                        </div>
                        <div class="stat-card" id="stat-disk">
                            <div class="stat-icon orange">
                                <i class="ti ti-device-sd-card"></i>
                            </div>
                            <div class="stat-info">
                                <span class="stat-label">${this.__('systemStatus.metrics.disk')}</span>
                                <span class="stat-value" id="disk-value">-</span>
                            </div>
                        </div>
                    </div>

                    <!-- Main Content Grid -->
                    <div class="system-grid">
                        <!-- Server Information -->
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <i class="ti ti-server"></i>
                                    ${this.__('systemStatus.sections.server')}
                                </h3>
                            </div>
                            <div class="card-body">
                                <div class="info-list" id="server-info">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>
                        </div>

                        <!-- PHP Information -->
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <i class="ti ti-brand-php"></i>
                                    ${this.__('systemStatus.sections.php')}
                                </h3>
                            </div>
                            <div class="card-body">
                                <div class="info-list" id="php-info">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>
                        </div>

                        <!-- Database Information -->
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <i class="ti ti-database"></i>
                                    ${this.__('systemStatus.sections.database')}
                                </h3>
                            </div>
                            <div class="card-body">
                                <div class="info-list" id="database-info">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>
                        </div>

                        <!-- API Statistics & Live Metrics Combined -->
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <i class="ti ti-api"></i>
                                    ${this.__('systemStatus.sections.apiStats')}
                                </h3>
                                <span class="live-indicator">
                                    <span class="live-dot"></span>
                                    ${this.__('systemStatus.liveMetrics.live')}
                                </span>
                            </div>
                            <div class="card-body">
                                <!-- Summary Stats -->
                                <div class="api-stats-grid api-stats-grid-compact" id="api-stats">
                                    <!-- Populated dynamically -->
                                </div>

                                <!-- Live Metrics -->
                                <div class="live-metrics-section">
                                    <h4 class="section-subtitle">
                                        <i class="ti ti-activity"></i>
                                        ${this.__('systemStatus.sections.liveApiMetrics')}
                                    </h4>
                                    <div class="live-metrics-grid live-metrics-grid-compact" id="live-api-metrics">
                                        <!-- Populated dynamically -->
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Storage Breakdown -->
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <i class="ti ti-folder"></i>
                                    ${this.__('systemStatus.sections.storage')}
                                </h3>
                            </div>
                            <div class="card-body">
                                <div class="storage-breakdown" id="storage-breakdown">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>
                        </div>

                        <!-- PHP Extensions -->
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">
                                    <i class="ti ti-puzzle"></i>
                                    ${this.__('systemStatus.sections.extensions')}
                                </h3>
                            </div>
                            <div class="card-body">
                                <div class="extensions-grid" id="extensions-info">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Table Stats -->
                    <div class="card mt-4">
                        <div class="card-header">
                            <h3 class="card-title">
                                <i class="ti ti-table"></i>
                                ${this.__('systemStatus.sections.tableStats')}
                            </h3>
                        </div>
                        <div class="card-body">
                            <div class="table-stats-grid" id="table-stats">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                    </div>
                </div>
        `;
    }

    /**
     * Initialize page
     */
    async init() {
        this.bindEvents();
        await this.loadSystemStatus();
        this.startAutoRefresh();
        this.startLiveMetricsRefresh();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Refresh button
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            this.loadSystemStatus();
        });

        // Auto-refresh toggle
        document.getElementById('auto-refresh-toggle')?.addEventListener('change', (e) => {
            this.autoRefreshEnabled = e.target.checked;
            if (this.autoRefreshEnabled) {
                this.startAutoRefresh();
                this.startLiveMetricsRefresh();
            } else {
                this.stopAutoRefresh();
                this.stopLiveMetricsRefresh();
            }
        });
    }

    /**
     * Load system status from API
     */
    async loadSystemStatus() {
        try {
            const response = await this.app.api.get('/system/status');

            if (response.success) {
                this.renderSystemStatus(response.data);
                const loadingState = document.getElementById('loading-state');
                const systemContent = document.getElementById('system-content');
                const lastUpdateTime = document.getElementById('last-update-time');

                if (loadingState) loadingState.style.display = 'none';
                if (systemContent) systemContent.style.display = 'block';
                if (lastUpdateTime) lastUpdateTime.textContent = new Date().toLocaleTimeString('tr-TR');
            }
        } catch (error) {
            console.error('Failed to load system status:', error);
            if (this.app?.toast) {
                this.app.toast.error(this.__('systemStatus.toast.loadError'));
            }
        }
    }

    /**
     * Render system status data
     */
    renderSystemStatus(data) {
        // Quick stats
        this.renderQuickStats(data);

        // Server info
        this.renderServerInfo(data.server);

        // PHP info
        this.renderPhpInfo(data.php);

        // Database info
        this.renderDatabaseInfo(data.database);

        // API stats
        this.renderApiStats(data.api_stats);

        // Live API Metrics
        this.renderLiveApiMetrics(data.api_stats?.live);

        // Storage breakdown
        this.renderStorageBreakdown(data.storage_breakdown, data.disk);

        // Extensions
        this.renderExtensions(data.php?.extensions);

        // Table stats
        this.renderTableStats(data.database?.tables);
    }

    /**
     * Render quick stats cards
     */
    renderQuickStats(data) {
        // Store static values for live refresh
        this._staticCpuCores = data?.cpu?.cores || null;
        this._staticMemoryLimit = data?.memory?.limit_formatted || null;
        this._staticDiskTotal = data?.disk?.partition_total_formatted || null;

        // Uptime
        const uptimeEl = document.getElementById('uptime-value');
        if (uptimeEl) uptimeEl.textContent = data?.uptime?.formatted || 'N/A';

        // CPU - show percentage + cores
        const cpuEl = document.getElementById('cpu-value');
        if (cpuEl) {
            const cpuPercent = data?.cpu?.usage_percent !== null && data?.cpu?.usage_percent !== undefined
                ? `${data.cpu.usage_percent}%`
                : (data?.cpu?.load_average ? `${data.cpu.load_average['1min']}` : 'N/A');
            const cores = data?.cpu?.cores;
            cpuEl.innerHTML = cores
                ? `${cpuPercent} <span class="stat-detail">/ ${cores} ${this.__('systemStatus.metrics.cores')}</span>`
                : cpuPercent;
        }

        // Memory - show used / total
        const memoryEl = document.getElementById('memory-value');
        if (memoryEl) {
            const memCurrent = data?.memory?.current_formatted || '0 B';
            const memLimit = data?.memory?.limit_formatted || '?';
            memoryEl.innerHTML = `${memCurrent} <span class="stat-detail">/ ${memLimit}</span>`;
        }

        // Disk - show used / total partition
        const diskEl = document.getElementById('disk-value');
        if (diskEl) {
            const diskUsed = data?.disk?.app_used_formatted || '0 B';
            const diskTotal = data?.disk?.partition_total_formatted;
            diskEl.innerHTML = diskTotal && diskTotal !== 'N/A'
                ? `${diskUsed} <span class="stat-detail">/ ${diskTotal}</span>`
                : diskUsed;
        }

        // Update stat card colors based on values
        this.updateStatCardColor('stat-cpu', data?.cpu?.usage_percent || 0);
        this.updateStatCardColor('stat-memory', data?.memory?.usage_percent || 0);
        this.updateStatCardColor('stat-disk', data?.disk?.partition_usage_percent || 0);
    }

    /**
     * Update quick stat cards from lightweight live payload.
     * Keeps disk value unchanged to avoid expensive disk scans on each 3s poll.
     */
    renderQuickStatsFromLive(liveQuick) {
        if (!liveQuick) return;

        const uptimeEl = document.getElementById('uptime-value');
        if (uptimeEl && liveQuick?.uptime?.formatted) {
            uptimeEl.textContent = liveQuick.uptime.formatted;
        }

        // CPU - show percentage + cores (cores from live or cached)
        const cpuEl = document.getElementById('cpu-value');
        if (cpuEl) {
            const cpuPercent = liveQuick?.cpu?.usage_percent !== null && liveQuick?.cpu?.usage_percent !== undefined
                ? `${liveQuick.cpu.usage_percent}%`
                : (liveQuick?.cpu?.load_average ? `${liveQuick.cpu.load_average['1min']}` : null);
            if (cpuPercent !== null) {
                const cores = liveQuick?.cpu?.cores || this._staticCpuCores;
                cpuEl.innerHTML = cores
                    ? `${cpuPercent} <span class="stat-detail">/ ${cores} ${this.__('systemStatus.metrics.cores')}</span>`
                    : cpuPercent;
            }
        }

        // Memory - show used / total
        const memoryEl = document.getElementById('memory-value');
        if (memoryEl && liveQuick?.memory) {
            const memCurrent = liveQuick.memory.current_formatted || null;
            const memLimit = liveQuick.memory.limit_formatted || this._staticMemoryLimit;
            if (memCurrent && memLimit) {
                memoryEl.innerHTML = `${memCurrent} <span class="stat-detail">/ ${memLimit}</span>`;
            } else if (liveQuick.memory.usage_percent !== undefined) {
                memoryEl.textContent = `${liveQuick.memory.usage_percent || 0}%`;
            }
        }

        // Disk - update from live if available
        const diskEl = document.getElementById('disk-value');
        if (diskEl && liveQuick?.disk) {
            const diskTotal = liveQuick.disk.partition_total_formatted || this._staticDiskTotal;
            const diskFree = liveQuick.disk.partition_free_formatted;
            if (diskTotal && diskTotal !== 'N/A' && diskFree) {
                // Show partition used / total from live data
                const diskPercent = liveQuick.disk.partition_usage_percent || 0;
                diskEl.innerHTML = `${diskPercent}% <span class="stat-detail">/ ${diskTotal}</span>`;
            }
        }

        this.updateStatCardColor('stat-cpu', liveQuick?.cpu?.usage_percent || 0);
        this.updateStatCardColor('stat-memory', liveQuick?.memory?.usage_percent || 0);
    }

    /**
     * Update stat card color based on value
     */
    updateStatCardColor(cardId, value) {
        const card = document.getElementById(cardId);
        if (!card) return;

        card.classList.remove('warning', 'danger');
        if (value >= 90) {
            card.classList.add('danger');
        } else if (value >= 70) {
            card.classList.add('warning');
        }
    }

    /**
     * Render server information
     */
    renderServerInfo(server) {
        const container = document.getElementById('server-info');
        if (!container || !server) return;

        container.innerHTML = `
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.hostname')}</span>
                <span class="info-value">${server.hostname || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.serverSoftware')}</span>
                <span class="info-value">${server.server_software || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.serverIp')}</span>
                <span class="info-value">${server.server_ip || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.protocol')}</span>
                <span class="info-value">
                    <span class="badge ${server.protocol === 'HTTPS' ? 'badge-success' : 'badge-warning'}">
                        ${server.protocol || 'HTTP'}
                    </span>
                </span>
            </div>
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.serverTime')}</span>
                <span class="info-value">${server.server_time || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.timezone')}</span>
                <span class="info-value">${server.timezone || 'N/A'}</span>
            </div>
        `;
    }

    /**
     * Render PHP information
     */
    renderPhpInfo(php) {
        const container = document.getElementById('php-info');
        if (!container || !php) return;

        container.innerHTML = `
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.phpVersion')}</span>
                <span class="info-value">
                    <span class="badge badge-primary">${php.version || 'N/A'}</span>
                </span>
            </div>
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.sapi')}</span>
                <span class="info-value">${php.sapi || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.memoryLimit')}</span>
                <span class="info-value">${php.memory_limit || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.maxExecutionTime')}</span>
                <span class="info-value">${php.max_execution_time || 'N/A'}s</span>
            </div>
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.uploadMaxFilesize')}</span>
                <span class="info-value">${php.upload_max_filesize || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.postMaxSize')}</span>
                <span class="info-value">${php.post_max_size || 'N/A'}</span>
            </div>
        `;
    }

    /**
     * Render database information
     */
    renderDatabaseInfo(database) {
        const container = document.getElementById('database-info');
        if (!container || !database) return;

        container.innerHTML = `
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.dbType')}</span>
                <span class="info-value">
                    <span class="badge badge-info">${database.type || 'SQLite'}</span>
                </span>
            </div>
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.dbVersion')}</span>
                <span class="info-value">${database.version || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">${this.__('systemStatus.fields.dbSize')}</span>
                <span class="info-value">${database.size_formatted || 'N/A'}</span>
            </div>
        `;
    }

    /**
     * Render API statistics
     */
    renderApiStats(stats) {
        const container = document.getElementById('api-stats');
        if (!container || !stats) return;

        container.innerHTML = `
            <div class="api-stat-item">
                <div class="api-stat-value">${this.formatNumber(stats.today || 0)}</div>
                <div class="api-stat-label">${this.__('systemStatus.apiStats.today')}</div>
            </div>
            <div class="api-stat-item">
                <div class="api-stat-value">${this.formatNumber(stats.this_month || 0)}</div>
                <div class="api-stat-label">${this.__('systemStatus.apiStats.thisMonth')}</div>
            </div>
            <div class="api-stat-item">
                <div class="api-stat-value">${this.formatNumber(stats.total || 0)}</div>
                <div class="api-stat-label">${this.__('systemStatus.apiStats.total')}</div>
            </div>
        `;
    }

    /**
     * Render Live API Metrics
     */
    renderLiveApiMetrics(live) {
        const container = document.getElementById('live-api-metrics');
        if (!container) return;

        if (!live) {
            container.innerHTML = `<div class="text-muted">${this.__('messages.noData')}</div>`;
            return;
        }

        // Determine status colors based on values
        const responseTimeClass = live.response_time_ms < 100 ? 'success' : (live.response_time_ms < 500 ? 'warning' : 'danger');
        const errorRateClass = live.error_rate < 1 ? 'success' : (live.error_rate < 5 ? 'warning' : 'danger');

        // Check if values changed for animation
        const prevValues = this._prevLiveValues || {};
        const animate = (key, value) => {
            const changed = prevValues[key] !== value;
            return changed ? 'value-changed' : '';
        };

        container.innerHTML = `
            <div class="live-metric-card">
                <div class="live-metric-icon cyan">
                    <i class="ti ti-bolt"></i>
                </div>
                <div class="live-metric-info">
                    <div class="live-metric-value ${animate('rps', live.requests_per_second)}" data-metric="rps">${live.requests_per_second || 0}</div>
                    <div class="live-metric-label">${this.__('systemStatus.liveMetrics.requestsPerSecond')}</div>
                </div>
            </div>

            <div class="live-metric-card">
                <div class="live-metric-icon ${responseTimeClass}">
                    <i class="ti ti-clock"></i>
                </div>
                <div class="live-metric-info">
                    <div class="live-metric-value ${animate('rt', live.response_time_ms)}" data-metric="rt">${live.response_time_ms || 0}<span class="metric-unit">ms</span></div>
                    <div class="live-metric-label">${this.__('systemStatus.liveMetrics.responseTime')}</div>
                </div>
            </div>

            <div class="live-metric-card">
                <div class="live-metric-icon purple">
                    <i class="ti ti-users"></i>
                </div>
                <div class="live-metric-info">
                    <div class="live-metric-value ${animate('ac', live.active_connections)}" data-metric="ac">${live.active_connections || 0}</div>
                    <div class="live-metric-label">${this.__('systemStatus.liveMetrics.activeConnections')}</div>
                </div>
            </div>

            <div class="live-metric-card">
                <div class="live-metric-icon ${errorRateClass}">
                    <i class="ti ti-alert-triangle"></i>
                </div>
                <div class="live-metric-info">
                    <div class="live-metric-value ${animate('er', live.error_rate)}" data-metric="er">${live.error_rate || 0}<span class="metric-unit">%</span></div>
                    <div class="live-metric-label">${this.__('systemStatus.liveMetrics.errorRate')}</div>
                </div>
            </div>
        `;

        // Store current values for next comparison
        this._prevLiveValues = {
            rps: live.requests_per_second,
            rt: live.response_time_ms,
            ac: live.active_connections,
            er: live.error_rate
        };

        // Remove animation class after animation completes
        setTimeout(() => {
            container.querySelectorAll('.value-changed').forEach(el => {
                el.classList.remove('value-changed');
            });
        }, 500);
    }

    /**
     * Render storage breakdown
     */
    renderStorageBreakdown(breakdown, disk) {
        const container = document.getElementById('storage-breakdown');
        if (!container) return;

        // Application storage summary
        let html = `
            <div class="disk-usage-container">
                <div class="disk-usage-header">
                    <span>${this.__('systemStatus.storage.appStorage')}</span>
                    <span>${disk?.app_used_formatted || '0 B'}</span>
                </div>
                <div class="storage-summary">
                    <div class="storage-summary-item">
                        <i class="ti ti-folder text-primary"></i>
                        <span>Storage:</span>
                        <strong>${disk?.storage_used_formatted || '0 B'}</strong>
                    </div>
                    <div class="storage-summary-item">
                        <i class="ti ti-database text-info"></i>
                        <span>Database:</span>
                        <strong>${disk?.db_size_formatted || '0 B'}</strong>
                    </div>
                </div>
            </div>
        `;

        // Disk partition info (reference)
        if (disk?.partition_total) {
            html += `
                <div class="disk-usage-container mt-3">
                    <div class="disk-usage-header">
                        <span>${this.__('systemStatus.storage.diskPartition')}</span>
                        <span>${disk?.partition_used_formatted || '0 B'} / ${disk?.partition_total_formatted || '0 B'}</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar ${this.getProgressBarClass(disk?.partition_usage_percent || 0)}"
                             style="width: ${disk?.partition_usage_percent || 0}%"></div>
                    </div>
                    <div class="disk-usage-footer">
                        <span>${this.__('systemStatus.storage.free')}: ${disk?.partition_free_formatted || '0 B'}</span>
                        <span>${disk?.partition_usage_percent || 0}% ${this.__('systemStatus.storage.used')}</span>
                    </div>
                </div>
            `;
        }

        // Folder breakdown
        if (breakdown) {
            html += '<div class="storage-folders mt-3">';
            const folderIcons = {
                media: 'ti-photo',
                avatars: 'ti-user-circle',
                templates: 'ti-layout',
                exports: 'ti-file-export',
                logs: 'ti-file-text'
            };

            for (const [folder, data] of Object.entries(breakdown)) {
                const folderName = this.__(`systemStatus.storage.folders.${folder}`) || folder;
                html += `
                    <div class="storage-folder-item">
                        <i class="ti ${folderIcons[folder] || 'ti-folder'}"></i>
                        <span class="folder-name">${folderName}</span>
                        <span class="folder-size">${data.size_formatted}</span>
                    </div>
                `;
            }
            html += '</div>';
        }

        container.innerHTML = html;
    }

    /**
     * Render PHP extensions
     */
    renderExtensions(extensions) {
        const container = document.getElementById('extensions-info');
        if (!container || !extensions) return;

        let html = '';
        for (const [name, loaded] of Object.entries(extensions)) {
            html += `
                <div class="extension-item ${loaded ? 'enabled' : 'disabled'}">
                    <i class="ti ${loaded ? 'ti-check' : 'ti-x'}"></i>
                    <span>${name}</span>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    /**
     * Render table statistics
     */
    renderTableStats(tables) {
        const container = document.getElementById('table-stats');
        if (!container || !tables) return;

        const tableIcons = {
            users: 'ti-users',
            companies: 'ti-building',
            products: 'ti-package',
            devices: 'ti-device-desktop',
            templates: 'ti-layout',
            media: 'ti-photo',
            playlists: 'ti-playlist',
            notifications: 'ti-bell'
        };

        let html = '';
        for (const [table, count] of Object.entries(tables)) {
            const tableName = this.__(`systemStatus.tables.${table}`) || table;
            html += `
                <div class="table-stat-item">
                    <div class="table-stat-icon">
                        <i class="ti ${tableIcons[table] || 'ti-table'}"></i>
                    </div>
                    <div class="table-stat-info">
                        <span class="table-stat-name">${tableName}</span>
                        <span class="table-stat-count">${this.formatNumber(count)} ${this.__('systemStatus.records')}</span>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    /**
     * Get progress bar class based on percentage
     */
    getProgressBarClass(percent) {
        if (percent >= 90) return 'danger';
        if (percent >= 70) return 'warning';
        return 'success';
    }

    /**
     * Format number with thousands separator
     */
    formatNumber(num) {
        return new Intl.NumberFormat('tr-TR').format(num);
    }

    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            if (this.autoRefreshEnabled) {
                this.loadSystemStatus();
            }
        }, this.refreshRate);
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Start live metrics refresh (faster interval)
     */
    startLiveMetricsRefresh() {
        if (this.liveMetricsInterval) {
            clearInterval(this.liveMetricsInterval);
        }

        this.liveMetricsInterval = setInterval(() => {
            if (this.autoRefreshEnabled) {
                this.loadLiveMetrics();
            }
        }, this.liveRefreshRate);
    }

    /**
     * Stop live metrics refresh
     */
    stopLiveMetricsRefresh() {
        if (this.liveMetricsInterval) {
            clearInterval(this.liveMetricsInterval);
            this.liveMetricsInterval = null;
        }
    }

    /**
     * Load only live metrics (lighter API call)
     */
    async loadLiveMetrics() {
        try {
            const response = await this.app.api.get('/system/status?live_only=1');

            if (response.success && response.data?.api_stats?.live) {
                this.renderLiveApiMetrics(response.data.api_stats.live);
                this.renderQuickStatsFromLive(response.data?.quick_stats);
            }
        } catch (error) {
            // Silent fail for live metrics - don't interrupt user
            console.debug('Live metrics refresh failed:', error);
        }
    }

    /**
     * Cleanup on page destroy
     */
    destroy() {
        this.stopAutoRefresh();
        this.stopLiveMetricsRefresh();
        this.app.i18n.clearPageTranslations();
    }
}

export default SystemStatusPage;
