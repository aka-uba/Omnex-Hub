import { DataTable } from '../../components/DataTable.js';
import { escapeHTML } from '../../core/SecurityUtils.js';
import { SignageDeviceTree } from '../../components/SignageDeviceTree.js';
import PlaylistListExperienceBase from './PlaylistListExperienceBase.js';

export class PlaylistListOpsPage extends PlaylistListExperienceBase {
    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.text('breadcrumb.panel', 'Panel')}</a>
                    <span class="breadcrumb-separator">></span>
                    <span class="breadcrumb-current">Operasyon+ Playlistler</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon orange">
                            <i class="ti ti-broadcast"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">Operasyon+ Playlistler</h1>
                            <p class="page-subtitle">Mevcut yapıyı bozmadan daha iyi görünürlük, filtre ve yayın kontrolü</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="ops-new-playlist-btn" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.text('playlists.addPlaylist', 'Yeni Playlist')}
                        </button>
                    </div>
                </div>
            </div>

            ${this.renderViewSwitcher('ops')}

            <div id="ops-metrics" class="playlist-lab-metrics"></div>

            <div class="playlist-lab-toolbar">
                <div class="playlist-lab-filters">
                    <button class="btn btn-outline btn-sm playlist-filter-chip active" data-filter="all">Tüm</button>
                    <button class="btn btn-outline btn-sm playlist-filter-chip" data-filter="live">Canlıya Hazır</button>
                    <button class="btn btn-outline btn-sm playlist-filter-chip" data-filter="attention">Dikkat Gereken</button>
                    <button class="btn btn-outline btn-sm playlist-filter-chip" data-filter="unassigned">Atanmamış</button>
                    <button class="btn btn-outline btn-sm playlist-filter-chip" data-filter="draft">Taslak</button>
                </div>
                <div class="playlist-lab-search">
                    <i class="ti ti-search"></i>
                    <input type="text" id="ops-search-input" placeholder="Playlist ara">
                </div>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div class="xl:col-span-8">
                    <div class="card card-table">
                        <div class="card-header">
                            <div>
                                <h3 class="card-title">Yayın Kontrol Listesi</h3>
                                <p class="card-subtitle">Durum, sağlık ve cihaz etkisi tek tabloda</p>
                            </div>
                        </div>
                        <div class="card-body">
                            <div id="ops-table-container"></div>
                        </div>
                    </div>
                </div>
                <div class="xl:col-span-4">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Operasyon Özeti</h3>
                        </div>
                        <div class="card-body">
                            <div id="ops-attention-list"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mt-4">
                <div class="card-header">
                    <div class="card-header-left">
                        <h3 class="card-title">Cihaz Bağlam Ağacı</h3>
                        <p class="card-subtitle">Playlist atama ve saha topolojisini aynı ekranda tutar</p>
                    </div>
                    <div class="card-header-right">
                        <button id="ops-tree-expand-all" class="btn btn-outline btn-sm">
                            <i class="ti ti-arrows-maximize"></i> ${this.text('deviceTree.expandAll', 'Tümünü Aç')}
                        </button>
                        <button id="ops-tree-collapse-all" class="btn btn-outline btn-sm">
                            <i class="ti ti-arrows-minimize"></i> ${this.text('deviceTree.collapseAll', 'Tümünü Kapat')}
                        </button>
                    </div>
                </div>
                <div class="card-body" id="ops-device-tree-container"></div>
            </div>
        `;
    }

    async init() {
        window.playlistPage = this;
        this.addStyles();
        await this.loadTemplates();
        this.initDataTable();
        this.bindEvents();
        await this.loadPlaylists();

        this.deviceTree = new SignageDeviceTree(this.app, '#ops-device-tree-container');
        await this.deviceTree.init();
    }

    initDataTable() {
        this.dataTable = new DataTable({
            container: '#ops-table-container',
            columns: [
                {
                    key: 'name',
                    label: 'Playlist',
                    sortable: true,
                    render: (val, row) => {
                        const state = this.getOperationalState(row);
                        const summary = this.getPlaylistContentSummary(row);
                        return `
                            <div class="ops-row-main">
                                <div class="ops-row-title">
                                    <strong>${escapeHTML(val || '')}</strong>
                                    <span class="ops-state-pill tone-${state.tone}">${state.label}</span>
                                </div>
                                <div class="ops-row-meta">
                                    <span>${summary.totalItems} içerik</span>
                                    <span>${escapeHTML(row.layout_type || 'full')}</span>
                                    <span>${escapeHTML(row.orientation || 'landscape')}</span>
                                </div>
                            </div>
                        `;
                    }
                },
                {
                    key: 'transition',
                    label: 'Akış',
                    render: (val, row) => `
                        <div class="ops-flow-stack">
                            <span class="badge badge-info">${escapeHTML(String(val || 'none'))}</span>
                            <small>${parseInt(row.transition_duration, 10) || 500} ms</small>
                        </div>
                    `
                },
                {
                    key: 'assigned_device_count',
                    label: 'Yayın Etkisi',
                    sortable: true,
                    render: (val, row) => {
                        const assigned = parseInt(val, 10) || 0;
                        return `
                            <div class="ops-flow-stack">
                                <strong>${assigned}</strong>
                                <small>${assigned ? 'ekran bağlı' : 'ekran bekliyor'}</small>
                                ${assigned > 1 ? `
                                    <button class="btn btn-xs btn-ghost text-primary" data-ops-devices="${row.id}">Listele</button>
                                ` : ''}
                            </div>
                        `;
                    }
                },
                {
                    key: 'updated_at',
                    label: 'Son Dokunuş',
                    sortable: true,
                    render: (val) => `
                        <div class="ops-flow-stack">
                            <span>${this.formatDateTime(val)}</span>
                            <small>Kayıt zamanı</small>
                        </div>
                    `
                }
            ],
            actions: [
                {
                    name: 'play',
                    icon: 'ti-player-play',
                    label: 'Başlat',
                    class: 'btn-ghost text-success',
                    visible: (row) => (parseInt(row.assigned_device_count, 10) || 0) > 0,
                    onClick: (row) => this.sendPlaylistCommand(row, 'start')
                },
                {
                    name: 'stop',
                    icon: 'ti-player-stop',
                    label: 'Durdur',
                    class: 'btn-ghost text-danger',
                    visible: (row) => (parseInt(row.assigned_device_count, 10) || 0) > 0,
                    onClick: (row) => this.sendPlaylistCommand(row, 'stop')
                },
                {
                    name: 'refresh',
                    icon: 'ti-refresh',
                    label: 'Yenile',
                    class: 'btn-ghost text-info',
                    visible: (row) => (parseInt(row.assigned_device_count, 10) || 0) > 0,
                    onClick: (row) => this.sendPlaylistCommand(row, 'refresh')
                },
                {
                    name: 'assign',
                    icon: 'ti-device-tv',
                    label: 'Ata',
                    class: 'btn-ghost text-primary',
                    onClick: (row) => this.showAssignToDeviceModal(row)
                },
                {
                    name: 'edit',
                    icon: 'ti-edit',
                    label: 'Düzenle',
                    onClick: (row) => this.edit(row.id)
                }
            ],
            pagination: true,
            pageSize: 15,
            searchable: false,
            emptyText: 'Playlist bulunamadı'
        });
    }

    bindEvents() {
        document.getElementById('ops-new-playlist-btn')?.addEventListener('click', () => {
            window.location.hash = '#/signage/playlists/new';
        });

        document.getElementById('ops-search-input')?.addEventListener('input', (event) => {
            this.setSearchTerm(event.target.value);
        });

        document.querySelectorAll('.playlist-filter-chip').forEach((button) => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.playlist-filter-chip').forEach((chip) => chip.classList.remove('active'));
                button.classList.add('active');
                this.setQuickFilter(button.dataset.filter || 'all');
            });
        });

        document.getElementById('ops-tree-expand-all')?.addEventListener('click', () => {
            this.deviceTree?.expandAll?.();
        });

        document.getElementById('ops-tree-collapse-all')?.addEventListener('click', () => {
            this.deviceTree?.collapseAll?.();
        });

        document.addEventListener('click', this.handleDelegatedClick);
    }

    handleDelegatedClick = (event) => {
        const devicesButton = event.target.closest('[data-ops-devices]');
        if (devicesButton) {
            this.showAssignedDevicesModal(devicesButton.dataset.opsDevices);
        }
    };

    refreshView() {
        const filtered = this.getFilteredPlaylists();
        this.dataTable?.setData(filtered, { preservePage: true });
        this.renderMetrics(filtered);
        this.renderAttentionRail(filtered);
    }

    renderMetrics(filtered) {
        const stats = this.getDashboardStats(filtered);
        const container = document.getElementById('ops-metrics');
        if (!container) return;

        container.innerHTML = `
            <div class="playlist-metric-card">
                <span class="metric-label">Toplam Playlist</span>
                <strong>${stats.total}</strong>
                <small>Yönetilen tüm akışları kapsar</small>
            </div>
            <div class="playlist-metric-card success">
                <span class="metric-label">Canlıya Hazır</span>
                <strong>${stats.liveReady}</strong>
                <small>İçerik + cihaz ataması tamam</small>
            </div>
            <div class="playlist-metric-card warning">
                <span class="metric-label">Dikkat Gereken</span>
                <strong>${stats.needsAttention}</strong>
                <small>Eksik içerik, cihaz veya durum</small>
            </div>
            <div class="playlist-metric-card info">
                <span class="metric-label">Bağlı Ekran</span>
                <strong>${stats.assignedScreens}</strong>
                <small>Bu görünümde etkilenen ekran</small>
            </div>
        `;
    }

    renderAttentionRail(filtered) {
        const container = document.getElementById('ops-attention-list');
        if (!container) return;

        const attention = filtered
            .map((playlist) => ({ playlist, flags: this.getHealthFlags(playlist) }))
            .filter((item) => item.flags.length)
            .slice(0, 6);

        if (!attention.length) {
            container.innerHTML = this.renderEmptyState('Bu görünümde kritik aksiyon yok');
            return;
        }

        container.innerHTML = attention.map(({ playlist, flags }) => `
            <div class="ops-attention-item">
                <div class="ops-attention-head">
                    <strong>${escapeHTML(playlist.name || '')}</strong>
                    <button class="btn btn-xs btn-outline" data-ops-open="${playlist.id}">Ac</button>
                </div>
                <div class="ops-attention-tags">
                    ${flags.map((flag) => `<span class="ops-attention-tag">${escapeHTML(flag)}</span>`).join('')}
                </div>
            </div>
        `).join('');

        container.querySelectorAll('[data-ops-open]').forEach((button) => {
            button.addEventListener('click', () => this.edit(button.dataset.opsOpen));
        });
    }

    addStyles() {
        if (document.getElementById('playlist-list-ops-styles')) return;

        const style = document.createElement('style');
        style.id = 'playlist-list-ops-styles';
        style.textContent = `
            .playlist-lab-switcher {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                margin-bottom: 1rem;
            }
            .playlist-lab-link {
                display: inline-flex;
                align-items: center;
                padding: 0.55rem 0.9rem;
                border-radius: 999px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                color: var(--text-secondary);
                text-decoration: none;
                font-size: 0.85rem;
                font-weight: 600;
            }
            .playlist-lab-link.active {
                background: rgba(249, 115, 22, 0.12);
                border-color: rgba(249, 115, 22, 0.3);
                color: var(--color-warning);
            }
            .playlist-lab-metrics {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 1rem;
                margin-bottom: 1rem;
            }
            .playlist-metric-card {
                padding: 1rem;
                border-radius: 16px;
                border: 1px solid var(--border-color);
                background: linear-gradient(180deg, var(--bg-primary), var(--bg-secondary));
                display: flex;
                flex-direction: column;
                gap: 0.35rem;
            }
            .playlist-metric-card strong {
                font-size: 1.8rem;
                line-height: 1;
            }
            .playlist-metric-card.success strong { color: var(--color-success); }
            .playlist-metric-card.warning strong { color: var(--color-warning); }
            .playlist-metric-card.info strong { color: var(--color-primary); }
            .metric-label {
                font-size: 0.78rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--text-muted);
                font-weight: 700;
            }
            .playlist-lab-toolbar {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                margin-bottom: 1rem;
            }
            .playlist-lab-filters {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            .playlist-filter-chip.active {
                background: var(--color-primary);
                border-color: var(--color-primary);
                color: #fff;
            }
            .playlist-lab-search {
                min-width: 260px;
                position: relative;
            }
            .playlist-lab-search i {
                position: absolute;
                top: 50%;
                left: 0.85rem;
                transform: translateY(-50%);
                color: var(--text-muted);
            }
            .playlist-lab-search input {
                width: 100%;
                padding: 0.75rem 0.9rem 0.75rem 2.4rem;
                border-radius: 12px;
                border: 1px solid var(--border-color);
                background: var(--bg-primary);
            }
            .ops-row-main {
                display: flex;
                flex-direction: column;
                gap: 0.35rem;
            }
            .ops-row-title {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                flex-wrap: wrap;
            }
            .ops-state-pill {
                padding: 0.2rem 0.55rem;
                border-radius: 999px;
                font-size: 0.7rem;
                font-weight: 700;
            }
            .ops-state-pill.tone-success { background: rgba(34,197,94,0.14); color: #15803d; }
            .ops-state-pill.tone-warning { background: rgba(245,158,11,0.14); color: #b45309; }
            .ops-state-pill.tone-info { background: rgba(59,130,246,0.14); color: #1d4ed8; }
            .ops-state-pill.tone-muted { background: rgba(148,163,184,0.14); color: #475569; }
            .ops-row-meta,
            .ops-flow-stack {
                display: flex;
                flex-direction: column;
                gap: 0.2rem;
                color: var(--text-muted);
                font-size: 0.78rem;
            }
            .ops-attention-item {
                padding: 0.9rem;
                border: 1px solid var(--border-color);
                border-radius: 14px;
                background: var(--bg-secondary);
                margin-bottom: 0.75rem;
            }
            .ops-attention-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.75rem;
                margin-bottom: 0.6rem;
            }
            .ops-attention-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 0.4rem;
            }
            .ops-attention-tag {
                padding: 0.2rem 0.5rem;
                border-radius: 999px;
                background: rgba(245, 158, 11, 0.12);
                color: #b45309;
                font-size: 0.72rem;
                font-weight: 600;
            }
            .playlist-variant-empty {
                min-height: 180px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 0.4rem;
                text-align: center;
                color: var(--text-muted);
            }
            .playlist-variant-empty i {
                font-size: 2rem;
            }
        `;

        document.head.appendChild(style);
    }

    destroy() {
        document.removeEventListener('click', this.handleDelegatedClick);
        super.destroy();
    }
}

export default PlaylistListOpsPage;
