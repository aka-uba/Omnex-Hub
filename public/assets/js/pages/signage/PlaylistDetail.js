/**
 * Playlist Detail/Edit Page Component
 */

import { Logger } from '../../core/Logger.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { MediaUtils } from '../../utils/MediaUtils.js';
import { escapeHTML } from '../../core/SecurityUtils.js';

export class PlaylistDetailPage {
    constructor(app) {
        this.app = app;
        this.playlist = null;
        this.items = [];
        this.mediaLibrary = [];
        this.isNew = false;
        this.contentModal = null;
        this.activeTab = 'media'; // 'media', 'htmlTemplates', 'webpage', 'stream'
        this.webTemplates = []; // HTML templates from web_templates table

        // Media library state (like MediaPicker)
        this.activeMediaLibrary = 'company'; // 'company' or 'public'
        this.companyMedia = [];
        this.publicMedia = [];
        this.mediaSearchTerm = '';

        // Pagination state
        this.mediaCurrentPage = 1;
        this.mediaTotalPages = 1;
        this.mediaTotalItems = 0;
        this.mediaPerPage = 28;

        // Folder navigation state
        this.currentFolderId = null;
        this.folders = [];
        this.breadcrumb = [];
        this.companyFolders = [];
        this.publicFolders = [];
        this.companyMeta = null;
        this.publicMeta = null;
    }

    /**
     * Translation helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    /**
     * Get translated folder name
     */
    _getFolderDisplayName(folder) {
        if (folder && folder.name_key) {
            // Use tc() (common-only) to avoid page translation shadowing.
            // Folder name_keys (mediaLibrary.folders.*) are always in common.json.
            const translated = this.app.i18n.tc(folder.name_key);
            if (translated && translated !== folder.name_key) {
                return translated;
            }
        }
        return (folder && folder.name) || '';
    }

    renderHelpLabel(labelKey, buttonId, helpTitleKey) {
        const label = this.__(labelKey);
        const helpTitle = this.__(helpTitleKey);

        return `
            <span class="field-label-with-help">
                <span>${label}</span>
                <button
                    type="button"
                    id="${buttonId}"
                    class="field-help-button"
                    title="${escapeHTML(helpTitle)}"
                    aria-label="${escapeHTML(helpTitle)}"
                >!</button>
            </span>
        `;
    }

    renderTransitionOptions() {
        const options = [
            ['none', 'playlists.transitions.none'],
            ['fade', 'playlists.transitions.fade'],
            ['crossfade', 'playlists.transitions.crossfade'],
            ['slide-left', 'playlists.transitions.slideLeft'],
            ['slide-right', 'playlists.transitions.slideRight'],
            ['slide-up', 'playlists.transitions.slideUp'],
            ['slide-down', 'playlists.transitions.slideDown'],
            ['push-left', 'playlists.transitions.pushLeft'],
            ['push-right', 'playlists.transitions.pushRight'],
            ['push-up', 'playlists.transitions.pushUp'],
            ['push-down', 'playlists.transitions.pushDown'],
            ['wipe-left', 'playlists.transitions.wipeLeft'],
            ['wipe-right', 'playlists.transitions.wipeRight'],
            ['wipe-up', 'playlists.transitions.wipeUp'],
            ['wipe-down', 'playlists.transitions.wipeDown'],
            ['zoom', 'playlists.transitions.zoom'],
            ['zoom-in', 'playlists.transitions.zoomIn'],
            ['zoom-out', 'playlists.transitions.zoomOut'],
            ['random-safe', 'playlists.transitions.randomSafe']
        ];

        return options.map(([value, key]) => (
            `<option value="${value}">${this.__(key)}</option>`
        )).join('');
    }

    showFieldHelpModal(topic) {
        const isDuration = topic === 'duration';
        const titleKey = isDuration
            ? 'playlists.form.help.durationTitle'
            : 'playlists.form.help.transitionTitle';
        const introKey = isDuration
            ? 'playlists.form.help.durationIntro'
            : 'playlists.form.help.transitionIntro';
        const tipKeyPairs = isDuration
            ? [
                ['playlists.form.help.fastTitle', 'playlists.form.help.fastBody'],
                ['playlists.form.help.recommendedTitle', 'playlists.form.help.recommendedBody'],
                ['playlists.form.help.longTitle', 'playlists.form.help.longBody']
            ]
            : [
                ['playlists.form.help.bestPracticeTitle', 'playlists.form.help.bestPracticeBody'],
                ['playlists.form.help.productFlowTitle', 'playlists.form.help.productFlowBody'],
                ['playlists.form.help.cinematicTitle', 'playlists.form.help.cinematicBody'],
                ['playlists.form.help.safeModeTitle', 'playlists.form.help.safeModeBody']
            ];

        const content = `
            <div class="playlist-help-modal">
                <p class="playlist-help-intro">${escapeHTML(this.__(introKey))}</p>
                <div class="playlist-help-list">
                    ${tipKeyPairs.map(([tipTitleKey, tipBodyKey]) => `
                        <div class="playlist-help-item">
                            <span class="playlist-help-badge">!</span>
                            <div class="playlist-help-copy">
                                <strong>${escapeHTML(this.__(tipTitleKey))}</strong>
                                <p>${escapeHTML(this.__(tipBodyKey))}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        Modal.show({
            title: this.__(titleKey),
            icon: 'ti-alert-circle',
            content,
            size: 'md',
            showFooter: true,
            footer: `
                <button type="button" class="btn btn-outline" data-modal-close>${this.__('modal.close')}</button>
            `
        });
    }

    render() {
        const id = this.app.router.params?.id;
        this.isNew = !id || id === 'new';

        return `
            <div class="page-header">
                <div class="page-header-breadcrumb">
                    <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
                    <span class="breadcrumb-separator">></span>
                    <a href="#/signage/playlists">${this.__('playlists.title')}</a>
                    <span class="breadcrumb-separator">></span>
                    <span class="breadcrumb-current">${this.isNew ? this.__('playlists.addPlaylist') : this.__('playlists.editPlaylist')}</span>
                </div>
                <div class="page-header-main">
                    <div class="page-header-left">
                        <div class="page-header-icon orange">
                            <i class="ti ti-${this.isNew ? 'plus' : 'edit'}"></i>
                        </div>
                        <div class="page-header-info">
                            <h1 class="page-title">${this.isNew ? this.__('playlists.addPlaylist') : this.__('playlists.editPlaylist')}</h1>
                            <p class="page-subtitle">${this.isNew ? this.__('playlists.form.createDesc') : this.__('playlists.form.editDesc')}</p>
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

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Playlist Info -->
                <div class="lg:col-span-1">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">${this.__('playlists.form.infoTitle')}</h3>
                        </div>
                        <div class="card-body">
                            <form id="playlist-form" class="space-y-4">
                                <div class="form-group">
                                    <label class="form-label form-label-required">${this.__('playlists.form.fields.name')}</label>
                                    <input type="text" id="playlist-name" class="form-input"
                                        placeholder="${this.__('playlists.form.namePlaceholder')}" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('playlists.form.fields.description')}</label>
                                    <textarea id="playlist-description" class="form-input" rows="3"
                                        placeholder="${this.__('playlists.form.descPlaceholder')}"></textarea>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('playlists.form.fields.orientation')}</label>
                                    <select id="playlist-orientation" class="form-select">
                                        <option value="landscape">${this.__('playlists.orientations.landscape')}</option>
                                        <option value="portrait">${this.__('playlists.orientations.portrait')}</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('playlists.form.fields.layoutType')}</label>
                                    <select id="playlist-layout" class="form-select">
                                        <option value="full">${this.__('playlists.layouts.full')}</option>
                                        <option value="grid-2">${this.__('playlists.layouts.grid2')}</option>
                                        <option value="grid-3">${this.__('playlists.layouts.grid3')}</option>
                                        <option value="grid-4">${this.__('playlists.layouts.grid4')}</option>
                                        <option value="hybrid">${this.__('playlists.layouts.hybrid')}</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('status.title')}</label>
                                    <select id="playlist-status" class="form-select">
                                        <option value="draft">${this.__('status.draft')}</option>
                                        <option value="active">${this.__('status.active')}</option>
                                        <option value="archived">${this.__('status.archived')}</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('playlists.form.fields.duration')}</label>
                                    <input type="number" id="playlist-duration" class="form-input"
                                        value="10" min="1" max="300">
                                    <p class="form-hint">${this.__('playlists.form.durationHint')}</p>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.renderHelpLabel('playlists.form.fields.transition', 'btn-transition-help', 'playlists.form.help.transitionTitle')}</label>
                                    <select id="playlist-transition" class="form-select">
                                        ${this.renderTransitionOptions()}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.renderHelpLabel('playlists.form.fields.transitionDuration', 'btn-transition-duration-help', 'playlists.form.help.durationTitle')}</label>
                                    <div class="input-with-suffix">
                                        <input type="number" id="playlist-transition-duration" class="form-input"
                                            value="500" min="100" max="2000" step="100">
                                        <span class="input-suffix">ms</span>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- Playlist Items -->
                <div class="lg:col-span-2">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">${this.__('playlists.form.itemsTitle')}</h3>
                            <button id="btn-add-item" class="btn btn-sm btn-primary">
                                <i class="ti ti-plus"></i>
                                ${this.__('playlists.form.addItem')}
                            </button>
                        </div>
                        <div class="card-body">
                            <div class="playlist-items-hint">
                                <i class="ti ti-info-circle"></i>
                                <span>${this.__('playlists.form.itemsHint')}</span>
                            </div>
                            <div id="playlist-items-container">
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

    renderItems() {
        if (!this.items.length) {
            return `
                <div class="text-center py-12 text-gray-500">
                    <i class="ti ti-photo text-4xl mb-2"></i>
                    <p>${this.__('playlists.form.noItems')}</p>
                    <p class="text-sm">${this.__('playlists.form.noItemsHint')}</p>
                </div>
            `;
        }

        return `
            <div class="playlist-items-list" id="sortable-items">
                ${this.items.map((item, index) => this.renderPlaylistItem(item, index)).join('')}
            </div>
        `;
    }

    /**
     * Render a single playlist item (media, template, or webpage)
     */
    renderPlaylistItem(item, index) {
        const isTemplate = item.type === 'template';
        const isVideo = item.type === 'video';
        const isImage = item.type === 'image';
        const isHtml = item.type === 'html';
        const isStream = item.type === 'stream';

        // Get type label
        let typeLabel;
        if (isTemplate) {
            typeLabel = `<span class="item-type-badge template">${this.__('playlists.mediaTypes.template')}</span>`;
        } else if (isStream) {
            typeLabel = `<span class="item-type-badge stream">${this.__('playlists.mediaTypes.stream')}</span>`;
        } else if (isHtml) {
            typeLabel = `<span class="item-type-badge webpage">${this.__('playlists.mediaTypes.webpage')}</span>`;
        } else if (isVideo) {
            typeLabel = this.__('playlists.mediaTypes.video');
        } else {
            typeLabel = this.__('playlists.mediaTypes.image');
        }

        // Render preview based on type
        let previewHtml;
        if (isTemplate) {
            previewHtml = item.url
                ? `<div class="preview-loading"></div><img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.name)}" onload="this.previousElementSibling.remove();this.style.opacity=1">`
                : `<div class="template-placeholder-sm"><i class="ti ti-layout"></i></div>`;
        } else if (isStream) {
            previewHtml = `<div class="stream-placeholder-sm"><i class="ti ti-broadcast"></i></div>`;
        } else if (isHtml) {
            previewHtml = `<div class="webpage-placeholder-sm"><i class="ti ti-world"></i></div>`;
        } else if (isVideo) {
            previewHtml = `<div class="preview-loading"></div><video src="${escapeHTML(item.url)}" muted onloadeddata="this.previousElementSibling.remove();this.style.opacity=1"></video>`;
        } else {
            previewHtml = `<div class="preview-loading"></div><img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.name)}" onload="this.previousElementSibling.remove();this.style.opacity=1">`;
        }

        return `
            <div class="playlist-item ${isTemplate ? 'template-item-row' : ''} ${isHtml ? 'webpage-item-row' : ''} ${isStream ? 'stream-item-row' : ''}" data-id="${item.id}" data-index="${index}">
                <div class="playlist-item-drag">
                    <i class="ti ti-grip-vertical"></i>
                </div>
                <div class="playlist-item-preview">
                    ${previewHtml}
                </div>
                <div class="playlist-item-info">
                    <h4>${escapeHTML(item.name)}</h4>
                    <p>${typeLabel}</p>
                </div>
                <div class="playlist-item-duration">
                    <input type="number" class="form-input form-input-sm"
                        value="${item.duration || ''}" min="1" max="300"
                        placeholder="${isVideo ? 'Oto' : '10'}"
                        title="${isVideo ? this.__('playlists.form.durationHintVideo') : this.__('playlists.form.durationHintImage')}"
                        onchange="window.playlistDetailPage?.updateItemDuration(${index}, this.value)">
                    <span>${this.__('playlists.form.seconds')}</span>
                </div>
                ${isVideo ? `
                    <div class="playlist-item-loop">
                        <label class="toggle-label" title="${this.__('playlists.form.loopHint')}">
                            <input type="checkbox" class="toggle-input loop-toggle"
                                data-index="${index}"
                                ${item.loop > 0 ? 'checked' : ''}
                                onchange="window.playlistDetailPage?.toggleLoop(${index}, this.checked)">
                            <span class="toggle-switch"></span>
                        </label>
                        <div class="loop-count-wrapper ${item.loop > 0 ? 'visible' : ''}" data-loop-wrapper="${index}">
                            <input type="number" class="form-input form-input-sm loop-count-input"
                                value="${item.loop || 1}" min="1" max="99"
                                title="${this.__('playlists.form.loopCountHint')}"
                                onchange="window.playlistDetailPage?.updateItemLoop(${index}, this.value)">
                            <span class="loop-label">×</span>
                        </div>
                    </div>
                ` : '<div class="playlist-item-loop"></div>'}
                ${isVideo ? `
                    <div class="playlist-item-volume">
                        <button onclick="window.playlistDetailPage?.toggleMuted(${index})"
                            class="btn btn-sm btn-ghost ${item.muted !== false ? 'text-gray-500' : 'text-primary-500'}"
                            title="${item.muted !== false ? this.__('playlists.form.soundOff') : this.__('playlists.form.soundOn')}">
                            <i class="ti ti-${item.muted !== false ? 'volume-off' : 'volume'}"></i>
                        </button>
                    </div>
                ` : ''}
                <div class="playlist-item-actions">
                    <button onclick="window.playlistDetailPage?.editItem(${index})"
                        class="btn btn-sm btn-ghost text-blue-500" title="${this.__('actions.edit')}">
                        <i class="ti ti-edit"></i>
                    </button>
                    <button onclick="window.playlistDetailPage?.removeItem(${index})"
                        class="btn btn-sm btn-ghost text-red-500" title="${this.__('actions.delete')}">
                        <i class="ti ti-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    renderMediaLibrary() {
        // Get filtered media based on search
        const filteredMedia = this.getFilteredMedia();

        return `
            <div class="playlist-media-library">
                <!-- Sub-tabs: Firma Kütüphanesi / Ortak Kütüphane -->
                <div class="media-library-subtabs">
                    <button type="button" class="media-library-subtab ${this.activeMediaLibrary === 'company' ? 'active' : ''}" data-library="company">
                        <i class="ti ti-building"></i>
                        ${this.__('mediaLibrary.companyLibrary')}
                    </button>
                    <button type="button" class="media-library-subtab ${this.activeMediaLibrary === 'public' ? 'active' : ''}" data-library="public">
                        <i class="ti ti-world"></i>
                        ${this.__('mediaLibrary.publicLibrary')}
                    </button>
                </div>

                <!-- Toolbar: Search -->
                <div class="media-library-toolbar">
                    <div class="media-library-search">
                        <i class="ti ti-search"></i>
                        <input type="text" class="form-input form-input-sm" id="playlist-media-search"
                            placeholder="${this.__('mediaLibrary.search')}" value="${this.mediaSearchTerm || ''}">
                    </div>
                </div>

                <!-- Media Grid -->
                <div class="media-library-content" id="playlist-media-grid">
                    ${this.renderMediaGrid(filteredMedia)}
                </div>

                <!-- Footer with pagination -->
                <div class="media-library-footer">
                    <div class="media-library-selected-info">
                        <span>${this.mediaTotalItems} ${this.__('mediaLibrary.items')}</span>
                    </div>
                    ${this.renderMediaPagination()}
                </div>
            </div>
        `;
    }

    /**
     * Render pagination controls
     */
    renderMediaPagination() {
        if (this.mediaTotalPages <= 1) {
            return '';
        }

        const startItem = ((this.mediaCurrentPage - 1) * this.mediaPerPage) + 1;
        const endItem = Math.min(this.mediaCurrentPage * this.mediaPerPage, this.mediaTotalItems);

        return `
            <div class="media-library-pagination">
                <button type="button" class="btn btn-icon btn-sm btn-ghost" id="media-prev-page"
                    ${this.mediaCurrentPage <= 1 ? 'disabled' : ''} title="${this.__('actions.previous')}">
                    <i class="ti ti-chevron-left"></i>
                </button>
                <span class="media-pagination-info">
                    ${startItem}-${endItem} / ${this.mediaTotalItems}
                </span>
                <button type="button" class="btn btn-icon btn-sm btn-ghost" id="media-next-page"
                    ${this.mediaCurrentPage >= this.mediaTotalPages ? 'disabled' : ''} title="${this.__('actions.next')}">
                    <i class="ti ti-chevron-right"></i>
                </button>
            </div>
        `;
    }

    /**
     * Get filtered media based on search term and active library
     */
    getFilteredMedia() {
        const sourceMedia = this.activeMediaLibrary === 'company'
            ? this.companyMedia
            : this.publicMedia;

        if (!this.mediaSearchTerm) {
            return sourceMedia;
        }

        const searchLower = this.mediaSearchTerm.toLowerCase();
        return sourceMedia.filter(m =>
            (m.name || m.filename || '').toLowerCase().includes(searchLower)
        );
    }

    /**
     * Render breadcrumb navigation
     */
    renderBreadcrumb() {
        if (!this.currentFolderId && (!this.breadcrumb || this.breadcrumb.length === 0)) {
            return '';
        }

        return `
            <div class="media-library-breadcrumb">
                <button type="button" class="media-breadcrumb-item media-breadcrumb-home" data-folder-id="">
                    <i class="ti ti-home"></i>
                </button>
                ${(this.breadcrumb || []).map(item => `
                    <span class="media-breadcrumb-separator"><i class="ti ti-chevron-right"></i></span>
                    <button type="button" class="media-breadcrumb-item" data-folder-id="${item.id}">
                        ${escapeHTML(this._getFolderDisplayName(item))}
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render folders
     */
    renderFolders() {
        if (!this.folders || this.folders.length === 0) {
            return '';
        }

        return this.folders.map(folder => `
            <div class="media-item media-folder-item" data-folder-id="${folder.id}" data-folder-name="${escapeHTML(this._getFolderDisplayName(folder))}" data-folder-name-key="${folder.name_key || ''}">
                <div class="media-folder-icon">
                    <i class="ti ti-folder${folder.is_public ? '-share' : '-filled'}"></i>
                </div>
                <div class="media-item-name media-folder-name">${escapeHTML(this._getFolderDisplayName(folder))}</div>
            </div>
        `).join('');
    }

    /**
     * Render media grid items
     */
    renderMediaGrid(mediaList) {
        const breadcrumbHtml = this.renderBreadcrumb();
        const foldersHtml = this.renderFolders();

        // Empty state
        if ((!mediaList || !mediaList.length) && (!this.folders || !this.folders.length)) {
            return `
                ${breadcrumbHtml}
                <div class="text-center py-8 text-gray-500">
                    <i class="ti ti-photo-off text-4xl mb-2"></i>
                    <p>${this.__('playlists.form.emptyMedia')}</p>
                    <a href="#/media" target="_blank" class="btn btn-primary btn-sm mt-4">
                        <i class="ti ti-upload"></i>
                        ${this.__('playlists.form.uploadMedia')}
                    </a>
                </div>
            `;
        }

        return `
            ${breadcrumbHtml}
            <div class="media-grid">
                ${foldersHtml}
                ${(mediaList || []).map(media => `
                    <div class="media-item ${this.items.some(i => i.media_id === media.id && i.type !== 'template') ? 'selected' : ''}"
                        data-media-id="${media.id}">
                        <div class="media-item-preview">
                            ${media.type === 'image'
                                ? `<img src="${escapeHTML(media.url)}" alt="${escapeHTML(media.name || media.filename)}" loading="lazy">`
                                : `<video src="${escapeHTML(media.url)}" muted preload="metadata"></video>`
                            }
                            ${media.type === 'video' ? '<div class="media-video-icon"><i class="ti ti-player-play"></i></div>' : ''}
                        </div>
                        <div class="media-item-name">${escapeHTML(media.name || media.filename)}</div>
                        ${this.items.some(i => i.media_id === media.id && i.type !== 'template')
                            ? '<div class="media-item-check"><i class="ti ti-check"></i></div>'
                            : ''
                        }
                    </div>
                `).join('')}
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
        Logger.log('[DEBUG] PlaylistDetail init started');

        // Add styles FIRST before any rendering
        this.addStyles();

        window.playlistDetailPage = this;

        const id = this.app.router.params?.id;
        Logger.log('[DEBUG] Route ID:', id, 'isNew:', this.isNew);

        if (id && id !== 'new') {
            await this.loadPlaylist(id);
            Logger.log('[DEBUG] Playlist loaded:', this.playlist);
            Logger.log('[DEBUG] Items after load:', this.items);
        } else {
            document.getElementById('playlist-items-container').innerHTML = this.renderItems();
        }

        // Load media and HTML templates in parallel
        await Promise.all([
            this.loadMediaLibrary(),
            this.loadWebTemplates()
        ]);
        Logger.log('[DEBUG] Media library loaded:', this.mediaLibrary.length, 'items');

        this.bindEvents();
        Logger.log('[DEBUG] PlaylistDetail init completed');
    }

    /**
     * Load web templates (HTML templates from web_templates table)
     */
    async loadWebTemplates() {
        try {
            const res = await this.app.api.get('/web-templates?status=published&per_page=100');
            this.webTemplates = res.data?.items || res.data || [];
            Logger.log('[DEBUG] Web templates loaded:', this.webTemplates.length);
        } catch (error) {
            Logger.error('Web templates load error:', error);
            this.webTemplates = [];
        }
    }

    /**
     * Render HTML templates library grid
     */
    renderHtmlTemplatesLibrary() {
        if (!this.webTemplates.length) {
            return `
                <div class="text-center py-8 text-gray-500">
                    <i class="ti ti-code text-4xl mb-2"></i>
                    <p>${this.__('playlists.form.emptyHtmlTemplates')}</p>
                    <p class="text-sm mt-2">${this.__('playlists.form.emptyHtmlTemplatesHint')}</p>
                    <a href="#/web-templates" target="_blank" class="btn btn-primary mt-4">
                        <i class="ti ti-plus"></i>
                        ${this.__('playlists.form.goToHtmlTemplates')}
                    </a>
                </div>
            `;
        }

        return `
            <div class="template-grid">
                ${this.webTemplates.map(wt => {
                    const isSelected = this.items.some(i => i.web_template_id === wt.id);
                    const typeLabel = wt.template_type || 'signage';
                    const sizeLabel = wt.width && wt.height ? `${wt.width}×${wt.height}` : '';
                    const statusClass = wt.status === 'published' ? 'badge-success' : 'badge-warning';

                    return `
                        <div class="template-item html-template-item ${isSelected ? 'selected' : ''}"
                            data-template-id="${wt.id}">
                            <div class="template-item-preview">
                                ${wt.thumbnail
                                    ? `<img src="${wt.thumbnail}" alt="${escapeHTML(wt.name)}">`
                                    : `<div class="template-placeholder html-template-placeholder">
                                        <i class="ti ti-code"></i>
                                        <span>HTML</span>
                                       </div>`
                                }
                            </div>
                            <div class="template-item-info">
                                <div class="template-item-name">${escapeHTML(wt.name)}</div>
                                <div class="template-item-meta">
                                    <span class="template-type-badge signage">${escapeHTML(typeLabel)}</span>
                                    ${sizeLabel ? `<span class="template-size">${sizeLabel}</span>` : ''}
                                </div>
                            </div>
                            ${isSelected ? '<div class="template-item-check"><i class="ti ti-check"></i></div>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Select an HTML template from web_templates and add to playlist
     */
    selectHtmlTemplate(templateId) {
        const wt = this.webTemplates.find(t => t.id === templateId);
        if (!wt) return;

        const existingIndex = this.items.findIndex(i => i.web_template_id === templateId);

        if (existingIndex > -1) {
            // Toggle off — remove
            this.items.splice(existingIndex, 1);
        } else {
            const defaultDuration = parseInt(document.getElementById('playlist-duration')?.value) || 10;

            // Build the URL for the HTML content
            // If the web template has data_sources with file info, use file path
            // Otherwise serve via a simple route
            let contentUrl = '';
            try {
                const ds = typeof wt.data_sources === 'string' ? JSON.parse(wt.data_sources) : wt.data_sources;
                if (ds && ds.source === 'fabric_template') {
                    // Generated from fabric — file exists on disk
                    const basePath = window.OmnexConfig?.basePath || '';
                    contentUrl = `${basePath}/api/web-templates/${wt.id}/serve`;
                }
            } catch { /* ignore */ }

            if (!contentUrl) {
                const basePath = window.OmnexConfig?.basePath || '';
                contentUrl = `${basePath}/api/web-templates/${wt.id}/serve`;
            }

            const newItem = {
                id: 'new_' + Date.now(),
                web_template_id: wt.id,
                name: wt.name,
                url: contentUrl,
                type: 'html',
                duration: defaultDuration,
                width: wt.width,
                height: wt.height,
                order: this.items.length
            };

            this.items.push(newItem);
        }

        // Re-render items and modal grid
        document.getElementById('playlist-items-container').innerHTML = this.renderItems();
        this.initDragDrop();

        // Refresh the grid in modal
        const container = this.contentModal?.element?.querySelector('#content-library-container');
        if (container) {
            container.innerHTML = this.renderHtmlTemplatesLibrary();
            this.bindContentItemClicks();
        }
    }

    async loadPlaylist(id) {
        try {
            Logger.log('[DEBUG] loadPlaylist called with id:', id);
            const response = await this.app.api.get(`/playlists/${id}`);
            Logger.log('[DEBUG] Playlist API response:', response);
            Logger.log('[DEBUG] Playlist API response.data:', response.data);

            this.playlist = response.data;
            this.items = this.playlist.items || [];

            Logger.log('[DEBUG] Parsed playlist:', this.playlist);
            Logger.log('[DEBUG] Parsed items:', this.items);
            Logger.log('[DEBUG] Items count:', this.items.length);
            if (this.items.length > 0) {
                Logger.log('[DEBUG] First item:', this.items[0]);
            }

            document.getElementById('playlist-name').value = this.playlist.name || '';
            document.getElementById('playlist-description').value = this.playlist.description || '';
            document.getElementById('playlist-status').value = this.playlist.status || 'draft';
            document.getElementById('playlist-duration').value = this.playlist.default_duration || 10;
            document.getElementById('playlist-orientation').value = this.playlist.orientation || 'landscape';
            document.getElementById('playlist-layout').value = this.playlist.layout_type || 'full';
            document.getElementById('playlist-transition').value = this.playlist.transition || 'none';
            document.getElementById('playlist-transition-duration').value = this.playlist.transition_duration || 500;

            Logger.log('[DEBUG] Form populated, rendering items...');
            document.getElementById('playlist-items-container').innerHTML = this.renderItems();
            this.initDragDrop();
            Logger.log('[DEBUG] Items rendered');
        } catch (error) {
            Logger.error('[DEBUG] Playlist load error:', error);
            Toast.error(this.__('messages.loadFailed') + ': ' + (error.message || ''));
        }
    }

    async loadMediaLibrary(page = 1, folderId = null) {
        try {
            const perPage = this.mediaPerPage;
            const folderParam = folderId ? `&folder_id=${folderId}` : '';

            // Load from both company and public scopes with pagination
            const [companyRes, publicRes] = await Promise.all([
                this.app.api.get(`/media?scope=company&page=${page}&per_page=${perPage}${folderParam}`),
                this.app.api.get(`/media?scope=public&page=${page}&per_page=${perPage}${folderParam}`)
            ]);

            // Extract files and meta from responses
            const companyData = companyRes.data;
            const publicData = publicRes.data;

            // Company media
            let companyFiles = [];
            if (Array.isArray(companyData)) {
                companyFiles = companyData;
            } else if (companyData && Array.isArray(companyData.files)) {
                companyFiles = companyData.files;
            }
            this.companyMedia = companyFiles.filter(m => m.type === 'image' || m.type === 'video');
            this.companyMeta = companyData?.meta || null;
            this.companyFolders = companyData?.folders || [];

            // Public media
            let publicFiles = [];
            if (Array.isArray(publicData)) {
                publicFiles = publicData;
            } else if (publicData && Array.isArray(publicData.files)) {
                publicFiles = publicData.files;
            }
            this.publicMedia = publicFiles.filter(m => m.type === 'image' || m.type === 'video');
            this.publicMeta = publicData?.meta || null;
            this.publicFolders = publicData?.folders || [];

            // Update pagination state
            this.mediaCurrentPage = page;
            this.currentFolderId = folderId;

            // Set active library data
            this.setActiveLibraryData();

            Logger.log('[DEBUG] Company media:', this.companyMedia.length, 'Folders:', this.companyFolders.length, this.companyFolders);
            Logger.log('[DEBUG] Public media:', this.publicMedia.length, 'Folders:', this.publicFolders.length, this.publicFolders);
            Logger.log('[DEBUG] Active library:', this.activeMediaLibrary, 'Current folders:', this.folders);
        } catch (error) {
            Logger.error('[DEBUG] Media load error:', error);
            this.companyMedia = [];
            this.publicMedia = [];
            this.mediaLibrary = [];
            this.folders = [];
        }
    }

    /**
     * Set active library data based on activeMediaLibrary
     */
    setActiveLibraryData() {
        Logger.log('[DEBUG] setActiveLibraryData called, activeMediaLibrary:', this.activeMediaLibrary);
        if (this.activeMediaLibrary === 'company') {
            this.mediaLibrary = this.companyMedia;
            this.folders = this.companyFolders;
            if (this.companyMeta) {
                this.mediaTotalPages = this.companyMeta.total_pages || 1;
                this.mediaTotalItems = this.companyMeta.total || this.companyMedia.length;
            } else {
                this.mediaTotalPages = 1;
                this.mediaTotalItems = this.companyMedia.length;
            }
        } else {
            this.mediaLibrary = this.publicMedia;
            this.folders = this.publicFolders;
            if (this.publicMeta) {
                this.mediaTotalPages = this.publicMeta.total_pages || 1;
                this.mediaTotalItems = this.publicMeta.total || this.publicMedia.length;
            } else {
                this.mediaTotalPages = 1;
                this.mediaTotalItems = this.publicMedia.length;
            }
        }
        Logger.log('[DEBUG] After setActiveLibraryData - folders:', this.folders.length, 'media:', this.mediaLibrary.length);
    }

    bindEvents() {
        document.getElementById('btn-cancel')?.addEventListener('click', () => {
            window.location.hash = '#/signage/playlists';
        });

        document.getElementById('btn-save')?.addEventListener('click', () => {
            this.save();
        });

        document.getElementById('btn-add-item')?.addEventListener('click', () => {
            this.openContentModal();
        });

        document.getElementById('btn-transition-help')?.addEventListener('click', () => {
            this.showFieldHelpModal('transition');
        });

        document.getElementById('btn-transition-duration-help')?.addEventListener('click', () => {
            this.showFieldHelpModal('duration');
        });
    }

    /**
     * Open tabbed modal for selecting media or templates
     */
    openContentModal() {
        Logger.log('[DEBUG] openContentModal called');
        this.activeTab = 'media';

        const modalContent = `
            <div class="content-modal-tabs">
                <button type="button" class="content-tab active" data-tab="media">
                    <i class="ti ti-photo"></i>
                    ${this.__('playlists.form.tabMedia')}
                </button>
                <button type="button" class="content-tab" data-tab="htmlTemplates">
                    <i class="ti ti-code"></i>
                    ${this.__('playlists.form.tabHtmlTemplates')}
                </button>
                <button type="button" class="content-tab" data-tab="webpage">
                    <i class="ti ti-world"></i>
                    ${this.__('playlists.form.tabWebpage')}
                </button>
                <button type="button" class="content-tab" data-tab="stream">
                    <i class="ti ti-broadcast"></i>
                    ${this.__('playlists.form.tabStream')}
                </button>
            </div>
            <div id="content-library-container">
                ${this.renderMediaLibrary()}
            </div>
        `;

        this.contentModal = Modal.show({
            title: this.__('playlists.form.addItem'),
            icon: 'ti-plus',
            content: modalContent,
            size: 'lg',
            showFooter: true,
            footer: `
                <button type="button" class="btn btn-outline" data-modal-close>${this.__('modal.close')}</button>
            `
        });

        // Bind tab clicks
        setTimeout(() => {
            this.bindContentModalEvents();
        }, 100);
    }

    /**
     * Bind events for content modal (tabs, items)
     */
    bindContentModalEvents() {
        if (!this.contentModal?.element) return;

        // Tab switching
        this.contentModal.element.querySelectorAll('.content-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchContentTab(tabName);
            });
        });

        // Bind item clicks based on active tab
        this.bindContentItemClicks();
    }

    /**
     * Switch between media, templates, and webpage tabs
     */
    switchContentTab(tabName) {
        this.activeTab = tabName;

        // Reset media search when switching tabs
        if (tabName === 'media') {
            this.mediaSearchTerm = '';
        }

        // Update tab buttons
        this.contentModal.element.querySelectorAll('.content-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Render content based on tab
        const container = this.contentModal.element.querySelector('#content-library-container');
        if (container) {
            if (tabName === 'media') {
                container.innerHTML = this.renderMediaLibrary();
            } else if (tabName === 'htmlTemplates') {
                container.innerHTML = this.renderHtmlTemplatesLibrary();
            } else if (tabName === 'webpage') {
                container.innerHTML = this.renderWebPageForm();
            } else if (tabName === 'stream') {
                container.innerHTML = this.renderStreamForm();
            }
            this.bindContentItemClicks();
        }
    }

    /**
     * Switch between company and public media library
     */
    async switchMediaLibrary(library) {
        this.activeMediaLibrary = library;
        this.mediaSearchTerm = '';
        this.mediaCurrentPage = 1;
        this.currentFolderId = null;
        this.breadcrumb = [];

        // Update sub-tabs
        if (this.contentModal?.element) {
            this.contentModal.element.querySelectorAll('.media-library-subtab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.library === library);
            });

            // Clear search input
            const searchInput = this.contentModal.element.querySelector('#playlist-media-search');
            if (searchInput) searchInput.value = '';

            // Show loading
            const gridContainer = this.contentModal.element.querySelector('#playlist-media-grid');
            if (gridContainer) {
                gridContainer.innerHTML = `
                    <div class="text-center py-8">
                        <i class="ti ti-loader-2 animate-spin text-3xl text-primary-500"></i>
                        <p class="mt-2 text-gray-500">${this.__('messages.loading')}</p>
                    </div>
                `;
            }
        }

        // Reload media for the new library
        await this.loadMediaLibrary(1, null);

        // Refresh content
        this.refreshMediaContent();
    }

    /**
     * Refresh media grid without re-rendering the whole container
     */
    refreshMediaGrid() {
        if (!this.contentModal?.element) return;

        const gridContainer = this.contentModal.element.querySelector('#playlist-media-grid');
        if (gridContainer) {
            const filteredMedia = this.getFilteredMedia();
            gridContainer.innerHTML = this.renderMediaGrid(filteredMedia);
            this.bindMediaGridEvents();
        }
    }

    /**
     * Refresh entire media content (grid + footer)
     */
    refreshMediaContent() {
        if (!this.contentModal?.element) return;

        // Update grid
        const gridContainer = this.contentModal.element.querySelector('#playlist-media-grid');
        if (gridContainer) {
            const filteredMedia = this.getFilteredMedia();
            gridContainer.innerHTML = this.renderMediaGrid(filteredMedia);
        }

        // Update footer info
        const infoEl = this.contentModal.element.querySelector('.media-library-selected-info span');
        if (infoEl) {
            infoEl.textContent = `${this.mediaTotalItems} ${this.__('mediaLibrary.items')}`;
        }

        // Update pagination
        const footerEl = this.contentModal.element.querySelector('.media-library-footer');
        if (footerEl) {
            const paginationEl = footerEl.querySelector('.media-library-pagination');
            const newPaginationHtml = this.renderMediaPagination();
            if (paginationEl) {
                paginationEl.outerHTML = newPaginationHtml || '<div class="media-library-pagination"></div>';
            } else if (newPaginationHtml) {
                footerEl.insertAdjacentHTML('beforeend', newPaginationHtml);
            }
        }

        // Rebind events
        this.bindMediaGridEvents();
    }

    /**
     * Bind events for media grid items (folders, files, breadcrumb, pagination)
     */
    bindMediaGridEvents() {
        if (!this.contentModal?.element) return;

        // Folder clicks
        this.contentModal.element.querySelectorAll('.media-folder-item').forEach(item => {
            item.addEventListener('click', () => {
                const folderId = item.dataset.folderId;
                const folderName = item.dataset.folderName;
                const folderNameKey = item.dataset.folderNameKey || null;
                if (folderId) {
                    this.navigateToFolder(folderId, folderName, folderNameKey);
                }
            });
        });

        // Breadcrumb clicks
        this.contentModal.element.querySelectorAll('.media-breadcrumb-item').forEach(item => {
            item.addEventListener('click', () => {
                const folderId = item.dataset.folderId;
                this.navigateToFolder(folderId || null, null, null);
            });
        });

        // Media item clicks (not folders)
        this.contentModal.element.querySelectorAll('.media-item:not(.media-folder-item)').forEach(item => {
            item.addEventListener('click', () => {
                this.selectMedia(item.dataset.mediaId);
                this.refreshMediaGrid();
            });
        });

        // Pagination clicks
        this.contentModal.element.querySelector('#media-prev-page')?.addEventListener('click', () => {
            if (this.mediaCurrentPage > 1) {
                this.goToMediaPage(this.mediaCurrentPage - 1);
            }
        });

        this.contentModal.element.querySelector('#media-next-page')?.addEventListener('click', () => {
            if (this.mediaCurrentPage < this.mediaTotalPages) {
                this.goToMediaPage(this.mediaCurrentPage + 1);
            }
        });
    }

    /**
     * Navigate to a folder
     */
    async navigateToFolder(folderId, folderName, nameKey) {
        if (!this.contentModal?.element) return;

        // Show loading
        const gridContainer = this.contentModal.element.querySelector('#playlist-media-grid');
        if (gridContainer) {
            gridContainer.innerHTML = `
                <div class="text-center py-8">
                    <i class="ti ti-loader-2 animate-spin text-3xl text-primary-500"></i>
                    <p class="mt-2 text-gray-500">${this.__('messages.loading')}</p>
                </div>
            `;
        }

        // Update breadcrumb
        if (folderId && folderName) {
            // Entering a folder
            const existingIndex = this.breadcrumb.findIndex(b => b.id === folderId);
            if (existingIndex >= 0) {
                this.breadcrumb = this.breadcrumb.slice(0, existingIndex + 1);
            } else {
                this.breadcrumb.push({ id: folderId, name: folderName, name_key: nameKey || null });
            }
        } else if (folderId && !folderName) {
            // Clicked on breadcrumb
            const existingIndex = this.breadcrumb.findIndex(b => b.id === folderId);
            if (existingIndex >= 0) {
                this.breadcrumb = this.breadcrumb.slice(0, existingIndex + 1);
            }
        } else {
            // Going to root (home clicked)
            this.breadcrumb = [];
        }

        // Reset page when navigating
        this.mediaCurrentPage = 1;

        // Load media for the folder
        await this.loadMediaLibrary(1, folderId || null);

        // Refresh content
        this.refreshMediaContent();
    }

    /**
     * Go to a specific page
     */
    async goToMediaPage(page) {
        if (!this.contentModal?.element) return;

        // Show loading
        const gridContainer = this.contentModal.element.querySelector('#playlist-media-grid');
        if (gridContainer) {
            gridContainer.innerHTML = `
                <div class="text-center py-8">
                    <i class="ti ti-loader-2 animate-spin text-3xl text-primary-500"></i>
                    <p class="mt-2 text-gray-500">${this.__('messages.loading')}</p>
                </div>
            `;
        }

        // Load media for the page
        await this.loadMediaLibrary(page, this.currentFolderId);

        // Refresh content
        this.refreshMediaContent();
    }

    /**
     * Bind click events for media, template, or webpage items
     */
    bindContentItemClicks() {
        if (!this.contentModal?.element) return;

        if (this.activeTab === 'media') {
            // Sub-tab switching (Firma Kütüphanesi / Ortak Kütüphane)
            this.contentModal.element.querySelectorAll('.media-library-subtab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const library = tab.dataset.library;
                    if (library && library !== this.activeMediaLibrary) {
                        this.switchMediaLibrary(library);
                    }
                });
            });

            // Search input
            const searchInput = this.contentModal.element.querySelector('#playlist-media-search');
            let searchTimeout;
            searchInput?.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.mediaSearchTerm = e.target.value.toLowerCase();
                    this.refreshMediaGrid();
                }, 300);
            });

            // Bind grid events (folders, files, breadcrumb, pagination)
            this.bindMediaGridEvents();
        } else if (this.activeTab === 'htmlTemplates') {
            // Bind HTML template item clicks
            this.contentModal.element.querySelectorAll('.html-template-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.selectHtmlTemplate(item.dataset.templateId);
                });
            });
        } else if (this.activeTab === 'webpage') {
            // Bind webpage form submit
            const addBtn = this.contentModal.element.querySelector('#btn-add-webpage');
            addBtn?.addEventListener('click', () => this.addWebPage());

            // Enter key to submit
            const urlInput = this.contentModal.element.querySelector('#webpage-url');
            urlInput?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addWebPage();
            });
        } else if (this.activeTab === 'stream') {
            // Bind stream form submit
            const addBtn = this.contentModal.element.querySelector('#btn-add-stream');
            addBtn?.addEventListener('click', () => this.addStreamItem());

            const urlInput = this.contentModal.element.querySelector('#stream-url');
            urlInput?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addStreamItem();
            });
        }
    }

    /**
     * Render web page URL form
     */
    renderWebPageForm() {
        return `
            <div class="webpage-form">
                <div class="webpage-form-icon">
                    <i class="ti ti-world"></i>
                </div>
                <h3>${this.__('playlists.form.webpageTitle')}</h3>
                <p class="webpage-form-hint">${this.__('playlists.form.webpageHint')}</p>

                <div class="form-group">
                    <label class="form-label form-label-required">${this.__('playlists.form.webpageUrl')}</label>
                    <input type="url" id="webpage-url" class="form-input"
                        placeholder="https://example.com" required>
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('playlists.form.webpageName')} (${this.__('form.optional')})</label>
                    <input type="text" id="webpage-name" class="form-input"
                        placeholder="${this.__('playlists.form.webpageNamePlaceholder')}">
                </div>

                <div class="form-group">
                    <label class="form-label">${this.__('playlists.form.fields.duration')} (${this.__('playlists.form.seconds')})</label>
                    <input type="number" id="webpage-duration" class="form-input"
                        value="30" min="5" max="3600" style="width: 120px;">
                </div>

                <button type="button" id="btn-add-webpage" class="btn btn-primary">
                    <i class="ti ti-plus"></i>
                    ${this.__('playlists.form.addWebpage')}
                </button>

                <div class="webpage-warning">
                    <i class="ti ti-alert-triangle"></i>
                    <span>${this.__('playlists.form.webpageWarning')}</span>
                </div>
            </div>
        `;
    }

    /**
     * Add web page URL to playlist
     */
    addWebPage() {
        const urlInput = this.contentModal.element.querySelector('#webpage-url');
        const nameInput = this.contentModal.element.querySelector('#webpage-name');
        const durationInput = this.contentModal.element.querySelector('#webpage-duration');

        const url = urlInput?.value.trim();
        const name = nameInput?.value.trim() || this.extractDomainName(url);
        const duration = parseInt(durationInput?.value) || 30;

        if (!url) {
            Toast.error(this.__('playlists.form.webpageUrlRequired'));
            if (urlInput) urlInput.classList.add('error');
            urlInput?.focus();
            return;
        }

        // Basic URL validation
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            Toast.error(this.__('playlists.form.webpageUrlInvalid'));
            if (urlInput) urlInput.classList.add('error');
            urlInput?.focus();
            return;
        }

        // Clear error state on valid input
        if (urlInput) urlInput.classList.remove('error');

        // Check if already added
        const existingIndex = this.items.findIndex(i => i.url === url && i.type === 'html');
        if (existingIndex > -1) {
            Toast.warning(this.__('playlists.form.webpageAlreadyAdded'));
            return;
        }

        // Add to items
        const newItem = {
            id: 'new_' + Date.now(),
            name: name,
            url: url,
            type: 'html',
            duration: duration,
            order: this.items.length
        };

        Logger.log('[DEBUG] Adding webpage item:', newItem);
        this.items.push(newItem);

        // Update UI
        document.getElementById('playlist-items-container').innerHTML = this.renderItems();
        this.initDragDrop();

        // Clear form and show success
        urlInput.value = '';
        nameInput.value = '';
        Toast.success(this.__('playlists.form.webpageAdded'));
    }

    /**
     * Extract domain name from URL for display
     */
    extractDomainName(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch {
            return url;
        }
    }

    // ========== Stream Form ==========

    renderStreamForm() {
        return `
            <div class="stream-form">
                <div class="stream-form-icon">
                    <i class="ti ti-broadcast"></i>
                </div>
                <h3>${this.__('playlists.form.streamTitle')}</h3>
                <p class="stream-form-hint">${this.__('playlists.form.streamHint')}</p>
                <div class="form-group">
                    <label class="form-label form-label-required">${this.__('playlists.form.streamUrl')}</label>
                    <input type="url" id="stream-url" class="form-input"
                        placeholder="http://192.168.1.x:8080/master.m3u8">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('playlists.form.streamName')} (${this.__('form.optional')})</label>
                    <input type="text" id="stream-name" class="form-input"
                        placeholder="${this.__('playlists.form.streamNamePlaceholder')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('playlists.form.duration')} (${this.__('form.optional')})</label>
                    <input type="number" id="stream-duration" class="form-input"
                        min="0" placeholder="${this.__('playlists.form.streamDurationHint')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${this.__('playlists.form.streamMuted')}</label>
                    <select id="stream-muted" class="form-select">
                        <option value="1">${this.__('playlists.form.streamMutedYes')}</option>
                        <option value="0">${this.__('playlists.form.streamMutedNo')}</option>
                    </select>
                </div>
                <button type="button" id="btn-add-stream" class="btn btn-primary">
                    <i class="ti ti-plus"></i> ${this.__('playlists.form.streamAdd')}
                </button>
                <div class="stream-formats">
                    <i class="ti ti-info-circle"></i>
                    <span>${this.__('playlists.form.streamFormats')}</span>
                </div>
            </div>
        `;
    }

    addStreamItem() {
        const urlInput = this.contentModal.element.querySelector('#stream-url');
        const nameInput = this.contentModal.element.querySelector('#stream-name');
        const durationInput = this.contentModal.element.querySelector('#stream-duration');
        const mutedInput = this.contentModal.element.querySelector('#stream-muted');

        const url = urlInput?.value.trim();
        if (!url) {
            Toast.error(this.__('playlists.form.streamUrlRequired'));
            if (urlInput) urlInput.classList.add('error');
            urlInput?.focus();
            return;
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            Toast.error(this.__('playlists.form.streamUrlInvalid'));
            if (urlInput) urlInput.classList.add('error');
            urlInput?.focus();
            return;
        }

        // Clear error state on valid input
        if (urlInput) urlInput.classList.remove('error');

        // Check duplicate
        const existingIndex = this.items.findIndex(i => i.url === url && (i.type === 'stream' || i.type === 'video'));
        if (existingIndex !== -1) {
            Toast.warning(this.__('playlists.form.streamAlreadyAdded'));
            return;
        }

        const name = nameInput?.value.trim() || this.extractStreamName(url);
        const duration = parseInt(durationInput?.value) || 0;
        const muted = mutedInput?.value === '1';

        const newItem = {
            id: 'new_' + Date.now(),
            name: name,
            url: url,
            type: 'stream',
            duration: duration,
            muted: muted,
            order: this.items.length
        };

        Logger.log('[DEBUG] Adding stream item:', newItem);
        this.items.push(newItem);

        document.getElementById('playlist-items-container').innerHTML = this.renderItems();
        this.initDragDrop();

        urlInput.value = '';
        nameInput.value = '';
        Toast.success(this.__('playlists.form.streamAdded'));
    }

    extractStreamName(url) {
        try {
            const urlObj = new URL(url);
            const host = urlObj.hostname;
            const port = urlObj.port ? ':' + urlObj.port : '';
            return `Stream ${host}${port}`;
        } catch {
            return 'Stream';
        }
    }

    selectMedia(mediaId) {
        Logger.log('[DEBUG] selectMedia called with mediaId:', mediaId);

        // Search in both company and public media
        let media = this.companyMedia.find(m => m.id === mediaId);
        if (!media) {
            media = this.publicMedia.find(m => m.id === mediaId);
        }
        Logger.log('[DEBUG] Found media:', media);

        if (!media) {
            Logger.warn('[DEBUG] Media not found in library!');
            return;
        }

        const existingIndex = this.items.findIndex(i => i.media_id === mediaId);
        Logger.log('[DEBUG] Existing index:', existingIndex);

        if (existingIndex > -1) {
            this.items.splice(existingIndex, 1);
            Logger.log('[DEBUG] Removed item, new items:', this.items);
        } else {
            const defaultDuration = parseInt(document.getElementById('playlist-duration')?.value) || 10;
            const newItem = {
                id: 'new_' + Date.now(),
                media_id: media.id,
                name: media.name,
                url: media.url,
                type: media.type,
                duration: defaultDuration,
                order: this.items.length,
                // ✅ Video için varsayılan ses kapalı (muted: true)
                ...(media.type === 'video' && { muted: true })
            };
            Logger.log('[DEBUG] Adding new item:', newItem);
            this.items.push(newItem);
            Logger.log('[DEBUG] Items after add:', this.items);
        }

        document.getElementById('playlist-items-container').innerHTML = this.renderItems();
        this.initDragDrop();
        Logger.log('[DEBUG] Items rendered');
    }

    removeItem(index) {
        this.items.splice(index, 1);
        document.getElementById('playlist-items-container').innerHTML = this.renderItems();
        this.initDragDrop();
    }

    /**
     * Edit playlist item
     */
    editItem(index) {
        const item = this.items[index];
        if (!item) return;

        const isHtml = item.type === 'html';
        const isVideo = item.type === 'video';
        const isStream = item.type === 'stream';

        Modal.show({
            title: this.__('playlists.form.editItem'),
            icon: 'ti-edit',
            size: 'md',
            content: `
                <form id="edit-item-form" class="edit-item-form">
                    <div class="form-group">
                        <label class="form-label form-label-required">${this.__('playlists.form.itemName')}</label>
                        <input type="text" id="edit-item-name" class="form-input" value="${escapeHTML(item.name || '')}" required>
                    </div>
                    ${isHtml || isStream ? `
                        <div class="form-group">
                            <label class="form-label form-label-required">${isStream ? this.__('playlists.form.streamUrl') : this.__('playlists.form.webpageUrl')}</label>
                            <input type="url" id="edit-item-url" class="form-input" value="${escapeHTML(item.url || '')}" required>
                        </div>
                    ` : ''}
                    <div class="form-group">
                        <label class="form-label">${this.__('playlists.form.duration')} (${this.__('playlists.form.seconds')})</label>
                        <input type="number" id="edit-item-duration" class="form-input"
                            value="${item.duration || ''}" min="1" max="300"
                            placeholder="${isVideo ? this.__('playlists.form.autoForVideo') : '10'}">
                        <small class="form-hint">${isVideo ? this.__('playlists.form.durationHintVideo') : this.__('playlists.form.durationHintImage')}</small>
                    </div>
                    ${isVideo ? `
                        <div class="form-group">
                            <label class="toggle-label-inline">
                                <input type="checkbox" id="edit-item-loop" ${item.loop > 0 ? 'checked' : ''}>
                                <span>${this.__('playlists.form.loopVideo')}</span>
                            </label>
                            <div class="loop-count-row" id="edit-loop-count-row" style="${item.loop > 0 ? '' : 'display:none'}">
                                <label class="form-label">${this.__('playlists.form.loopCount')}</label>
                                <input type="number" id="edit-item-loop-count" class="form-input" value="${item.loop || 1}" min="1" max="99">
                            </div>
                        </div>
                    ` : ''}
                </form>
            `,
            confirmText: this.__('actions.save'),
            cancelText: this.__('actions.cancel'),
            onConfirm: () => {
                const name = document.getElementById('edit-item-name').value.trim();
                const duration = parseInt(document.getElementById('edit-item-duration').value) || null;

                if (!name) {
                    Toast.error(this.__('validation.requiredField', { field: this.__('playlists.form.itemName') }));
                    const nameInput = document.getElementById('edit-item-name');
                    if (nameInput) nameInput.classList.add('error');
                    nameInput?.focus();
                    throw new Error('Validation failed');
                }

                // Update item
                this.items[index].name = name;
                this.items[index].duration = duration;

                // Update URL for html/stream items
                if (isHtml || isStream) {
                    const url = document.getElementById('edit-item-url').value.trim();
                    if (!url) {
                        Toast.error(isStream ? this.__('playlists.form.streamUrlRequired') : this.__('playlists.form.webpageUrlRequired'));
                        const urlEl = document.getElementById('edit-item-url');
                        if (urlEl) urlEl.classList.add('error');
                        urlEl?.focus();
                        throw new Error('Validation failed');
                    }
                    this.items[index].url = url;
                }

                // Update loop for video items
                if (isVideo) {
                    const loopEnabled = document.getElementById('edit-item-loop').checked;
                    const loopCount = parseInt(document.getElementById('edit-item-loop-count').value) || 1;
                    this.items[index].loop = loopEnabled ? loopCount : 0;
                }

                // Re-render
                document.getElementById('playlist-items-container').innerHTML = this.renderItems();
                this.initDragDrop();
                Toast.success(this.__('playlists.form.itemUpdated'));
            }
        });

        // Handle loop checkbox toggle
        setTimeout(() => {
            const loopCheckbox = document.getElementById('edit-item-loop');
            const loopCountRow = document.getElementById('edit-loop-count-row');
            if (loopCheckbox && loopCountRow) {
                loopCheckbox.addEventListener('change', () => {
                    loopCountRow.style.display = loopCheckbox.checked ? '' : 'none';
                });
            }
        }, 100);
    }

    /**
     * Initialize drag and drop functionality for playlist items
     */
    initDragDrop() {
        const container = document.getElementById('sortable-items');
        if (!container) return;

        const items = container.querySelectorAll('.playlist-item');

        items.forEach(item => {
            // Make the drag handle draggable
            const dragHandle = item.querySelector('.playlist-item-drag');
            if (dragHandle) {
                item.setAttribute('draggable', 'true');

                // Drag start
                item.addEventListener('dragstart', (e) => {
                    item.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', item.dataset.index);
                });

                // Drag end
                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                    // Remove all drag-over classes
                    container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
                });
            }

            // Drag over
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const dragging = container.querySelector('.dragging');
                if (dragging && dragging !== item) {
                    item.classList.add('drag-over');
                }
            });

            // Drag leave
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            // Drop
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');

                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = parseInt(item.dataset.index);

                if (fromIndex !== toIndex && !isNaN(fromIndex) && !isNaN(toIndex)) {
                    this.reorderItems(fromIndex, toIndex);
                }
            });
        });

        // Also allow drop on the container itself for edge cases
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
    }

    /**
     * Reorder items after drag and drop
     */
    reorderItems(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.items.length) return;
        if (toIndex < 0 || toIndex >= this.items.length) return;

        // Remove item from old position
        const [movedItem] = this.items.splice(fromIndex, 1);

        // Insert at new position
        this.items.splice(toIndex, 0, movedItem);

        // Update order property
        this.items.forEach((item, index) => {
            item.order = index;
        });

        // Re-render
        document.getElementById('playlist-items-container').innerHTML = this.renderItems();
        this.initDragDrop();

        Logger.log('[DEBUG] Items reordered:', this.items.map(i => i.name));
    }

    updateItemDuration(index, value) {
        if (this.items[index]) {
            // Allow empty value for videos (natural duration)
            this.items[index].duration = value ? parseInt(value) : null;
        }
    }

    toggleLoop(index, enabled) {
        if (this.items[index]) {
            // When toggle is enabled, set loop to 1 (or keep current value)
            // When disabled, set loop to 0
            if (enabled) {
                this.items[index].loop = this.items[index].loop || 1;
            } else {
                this.items[index].loop = 0;
            }
            // Show/hide the loop count wrapper
            const wrapper = document.querySelector(`[data-loop-wrapper="${index}"]`);
            if (wrapper) {
                wrapper.classList.toggle('visible', enabled);
            }
        }
    }

    updateItemLoop(index, value) {
        if (this.items[index]) {
            this.items[index].loop = parseInt(value) || 0;
        }
    }

    /**
     * ✅ Toggle video muted state (ses aç/kapa)
     */
    toggleMuted(index) {
        if (this.items[index] && this.items[index].type === 'video') {
            // Toggle muted: true -> false, false -> true, undefined -> false
            const currentMuted = this.items[index].muted !== false; // Default true
            this.items[index].muted = !currentMuted;

            // Re-render to update icon
            document.getElementById('playlist-items-container').innerHTML = this.renderItems();
            this.initDragDrop();
        }
    }

    async save() {
        Logger.log('[DEBUG] save() called');
        Logger.log('[DEBUG] Current playlist:', this.playlist);
        Logger.log('[DEBUG] Current items:', this.items);

        const name = document.getElementById('playlist-name')?.value.trim();
        const description = document.getElementById('playlist-description')?.value.trim();
        const status = document.getElementById('playlist-status')?.value;
        const defaultDuration = parseInt(document.getElementById('playlist-duration')?.value) || 10;
        const orientation = document.getElementById('playlist-orientation')?.value;
        const layoutType = document.getElementById('playlist-layout')?.value;
        const transitionType = document.getElementById('playlist-transition')?.value || 'none';
        const transitionDuration = parseInt(document.getElementById('playlist-transition-duration')?.value) || 500;

        Logger.log('[DEBUG] Form values:', { name, description, status, defaultDuration, orientation, layoutType, transitionType, transitionDuration });

        if (!name) {
            Toast.error(this.__('validation.requiredField', { field: this.__('playlists.form.fields.name') }));
            const nameInput = document.getElementById('playlist-name');
            if (nameInput) nameInput.classList.add('error');
            nameInput?.focus();
            return;
        }

        const data = {
            name,
            description,
            status,
            default_duration: defaultDuration,
            orientation,
            layout_type: layoutType,
            transition_type: transitionType,
            transition_duration: transitionDuration,
            items: this.items.map((item, index) => ({
                media_id: item.media_id || null,
                template_id: item.template_id || null,
                type: item.type, // 'image', 'video', 'template', 'html', or 'stream'
                url: item.url || null, // For html/webpage/stream items
                name: item.name || null, // Display name
                duration: item.duration,
                loop: parseInt(item.loop) || 0,
                muted: (item.type === 'video' || item.type === 'stream') ? (item.muted !== false) : undefined,
                order: index
            }))
        };

        Logger.log('[DEBUG] Data to save:', data);
        Logger.log('[DEBUG] Will update:', !!this.playlist?.id, 'Playlist ID:', this.playlist?.id);

        try {
            if (this.playlist?.id) {
                Logger.log('[DEBUG] Calling PUT /playlists/' + this.playlist.id);
                const response = await this.app.api.put(`/playlists/${this.playlist.id}`, data);
                Logger.log('[DEBUG] Update response:', response);
                Toast.success(this.__('playlists.toast.updated'));
            } else {
                Logger.log('[DEBUG] Calling POST /playlists');
                const response = await this.app.api.post('/playlists', data);
                Logger.log('[DEBUG] Create response:', response);
                Toast.success(this.__('playlists.toast.created'));
            }
            window.location.hash = '#/signage/playlists';
        } catch (error) {
            Logger.error('[DEBUG] Save error:', error);
            Toast.error(this.__('messages.saveFailed') + ': ' + (error.message || ''));
        }
    }

    addStyles() {
        if (document.getElementById('playlist-detail-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'playlist-detail-styles';
        styles.textContent = `
            .field-label-with-help {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
            }

            .field-help-button {
                width: 1.35rem;
                height: 1.35rem;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid var(--border-color);
                border-radius: 999px;
                background: var(--bg-secondary);
                color: var(--color-warning);
                font-size: 0.75rem;
                font-weight: 700;
                line-height: 1;
                cursor: pointer;
                transition: all 0.2s;
            }

            .field-help-button:hover,
            .field-help-button:focus-visible {
                border-color: var(--color-warning);
                background: var(--color-warning-light, rgba(245, 158, 11, 0.12));
                color: var(--color-warning);
                outline: none;
            }

            .playlist-help-modal {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .playlist-help-intro {
                margin: 0;
                color: var(--text-secondary);
                line-height: 1.6;
            }

            .playlist-help-list {
                display: flex;
                flex-direction: column;
                gap: 0.875rem;
            }

            .playlist-help-item {
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
                padding: 0.9rem;
                border: 1px solid var(--border-color);
                border-radius: var(--radius-lg);
                background: var(--bg-secondary);
            }

            .playlist-help-badge {
                flex: 0 0 1.5rem;
                width: 1.5rem;
                height: 1.5rem;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 999px;
                background: var(--color-warning);
                color: #fff;
                font-size: 0.8rem;
                font-weight: 700;
                line-height: 1;
            }

            .playlist-help-copy strong {
                display: block;
                margin-bottom: 0.25rem;
                color: var(--text-primary);
            }

            .playlist-help-copy p {
                margin: 0;
                color: var(--text-secondary);
                line-height: 1.5;
            }

            /* Media Library Sub-tabs */
            .playlist-media-library {
                display: flex;
                flex-direction: column;
            }

            .media-library-subtabs {
                display: flex;
                gap: 4px;
                padding: 8px;
                background: var(--bg-secondary);
                border-radius: var(--radius-md);
            }

            .media-library-subtab {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 16px;
                background: transparent;
                border: none;
                border-radius: var(--radius-sm);
                font-size: 0.8rem;
                font-weight: 500;
                color: var(--text-muted);
                cursor: pointer;
                transition: all 0.2s;
            }

            .media-library-subtab:hover {
                background: var(--bg-tertiary);
                color: var(--text-primary);
            }

            .media-library-subtab.active {
                background: var(--color-primary);
                color: white;
            }

            .media-library-subtab i {
                font-size: 1rem;
            }

            /* Media Library Toolbar */
            .media-library-toolbar {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .media-library-search {
                flex: 1;
                min-width: 150px;
                max-width: 280px;
                position: relative;
            }

            .media-library-search i {
                position: absolute;
                left: 10px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-muted);
                font-size: 0.875rem;
                pointer-events: none;
            }

            .media-library-search input {
                width: 100%;
                padding: 6px 10px 6px 32px;
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
                background: var(--bg-primary);
                font-size: 0.8rem;
                color: var(--text-primary);
            }

            .media-library-search input:focus {
                outline: none;
                border-color: var(--color-primary);
            }

            .media-library-content {
                flex: 1;
                max-height: 380px;
                overflow-y: auto;
                padding: 4px;
            }

            /* Video icon overlay */
            .media-video-icon {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 32px;
                height: 32px;
                background: rgba(0, 0, 0, 0.6);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 0.9rem;
            }

            .media-item-preview {
                position: relative;
            }

            /* Breadcrumb */
            .media-library-breadcrumb {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 8px 12px;
                margin-bottom: 12px;
                background: var(--bg-secondary);
                border-radius: var(--radius-md);
                flex-wrap: wrap;
            }

            .media-breadcrumb-item {
                display: flex;
                align-items: center;
                padding: 4px 8px;
                background: transparent;
                border: none;
                border-radius: var(--radius-sm);
                font-size: 0.8rem;
                color: var(--text-muted);
                cursor: pointer;
                transition: all 0.2s;
            }

            .media-breadcrumb-item:hover {
                background: var(--bg-tertiary);
                color: var(--color-primary);
            }

            .media-breadcrumb-home {
                color: var(--color-primary);
            }

            .media-breadcrumb-separator {
                color: var(--text-muted);
                font-size: 0.7rem;
            }

            /* Folder Items - products.css ile uyumlu */
            .media-folder-item {
                cursor: pointer;
            }

            .media-folder-item:hover {
                border-color: var(--color-warning);
            }

            .media-folder-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, var(--color-warning-light, #fff3cd) 0%, #ffeeba 100%);
                color: var(--color-warning);
                font-size: 2.5rem;
            }

            .dark .media-folder-icon {
                background: linear-gradient(135deg, rgba(250, 176, 5, 0.2) 0%, rgba(250, 176, 5, 0.1) 100%);
            }

            .media-folder-item:hover .media-folder-icon {
                transform: scale(1.02);
            }

            .media-folder-item .media-folder-name {
                background: linear-gradient(transparent, rgba(0,0,0,0.5));
            }

            /* Footer */
            .media-library-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 0;
                margin-top: 12px;
                border-top: 1px solid var(--border-color);
            }

            .media-library-selected-info {
                font-size: 0.8rem;
                color: var(--text-muted);
            }

            /* Pagination */
            .media-library-pagination {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .media-pagination-info {
                font-size: 0.8rem;
                color: var(--text-muted);
                min-width: 80px;
                text-align: center;
            }

            .playlist-items-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .playlist-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
                min-height: 69px;
            }

            .playlist-item-drag {
                cursor: grab;
                color: var(--text-muted);
                padding: 8px;
                margin: -8px;
            }

            .playlist-item-drag:active {
                cursor: grabbing;
            }

            .playlist-item.dragging {
                opacity: 0.5;
                border-color: var(--color-primary);
                background: var(--color-primary-bg, rgba(34, 139, 230, 0.1));
            }

            .playlist-item.drag-over {
                border-color: var(--color-primary);
                border-style: dashed;
                transform: scale(1.02);
            }

            .playlist-item-preview {
                position: relative;
                width: 80px;
                min-width: 80px;
                height: 45px;
                min-height: 45px;
                flex-shrink: 0;
                border-radius: var(--radius-sm);
                overflow: hidden;
                background: var(--bg-tertiary);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .playlist-item-preview img,
            .playlist-item-preview video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
                opacity: 0;
                transition: opacity 0.2s;
            }

            /* Loading skeleton for previews */
            .preview-loading {
                position: absolute;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
            }

            @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            .playlist-item-info {
                flex: 1;
            }

            .playlist-item-info h4 {
                font-size: 0.875rem;
                font-weight: 500;
                margin: 0;
            }

            .playlist-item-info p {
                font-size: 0.75rem;
                color: var(--text-muted);
                margin: 0;
            }

            .playlist-item-duration {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .playlist-item-duration input {
                width: 60px;
                text-align: center;
            }

            .playlist-item-duration span {
                font-size: 0.75rem;
                color: var(--text-muted);
            }

            .playlist-item-loop {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .toggle-label {
                display: flex;
                align-items: center;
                cursor: pointer;
                user-select: none;
            }

            .toggle-input {
                display: none;
            }

            .toggle-switch {
                position: relative;
                width: 32px;
                height: 18px;
                background: var(--bg-tertiary);
                border-radius: 9px;
                transition: background 0.2s;
            }

            .toggle-switch::after {
                content: '';
                position: absolute;
                top: 2px;
                left: 2px;
                width: 14px;
                height: 14px;
                background: white;
                border-radius: 50%;
                transition: transform 0.2s;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            }

            .toggle-input:checked + .toggle-switch {
                background: var(--color-primary);
            }

            .toggle-input:checked + .toggle-switch::after {
                transform: translateX(14px);
            }

            .loop-count-wrapper {
                display: none;
                align-items: center;
                gap: 4px;
            }

            .loop-count-wrapper.visible {
                display: flex;
            }

            .loop-count-input {
                width: 45px !important;
                text-align: center;
                padding: 4px !important;
                font-size: 0.8rem;
            }

            .loop-label {
                font-size: 0.8rem;
                color: var(--text-muted);
            }

            .playlist-items-hint {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 10px 12px;
                margin-bottom: 16px;
                background: var(--color-info-bg, rgba(34, 139, 230, 0.1));
                border: 1px solid var(--color-info, #228be6);
                border-radius: var(--radius-md);
                font-size: 0.8rem;
                color: var(--color-info, #228be6);
            }

            .playlist-items-hint i {
                flex-shrink: 0;
                margin-top: 2px;
            }

            .media-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 12px;
            }

            .media-item {
                position: relative;
                aspect-ratio: 1;
                border: 2px solid var(--border-color);
                border-radius: var(--radius-md);
                overflow: hidden;
                cursor: pointer;
                transition: all var(--transition-fast);
                background: var(--bg-secondary);
            }

            .media-item:hover {
                border-color: var(--color-primary);
                transform: scale(1.02);
            }

            .media-item.selected {
                border-color: var(--color-primary);
                box-shadow: 0 0 0 3px rgba(51, 154, 240, 0.3);
            }

            .media-item-preview {
                width: 100%;
                height: 100%;
                background: var(--bg-tertiary);
                position: relative;
            }

            .media-item-preview img,
            .media-item-preview video {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .media-item-name {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                padding: 6px 8px;
                background: linear-gradient(transparent, rgba(0,0,0,0.7));
                color: #fff;
                font-size: 0.7rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .media-item-check {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 22px;
                height: 22px;
                background: var(--color-primary);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
            }

            .template-preview-card {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
            }

            .template-preview-image {
                width: 120px;
                height: 68px;
                object-fit: cover;
                border-radius: var(--radius-sm);
            }

            .template-preview-placeholder {
                width: 120px;
                height: 68px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: var(--bg-tertiary);
                border-radius: var(--radius-sm);
                color: var(--text-muted);
                font-size: 0.75rem;
            }

            .template-preview-placeholder i {
                font-size: 1.5rem;
                margin-bottom: 4px;
            }

            .template-preview-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .template-preview-name {
                font-weight: 500;
            }

            .template-preview-size {
                font-size: 0.75rem;
                color: var(--text-muted);
            }

            /* Content Modal Tabs */
            .content-modal-tabs {
                display: flex;
                gap: 4px;
                padding: 12px;
                background: var(--bg-secondary);
                border-bottom: 1px solid var(--border-color);
                margin: -16px -16px 0 -16px;
            }

            /* Content Library Container - Fixed height to prevent modal resize */
            #content-library-container {
                min-height: 480px;
                padding-top: 12px;
            }

            .content-tab {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 20px;
                background: transparent;
                border: none;
                border-radius: var(--radius-md);
                font-size: 0.875rem;
                font-weight: 500;
                color: var(--text-muted);
                cursor: pointer;
                transition: background 0.2s, color 0.15s;
            }

            .content-tab:hover:not(.active) {
                background: var(--bg-tertiary);
                color: var(--text-primary);
            }

            .content-tab.active,
            .content-tab.active:hover {
                background: var(--color-primary);
                color: white;
            }

            .content-tab i {
                font-size: 1.1rem;
            }

            /* Template Grid */
            .template-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 16px;
            }

            .template-item {
                position: relative;
                border: 2px solid var(--border-color);
                border-radius: var(--radius-md);
                overflow: hidden;
                cursor: pointer;
                transition: all 0.2s;
                background: var(--bg-secondary);
            }

            .template-item:hover {
                border-color: var(--color-primary);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }

            .template-item.selected {
                border-color: var(--color-primary);
                background: rgba(34, 139, 230, 0.1);
            }

            .template-item-preview {
                aspect-ratio: 16/9;
                background: var(--bg-tertiary);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .template-item-preview img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .template-placeholder {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: var(--text-muted);
            }

            .template-placeholder i {
                font-size: 2rem;
            }

            .template-placeholder-sm {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
                background: var(--bg-tertiary);
                color: var(--text-muted);
            }

            .template-placeholder-sm i {
                font-size: 1.25rem;
            }

            .template-item-info {
                padding: 10px 12px;
            }

            .template-item-name {
                font-size: 0.8rem;
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 6px;
            }

            .template-item-meta {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .template-type-badge {
                display: inline-flex;
                align-items: center;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 0.65rem;
                font-weight: 600;
                text-transform: uppercase;
            }

            .template-type-badge.signage {
                background: rgba(139, 92, 246, 0.15);
                color: #8b5cf6;
            }

            .template-type-badge.tv {
                background: rgba(16, 185, 129, 0.15);
                color: #10b981;
            }

            .template-size {
                font-size: 0.7rem;
                color: var(--text-muted);
            }

            .template-item-check {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 24px;
                height: 24px;
                background: var(--color-primary);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* Item type badge in playlist list */
            .item-type-badge {
                display: inline-flex;
                align-items: center;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 0.65rem;
                font-weight: 600;
            }

            .item-type-badge.template {
                background: rgba(139, 92, 246, 0.15);
                color: #8b5cf6;
            }

            .template-item-row {
                border-left: 3px solid #8b5cf6;
            }

            /* Webpage styles */
            .item-type-badge.webpage {
                background: rgba(59, 130, 246, 0.15);
                color: #3b82f6;
            }

            .webpage-item-row {
                border-left: 3px solid #3b82f6;
            }

            .webpage-placeholder-sm {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
            }

            .webpage-placeholder-sm i {
                font-size: 1.5rem;
            }

            /* Web page form */
            .webpage-form {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                padding: 20px;
            }

            .webpage-form-icon {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 16px;
            }

            .webpage-form-icon i {
                font-size: 2.5rem;
                color: white;
            }

            .webpage-form h3 {
                font-size: 1.25rem;
                font-weight: 600;
                margin-bottom: 8px;
            }

            .webpage-form-hint {
                color: var(--text-muted);
                font-size: 0.875rem;
                margin-bottom: 24px;
                max-width: 400px;
            }

            .webpage-form .form-group {
                width: 100%;
                max-width: 400px;
                text-align: left;
                margin-bottom: 16px;
            }

            .webpage-form .btn-primary {
                margin-top: 8px;
            }

            .webpage-warning {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 12px 16px;
                margin-top: 24px;
                background: rgba(251, 191, 36, 0.1);
                border: 1px solid rgba(251, 191, 36, 0.3);
                border-radius: var(--radius-md);
                font-size: 0.8rem;
                color: #b45309;
                text-align: left;
                max-width: 400px;
            }

            .webpage-warning i {
                flex-shrink: 0;
                color: #f59e0b;
            }

            /* Stream form */
            .stream-form {
                padding: 40px 20px;
                text-align: center;
            }

            .stream-form-icon {
                width: 64px;
                height: 64px;
                border-radius: 16px;
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.2));
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 16px;
            }

            .stream-form-icon i {
                font-size: 1.75rem;
                color: #ef4444;
            }

            .stream-form h3 { margin-bottom: 4px; }

            .stream-form-hint {
                color: var(--text-muted);
                font-size: 0.85rem;
                margin-bottom: 20px;
            }

            .stream-form .form-group {
                width: 100%;
                max-width: 400px;
                text-align: left;
                margin: 0 auto 16px;
            }

            .stream-form .btn-primary {
                margin-top: 8px;
            }

            .stream-formats {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 12px 16px;
                margin: 24px auto 0;
                background: rgba(59, 130, 246, 0.08);
                border: 1px solid rgba(59, 130, 246, 0.2);
                border-radius: var(--radius-md);
                font-size: 0.8rem;
                color: #1d4ed8;
                text-align: left;
                max-width: 400px;
            }

            .stream-formats i {
                flex-shrink: 0;
                color: #3b82f6;
            }

            .item-type-badge.stream {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
                border: 1px solid rgba(239, 68, 68, 0.3);
            }

            .stream-placeholder-sm {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(239, 68, 68, 0.08);
                border-radius: 4px;
            }

            .stream-placeholder-sm i {
                font-size: 1.25rem;
                color: #ef4444;
            }

            .stream-item-row {
                border-left: 3px solid #ef4444;
            }

            /* Input with suffix */
            .input-with-suffix {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .input-with-suffix .form-input {
                width: 100px;
            }

            .input-suffix {
                font-size: 0.875rem;
                color: var(--text-muted);
            }

            @media (max-width: 768px) {
                .playlist-item {
                    flex-wrap: wrap;
                }

                .playlist-item-preview {
                    width: 60px;
                    height: 34px;
                }

                .media-grid {
                    grid-template-columns: repeat(2, 1fr);
                }

                .template-preview-card {
                    flex-direction: column;
                    align-items: flex-start;
                }

                .template-preview-image {
                    width: 100%;
                    height: auto;
                    aspect-ratio: 16/9;
                }

                .template-preview-placeholder {
                    width: 100%;
                    height: auto;
                    aspect-ratio: 16/9;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    destroy() {
        window.playlistDetailPage = null;
        if (this.contentModal) {
            Modal.close(this.contentModal.id);
        }
        this.app.i18n.clearPageTranslations();
    }
}

export default PlaylistDetailPage;
