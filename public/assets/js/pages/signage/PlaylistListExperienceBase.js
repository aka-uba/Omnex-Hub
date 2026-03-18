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
            Toast.error(this.text('messages.loadFailed', 'Veriler yüklenemedi'));
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

    getPreviewAssetKind(item, displayUrl = '') {
        const rawType = String(item?.type || item?.content_type || '').toLowerCase();

        if (rawType.includes('video') || rawType.includes('stream')) {
            return 'video';
        }

        if (rawType.includes('image') || rawType.includes('template')) {
            return 'image';
        }

        return MediaUtils.isVideo(displayUrl) ? 'video' : 'image';
    }

    getPlaylistPreviewAsset(playlist) {
        if (playlist?.template_preview) {
            const templatePreview = MediaUtils.getDisplayUrl(playlist.template_preview);
            if (templatePreview) {
                return {
                    url: templatePreview,
                    kind: 'image'
                };
            }
        }

        const items = this.getPlaylistItems(playlist);
        for (const item of items) {
            if (item?.url && typeof item.url === 'string') {
                const displayUrl = MediaUtils.getDisplayUrl(item.url);
                if (displayUrl) {
                    return {
                        url: displayUrl,
                        kind: this.getPreviewAssetKind(item, displayUrl)
                    };
                }
            }
        }

        return null;
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
            return { key: 'empty', label: 'İçerik Bekliyor', tone: 'warning' };
        }

        if (!assigned) {
            return { key: 'ready', label: 'Yayın Bekliyor', tone: 'info' };
        }

        return { key: 'live', label: 'Canlıya Hazır', tone: 'success' };
    }

    getHealthFlags(playlist) {
        const summary = this.getPlaylistContentSummary(playlist);
        const assigned = parseInt(playlist?.assigned_device_count, 10) || 0;
        const flags = [];

        if (!summary.totalItems) {
            flags.push('İçerik yok');
        }
        if (!assigned) {
            flags.push('Cihaz ataması yok');
        }
        if (String(playlist?.status || 'draft') !== 'active') {
            flags.push('Yayın dışı');
        }
        if ((playlist?.transition_duration ? parseInt(playlist.transition_duration, 10) : 0) > 700) {
            flags.push('Geçiş süresi uzun');
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
        const previewAsset = this.getPlaylistPreviewAsset(playlist);
        const summary = this.getPlaylistContentSummary(playlist);

        if (previewAsset?.url) {
            const escapedUrl = escapeHTML(previewAsset.url);
            const escapedName = escapeHTML(playlist?.name || 'Playlist');

            if (previewAsset.kind === 'video') {
                return `
                    <video
                        src="${escapedUrl}"
                        class="${className}"
                        muted
                        autoplay
                        loop
                        playsinline
                        preload="metadata"
                        aria-label="${escapedName}"></video>
                `;
            }

            return `<img src="${escapedUrl}" alt="${escapedName}" class="${className}">`;
        }

        return `
            <div class="playlist-preview-fallback ${className}">
                <span class="preview-kicker">${summary.totalItems || 0} Icerik</span>
                <strong>${escapeHTML((playlist?.name || 'Playlist').slice(0, 22))}</strong>
                <span>${escapeHTML(playlist?.layout_type || 'full')}</span>
            </div>
        `;
    }

    renderEmptyState(message = 'Playlist bulunamadı') {
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
