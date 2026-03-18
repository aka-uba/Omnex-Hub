import { escapeHTML } from '../../core/SecurityUtils.js';
import PlaylistListExperienceBase from './PlaylistListExperienceBase.js';

export class PlaylistListStudioPage extends PlaylistListExperienceBase {
    render() {
        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.text('breadcrumb.panel', 'Panel')}</a>
                    <span class="breadcrumb-separator">></span>
                    <span class="breadcrumb-current">Studio Split Playlistler</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon orange">
                            <i class="ti ti-device-desktop-analytics"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">Studio Split Playlistler</h1>
                            <p class="page-subtitle">Sol listede seçim, sağ panelde preview, yayın durumu ve saha etkisi</p>
                        </div>
                    </div>
                    <div class="page-header-right">
                        <button id="studio-new-playlist-btn" class="btn btn-primary">
                            <i class="ti ti-plus"></i>
                            ${this.text('playlists.addPlaylist', 'Yeni Playlist')}
                        </button>
                    </div>
                </div>
            </div>

            ${this.renderViewSwitcher('studio')}

            <div class="studio-shell">
                <aside class="studio-sidebar">
                    <div class="studio-sidebar-head">
                        <div class="playlist-lab-search">
                            <i class="ti ti-search"></i>
                            <input type="text" id="studio-search-input" placeholder="Playlist ara">
                        </div>
                        <div class="playlist-lab-filters">
                            <button class="btn btn-outline btn-sm playlist-filter-chip active" data-filter="all">Tüm</button>
                            <button class="btn btn-outline btn-sm playlist-filter-chip" data-filter="live">Canlı</button>
                            <button class="btn btn-outline btn-sm playlist-filter-chip" data-filter="attention">Riskli</button>
                        </div>
                    </div>
                    <div id="studio-list" class="studio-list"></div>
                </aside>

                <section class="studio-detail">
                    <div id="studio-detail-panel"></div>
                </section>
            </div>
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
        document.getElementById('studio-new-playlist-btn')?.addEventListener('click', () => {
            window.location.hash = '#/signage/playlists/new';
        });

        document.getElementById('studio-search-input')?.addEventListener('input', (event) => {
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
        const listItem = event.target.closest('[data-studio-select]');
        if (listItem) {
            this.selectPlaylist(listItem.dataset.studioSelect);
            return;
        }

        const actionButton = event.target.closest('[data-studio-action]');
        if (!actionButton) {
            return;
        }

        const playlistId = actionButton.dataset.playlistId;
        const action = actionButton.dataset.studioAction;
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
        const selected = this.ensureSelectedPlaylist(filtered);
        this.renderList(filtered);
        this.renderDetail(selected);
    }

    renderList(filtered) {
        const container = document.getElementById('studio-list');
        if (!container) return;

        if (!filtered.length) {
            container.innerHTML = this.renderEmptyState('Seçilebilir playlist yok');
            return;
        }

        container.innerHTML = filtered.map((playlist) => {
            const state = this.getOperationalState(playlist);
            const summary = this.getPlaylistContentSummary(playlist);
            const selected = playlist.id === this.selectedPlaylistId;
            const assigned = parseInt(playlist.assigned_device_count, 10) || 0;

            return `
                <button type="button" class="studio-list-item ${selected ? 'active' : ''}" data-studio-select="${playlist.id}">
                    <div class="studio-list-item-top">
                        <strong>${escapeHTML(playlist.name || '')}</strong>
                        <span class="ops-state-pill tone-${state.tone}">${state.label}</span>
                    </div>
                    <div class="studio-list-item-meta">
                        <span>${summary.totalItems} içerik</span>
                        <span>${assigned} ekran</span>
                        <span>${escapeHTML(String(playlist.transition || 'none'))}</span>
                    </div>
                </button>
            `;
        }).join('');
    }

    renderDetail(playlist) {
        const panel = document.getElementById('studio-detail-panel');
        if (!panel) return;

        if (!playlist) {
            panel.innerHTML = this.renderEmptyState('Detay gösterilecek playlist yok');
            return;
        }

        const summary = this.getPlaylistContentSummary(playlist);
        const state = this.getOperationalState(playlist);
        const flags = this.getHealthFlags(playlist);
        const assigned = parseInt(playlist.assigned_device_count, 10) || 0;
        const itemsPreview = summary.items.slice(0, 5);

        panel.innerHTML = `
            <div class="studio-hero">
                <div class="studio-hero-preview">
                    ${this.renderPreviewFrame(playlist, 'studio-preview-media')}
                </div>
                <div class="studio-hero-copy">
                    <div class="studio-hero-head">
                        <span class="ops-state-pill tone-${state.tone}">${state.label}</span>
                        <span class="studio-hero-date">Son güncelleme: ${this.formatDateTime(playlist.updated_at)}</span>
                    </div>
                    <h2>${escapeHTML(playlist.name || '')}</h2>
                    <p>${escapeHTML(playlist.description || 'Bu playlist için açıklama eklenmemiş.')}</p>
                    <div class="studio-stat-strip">
                        <div><strong>${summary.totalItems}</strong><span>İçerik</span></div>
                        <div><strong>${assigned}</strong><span>Bağlı ekran</span></div>
                        <div><strong>${parseInt(playlist.transition_duration, 10) || 500}</strong><span>ms geçiş</span></div>
                        <div><strong>${escapeHTML(playlist.layout_type || 'full')}</strong><span>Yerleşim</span></div>
                    </div>
                    <div class="studio-action-strip">
                        <button class="btn btn-primary" data-studio-action="edit" data-playlist-id="${playlist.id}">
                            <i class="ti ti-edit"></i> Düzenle
                        </button>
                        <button class="btn btn-outline" data-studio-action="assign" data-playlist-id="${playlist.id}">
                            <i class="ti ti-device-tv"></i> Cihaz Ata
                        </button>
                        ${assigned ? `
                            <button class="btn btn-outline text-success" data-studio-action="start" data-playlist-id="${playlist.id}">
                                <i class="ti ti-player-play"></i> Başlat
                            </button>
                            <button class="btn btn-outline text-info" data-studio-action="refresh" data-playlist-id="${playlist.id}">
                                <i class="ti ti-refresh"></i> Yenile
                            </button>
                            <button class="btn btn-outline" data-studio-action="devices" data-playlist-id="${playlist.id}">
                                <i class="ti ti-devices"></i> Cihazlar
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-4">
                <div class="xl:col-span-7">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Yayın Hazırlık Kontrolü</h3>
                        </div>
                        <div class="card-body">
                            <div class="studio-health-stack">
                                ${flags.length ? flags.map((flag) => `
                                    <div class="studio-health-item warning">
                                        <i class="ti ti-alert-triangle"></i>
                                        <span>${escapeHTML(flag)}</span>
                                    </div>
                                `).join('') : `
                                    <div class="studio-health-item success">
                                        <i class="ti ti-check"></i>
                                        <span>Bu playlist operasyon açısından temiz görünüyor.</span>
                                    </div>
                                `}
                                <div class="studio-health-item">
                                    <i class="ti ti-sparkles"></i>
                                    <span>Geçiş: ${escapeHTML(String(playlist.transition || 'none'))} / ${parseInt(playlist.transition_duration, 10) || 500} ms</span>
                                </div>
                                <div class="studio-health-item">
                                    <i class="ti ti-template"></i>
                                    <span>Şablon: ${escapeHTML(playlist.template_name || 'Şablon kullanılmıyor')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mt-4">
                        <div class="card-header">
                            <h3 class="card-title">İçerik Sırası</h3>
                        </div>
                        <div class="card-body">
                            ${itemsPreview.length ? `
                                <div class="studio-sequence">
                                    ${itemsPreview.map((item, index) => `
                                        <div class="studio-sequence-item">
                                            <span class="studio-seq-index">${index + 1}</span>
                                            <div>
                                                <strong>${escapeHTML(item.name || item.url || `İçerik ${index + 1}`)}</strong>
                                                <small>${escapeHTML(String(item.type || 'media'))}</small>
                                            </div>
                                        </div>
                                    `).join('')}
                                    ${summary.items.length > itemsPreview.length ? `
                                        <div class="studio-sequence-more">+${summary.items.length - itemsPreview.length} ek içerik daha</div>
                                    ` : ''}
                                </div>
                            ` : `
                                <div class="studio-sequence-more">Bu playlistte parse edilebilir içerik listesi bulunamadı.</div>
                            `}
                        </div>
                    </div>
                </div>

                <div class="xl:col-span-5">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Saha Etkisi</h3>
                        </div>
                        <div class="card-body">
                            ${assigned ? `
                                <div class="studio-device-list">
                                    ${(playlist.assigned_devices || []).slice(0, 6).map((device) => `
                                        <div class="studio-device-item">
                                            <i class="ti ti-device-tv"></i>
                                            <div>
                                                <strong>${escapeHTML(device.device_name || '')}</strong>
                                                <small>${escapeHTML(device.ip_address || 'IP yok')}</small>
                                            </div>
                                        </div>
                                    `).join('')}
                                    ${(playlist.assigned_devices || []).length > 6 ? `
                                        <div class="studio-sequence-more">+${playlist.assigned_devices.length - 6} cihaz daha</div>
                                    ` : ''}
                                </div>
                            ` : `
                                <div class="studio-sequence-more">Bu playlist henüz bir ekrana bağlanmamış.</div>
                            `}
                        </div>
                    </div>

                    <div class="card mt-4">
                        <div class="card-header">
                            <h3 class="card-title">Kritik Aksiyonlar</h3>
                        </div>
                        <div class="card-body">
                            <div class="studio-action-list">
                                ${assigned ? `
                                    <button class="btn btn-outline" data-studio-action="stop" data-playlist-id="${playlist.id}">
                                        <i class="ti ti-player-stop"></i> Yayın Durdur
                                    </button>
                                ` : ''}
                                <button class="btn btn-outline text-danger" data-studio-action="delete" data-playlist-id="${playlist.id}">
                                    <i class="ti ti-trash"></i> Playlist Sil
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    addStyles() {
        if (document.getElementById('playlist-list-studio-styles')) return;

        const style = document.createElement('style');
        style.id = 'playlist-list-studio-styles';
        style.textContent = `
            .playlist-lab-switcher,
            .playlist-lab-filters {
                display: flex;
                flex-wrap: wrap;
                gap: 0.6rem;
                align-items: center;
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
                background: rgba(16,185,129,0.12);
                border-color: rgba(16,185,129,0.28);
                color: #0f766e;
            }
            .playlist-filter-chip.active {
                background: #0f766e;
                border-color: #0f766e;
                color: #fff;
            }
            .studio-shell {
                display: grid;
                grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
                gap: 1rem;
                align-items: start;
            }
            .studio-sidebar,
            .studio-detail {
                min-width: 0;
            }
            .studio-sidebar-head,
            .playlist-lab-search {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            .playlist-lab-search {
                position: relative;
            }
            .playlist-lab-search i {
                position: absolute;
                top: 0.85rem;
                left: 0.85rem;
                color: var(--text-muted);
            }
            .playlist-lab-search input {
                width: 100%;
                padding: 0.75rem 0.9rem 0.75rem 2.4rem;
                border-radius: 12px;
                border: 1px solid var(--border-color);
                background: var(--bg-primary);
            }
            .studio-list {
                display: flex;
                flex-direction: column;
                gap: 0.7rem;
                max-height: calc(100vh - 240px);
                overflow: auto;
                padding-right: 0.25rem;
                margin-top: 1rem;
            }
            .studio-list-item {
                width: 100%;
                text-align: left;
                padding: 0.95rem;
                border: 1px solid var(--border-color);
                border-radius: 16px;
                background: var(--bg-primary);
                cursor: pointer;
            }
            .studio-list-item.active {
                border-color: rgba(16,185,129,0.35);
                box-shadow: 0 0 0 1px rgba(16,185,129,0.18);
                background: linear-gradient(180deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02));
            }
            .studio-list-item-top,
            .studio-list-item-meta {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.6rem;
                flex-wrap: wrap;
            }
            .studio-list-item-meta {
                margin-top: 0.4rem;
                color: var(--text-muted);
                font-size: 0.78rem;
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
            .studio-hero {
                display: grid;
                grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
                gap: 1rem;
                padding: 1rem;
                border: 1px solid var(--border-color);
                border-radius: 22px;
                background: radial-gradient(circle at top right, rgba(16, 185, 129, 0.08), transparent 32%), var(--bg-primary);
            }
            .studio-hero-preview {
                min-height: 260px;
                border-radius: 18px;
                overflow: hidden;
                background: linear-gradient(135deg, #0f172a, #0f766e);
            }
            .studio-preview-media,
            .playlist-preview-fallback {
                width: 100%;
                height: 100%;
                min-height: 260px;
                object-fit: cover;
            }
            .playlist-preview-fallback {
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                gap: 0.35rem;
                padding: 1.25rem;
                color: #fff;
            }
            .preview-kicker {
                font-size: 0.72rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                opacity: 0.82;
            }
            .studio-hero-copy {
                display: flex;
                flex-direction: column;
                gap: 0.95rem;
            }
            .studio-hero-head,
            .studio-action-strip,
            .studio-stat-strip,
            .studio-action-list {
                display: flex;
                flex-wrap: wrap;
                gap: 0.75rem;
                align-items: center;
            }
            .studio-hero-head {
                justify-content: space-between;
            }
            .studio-hero-date {
                font-size: 0.78rem;
                color: var(--text-muted);
            }
            .studio-hero-copy h2 {
                margin: 0;
                font-size: 1.35rem;
            }
            .studio-hero-copy p {
                margin: 0;
                color: var(--text-muted);
                line-height: 1.6;
            }
            .studio-stat-strip {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 0.75rem;
                padding: 0.9rem;
                border-radius: 16px;
                background: var(--bg-secondary);
            }
            .studio-stat-strip div {
                display: flex;
                flex-direction: column;
                gap: 0.2rem;
            }
            .studio-stat-strip strong {
                font-size: 1.05rem;
            }
            .studio-stat-strip span {
                font-size: 0.72rem;
                color: var(--text-muted);
            }
            .studio-health-stack,
            .studio-sequence,
            .studio-device-list {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            .studio-health-item,
            .studio-sequence-item,
            .studio-device-item {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.8rem;
                border: 1px solid var(--border-color);
                border-radius: 14px;
                background: var(--bg-secondary);
            }
            .studio-health-item.warning {
                border-color: rgba(245, 158, 11, 0.28);
                background: rgba(245, 158, 11, 0.08);
            }
            .studio-health-item.success {
                border-color: rgba(34, 197, 94, 0.24);
                background: rgba(34, 197, 94, 0.08);
            }
            .studio-seq-index {
                width: 1.7rem;
                height: 1.7rem;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 999px;
                background: rgba(15, 118, 110, 0.12);
                color: #0f766e;
                font-size: 0.76rem;
                font-weight: 700;
            }
            .studio-sequence-item strong,
            .studio-device-item strong {
                display: block;
            }
            .studio-sequence-item small,
            .studio-device-item small {
                color: var(--text-muted);
            }
            .studio-sequence-more {
                padding: 1rem;
                border: 1px dashed var(--border-color);
                border-radius: 14px;
                color: var(--text-muted);
                text-align: center;
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
            @media (max-width: 1180px) {
                .studio-shell,
                .studio-hero {
                    grid-template-columns: 1fr;
                }
                .studio-list {
                    max-height: none;
                }
                .studio-stat-strip {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
            }
        `;

        document.head.appendChild(style);
    }

    destroy() {
        document.removeEventListener('click', this.handleDelegatedClick);
        super.destroy();
    }
}

export default PlaylistListStudioPage;
