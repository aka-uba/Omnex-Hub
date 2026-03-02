/**
 * Omnex Display Hub - Media Library Plugin for VvvebJs
 * Omnex medya kütüphanesi entegrasyonu
 *
 * Özellikler:
 * - Firma medya kütüphanesi
 * - Ortak (public) medya kütüphanesi
 * - Scope bazlı filtreleme (company, public, all)
 * - JWT token authentication
 * - Türkçe arayüz
 */

(function() {
    'use strict';

    // Omnex API Configuration
    const OmnexConfig = {
        apiUrl: window.OmnexConfig?.apiUrl || '/market-etiket-sistemi/api',
        basePath: window.OmnexConfig?.basePath || '/market-etiket-sistemi',
        get mediaApiUrl() {
            return this.apiUrl + '/media';
        }
    };

    // Get auth token
    function getAuthToken() {
        return localStorage.getItem('omnex_token') ||
               sessionStorage.getItem('omnex_token') ||
               localStorage.getItem('token') ||
               sessionStorage.getItem('token') || '';
    }

    // Translations
    const tr = {
        mediaLibrary: 'Medya Kütüphanesi',
        companyMedia: 'Firma Medyası',
        publicMedia: 'Ortak Medya',
        allMedia: 'Tümü',
        searchPlaceholder: 'Dosya ara...',
        uploadFile: 'Dosya Yükle',
        dropFilesHere: 'Dosyaları buraya sürükleyin veya seçin',
        noFilesFound: 'Dosya bulunamadı',
        cancel: 'İptal',
        select: 'Seç',
        addSelected: 'Seçileni Ekle',
        loading: 'Yükleniyor...',
        uploadSuccess: 'Dosya başarıyla yüklendi',
        uploadError: 'Dosya yüklenirken hata oluştu',
        deleteConfirm: 'Bu dosyayı silmek istediğinize emin misiniz?',
        images: 'Görseller',
        videos: 'Videolar',
        documents: 'Dökümanlar',
        all: 'Tümü',
        size: 'Boyut',
        date: 'Tarih',
        name: 'Ad',
        type: 'Tür',
        home: 'Ana Dizin',
        empty: 'Klasör boş',
        item: 'öge',
        items: 'öge',
        preview: 'Önizleme',
        delete: 'Sil',
        rename: 'Yeniden Adlandır',
        mediaNotAccessible: 'Medya kütüphanesine erişilemiyor. Lütfen giriş yapın.',
        authRequired: 'Oturum Gerekli'
    };

    // Omnex modal HTML
    const omnexModalHtml = `
    <div class="modal fade modal-full" id="MediaModal" tabindex="-1" role="dialog" aria-labelledby="MediaModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-scrollable" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title fw-normal" id="MediaModalLabel">
                <i class="la la-images me-2"></i>${tr.mediaLibrary}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="filemanager omnex-media-manager">

                <!-- Scope Tabs -->
                <div class="omnex-media-tabs mb-3">
                    <ul class="nav nav-tabs" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" data-scope="all" type="button">
                                <i class="la la-layer-group"></i> ${tr.allMedia}
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" data-scope="company" type="button">
                                <i class="la la-building"></i> ${tr.companyMedia}
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" data-scope="public" type="button">
                                <i class="la la-globe"></i> ${tr.publicMedia}
                            </button>
                        </li>
                    </ul>
                </div>

                <!-- Top toolbar -->
                <div class="top-right d-flex justify-content-between mb-3">
                    <div class="d-flex gap-2">
                        <!-- Type filter -->
                        <select class="form-select form-select-sm omnex-type-filter" style="width:auto;">
                            <option value="image">${tr.images}</option>
                            <option value="video">${tr.videos}</option>
                            <option value="all">${tr.all}</option>
                        </select>
                    </div>

                    <div class="d-flex gap-2">
                        <div class="search">
                            <input type="search" class="form-control form-control-sm" id="omnex-media-search" placeholder="${tr.searchPlaceholder}" />
                        </div>
                        <button class="btn btn-outline-primary btn-sm btn-icon"
                           data-bs-toggle="collapse"
                           data-bs-target=".upload-collapse"
                           aria-expanded="false">
                           <i class="la la-upload la-lg"></i>
                           ${tr.uploadFile}
                        </button>
                    </div>
                </div>

                <!-- Upload panel -->
                <div class="top-panel">
                    <div class="upload-collapse collapse">
                        <button id="upload-close" type="button" class="btn btn-sm btn-light" aria-label="Close" data-bs-toggle="collapse" data-bs-target=".upload-collapse" aria-expanded="true">
                           <span aria-hidden="true"><i class="la la-times la-lg"></i></span>
                        </button>
                       <h3>${tr.dropFilesHere}</h3>
                       <input type="file" multiple class="" accept="image/*,video/*">
                        <div class="status"></div>
                    </div>
                </div>

                <!-- Media grid -->
                <div class="display-panel">
                    <div class="omnex-loading" style="display:none;">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">${tr.loading}</span>
                        </div>
                    </div>

                    <ul class="data omnex-media-grid" id="media-files"></ul>

                    <div class="nothingfound" style="display:none;">
                        <div class="nofiles">
                            <i class="la la-folder-open"></i>
                        </div>
                        <div>${tr.noFilesFound}</div>
                        <p class="text-muted mt-2">${tr.mediaNotAccessible}</p>
                        <div class="mt-4">
                            <button class="btn btn-outline-primary btn-sm btn-icon" data-bs-toggle="collapse" data-bs-target=".upload-collapse" aria-expanded="false">
                            <i class="la la-upload la-lg"></i>
                            ${tr.uploadFile}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          </div>
          <div class="modal-footer justify-content-between">
            <div class="align-left">
                <span class="omnex-selected-info text-muted"></span>
            </div>
            <div class="align-right">
                <button type="button" class="btn btn-secondary btn-icon me-1" data-bs-dismiss="modal">
                    <i class="la la-times"></i>
                    <span>${tr.cancel}</span>
                </button>
                <button type="button" class="btn btn-primary btn-icon save-btn">
                    <i class="la la-check"></i>
                    <span>${tr.addSelected}</span>
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;

    /**
     * Omnex Media Modal - Standalone implementation (not extending MediaModal)
     * To avoid getter/setter issues with parent class
     */
    class OmnexMediaModal {
        constructor(modal = true) {
            this.isInit = false;
            this.isModal = modal;
            this.modalHtml = omnexModalHtml;
            this.response = [];
            this.currentPath = '';
            this.breadcrumbsUrls = [];
            this.filemanager = null;
            this.breadcrumbs = null;
            this.fileList = null;
            this.mediaPath = '/media/';
            this.type = 'single';
            this.container = document.getElementById("MediaModal");

            // Omnex specific
            this.scope = 'all'; // all, company, public
            this.mediaType = 'image'; // image, video, all
            this.omnexMedia = [];
            this.currentPage = 1;
            this.hasMore = true;
            this.isLoading = false;
        }

        // Add modal HTML
        addModalHtml() {
            if (this.isModal) {
                document.body.insertAdjacentHTML('beforeend', this.modalHtml);
            }
            this.container = document.getElementById("MediaModal");
            this.container.querySelector(".save-btn").addEventListener("click", () => this.save());

            // Bind scope tabs
            this.container.querySelectorAll('[data-scope]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.container.querySelectorAll('[data-scope]').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    this.scope = e.target.dataset.scope;
                    this.currentPage = 1;
                    this.loadOmnexMedia();
                });
            });

            // Bind type filter
            this.container.querySelector('.omnex-type-filter')?.addEventListener('change', (e) => {
                this.mediaType = e.target.value;
                this.currentPage = 1;
                this.loadOmnexMedia();
            });

            // Bind search
            let searchTimeout;
            this.container.querySelector('#omnex-media-search')?.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.currentPage = 1;
                    this.loadOmnexMedia(e.target.value);
                }, 300);
            });
        }

        showUploadLoading() {
            const status = this.container?.querySelector(".upload-collapse .status");
            if (status) {
                status.innerHTML = `
                <div class="spinner-border" style="width: 5rem; height: 5rem;margin: 5rem auto; display:block" role="status">
                  <span class="visually-hidden">${tr.loading}</span>
                </div>`;
            }
        }

        hideUploadLoading() {
            const status = this.container?.querySelector(".upload-collapse .status");
            if (status) {
                status.innerHTML = '';
            }
        }

        save() {
            const checkedInput = this.container.querySelector(".files input:checked");
            let file = checkedInput?.value ?? false;
            let src = file;

            if (!file) return;

            // Get full URL from hidden input
            const hiddenInput = checkedInput?.closest('label')?.querySelector('input[type="hidden"]');
            if (hiddenInput) {
                src = hiddenInput.value;
            }

            if (this.targetThumb) {
                const thumbEl = document.querySelector(this.targetThumb);
                if (thumbEl) thumbEl.setAttribute("src", src);
            }

            if (this.callback) {
                this.callback(src);
            }

            if (this.targetInput) {
                let input = document.querySelector(this.targetInput);
                if (input) {
                    input.value = src;
                    const e = new Event("change", {bubbles: true});
                    input.dispatchEvent(e);
                }
            }

            let modal = bootstrap.Modal.getOrCreateInstance(this.container);
            if (this.isModal) modal.hide();
        }

        init() {
            if (!this.isInit) {
                if (this.isModal) this.addModalHtml();
                this.initGallery();
                this.isInit = true;

                // Bind file upload
                this.container.querySelector(".filemanager input[type=file]")?.addEventListener("change", (e) => this.onOmnexUpload(e));

                const event = new CustomEvent("mediaModal:init", {
                    detail: { type: this.type, targetInput: this.targetInput, targetThumb: this.targetThumb, callback: this.callback }
                });
                window.dispatchEvent(event);
            }
        }

        open(element, callback) {
            if (element instanceof Element) {
                this.targetInput = element.dataset.targetInput;
                this.targetThumb = element.dataset.targetThumb;
                if (element.dataset.type) {
                    this.type = element.dataset.type;
                }
            } else if (element) {
                this.targetInput = element.targetInput;
                this.targetThumb = element.targetThumb;
                if (element.type) {
                    this.type = element.type;
                }
            }

            this.callback = callback;
            this.init();

            let modal = bootstrap.Modal.getOrCreateInstance(this.container);
            if (this.isModal) modal.show();
        }

        // Initialize gallery
        initGallery() {
            this.filemanager = this.container.querySelector('.filemanager');
            this.fileList = this.filemanager.querySelector('.data');

            // Load Omnex media
            this.loadOmnexMedia();
        }

        // Load media from Omnex API
        async loadOmnexMedia(search = '') {
            if (this.isLoading) return;

            this.isLoading = true;
            this.showLoading();

            try {
                const token = getAuthToken();
                const params = new URLSearchParams({
                    page: this.currentPage,
                    limit: 30,
                    scope: this.scope
                });

                if (this.mediaType !== 'all') {
                    params.append('type', this.mediaType);
                }

                if (search) {
                    params.append('search', search);
                }

                const response = await fetch(`${OmnexConfig.mediaApiUrl}?${params}`, {
                    headers: {
                        'Authorization': token ? `Bearer ${token}` : '',
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (data.success && data.data) {
                    this.omnexMedia = Array.isArray(data.data) ? data.data : (data.data.items || []);
                    this.renderOmnexMedia();
                } else {
                    this.omnexMedia = [];
                    this.showEmpty();
                }
            } catch (error) {
                console.error('Omnex Media API Error:', error);
                this.omnexMedia = [];
                this.showEmpty();
            } finally {
                this.isLoading = false;
                this.hideLoading();
            }
        }

        // Render media grid
        renderOmnexMedia() {
            this.fileList.innerHTML = '';

            if (!this.omnexMedia.length) {
                this.showEmpty();
                return;
            }

            this.hideEmpty();

            this.omnexMedia.forEach(item => {
                const fileEl = this.createOmnexFileElement(item);
                this.fileList.appendChild(fileEl);
            });
        }

        // Create file element
        createOmnexFileElement(item) {
            const isImage = item.type === 'image' || /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(item.name || item.filename || '');
            const isVideo = item.type === 'video' || /\.(mp4|webm|ogg|mov)$/i.test(item.name || item.filename || '');

            const name = this.escapeHTML(item.name || item.filename || 'Untitled');
            const path = item.path || item.url || '';
            const fullUrl = path.startsWith('http') ? path : OmnexConfig.basePath + path;
            const thumbUrl = item.thumbnail || fullUrl;
            const size = this.bytesToSize(item.size || 0);
            const scope = item.scope || (item.is_public ? 'public' : 'company');

            let icon;
            if (isImage) {
                icon = `<img class="image" loading="lazy" src="${thumbUrl}" alt="${name}">`;
            } else if (isVideo) {
                icon = `<div class="video-thumb"><i class="la la-play-circle"></i></div>`;
            } else {
                const ext = name.split('.').pop();
                icon = `<span class="icon file f-${ext}">.${ext}</span>`;
            }

            const scopeBadge = scope === 'public'
                ? '<span class="badge bg-info badge-scope"><i class="la la-globe"></i></span>'
                : '<span class="badge bg-secondary badge-scope"><i class="la la-building"></i></span>';

            const li = document.createElement('li');
            li.className = 'files omnex-media-item';
            li.innerHTML = `
                <label class="form-check">
                    <input type="hidden" value="${fullUrl}" name="filename[]">
                    <input type="${this.type === 'single' ? 'radio' : 'checkbox'}" class="form-check-input" value="${path}" name="file[]">
                    <span class="form-check-label"></span>
                    <div class="files">
                        ${icon}
                        ${scopeBadge}
                        <div class="info">
                            <div class="name" title="${name}">${name}</div>
                            <span class="details">${size}</span>
                        </div>
                    </div>
                </label>
            `;

            return li;
        }

        // Upload file to Omnex
        async onOmnexUpload(event) {
            const files = event.target.files;
            if (!files || !files.length) return;

            this.showUploadLoading();

            for (const file of files) {
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('scope', 'company');

                    const token = getAuthToken();
                    const response = await fetch(`${OmnexConfig.mediaApiUrl}/upload`, {
                        method: 'POST',
                        headers: {
                            'Authorization': token ? `Bearer ${token}` : ''
                        },
                        body: formData
                    });

                    const data = await response.json();

                    if (data.success) {
                        if (typeof displayToast === 'function') {
                            displayToast('bg-success', tr.uploadSuccess, file.name);
                        }
                    } else {
                        if (typeof displayToast === 'function') {
                            displayToast('bg-danger', tr.uploadError, data.message || file.name);
                        }
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    if (typeof displayToast === 'function') {
                        displayToast('bg-danger', tr.uploadError, file.name);
                    }
                }
            }

            this.hideUploadLoading();
            this.loadOmnexMedia();
            event.target.value = '';
        }

        showLoading() {
            this.container?.querySelector('.omnex-loading')?.style.setProperty('display', 'flex');
        }

        hideLoading() {
            this.container?.querySelector('.omnex-loading')?.style.setProperty('display', 'none');
        }

        showEmpty() {
            this.filemanager?.querySelector('.nothingfound')?.style.setProperty('display', '');
        }

        hideEmpty() {
            this.filemanager?.querySelector('.nothingfound')?.style.setProperty('display', 'none');
        }

        // Utility: Escape HTML
        escapeHTML(text) {
            return text.replace(/\&/g,'&amp;').replace(/\</g,'&lt;').replace(/\>/g,'&gt;');
        }

        // Utility: Bytes to human readable size
        bytesToSize(bytes) {
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            if (bytes == 0) return '0 Bytes';
            const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
            return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
        }
    }

    // Make available globally
    window.OmnexMediaModal = OmnexMediaModal;

    // Override ImageInput.onClick to use OmnexMediaModal
    if (typeof ImageInput !== 'undefined') {
        ImageInput.onClick = function(e, element) {
            if (!Vvveb.MediaModal || !(Vvveb.MediaModal instanceof OmnexMediaModal)) {
                Vvveb.MediaModal = new OmnexMediaModal(true);
            }
            Vvveb.MediaModal.mediaType = 'image';
            Vvveb.MediaModal.open(this.closest("[data-target-input]"));
        };
    }

    // Override VideoInput.onClick to use OmnexMediaModal
    if (typeof VideoInput !== 'undefined') {
        VideoInput.onClick = function(e, element) {
            if (!Vvveb.MediaModal || !(Vvveb.MediaModal instanceof OmnexMediaModal)) {
                Vvveb.MediaModal = new OmnexMediaModal(true);
            }
            Vvveb.MediaModal.mediaType = 'video';
            Vvveb.MediaModal.open(this.closest("[data-target-input]"));
        };
    }

    // Add custom CSS for Omnex media modal
    const omnexMediaCSS = `
    <style>
    .omnex-media-manager .omnex-media-tabs .nav-link {
        color: #666;
        border: none;
        padding: 0.5rem 1rem;
    }
    .omnex-media-manager .omnex-media-tabs .nav-link.active {
        color: #228be6;
        border-bottom: 2px solid #228be6;
        background: transparent;
    }
    .omnex-media-manager .omnex-media-tabs .nav-link i {
        margin-right: 0.5rem;
    }
    .omnex-media-manager .omnex-media-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
        padding: 1rem 0;
    }
    .omnex-media-manager .omnex-media-item {
        position: relative;
        border: 2px solid #e9ecef;
        border-radius: 8px;
        overflow: hidden;
        transition: all 0.2s;
        background: #fff;
    }
    .omnex-media-manager .omnex-media-item:hover {
        border-color: #228be6;
        box-shadow: 0 4px 12px rgba(34, 139, 230, 0.15);
    }
    .omnex-media-manager .omnex-media-item .form-check {
        margin: 0;
        padding: 0;
    }
    .omnex-media-manager .omnex-media-item .form-check-input {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 10;
    }
    .omnex-media-manager .omnex-media-item .image {
        width: 100%;
        height: 120px;
        object-fit: cover;
        display: block;
    }
    .omnex-media-manager .omnex-media-item .video-thumb {
        width: 100%;
        height: 120px;
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .omnex-media-manager .omnex-media-item .video-thumb i {
        font-size: 3rem;
        color: #fff;
        opacity: 0.8;
    }
    .omnex-media-manager .omnex-media-item .info {
        padding: 0.5rem;
        background: #f8f9fa;
    }
    .omnex-media-manager .omnex-media-item .name {
        font-size: 0.75rem;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #212529;
    }
    .omnex-media-manager .omnex-media-item .details {
        font-size: 0.7rem;
        color: #6c757d;
    }
    .omnex-media-manager .omnex-media-item .badge-scope {
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 0.65rem;
        padding: 0.2rem 0.4rem;
    }
    .omnex-media-manager .omnex-loading {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 200px;
    }
    .omnex-media-manager .nothingfound {
        text-align: center;
        padding: 3rem;
        color: #6c757d;
    }
    .omnex-media-manager .nothingfound i {
        font-size: 4rem;
        opacity: 0.5;
    }
    </style>
    `;
    document.head.insertAdjacentHTML('beforeend', omnexMediaCSS);

    console.log('Omnex Media Plugin loaded - MediaModal overridden with Omnex integration');

})();
