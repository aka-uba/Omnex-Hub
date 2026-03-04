import { escapeHTML } from '../../core/SecurityUtils.js';
import PlaylistListExperienceBase from './PlaylistListExperienceBase.js';

export class PlaylistListCardsPage extends PlaylistListExperienceBase {
    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.text('breadcrumb.panel', 'Panel')}</a>
                    <span class="breadcrumb-separator">></span>
                    <span class="breadcrumb-current">Kart Hibrit Playlistler</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon orange">
                            <i class="ti ti-layout-grid"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">Kart Hibrit Playlistler</h1>
                            <p class="page-subtitle">Preview, saglik ve yayin aksiyonlarini satir yerine kart bazinda gosteren alternatif</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="cards-new-playlist-btn" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.text('playlists.addPlaylist', 'Yeni Playlist')}
                        </button>
                    </div>
                </div>
            </div>

            ${this.renderViewSwitcher('cards')}

            <div class="playlist-cards-toolbar">
                <div class="playlist-lab-filters">
                    <button class="btn btn-outline btn-sm playlist-filter-chip active" data-filter="all">Tum</button>
                    <button class="btn btn-outline btn-sm playlist-filter-chip" data-filter="live">Canliya Hazir</button>
                    <button class="btn btn-outline btn-sm playlist-filter-chip" data-filter="attention">Dikkat Gereken</button>
                    <button class="btn btn-outline btn-sm playlist-filter-chip" data-filter="rich">Zengin Icerik</button>
                </div>
                <div class="playlist-lab-search">
                    <i class="ti ti-search"></i>
                    <input type="text" id="cards-search-input" placeholder="Kartlarda ara">
                </div>
            </div>

            <div id="cards-metrics" class="playlist-lab-metrics"></div>
            <div id="playlist-card-grid" class="playlist-card-grid"></div>
        `;
    }

    async init() {
        window.playlistPage = this;
        this.addStyles();
        await this.loadTemplates();
        this.bindEvents();
        await this.loadPlaylists();
    }

    bindEvents() {
        document.getElementById('cards-new-playlist-btn')?.addEventListener('click', () => {
            window.location.hash = '#/signage/playlists/new';
        });

        document.getElementById('cards-search-input')?.addEventListener('input', (event) => {
            this.setSearchTerm(event.target.value);
        });

        document.querySelectorAll('.playlist-filter-chip').forEach((button) => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.playlist-filter-chip').forEach((chip) => chip.classList.remove('active'));
                button.classList.add('active');
                this.setQuickFilter(button.dataset.filter || 'all');
            });
        });

        document.addEventListener('click', this.handleDelegatedClick);
    }

    handleDelegatedClick = (event) => {
        const actionButton = event.target.closest('[data-card-action]');
        if (!actionButton) {
            return;
        }

        const playlistId = actionButton.dataset.playlistId;
        const action = actionButton.dataset.cardAction;
        const playlist = this.playlists.find((item) => item.id === playlistId);

        if (!playlist || !action) {
            return;
        }

        if (action === 'start' || action === 'stop' || action === 'refresh') {
            this.sendPlaylistCommand(playlist, action);
        } else if (action === 'edit') {
            this.edit(playlist.id);
        } else if (action === 'assign') {
            this.showAssignToDeviceModal(playlist);
        } else if (action === 'devices') {
            this.showAssignedDevicesModal(playlist.id);
        } else if (action === 'delete') {
            this.delete(playlist.id);
        }
    };

    refreshView() {
        const filtered = this.getFilteredPlaylists();
        this.renderMetrics(filtered);
        this.renderCards(filtered);
    }

    renderMetrics(filtered) {
        const stats = this.getDashboardStats(filtered);
        const container = document.getElementById('cards-metrics');
        if (!container) return;

        container.innerHTML = `
            <div class="playlist-metric-card">
                <span class="metric-label">Toplam</span>
                <strong>${stats.total}</strong>
                <small>Bu filtredeki playlistler</small>
            </div>
            <div class="playlist-metric-card success">
                <span class="metric-label">Canliya Hazir</span>
                <strong>${stats.liveReady}</strong>
                <small>Hemen yayinlanabilir</small>
            </div>
            <div class="playlist-metric-card warning">
                <span class="metric-label">Dikkat</span>
                <strong>${stats.needsAttention}</strong>
                <small>Operasyon takibi gerekir</small>
            </div>
        `;
    }

    renderCards(filtered) {
        const grid = document.getElementById('playlist-card-grid');
        if (!grid) return;

        if (!filtered.length) {
            grid.innerHTML = this.renderEmptyState('Gosterilecek kart bulunamadi');
            return;
        }

        grid.innerHTML = filtered.map((playlist) => {
            const summary = this.getPlaylistContentSummary(playlist);
            const state = this.getOperationalState(playlist);
            const flags = this.getHealthFlags(playlist);
            const assignedCount = parseInt(playlist.assigned_device_count, 10) || 0;

            return `
                <article class="playlist-overview-card">
                    <div class="playlist-card-preview">
                        ${this.renderPreviewFrame(playlist, 'playlist-preview-media')}
                        <div class="playlist-card-overlay">
                            <span class="ops-state-pill tone-${state.tone}">${state.label}</span>
                            <span class="playlist-card-updated">${this.formatDateTime(playlist.updated_at)}</span>
                        </div>
                    </div>
                    <div class="playlist-card-body">
                        <div class="playlist-card-title-row">
                            <div>
                                <h3>${escapeHTML(playlist.name || '')}</h3>
                                <p>${escapeHTML(playlist.description || 'Aciklama eklenmemis')}</p>
                            </div>
                            <button class="btn btn-ghost btn-sm" data-card-action="edit" data-playlist-id="${playlist.id}">
                                <i class="ti ti-edit"></i>
                            </button>
                        </div>

                        <div class="playlist-card-stats">
                            <div><strong>${summary.totalItems}</strong><span>Icerik</span></div>
                            <div><strong>${assignedCount}</strong><span>Ekran</span></div>
                            <div><strong>${escapeHTML(String(playlist.transition || 'none'))}</strong><span>Gecis</span></div>
                        </div>

                        <div class="playlist-card-badges">
                            <span class="badge badge-info">${escapeHTML(playlist.orientation || 'landscape')}</span>
                            <span class="badge badge-primary">${escapeHTML(playlist.layout_type || 'full')}</span>
                            ${playlist.template_name ? `<span class="badge badge-secondary">${escapeHTML(playlist.template_name)}</span>` : ''}
                        </div>

                        <div class="playlist-card-health">
                            ${flags.length ? flags.map((flag) => `<span class="ops-attention-tag">${escapeHTML(flag)}</span>`).join('') : '<span class="playlist-card-healthy">Sahaya cikmaya hazir</span>'}
                        </div>

                        <div class="playlist-card-actions">
                            <button class="btn btn-outline btn-sm" data-card-action="assign" data-playlist-id="${playlist.id}">
                                <i class="ti ti-device-tv"></i> Ata
                            </button>
                            ${assignedCount ? `
                                <button class="btn btn-outline btn-sm" data-card-action="devices" data-playlist-id="${playlist.id}">
                                    <i class="ti ti-devices"></i> Cihazlar
                                </button>
                                <button class="btn btn-outline btn-sm text-success" data-card-action="start" data-playlist-id="${playlist.id}">
                                    <i class="ti ti-player-play"></i> Baslat
                                </button>
                                <button class="btn btn-outline btn-sm text-info" data-card-action="refresh" data-playlist-id="${playlist.id}">
                                    <i class="ti ti-refresh"></i> Yenile
                                </button>
                            ` : ''}
                            <button class="btn btn-outline btn-sm text-danger" data-card-action="delete" data-playlist-id="${playlist.id}">
                                <i class="ti ti-trash"></i> Sil
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    }

    addStyles() {
        if (document.getElementById('playlist-list-cards-styles')) return;

        const style = document.createElement('style');
        style.id = 'playlist-list-cards-styles';
        style.textContent = `
            .playlist-lab-switcher,
            .playlist-lab-filters,
            .playlist-cards-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 0.75rem;
                align-items: center;
            }
            .playlist-cards-toolbar {
                justify-content: space-between;
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
                margin-bottom: 1rem;
            }
            .playlist-lab-link.active {
                background: rgba(59,130,246,0.12);
                border-color: rgba(59,130,246,0.28);
                color: var(--color-primary);
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
            .metric-label {
                font-size: 0.78rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--text-muted);
                font-weight: 700;
            }
            .playlist-card-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
                gap: 1.25rem;
            }
            .playlist-overview-card {
                display: flex;
                flex-direction: column;
                border: 1px solid var(--border-color);
                border-radius: 20px;
                overflow: hidden;
                background: var(--bg-primary);
                box-shadow: var(--shadow-sm);
            }
            .playlist-card-preview {
                position: relative;
                min-height: 190px;
                background: linear-gradient(135deg, #10223d, #1f4a7a);
            }
            .playlist-preview-media,
            .playlist-preview-fallback {
                width: 100%;
                height: 100%;
                object-fit: cover;
                min-height: 190px;
            }
            .playlist-preview-fallback {
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                gap: 0.35rem;
                padding: 1.25rem;
                color: #fff;
                background: linear-gradient(135deg, #0f172a, #1d4ed8);
            }
            .preview-kicker {
                font-size: 0.72rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                opacity: 0.82;
            }
            .playlist-card-overlay {
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: linear-gradient(180deg, transparent, rgba(15, 23, 42, 0.9));
            }
            .playlist-card-updated {
                color: rgba(255,255,255,0.88);
                font-size: 0.75rem;
            }
            .playlist-card-body {
                padding: 1rem;
                display: flex;
                flex-direction: column;
                gap: 0.95rem;
            }
            .playlist-card-title-row {
                display: flex;
                justify-content: space-between;
                gap: 1rem;
                align-items: flex-start;
            }
            .playlist-card-title-row h3 {
                margin: 0 0 0.25rem;
                font-size: 1rem;
            }
            .playlist-card-title-row p {
                margin: 0;
                color: var(--text-muted);
                font-size: 0.82rem;
                line-height: 1.45;
            }
            .playlist-card-stats {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 0.75rem;
                padding: 0.8rem;
                border-radius: 14px;
                background: var(--bg-secondary);
            }
            .playlist-card-stats div {
                display: flex;
                flex-direction: column;
                gap: 0.2rem;
            }
            .playlist-card-stats strong {
                font-size: 1rem;
            }
            .playlist-card-stats span {
                font-size: 0.72rem;
                color: var(--text-muted);
            }
            .playlist-card-badges,
            .playlist-card-health,
            .playlist-card-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            .playlist-card-healthy {
                font-size: 0.78rem;
                color: #15803d;
                font-weight: 600;
            }
            .ops-state-pill {
                padding: 0.2rem 0.55rem;
                border-radius: 999px;
                font-size: 0.7rem;
                font-weight: 700;
                color: #fff;
            }
            .ops-state-pill.tone-success { background: rgba(22,163,74,0.92); }
            .ops-state-pill.tone-warning { background: rgba(217,119,6,0.92); }
            .ops-state-pill.tone-info { background: rgba(37,99,235,0.92); }
            .ops-state-pill.tone-muted { background: rgba(71,85,105,0.92); }
            .ops-attention-tag {
                padding: 0.2rem 0.5rem;
                border-radius: 999px;
                background: rgba(245, 158, 11, 0.12);
                color: #b45309;
                font-size: 0.72rem;
                font-weight: 600;
            }
            .playlist-variant-empty {
                min-height: 220px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 0.45rem;
                text-align: center;
                color: var(--text-muted);
                border: 1px dashed var(--border-color);
                border-radius: 18px;
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

export default PlaylistListCardsPage;
