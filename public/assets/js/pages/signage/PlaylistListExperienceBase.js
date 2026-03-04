import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { escapeHTML } from '../../core/SecurityUtils.js';
import { MediaUtils } from '../../utils/MediaUtils.js';
import PlaylistListPage from './PlaylistList.js';

export class PlaylistListExperienceBase extends PlaylistListPage {
    constructor(app) {
        super(app);
        this.quickFilter = 'all';
        this.searchTerm = '';
        this.selectedPlaylistId = null;
    }

    text(key, fallback, params = {}) {
        const value = this.__(key, params);
        if (typeof value === 'string' && value.includes('.')) {
            return fallback;
        }
        return value || fallback;
    }

    renderViewSwitcher(activeView) {
        const views = [
            { key: 'default', href: '#/signage/playlists', label: 'Mevcut' },
            { key: 'ops', href: '#/signage/playlists/ops', label: 'Operasyon+' },
            { key: 'cards', href: '#/signage/playlists/cards', label: 'Kart Hibrit' },
            { key: 'studio', href: '#/signage/playlists/studio', label: 'Studio Split' }
        ];

        return `
            <div class="playlist-lab-switcher">
                ${views.map((view) => `
                    <a href="${view.href}" class="playlist-lab-link ${view.key === activeView ? 'active' : ''}">
                        ${view.label}
                    </a>
                `).join('')}
            </div>
        `;
    }

    async loadPlaylists() {
        try {
            if (this.dataTable?.setLoading) {
                this.dataTable.setLoading(true);
            }

            const response = await this.app.api.get('/playlists');
            this.playlists = response.data || [];

            if (!this.selectedPlaylistId && this.playlists.length) {
                this.selectedPlaylistId = this.playlists[0].id;
            }

            this.refreshView();
        } catch (error) {
            Logger.error('Playlist load error:', error);
            this.playlists = [];
            this.refreshView();
            Toast.error(this.text('messages.loadFailed', 'Veriler yuklenemedi'));
        } finally {
            if (this.dataTable?.setLoading) {
                this.dataTable.setLoading(false);
            }
        }
    }

    getPlaylistItems(playlist) {
        if (!playlist?.items) {
            return [];
        }

        if (Array.isArray(playlist.items)) {
            return playlist.items;
        }

        if (typeof playlist.items === 'string') {
            try {
                const parsed = JSON.parse(playlist.items);
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }

        return [];
    }

    getPlaylistPreviewUrl(playlist) {
        if (playlist?.template_preview) {
            const templatePreview = MediaUtils.getDisplayUrl(playlist.template_preview);
            if (templatePreview) {
                return templatePreview;
            }
        }

        const items = this.getPlaylistItems(playlist);
        for (const item of items) {
            if (item?.url && typeof item.url === 'string') {
                const displayUrl = MediaUtils.getDisplayUrl(item.url);
                if (displayUrl) {
                    return displayUrl;
                }
            }
        }

        return '';
    }

    getPlaylistContentSummary(playlist) {
        const items = this.getPlaylistItems(playlist);
        const totalItems = parseInt(playlist?.items_count, 10) || items.length || 0;
        const typeCounts = {
            image: 0,
            video: 0,
            template: 0,
            html: 0,
            stream: 0,
            other: 0
        };

        items.forEach((item) => {
            const rawType = String(item?.type || item?.content_type || '').toLowerCase();
            if (rawType.includes('image')) {
                typeCounts.image++;
            } else if (rawType.includes('video')) {
                typeCounts.video++;
            } else if (rawType.includes('template')) {
                typeCounts.template++;
            } else if (rawType === 'html' || rawType === 'webpage') {
                typeCounts.html++;
            } else if (rawType.includes('stream')) {
                typeCounts.stream++;
            } else if (rawType) {
                typeCounts.other++;
            }
        });

        return {
            totalItems,
            items,
            typeCounts
        };
    }

    getOperationalState(playlist) {
        const assigned = parseInt(playlist?.assigned_device_count, 10) || 0;
        const totalItems = this.getPlaylistContentSummary(playlist).totalItems;
        const status = String(playlist?.status || 'draft');

        if (status !== 'active') {
            return { key: 'draft', label: 'Taslak', tone: 'muted' };
        }

        if (!totalItems) {
            return { key: 'empty', label: 'Icerik Bekliyor', tone: 'warning' };
        }

        if (!assigned) {
            return { key: 'ready', label: 'Yayin Bekliyor', tone: 'info' };
        }

        return { key: 'live', label: 'Canliya Hazir', tone: 'success' };
    }

    getHealthFlags(playlist) {
        const summary = this.getPlaylistContentSummary(playlist);
        const assigned = parseInt(playlist?.assigned_device_count, 10) || 0;
        const flags = [];

        if (!summary.totalItems) {
            flags.push('Icerik yok');
        }
        if (!assigned) {
            flags.push('Cihaz atamasi yok');
        }
        if (String(playlist?.status || 'draft') !== 'active') {
            flags.push('Yayin disi');
        }
        if ((playlist?.transition_duration ? parseInt(playlist.transition_duration, 10) : 0) > 700) {
            flags.push('Gecis suresi uzun');
        }

        return flags;
    }

    getDashboardStats(playlists = this.playlists) {
        const stats = {
            total: playlists.length,
            liveReady: 0,
            needsAttention: 0,
            assignedScreens: 0,
            draft: 0
        };

        playlists.forEach((playlist) => {
            const state = this.getOperationalState(playlist);
            const assigned = parseInt(playlist?.assigned_device_count, 10) || 0;

            stats.assignedScreens += assigned;

            if (state.key === 'live') {
                stats.liveReady++;
            }
            if (state.key === 'draft') {
                stats.draft++;
            }
            if (this.getHealthFlags(playlist).length) {
                stats.needsAttention++;
            }
        });

        return stats;
    }

    getFilteredPlaylists() {
        const term = this.searchTerm.trim().toLowerCase();

        return this.playlists.filter((playlist) => {
            const summary = this.getPlaylistContentSummary(playlist);
            const state = this.getOperationalState(playlist);
            const assigned = parseInt(playlist?.assigned_device_count, 10) || 0;

            const matchesFilter = (
                this.quickFilter === 'all' ||
                (this.quickFilter === 'live' && state.key === 'live') ||
                (this.quickFilter === 'attention' && this.getHealthFlags(playlist).length > 0) ||
                (this.quickFilter === 'unassigned' && assigned === 0) ||
                (this.quickFilter === 'draft' && state.key === 'draft') ||
                (this.quickFilter === 'rich' && summary.totalItems >= 5)
            );

            if (!matchesFilter) {
                return false;
            }

            if (!term) {
                return true;
            }

            const haystack = [
                playlist?.name,
                playlist?.description,
                playlist?.template_name,
                playlist?.layout_type,
                playlist?.orientation
            ].filter(Boolean).join(' ').toLowerCase();

            return haystack.includes(term);
        });
    }

    setQuickFilter(filter) {
        this.quickFilter = filter;
        this.refreshView();
    }

    setSearchTerm(value) {
        this.searchTerm = value || '';
        this.refreshView();
    }

    ensureSelectedPlaylist(playlists = this.getFilteredPlaylists()) {
        if (!playlists.length) {
            this.selectedPlaylistId = null;
            return null;
        }

        const exists = playlists.find((playlist) => playlist.id === this.selectedPlaylistId);
        if (!exists) {
            this.selectedPlaylistId = playlists[0].id;
            return playlists[0];
        }

        return exists;
    }

    selectPlaylist(playlistId) {
        this.selectedPlaylistId = playlistId;
        this.refreshView();
    }

    formatDateTime(value) {
        if (!value) {
            return '-';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    renderPreviewFrame(playlist, className = '') {
        const previewUrl = this.getPlaylistPreviewUrl(playlist);
        const summary = this.getPlaylistContentSummary(playlist);

        if (previewUrl) {
            return `<img src="${previewUrl}" alt="${escapeHTML(playlist?.name || 'Playlist')}" class="${className}">`;
        }

        return `
            <div class="playlist-preview-fallback ${className}">
                <span class="preview-kicker">${summary.totalItems || 0} Icerik</span>
                <strong>${escapeHTML((playlist?.name || 'Playlist').slice(0, 22))}</strong>
                <span>${escapeHTML(playlist?.layout_type || 'full')}</span>
            </div>
        `;
    }

    renderEmptyState(message = 'Playlist bulunamadi') {
        return `
            <div class="playlist-variant-empty">
                <i class="ti ti-layout-off"></i>
                <strong>${escapeHTML(message)}</strong>
                <span>Filtreleri temizleyin veya yeni bir playlist olusturun.</span>
            </div>
        `;
    }

    refreshView() {}

    destroy() {
        window.playlistPage = null;
        if (this.dataTable) {
            this.dataTable.destroy();
            this.dataTable = null;
        }
        if (this.deviceTree) {
            this.deviceTree.destroy();
            this.deviceTree = null;
        }
        this.app.i18n.clearPageTranslations();
    }
}

export default PlaylistListExperienceBase;
