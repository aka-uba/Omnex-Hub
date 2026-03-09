/**
 * Template Editor Wrapper
 *
 * Fabric.js v7 tabanlı template editor wrapper.
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

import { DevicePresets, PresetCategories, GridLayouts, getGroupedPresets, getAllGridLayouts } from '../../editor/config/DevicePresets.js';
import { Toast } from '../../components/Toast.js';
import { Modal } from '../../components/Modal.js';
import { init as initMediaPicker } from '../products/form/MediaPicker.js';
import { Logger } from '../../core/Logger.js';
import { BarcodeUtils } from '../../utils/BarcodeUtils.js';
import { eventBus, EVENTS } from '../../editor/core/EventBus.js';
import { CUSTOM_PROPS, CUSTOM_TYPES } from '../../editor/core/CustomProperties.js';
import { showResponsivePreview } from '../../editor/utils/ResponsivePreview.js';

// ==========================================
// EDITOR WRAPPER CLASS
// ==========================================

export class EditorWrapper {
    constructor(app, options = {}) {
        this.app = app;
        this.options = options;
        this.editor = null;
        this.isV7 = true;

        // Template düzenleme için
        this._templateId = null;
        this._templateData = null;
        this._currentPresetId = 'esl_101_portrait';
        this._currentGridLayoutId = 'single';

        // MediaPicker instance
        this.mediaPicker = null;
        this._replaceSelectedImage = null;
        this._slotMediaInsertContext = null;
        this._eventUnsubs = [];
        this._toolbarHandlers = null;
        this._isSavingTemplate = false;
    }

    /**
     * i18n helper
     */
    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    _t(key, fallback) {
        const value = this.__(key);
        if (!value || value === key) return fallback;
        return value;
    }

    /**
     * Preload - Çevirileri yükle
     */
    async preload() {
        await this.app.i18n.loadPageTranslations('templates');

        // Feature flag kaldırıldı, sadece v7 kullanılır
    }

    /**
     * Render - Yükleme ekranı göster, sonra editor'ü belirle
     */
    render() {
        // Önceki editörden kalmış olası floating paneli temizle
        this._hideMultiFrameSlotSelector();

        // URL'den edit modu kontrolü (render aşamasında da page header için)
        const currentPath = window.location.hash || '';
        const isEditMode = /\/templates\/[a-f0-9-]+\/edit(?:-v7)?/i.test(currentPath);
        const isSuperAdmin = (this.app.auth?.getRole() || '').toLowerCase() === 'superadmin';

        const pageTitle = isEditMode
            ? this.__('editor.editTitle')
            : this.__('editor.newTitle');
        const pageSubtitle = isEditMode
            ? this.__('editor.editSubtitle')
            : this.__('editor.subtitle');
        const pageIcon = isEditMode ? 'ti-edit' : 'ti-plus';

        const currencySymbol = this.app?.i18n?.getCurrencySymbol?.() || '₺';

        return `
            <div id="editor-wrapper" class="editor-wrapper">
                <!-- Page Header (yükleme sırasında da görünür) -->
                <div class="page-header" id="editor-page-header">
                    <div class="page-header-breadcrumb">
                        <a href="#/dashboard">${this.__('breadcrumb.dashboard')}</a>
                        <span class="breadcrumb-separator">›</span>
                        <a href="#/templates">${this.__('title')}</a>
                        <span class="breadcrumb-separator">›</span>
                        <span class="breadcrumb-current">${pageTitle}</span>
                    </div>
                    <div class="page-header-main">
                        <div class="page-header-left">
                            <div class="page-header-icon purple">
                                <i class="ti ${pageIcon}"></i>
                            </div>
                            <div class="page-header-info">
                                <h1 class="page-title">${pageTitle}</h1>
                                <p class="page-subtitle">${pageSubtitle}</p>
                            </div>
                        </div>
                        <div class="page-header-right">
                            <a href="#/templates" class="btn btn-outline">
                                <i class="ti ti-arrow-left"></i>
                                <span class="btn-text">${this.__('editor.actions.back')}</span>
                            </a>
                        </div>
                    </div>
                </div>

                <div id="editor-loading" class="editor-loading" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 2rem;">
                    <div class="editor-loading-spinner" style="margin-bottom: 1rem;">
                        <i class="ti ti-loader-2 spin" style="font-size: 3rem; color: var(--color-primary);"></i>
                    </div>
                    <p class="editor-loading-text" id="loading-status-text" style="font-size: 1.1rem; color: var(--text-secondary);">${this.__('editor.loading')}</p>
                    <p class="editor-loading-subtext" id="loading-subtext" style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.5rem;">${this.__('editor.loadingFabric')}</p>
                </div>
                <div id="editor-container"></div>
                <!-- Floating Inspector Panel (fixed, sayfa genelinde sürüklenebilir) -->
                ${this._renderFloatingInspector()}
            </div>
        `;
    }

    /**
     * Init - Editor'ü yükle
     */
    async init() {
        const currentPath = window.location.hash || '';

        // URL'den template ID'sini çıkar (düzenleme modu için)
        // /templates/:id/edit formatını destekle
        const editMatch = currentPath.match(/\/templates\/([a-f0-9-]+)\/edit/i);
        if (editMatch) {
            this._templateId = editMatch[1];
            Logger.debug('[EditorWrapper] Düzenleme modu, Template ID:', this._templateId);
        }

        try {
            // Düzenleme modunda template verisini yükle
            if (this._templateId) {
                await this._loadTemplateData();
            }

            await this._loadV7Editor();

            // Düzenleme modunda template verisini canvas'a yükle
            if (this._templateId && this._templateData && this.editor) {
                await this._applyTemplateData();
            }

            // Yükleme ekranını gizle
            this._hideLoadingScreen();

        } catch (error) {
            Logger.error('[EditorWrapper] Editor yüklenirken hata:', error);
            this._showError(error);
        }
    }

    /**
     * Template verisini API'den yükle
     */
    async _loadTemplateData() {
        try {
            this._updateLoadingStatus(this.__('editor.loadingTemplate'), this.__('editor.fetchingData'));
            const response = await this.app.api.get(`/templates/${this._templateId}`);
            if (response.success && response.data) {
                this._templateData = response.data;
                Logger.debug('[EditorWrapper] Template verisi yüklendi:', this._templateData.name);
            }
        } catch (error) {
            Logger.error('[EditorWrapper] Template yüklenirken hata:', error);
            throw new Error(this.__('editor.errors.loadFailed'));
        }
    }

    /**
     * Template verisini form ve canvas'a uygula
     */
    async _applyTemplateData() {
        if (!this._templateData) return;

        const data = this._templateData;

        // Form alanlarını doldur
        const nameInput = document.getElementById('template-name');
        const descInput = document.getElementById('template-description');
        const typeSelect = document.getElementById('template-type');
        const sharedToggle = document.getElementById('template-shared');
        const commonToggle = document.getElementById('template-common');

        if (nameInput) nameInput.value = data.name || '';
        if (descInput) descInput.value = data.description || '';
        if (typeSelect) typeSelect.value = data.type || 'label';
        if (sharedToggle) {
            sharedToggle.checked = data.scope === 'system' || data.company_id === null;
        }
        if (commonToggle) {
            commonToggle.checked = !!data.is_default;
            this._toggleCommonTemplateVisibility(typeSelect?.value || data.type);
        }

        // Responsive ayarlarını doldur
        const responsiveMode = document.getElementById('responsive-mode');
        const scalePolicy = document.getElementById('scale-policy');
        const scalePolicyGroup = document.getElementById('scale-policy-group');
        if (responsiveMode) responsiveMode.value = data.responsive_mode || 'off';
        if (scalePolicy) scalePolicy.value = data.scale_policy || 'contain';
        if (scalePolicyGroup) {
            scalePolicyGroup.style.display = (data.responsive_mode && data.responsive_mode !== 'off') ? 'block' : 'none';
        }

        // Canvas boyutlarını ayarla
        const templateWidth = Number.parseInt(data.width, 10);
        const templateHeight = Number.parseInt(data.height, 10);
        if (Number.isFinite(templateWidth) && Number.isFinite(templateHeight) && templateWidth > 0 && templateHeight > 0) {
            this._currentPresetId = data.target_device_type || 'custom';
            this._currentGridLayoutId = data.grid_layout || 'single';

            if (this.editor && this.editor.setCanvasSize) {
                this.editor.setCanvasSize(templateWidth, templateHeight);
            }

            this._updateCanvasSizeDisplay(templateWidth, templateHeight);
            const customWidthInput = document.getElementById('custom-width');
            const customHeightInput = document.getElementById('custom-height');
            if (customWidthInput) customWidthInput.value = templateWidth;
            if (customHeightInput) customHeightInput.value = templateHeight;
        }

        // Canvas içeriğini yükle
        const content = data.content || data.design_data;
        if (content && this.editor && this.editor.load) {
            try {
                await this.editor.load(content);
                Logger.debug('[EditorWrapper] Canvas içeriği yüklendi');

                // Multi-product frame varsa slot görsel öğelerini yeniden oluştur
                // Kısa gecikme: loadFromJSON sonrası canvas'ın renderlanmasını bekle
                await new Promise(resolve => setTimeout(resolve, 100));
                this._restoreMultiFrameVisuals();
                Logger.debug('[EditorWrapper] Multi-frame visuals restored');
            } catch (e) {
                Logger.warn('[EditorWrapper] Canvas içeriği yüklenemedi:', e);
            }
        }

        // _templateMeta'yı güncelle (Ctrl+S için)
        if (this.editor && this.editor.setTemplateMeta) {
            this.editor.setTemplateMeta({
                id: this._templateId,
                name: data.name || '',
                description: data.description || '',
                type: data.type || 'label',
                width: data.width || 800,
                height: data.height || 1280
            });
        }

        // Cihaz preset buton active state güncelle
        if (this._currentPresetId) {
            document.querySelectorAll('.device-preset-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.preset === this._currentPresetId);
            });
        }

        // Grid layout'u uygula
        if (this._currentGridLayoutId) {
            // Sol panel buton active state güncelle
            document.querySelectorAll('.grid-layout-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.layout === this._currentGridLayoutId);
            });
            // Layout'u canvas'a uygula (single hariç - zaten varsayılan)
            if (this._currentGridLayoutId !== 'single') {
                this._applyGridLayout(this._currentGridLayoutId);
            }
        }

        // Grid görünürlüğünü uygula
        if (data.grid_visible === false || data.grid_visible === 0 || data.grid_visible === '0') {
            if (this.editor?.gridManager?.isGridVisible()) {
                this.editor.gridManager.hideGrid();
            }
            // Toolbar grid toggle butonunu güncelle
            const gridBtn = document.querySelector('[data-action="toggle-grid"]');
            if (gridBtn) gridBtn.classList.remove('active');
        }

        Logger.debug('[EditorWrapper] Template verisi uygulandı');
    }

    /**
     * Loading durumunu güncelle
     */
    _updateLoadingStatus(text, subtext = '') {
        const statusEl = document.getElementById('loading-status-text');
        const subtextEl = document.getElementById('loading-subtext');
        if (statusEl) statusEl.textContent = text;
        if (subtextEl) subtextEl.textContent = subtext;
    }

    /**
     * v7 Editor'ü yükle (yeni)
     */
    async _loadV7Editor() {
        Logger.debug('[EditorWrapper] v7 Editor yükleniyor...');

        this._updateLoadingStatus(this.__('editor.loadingFabric'), this.__('editor.downloadingLibrary'));

        // Fabric.js yüklenmesini bekle
        const { waitForFabric } = await import('../../editor/core/FabricExports.js');
        await waitForFabric();

        this._updateLoadingStatus(this.__('editor.creatingEditor'), this.__('editor.preparingCanvas'));

        Logger.debug('[EditorWrapper] Fabric.js yüklendi, v7 Editor oluşturuluyor...');

        // Container'a v7 editor HTML yapısını ekle
        const container = document.getElementById('editor-container');
        if (!container) {
            throw new Error(this.__('editor.errors.containerNotFound'));
        }

        // v7 Editor HTML yapısı
        container.innerHTML = this._renderV7EditorHTML();

        // Editor'ü yükle
        const { TemplateEditorV7 } = await import('../../editor/TemplateEditorV7.js');

        // Editor instance oluştur
        this.editor = new TemplateEditorV7({
            container: '#editor-container',
            canvasId: 'template-canvas',
            width: 800,
            height: 1280,
            i18n: (key, params) => this.__(key, params),
            onSave: async (data) => this._handleSave(data),
            onCanvasReady: (editor) => {
                Logger.debug('[EditorWrapper] v7 Canvas hazır');
                this._setupCanvasSelectionEvents();
            }
        });

        // Editor'ü başlat
        await this.editor.init();

        // Toolbar event'lerini bağla
        this._bindToolbarEvents();

        // Floating Inspector Panel'i başlat
        this._initFloatingInspector();

        // PropertyPanel event'lerini dinle
        this._bindPropertyPanelEvents();

        Logger.debug('[EditorWrapper] v7 Editor başlatıldı');
    }

    /**
     * Tüm event'leri bağla
     */
    _bindToolbarEvents() {
        if (this._toolbarHandlers) {
            const { toolbar, onToolbarActionClick, onToolbarDropdownClick, onDocumentClick } = this._toolbarHandlers;
            if (toolbar && onToolbarActionClick) toolbar.removeEventListener('click', onToolbarActionClick);
            if (toolbar && onToolbarDropdownClick) toolbar.removeEventListener('click', onToolbarDropdownClick);
            if (onDocumentClick) document.removeEventListener('click', onDocumentClick);
            this._toolbarHandlers = null;
        }

        // Toolbar buton event'leri
        const toolbar = document.getElementById('canvas-toolbar');
        if (toolbar) {
            const onToolbarActionClick = async (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                try {
                    await this._handleToolbarAction(btn.dataset.action, btn);
                    // Dropdown'u kapat (action çalıştıktan sonra)
                    const dropdown = btn.closest('.toolbar-dropdown');
                    if (dropdown) {
                        dropdown.classList.remove('open');
                    }
                } catch (error) {
                    Logger.error('[EditorWrapper] Toolbar aksiyon hatası:', btn.dataset.action, error);
                }
            };
            toolbar.addEventListener('click', onToolbarActionClick);

            // Toolbar dropdown toggle
            const onToolbarDropdownClick = (e) => {
                const toggle = e.target.closest('.toolbar-dropdown-toggle');
                if (toggle) {
                    e.stopPropagation();
                    const dropdown = toggle.closest('.toolbar-dropdown');
                    if (dropdown) {
                        // Diğer dropdown'ları kapat
                        toolbar.querySelectorAll('.toolbar-dropdown.open').forEach(d => {
                            if (d !== dropdown) d.classList.remove('open');
                        });
                        dropdown.classList.toggle('open');
                    }
                }
            };
            toolbar.addEventListener('click', onToolbarDropdownClick);

            // Sayfa tıklamalarında dropdown'ları kapat
            const onDocumentClick = (e) => {
                if (!e.target.closest('.toolbar-dropdown')) {
                    toolbar.querySelectorAll('.toolbar-dropdown.open').forEach(d => {
                        d.classList.remove('open');
                    });
                }
            };
            document.addEventListener('click', onDocumentClick);

            this._toolbarHandlers = {
                toolbar,
                onToolbarActionClick,
                onToolbarDropdownClick,
                onDocumentClick
            };
        }

        const unsubHistory = eventBus.on(EVENTS.HISTORY_CHANGE, (data) => {
            const undoBtn = document.getElementById('undo-btn');
            const redoBtn = document.getElementById('redo-btn');
            if (undoBtn) undoBtn.disabled = !data?.canUndo;
            if (redoBtn) redoBtn.disabled = !data?.canRedo;
        });
        this._eventUnsubs.push(unsubHistory);

        // Kaydet butonu (header'daki)
        document.getElementById('save-btn')?.addEventListener('click', () => this._saveTemplate());

        // Önizleme butonu
        document.getElementById('preview-btn')?.addEventListener('click', () => this._previewTemplate());

        // Responsive önizleme butonu
        document.getElementById('responsive-preview-btn')?.addEventListener('click', () => this._showResponsivePreview());

        // Form alanları değiştiğinde _templateMeta'yı güncelle (Ctrl+S için)
        document.getElementById('template-name')?.addEventListener('input', (e) => {
            if (this.editor && this.editor.setTemplateMeta) {
                this.editor.setTemplateMeta({ name: e.target.value?.trim() || '' });
            }
        });
        document.getElementById('template-description')?.addEventListener('input', (e) => {
            if (this.editor && this.editor.setTemplateMeta) {
                this.editor.setTemplateMeta({ description: e.target.value?.trim() || '' });
            }
        });
        document.getElementById('template-type')?.addEventListener('change', (e) => {
            if (this.editor && this.editor.setTemplateMeta) {
                this.editor.setTemplateMeta({ type: e.target.value || 'label' });
            }
            this._toggleCommonTemplateVisibility(e.target.value);
        });
        this._toggleCommonTemplateVisibility(document.getElementById('template-type')?.value);

        // Device preset butonları
        document.querySelectorAll('.device-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const presetId = btn.dataset.preset;
                const width = parseInt(btn.dataset.width);
                const height = parseInt(btn.dataset.height);

                Logger.debug('[EditorWrapper] Device preset butonu tıklandı:', presetId, 'width=', width, 'height=', height);
                Logger.debug('[EditorWrapper] this.editor mevcut mu?', !!this.editor);

                this._applyDevicePreset(presetId, width, height);

                // Active class güncelle
                document.querySelectorAll('.device-preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Grid layout butonları
        document.querySelectorAll('.grid-layout-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const layoutId = btn.dataset.layout;
                if (!layoutId) return;

                Logger.debug('[EditorWrapper] Grid layout butonu tıklandı:', layoutId);
                this._applyGridLayout(layoutId);

                // Active class güncelle
                document.querySelectorAll('.grid-layout-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Özel boyut uygula
        document.getElementById('apply-custom-size-btn')?.addEventListener('click', () => {
            const width = parseInt(document.getElementById('custom-width')?.value) || 800;
            const height = parseInt(document.getElementById('custom-height')?.value) || 1280;
            this._applyCustomSize(width, height);
        });

        // Responsive mod değiştiğinde scale policy görünürlüğü
        document.getElementById('responsive-mode')?.addEventListener('change', (e) => {
            const scalePolicyGroup = document.getElementById('scale-policy-group');
            if (scalePolicyGroup) {
                scalePolicyGroup.style.display = e.target.value !== 'off' ? 'block' : 'none';
            }
        });

        // Element butonları (sağ panel)
        document.querySelectorAll('.element-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const elementType = btn.dataset.element;
                try {
                    // Çoklu ürün çerçevesi kontrolü
                    if (elementType && elementType.startsWith('multi-frame-')) {
                        const cols = parseInt(btn.dataset.cols) || 2;
                        const rows = parseInt(btn.dataset.rows) || 2;
                        const layout = `${cols}x${rows}`;
                        await this._addMultiProductFrame(layout);
                    } else {
                        await this._addElement(elementType);
                    }
                } catch (error) {
                    Logger.error('[EditorWrapper] Element eklenirken hata:', elementType, error);
                }
            });
        });

        // Dinamik alan butonları
        document.querySelectorAll('.field-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fieldKey = btn.dataset.field;
                try {
                    await this._addDynamicField(fieldKey);
                } catch (error) {
                    Logger.error('[EditorWrapper] Dinamik alan eklenirken hata:', fieldKey, error);
                }
            });
        });

        // Dinamik alan arama
        document.getElementById('dynamic-field-search')?.addEventListener('input', (e) => {
            this._filterDynamicFields(e.target.value);
        });

        // Panel toggle (collapsible headers)
        document.querySelectorAll('[data-toggle-panel]').forEach(header => {
            header.addEventListener('click', () => {
                const panelId = header.dataset.togglePanel;
                this._togglePanel(panelId, header);
            });
        });
    }

    /**
     * PropertyPanel event'lerini dinle
     */
    _bindPropertyPanelEvents() {
        // Görsel değiştir - medya seçici aç
        const unsubReplaceImage = eventBus.on(EVENTS.PROPERTY_REPLACE_IMAGE, ({ object }) => {
            if (!object) return;
            this._replaceSelectedImage = object;
            this._openMediaPicker('image');
        });
        this._eventUnsubs.push(unsubReplaceImage);

        // Barkod/QR düzenle - ilgili modalı aç
        const unsubEditBarcode = eventBus.on(EVENTS.PROPERTY_EDIT_BARCODE, ({ object }) => {
            if (!object || !this.editor) return;
            const customType = object.get ? object.get(CUSTOM_PROPS.TYPE) : object[CUSTOM_PROPS.TYPE];
            if (customType === CUSTOM_TYPES.BARCODE || customType === CUSTOM_TYPES.QRCODE) {
                this.editor._showBarcodeEditModal(object);
            }
        });
        this._eventUnsubs.push(unsubEditBarcode);
    }

    /**
     * Canvas seçim olaylarını ayarla
     */
    _setupCanvasSelectionEvents() {
        if (!this.editor?.canvas) {
            Logger.warn('[EditorWrapper] Canvas bulunamadı, selection events ayarlanamadı');
            return;
        }

        const canvas = this.editor.canvas;

        // Multi-frame seçildiğinde slot selector panelini göster
        canvas.on('selection:created', (e) => {
            if (this._addingToSlot) return; // Slot'a alan eklenirken paneli kapatma
            const selected = e.selected?.[0];
            if (this._isMultiProductFrame(selected)) {
                this._showMultiFrameSlotSelector(selected);
            } else {
                this._hideMultiFrameSlotSelector();
            }
        });

        canvas.on('selection:updated', (e) => {
            if (this._addingToSlot) return; // Slot'a alan eklenirken paneli kapatma
            const selected = e.selected?.[0];
            Logger.debug('[EditorWrapper] selection:updated - type:', selected?.type, 'customType:', selected?.customType, 'isFrame:', this._isMultiProductFrame(selected));
            if (this._isMultiProductFrame(selected)) {
                this._showMultiFrameSlotSelector(selected);
            } else {
                this._hideMultiFrameSlotSelector();
            }
        });

        canvas.on('selection:cleared', () => {
            if (this._addingToSlot) return; // Slot'a alan eklenirken paneli kapatma
            this._hideMultiFrameSlotSelector();
        });

        // Slot sınır kontrolü - slot objelerinin sınır dışına taşınmasını engelle
        this._setupSlotBoundaryEnforcement(canvas);

        Logger.debug('[EditorWrapper] Canvas selection events ayarlandı');
    }

    /**
     * Multi-frame slot selector panelini göster
     */
    _showMultiFrameSlotSelector(frame) {
        // Aynı frame zaten aktifse paneli yeniden oluşturmaya gerek yok
        // (selection event'leri aynı frame için tekrar tetiklenebilir)
        if (this._activeFrame === frame && document.getElementById('multi-frame-slot-panel')) {
            return;
        }

        // Mevcut paneli kaldır
        this._hideMultiFrameSlotSelector();

        const cols = this._getFrameProp(frame, 'frameCols') || 2;
        const rows = this._getFrameProp(frame, 'frameRows') || 2;
        const totalSlots = cols * rows;

        // Dinamik alanlar - çeviri anahtarları camelCase formatında
        const currencySymbol = this.app?.i18n?.getCurrencySymbol?.() || '₺';
        const dynamicFields = [
            { key: 'product_name', label: this.__('editor.dynamicFields.productName'), icon: 'ti ti-tag', category: 'text' },
            { key: 'current_price', label: this.__('editor.dynamicFields.currentPrice') + ` (${currencySymbol})`, icon: 'ti ti-currency-lira', category: 'price' },
            { key: 'previous_price', label: (this.__('editor.dynamicFields.previousPrice') || 'Eski Fiyat') + ` (${currencySymbol})`, icon: 'ti ti-currency-lira-off', category: 'price' },
            { key: 'price_with_currency', label: this.__('editor.dynamicFields.priceWithCurrency') || 'Fiyat + Para Birimi', icon: 'ti ti-coin', category: 'price' },
            { key: 'discount_percent', label: this.__('editor.dynamicFields.discountPercent'), icon: 'ti ti-discount-2', category: 'price' },
            { key: 'price_updated_at', label: this.__('editor.dynamicFields.priceUpdatedAt'), icon: 'ti ti-calendar-event', category: 'text' },
            { key: 'barcode', label: this.__('editor.dynamicFields.barcode') || 'Barkod', icon: 'ti ti-barcode', category: 'barcode' },
            { key: 'kunye_no', label: this.__('editor.dynamicFields.kunyeNo'), icon: 'ti ti-qrcode', category: 'qr' },
            { key: 'image_url', label: this.__('editor.dynamicFields.imageUrl'), icon: 'ti ti-photo', category: 'image' },
            { key: 'image_url', label: this.__('editor.dynamicFields.media') || 'Medya', icon: 'ti ti-player-play', category: 'media' },
            { key: 'unit', label: this.__('editor.dynamicFields.unit') || 'Birim', icon: 'ti ti-scale', category: 'text' },
            { key: 'weight', label: this.__('editor.dynamicFields.weight'), icon: 'ti ti-scale', category: 'text' },
            { key: 'category', label: this.__('editor.dynamicFields.category') || 'Kategori', icon: 'ti ti-category', category: 'text' },
            { key: 'origin', label: this.__('editor.dynamicFields.origin'), icon: 'ti ti-map-pin', category: 'text' },
            { key: 'production_type', label: this.__('editor.dynamicFields.productionType'), icon: 'ti ti-plant', category: 'text' },
            { key: 'campaign_text', label: this.__('editor.dynamicFields.campaignText') || 'Kampanya Metni', icon: 'ti ti-badge', category: 'text' }
        ];

        // Panel HTML'i oluştur - sürüklenebilir başlık
        const panelHtml = `
            <div id="multi-frame-slot-panel" class="multi-frame-slot-panel">
                <div class="slot-panel-header" id="slot-panel-drag-handle">
                    <div class="slot-panel-header-content">
                        <i class="ti ti-grip-vertical drag-grip"></i>
                        <i class="ti ti-layout-grid"></i>
                        <span>${this.__('editor.multiFrame.title')}</span>
                    </div>
                    <div class="panel-header-actions">
                        <button class="panel-collapse-btn" id="collapse-slot-panel" title="${this.__('actions.collapse') || 'Daralt'}">
                            <i class="ti ti-chevron-up"></i>
                        </button>
                        <button class="slot-panel-close" id="close-slot-panel" title="${this.__('actions.close') || 'Kapat'}">
                            <i class="ti ti-x"></i>
                        </button>
                    </div>
                </div>

                <div class="floating-panel-body" id="slot-panel-body">
                    <div class="slot-panel-section">
                        <label class="slot-panel-label">${this.__('editor.multiFrame.selectSlot')}</label>
                        <div class="slot-selector-grid" style="grid-template-columns: repeat(${cols}, 1fr);">
                            ${Array.from({ length: totalSlots }, (_, i) => {
                                const slotNum = i + 1;
                                return `
                                    <button class="slot-select-btn ${slotNum === 1 ? 'active' : ''}" data-slot="${slotNum}">
                                        <span class="slot-number">${slotNum}</span>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div class="slot-panel-section">
                        <label class="slot-panel-label">${this.__('editor.multiFrame.addField') || 'Alan Ekle'}</label>
                        <div class="slot-field-buttons">
                            ${dynamicFields.map(field => `
                                <button class="slot-field-btn field-${field.category}" data-field="${field.key}" data-category="${field.category}">
                                    <i class="${field.icon}"></i>
                                    <span>${field.label}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Body'ye ekle (fixed panel olarak sayfa genelinde sürüklenebilir)
        document.body.insertAdjacentHTML('beforeend', panelHtml);

        {
            const panel = document.getElementById('multi-frame-slot-panel');
            if (panel) {
                // Fixed pozisyonla başlat - canvas alanının sağ üstüne konumla
                const canvasArea = document.querySelector('.editor-canvas-area');
                if (canvasArea) {
                    const canvasRect = canvasArea.getBoundingClientRect();
                    panel.style.top = `${canvasRect.top + 10}px`;
                    panel.style.right = '400px';
                }

                // İlk yüklemede right → left dönüşümü (drag uyumluluğu)
                requestAnimationFrame(() => {
                    const rect = panel.getBoundingClientRect();
                    panel.style.left = `${rect.left}px`;
                    panel.style.top = `${rect.top}px`;
                    panel.style.right = 'auto';
                });

                // Aktif slot'u sakla
                this._activeSlotId = 1;
                this._activeFrame = frame;

                // Frame pozisyon/scale tracking başlat
                this._lastFramePos = { left: frame.left, top: frame.top };
                this._lastFrameScale = {
                    scaleX: frame.scaleX || 1,
                    scaleY: frame.scaleY || 1,
                    left: frame.left,
                    top: frame.top
                };

                // Event listener'ları bağla
                this._bindSlotPanelEvents();

                // Sürükleme özelliğini ekle
                this._makeSlotPanelDraggable(panel);

                // İlk slot'u canvas'ta vurgula
                this._highlightActiveSlot(1);
            }
        }
    }

    /**
     * Herhangi bir paneli sürüklenebilir yap (slot-panel, inspector vb.)
     * @param {HTMLElement} panel - Sürüklenecek panel
     * @param {string} handleSelector - Sürükleme tutamacı selector'u
     * @param {string} [closeSelector] - Kapatma butonu selector'u (sürüklemeyi engellemek için)
     */
    _makePanelDraggable(panel, handleSelector, closeSelector) {
        const header = panel.querySelector(handleSelector);
        if (!header) return;

        const isFixed = () => window.getComputedStyle(panel).position === 'fixed';
        let isDragging = false;
        let startX, startY, initialLeft, initialTop, panelWidth, panelHeight;

        const onMouseDown = (e) => {
            // Header action butonlarını (kapat, daralt) sürüklemeye dahil etme
            if (e.target.closest('.panel-header-actions')) return;
            if (closeSelector && e.target.closest(closeSelector)) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = panel.getBoundingClientRect();
            panelWidth = rect.width;
            panelHeight = rect.height;

            // right → left dönüşümü (ilk kez sürükleniyorsa)
            if (panel.style.right && panel.style.right !== 'auto') {
                if (isFixed()) {
                    panel.style.left = `${rect.left}px`;
                    panel.style.top = `${rect.top}px`;
                } else {
                    const parentRect = panel.offsetParent ? panel.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
                    panel.style.left = `${rect.left - parentRect.left}px`;
                    panel.style.top = `${rect.top - parentRect.top}px`;
                }
                panel.style.right = 'auto';
            }

            initialLeft = isFixed() ? rect.left : panel.offsetLeft;
            initialTop = isFixed() ? rect.top : panel.offsetTop;

            panel.style.transition = 'none';
            document.body.style.userSelect = 'none';
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newX = initialLeft + dx;
            let newY = initialTop + dy;

            // Viewport sınır kontrolü
            const maxX = window.innerWidth - panelWidth;
            const maxY = window.innerHeight - panelHeight;
            newX = Math.max(0, Math.min(newX, Math.max(0, maxX)));
            newY = Math.max(0, Math.min(newY, Math.max(0, maxY)));

            panel.style.left = `${newX}px`;
            panel.style.top = `${newY}px`;
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                panel.style.transition = '';
                document.body.style.userSelect = '';
            }
        };

        header.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        panel._dragCleanup = () => {
            header.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }

    _makeSlotPanelDraggable(panel) {
        this._makePanelDraggable(panel, '#slot-panel-drag-handle', '.slot-panel-close');
    }

    // ========================================
    // FLOATING INSPECTOR PANEL
    // ========================================

    /**
     * Floating Inspector Panel HTML
     */
    _renderFloatingInspector() {
        return `
            <div id="floating-inspector-panel" class="floating-inspector-panel">
                <div class="inspector-panel-header" id="inspector-drag-handle">
                    <div class="inspector-header-content">
                        <i class="ti ti-grip-vertical drag-grip"></i>
                        <i class="ti ti-adjustments"></i>
                        <span>${this.__('editor.inspector.title') || 'Inspector'}</span>
                    </div>
                    <div class="panel-header-actions">
                        <button type="button" class="panel-collapse-btn" id="collapse-inspector-panel" title="${this.__('actions.collapse') || 'Daralt'}">
                            <i class="ti ti-chevron-up"></i>
                        </button>
                        <button type="button" class="inspector-panel-close" id="close-inspector-panel" title="${this.__('actions.close') || 'Kapat'}">
                            <i class="ti ti-x"></i>
                        </button>
                    </div>
                </div>
                <div class="floating-panel-body" id="inspector-panel-body">
                    <div class="inspector-tabs">
                        <button type="button" class="inspector-tab active" data-inspector-tab="properties">
                            <i class="ti ti-adjustments"></i>
                            <span>${this.__('editor.properties.title')}</span>
                        </button>
                        <button type="button" class="inspector-tab" data-inspector-tab="layers">
                            <i class="ti ti-stack-2"></i>
                            <span>${this.__('editor.layers.title') || 'Katmanlar'}</span>
                        </button>
                    </div>
                    <div class="inspector-tab-content" id="inspector-properties-tab">
                        <div id="inspector-properties-container">
                            <p class="text-muted text-center py-4">${this.__('editor.properties.selectElement')}</p>
                        </div>
                    </div>
                    <div class="inspector-tab-content hidden" id="inspector-layers-tab">
                        <div id="inspector-layers-container">
                            <p class="text-muted text-center py-2">${this.__('editor.layers.empty')}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Floating Inspector Panel'i başlat
     */
    _initFloatingInspector() {
        const panel = document.getElementById('floating-inspector-panel');
        if (!panel) return;

        // Fixed panel: ilk yüklemede right → left dönüşümü (drag uyumluluğu)
        requestAnimationFrame(() => {
            const rect = panel.getBoundingClientRect();
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = 'auto';
        });

        // Sürüklenebilir yap
        this._makePanelDraggable(panel, '#inspector-drag-handle', '.inspector-panel-close');

        // Event'leri bağla
        this._bindInspectorEvents(panel);

        // Editor'daki panelleri inspector'a da bağla
        if (this.editor) {
            this.editor._inspectorPanel = panel;
            this.editor._initInspectorBinding();
        }
    }

    /**
     * Inspector panel event binding
     */
    _bindInspectorEvents(panel) {
        // Tab switch
        panel.querySelectorAll('.inspector-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.inspectorTab;
                this._switchInspectorTab(panel, tabName);
            });
        });

        // Daralt/Genişlet butonu
        panel.querySelector('#collapse-inspector-panel')?.addEventListener('click', () => {
            this._togglePanelCollapse(panel, 'inspector-panel-body', 'collapse-inspector-panel');
        });

        // Kapat butonu
        const closeBtn = panel.querySelector('#close-inspector-panel');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                panel.classList.add('hidden');
                // Toolbar toggle butonunu güncelle
                const toggleBtn = document.querySelector('[data-action="toggle-inspector"]');
                if (toggleBtn) toggleBtn.classList.remove('active');
            });
        }
    }

    /**
     * Inspector tab değiştir
     */
    _switchInspectorTab(panel, tabName) {
        // Tab butonlarını güncelle
        panel.querySelectorAll('.inspector-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.inspectorTab === tabName);
        });

        // Tab içeriklerini güncelle
        panel.querySelector('#inspector-properties-tab')?.classList.toggle('hidden', tabName !== 'properties');
        panel.querySelector('#inspector-layers-tab')?.classList.toggle('hidden', tabName !== 'layers');
    }

    /**
     * Inspector paneli göster/gizle toggle
     */
    _toggleFloatingInspector() {
        const panel = document.getElementById('floating-inspector-panel');
        if (panel) {
            panel.classList.toggle('hidden');
        }
    }

    /**
     * Floating panel daralt/genişlet toggle
     * @param {HTMLElement} panel - Panelin ana elementi
     * @param {string} bodyId - Panel body element ID
     * @param {string} collapseBtnId - Collapse buton ID
     */
    _togglePanelCollapse(panel, bodyId, collapseBtnId) {
        if (!panel) return;

        const isCollapsed = panel.classList.toggle('collapsed');
        const collapseBtn = panel.querySelector(`#${collapseBtnId}`);
        if (collapseBtn) {
            const icon = collapseBtn.querySelector('i');
            if (icon) {
                icon.className = isCollapsed ? 'ti ti-chevron-down' : 'ti ti-chevron-up';
            }
            collapseBtn.title = isCollapsed
                ? this.__('actions.expand')
                : (this.__('actions.collapse') || 'Daralt');
        }
    }

    /**
     * Slot panel event'lerini bağla
     */
    _bindSlotPanelEvents() {
        const panel = document.getElementById('multi-frame-slot-panel');
        if (!panel) return;

        // Daralt/Genişlet butonu
        panel.querySelector('#collapse-slot-panel')?.addEventListener('click', () => {
            this._togglePanelCollapse(panel, 'slot-panel-body', 'collapse-slot-panel');
        });

        // Kapat butonu
        panel.querySelector('#close-slot-panel')?.addEventListener('click', () => {
            this._hideMultiFrameSlotSelector();
        });

        // Slot seçimi
        panel.querySelectorAll('.slot-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                panel.querySelectorAll('.slot-select-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._activeSlotId = parseInt(btn.dataset.slot);
                Logger.debug('[EditorWrapper] Aktif slot:', this._activeSlotId);
                // Canvas'ta aktif slot'u vurgula
                this._highlightActiveSlot(this._activeSlotId);
            });
        });

        // Alan ekleme
        panel.querySelectorAll('.slot-field-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fieldKey = btn.dataset.field;
                const category = btn.dataset.category;
                await this._addFieldToSlot(fieldKey, category);
            });
        });
    }

    /**
     * Seçili slot'a alan ekle
     */
    async _addFieldToSlot(fieldKey, category) {
        if (!this._activeFrame || !this._activeSlotId) {
            Logger.warn('[EditorWrapper] Aktif frame veya slot yok');
            return;
        }

        const frame = this._activeFrame;
        const slotId = this._activeSlotId;
        const cols = this._getFrameProp(frame, 'frameCols') || 2;
        const rows = this._getFrameProp(frame, 'frameRows') || 2;

        // Flag: selection event handler'ların paneli kapatmasını engelle
        this._addingToSlot = true;

        // Slot pozisyonunu hesapla (center origin desteği)
        const { x: frameX, y: frameY, w: frameW, h: frameH } = this._getFrameTopLeft(frame);
        const slotWidth = frameW / cols;
        const slotHeight = frameH / rows;
        const slotCol = (slotId - 1) % cols;
        const slotRow = Math.floor((slotId - 1) / cols);

        // Slot'un sol-üst köşesi
        const slotLeft = frameX + (slotCol * slotWidth);
        const slotTop = frameY + (slotRow * slotHeight);

        // V7'de tüm objeler originX/Y: 'center' ile oluşuyor,
        // bu yüzden left/top objenin merkezi olarak yorumlanır.
        // Slot içinde padding bırakarak merkez noktasını hesapla.
        const padding = 10;

        try {
            switch (category) {
                case 'text':
                case 'price': {
                    // Metin alanı ekle — slot merkezinin biraz sol-üstüne yerleştir
                    const fontSize = category === 'price' ? 24 : 16;
                    // Okunabilir label göster (ör: "Ürün Adı"), placeholder olarak {{fieldKey}} sakla
                    const placeholder = `{{${fieldKey}}}`;
                    const displayLabel = this.editor._getFieldLabel?.(fieldKey) || placeholder;
                    const estWidth = displayLabel.length * fontSize * 0.5;
                    const estHeight = fontSize * 1.2;

                    await this.editor.addText(displayLabel, {
                        left: slotLeft + padding + estWidth / 2,
                        top: slotTop + padding + estHeight / 2,
                        fontSize: fontSize,
                        fill: category === 'price' ? '#ff4444' : '#333333',
                        fontWeight: category === 'price' ? 'bold' : 'normal',
                        isDynamicField: true,
                        isDataField: true,
                        dynamicField: fieldKey,
                        placeholder: placeholder,
                        slotId: slotId,
                        inMultiFrame: true,
                        parentFrameId: frame.id || 'frame'
                    });
                    break;
                }

                case 'barcode':
                    // Barkod ekle — slot merkezine yerleştir (center origin)
                    await this._createBarcodeInSlot(
                        slotLeft + slotWidth / 2,
                        slotTop + slotHeight / 2,
                        fieldKey, slotId, frame
                    );
                    break;

                case 'qr':
                    // QR kod ekle — slot merkezine yerleştir (center origin)
                    await this._createQRCodeInSlot(
                        slotLeft + slotWidth / 2,
                        slotTop + slotHeight / 2,
                        fieldKey, slotId, frame
                    );
                    break;

                case 'image': {
                    // Ürün görseli placeholder — slot-image olarak işaretle (renderer tanısın)
                    const imgW = Math.min(slotWidth - 20, 100);
                    const imgH = Math.min(slotHeight - 20, 100);
                    await this.editor.addRect({
                        left: slotLeft + slotWidth / 2,
                        top: slotTop + slotHeight / 2,
                        width: imgW,
                        height: imgH,
                        fill: '#e8e8e8',
                        stroke: '#aaaaaa',
                        strokeWidth: 1,
                        strokeDashArray: [4, 4],
                        rx: 4,
                        ry: 4,
                        isDynamicField: true,
                        isDataField: true,
                        dynamicField: fieldKey,
                        customType: 'slot-image',
                        slotId: slotId,
                        inMultiFrame: true,
                        parentFrameId: frame.id || 'frame'
                    });
                    break;
                }

                case 'media': {
                    // Normal medya picker ile seçtir, seçilen görseli slot içine yerleştir.
                    this._slotMediaInsertContext = {
                        frame,
                        slotId,
                        frameId: frame.id || frame.objectId || 'frame'
                    };
                    this._openMediaPicker('media');
                    return;
                }

                default:
                    Logger.warn('[EditorWrapper] Bilinmeyen alan kategorisi:', category);
            }

            Toast.success(this.__('toast.fieldAdded') || 'Alan eklendi');
        } catch (error) {
            Logger.error('[EditorWrapper] Slot\'a alan eklenirken hata:', error);
            Toast.error(this.__('toast.fieldAddError') || 'Alan eklenemedi');
        } finally {
            // Flag'i kaldır ve frame'i tekrar seçili yap (panel açık kalsın)
            this._addingToSlot = false;
            if (frame && this.editor?.canvas) {
                this.editor.canvas.setActiveObject(frame);
                this.editor.canvas.requestRenderAll();
            }
            // Aktif slot highlight'ını güncelle
            this._highlightActiveSlot(slotId);
        }
    }

    /**
     * Slot içine barkod ekle
     */
    async _createBarcodeInSlot(x, y, fieldKey, slotId, frame) {
        if (typeof JsBarcode !== 'undefined') {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            try {
                JsBarcode(svg, '8690000000001', {
                    format: 'EAN13',
                    width: 1.5,
                    height: 40,
                    displayValue: true,
                    fontSize: 10,
                    margin: 5,
                    background: '#ffffff'
                });

                const svgData = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);

                if (this.editor.addImage) {
                    await this.editor.addImage(url, {
                        left: x,
                        top: y,
                        isDynamicField: true,
                        isDataField: true,
                        dynamicField: fieldKey,
                        customType: 'slot-barcode',
                        barcodeValue: '8690000000001',
                        barcodeFormat: 'EAN13',
                        barcodeDisplayValue: true,
                        slotId: slotId,
                        inMultiFrame: true,
                        parentFrameId: frame.id || 'frame'
                    });
                    URL.revokeObjectURL(url);
                } else {
                    Logger.warn('[EditorWrapper] editor.addImage metodu yok, barkod oluşturulamadı');
                }
            } catch (error) {
                Logger.warn('[EditorWrapper] Slot barkod oluşturulamadı:', error);
                // Fallback: metin olarak barkod ekle
                try {
                    await this.editor.addText('||||| 8690000000001 |||||', {
                        left: x,
                        top: y,
                        fontSize: 14,
                        fontFamily: 'monospace',
                        fill: '#333333',
                        isDynamicField: true,
                        isDataField: true,
                        dynamicField: fieldKey,
                        customType: 'slot-barcode',
                        barcodeValue: '8690000000001',
                        slotId: slotId,
                        inMultiFrame: true,
                        parentFrameId: frame.id || 'frame'
                    });
                } catch (fallbackError) {
                    Logger.error('[EditorWrapper] Barkod fallback da başarısız:', fallbackError);
                }
            }
        } else {
            // JsBarcode yüklenmemişse metin placeholder ekle
            Logger.warn('[EditorWrapper] JsBarcode kütüphanesi yüklenmemiş, metin placeholder oluşturuluyor');
            try {
                await this.editor.addText('||||| BARKOD |||||', {
                    left: x,
                    top: y,
                    fontSize: 14,
                    fontFamily: 'monospace',
                    fill: '#333333',
                    isDynamicField: true,
                    isDataField: true,
                    dynamicField: fieldKey,
                    customType: 'slot-barcode',
                    barcodeValue: '8690000000001',
                    slotId: slotId,
                    inMultiFrame: true,
                    parentFrameId: frame.id || 'frame'
                });
            } catch (err) {
                Logger.error('[EditorWrapper] Barkod metin placeholder oluşturulamadı:', err);
            }
        }
    }

    /**
     * Slot içine QR kod ekle
     */
    async _createQRCodeInSlot(x, y, fieldKey, slotId, frame) {
        if (typeof QRCode !== 'undefined') {
            try {
                const tempDiv = document.createElement('div');
                tempDiv.style.cssText = 'position: absolute; left: -9999px; top: -9999px;';
                document.body.appendChild(tempDiv);

                new QRCode(tempDiv, {
                    text: 'HAL-KUNYE-DEMO',
                    width: 60,
                    height: 60,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });

                await new Promise(resolve => setTimeout(resolve, 100));

                const canvas = tempDiv.querySelector('canvas');
                if (canvas && this.editor.addImage) {
                    const dataUrl = canvas.toDataURL('image/png');
                    await this.editor.addImage(dataUrl, {
                        left: x,
                        top: y,
                        isDynamicField: true,
                        isDataField: true,
                        dynamicField: fieldKey,
                        customType: 'slot-qrcode',
                        qrValue: 'HAL-KUNYE-DEMO',
                        slotId: slotId,
                        inMultiFrame: true,
                        parentFrameId: frame.id || 'frame'
                    });
                }

                document.body.removeChild(tempDiv);
            } catch (error) {
                Logger.warn('[EditorWrapper] Slot QR kod oluşturulamadı:', error);
            }
        }
    }

    /**
     * Multi-frame slot selector panelini gizle
     */
    _hideMultiFrameSlotSelector() {
        const panel = document.getElementById('multi-frame-slot-panel');
        if (panel) {
            panel.remove();
        }
        this._removeSlotHighlight();
        this._activeSlotId = null;
        this._activeFrame = null;
        this._lastFramePos = undefined;
        this._lastFrameScale = undefined;
    }

    /**
     * Şablon yüklendikten sonra multi-product frame görsel öğelerini yeniden oluştur
     * (Slot ayırıcı çizgiler ve slot numaraları — bunlar excludeFromExport olduğu için
     *  save'de filtrelenmiş olabilir, bu yüzden yeniden çiziyoruz)
     */
    _restoreMultiFrameVisuals() {
        const canvas = this.editor?.canvas;
        if (!canvas) return;

        const f = window.fabric;
        if (!f) return;

        const FLine = f.Line;
        const FText = f.FabricText || f.Text;
        if (!FLine || !FText) {
            Logger.warn('[EditorWrapper] FLine or FText not available, cannot restore multi-frame visuals');
            return;
        }

        const frames = canvas.getObjects().filter(
            o => this._isMultiProductFrame(o)
        );

        Logger.debug('[EditorWrapper] _restoreMultiFrameVisuals: frames found:', frames.length);

        if (frames.length === 0) return;

        frames.forEach(frame => {
            const cols = this._getFrameProp(frame, 'frameCols') || 2;
            const rows = this._getFrameProp(frame, 'frameRows') || 2;
            const { x: frameX, y: frameY, w: frameW, h: frameH } = this._getFrameTopLeft(frame);
            const slotWidth = frameW / cols;
            const slotHeight = frameH / rows;

            Logger.debug('[EditorWrapper] Frame coords:', { frameX, frameY, frameW, frameH, cols, rows });

            // Mevcut transient slot görsellerini temizle (varsa — duplicate önleme)
            const existingTransients = canvas.getObjects().filter(
                o => (o.isSlotLabel || o.isSlotDivider) && o.isTransient
            );
            existingTransients.forEach(o => canvas.remove(o));

            // Frame'in canvas stack index'ini bul — divider ve label'ları frame'in ÜSTÜNE ekleyeceğiz
            const frameIndex = canvas.getObjects().indexOf(frame);

            // Slot ayırıcı dikey çizgiler
            for (let i = 1; i < cols; i++) {
                const x = frameX + (i * slotWidth);
                const lineObj = new FLine([x, frameY, x, frameY + frameH], {
                    stroke: '#cccccc',
                    strokeWidth: 1,
                    strokeDashArray: [3, 3],
                    selectable: false,
                    evented: false,
                    excludeFromExport: true,
                    isTransient: true,
                    isSlotDivider: true
                });
                canvas.add(lineObj);
                // Divider'ı frame'in hemen üstüne taşı (sendObjectToBack yerine)
                // sendObjectToBack opak Group arka planının arkasına gönderiyordu
            }

            // Slot ayırıcı yatay çizgiler
            for (let j = 1; j < rows; j++) {
                const y = frameY + (j * slotHeight);
                const lineObj = new FLine([frameX, y, frameX + frameW, y], {
                    stroke: '#cccccc',
                    strokeWidth: 1,
                    strokeDashArray: [3, 3],
                    selectable: false,
                    evented: false,
                    excludeFromExport: true,
                    isTransient: true,
                    isSlotDivider: true
                });
                canvas.add(lineObj);
                // Divider'ı frame'in hemen üstüne taşı
            }

            // Slot numaraları
            let slotNum = 1;
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const cx = frameX + (col * slotWidth) + slotWidth / 2;
                    const cy = frameY + (row * slotHeight) + slotHeight / 2;

                    const label = new FText(`Slot ${slotNum}`, {
                        left: cx,
                        top: cy,
                        fontSize: 14,
                        fill: 'rgba(100, 100, 100, 0.7)',
                        originX: 'center',
                        originY: 'center',
                        selectable: false,
                        evented: false,
                        excludeFromExport: true,
                        isTransient: true,
                        isSlotLabel: true,
                        slotId: slotNum
                    });
                    canvas.add(label);
                    slotNum++;
                }
            }

            // Tüm divider ve label'ları frame'in hemen üstüne taşı
            // Bu, frame'in opak arka planının üstünde görünmelerini sağlar
            if (frameIndex >= 0) {
                const allObjects = canvas.getObjects();
                const transients = allObjects.filter(
                    o => (o.isSlotLabel || o.isSlotDivider) && o.isTransient
                );
                transients.forEach(t => {
                    // Frame'in hemen üstüne yerleştir (ama diğer objelerin altında)
                    const currentIdx = allObjects.indexOf(t);
                    const targetIdx = canvas.getObjects().indexOf(frame) + 1;
                    if (currentIdx !== targetIdx) {
                        canvas.moveObjectTo(t, targetIdx);
                    }
                });
            }

            Logger.debug('[EditorWrapper] Multi-frame slot görselleri yeniden oluşturuldu:', { cols, rows });
        });

        canvas.requestRenderAll();
    }

    /**
     * Multi-product-frame olup olmadığını kontrol et.
     * Fabric.js v7'de loadFromJSON sonrası customType prop'u kaybolabiliyor.
     * Bu helper birden fazla erişim yolu dener.
     * @param {Object} obj - Fabric.js nesnesi
     * @returns {boolean}
     */
    _isMultiProductFrame(obj) {
        if (!obj) return false;
        // 1. Doğrudan property erişimi
        if (obj.customType === 'multi-product-frame') return true;
        // 2. .get() ile erişim (Fabric.js v7)
        try {
            if (typeof obj.get === 'function' && obj.get('customType') === 'multi-product-frame') return true;
        } catch (e) { /* ignore */ }
        // 3. Fallback: frameCols/frameRows varsa (Group veya Rect) multi-product-frame kabul et
        const fc = obj.frameCols || (typeof obj.get === 'function' ? obj.get('frameCols') : undefined);
        const fr = obj.frameRows || (typeof obj.get === 'function' ? obj.get('frameRows') : undefined);
        if (fc && fr) return true;
        return false;
    }

    /**
     * Frame objesinden custom property oku (v7 uyumlu: plain property + .get())
     */
    _getFrameProp(frame, propName) {
        if (!frame) return undefined;
        // 1. Doğrudan property
        if (frame[propName] !== undefined) return frame[propName];
        // 2. .get() ile (Fabric.js v7)
        try {
            if (typeof frame.get === 'function') {
                const val = frame.get(propName);
                if (val !== undefined) return val;
            }
        } catch (e) { /* ignore */ }
        return undefined;
    }

    /**
     * Frame'in sol üst köşe koordinatlarını hesapla (origin: center desteği)
     */
    _getFrameTopLeft(frame) {
        const scaleX = frame.scaleX || 1;
        const scaleY = frame.scaleY || 1;
        const isCenter = (frame.originX === 'center');
        return {
            x: isCenter ? frame.left - (frame.width * scaleX) / 2 : frame.left,
            y: isCenter ? frame.top - (frame.height * scaleY) / 2 : frame.top,
            w: frame.width * scaleX,
            h: frame.height * scaleY
        };
    }

    /**
     * Canvas üzerinde aktif slot'u vurgula (mavi dashed border)
     */
    _highlightActiveSlot(slotId) {
        // Önceki highlight'ı kaldır
        this._removeSlotHighlight();

        const frame = this._activeFrame;
        if (!frame || !slotId || !this.editor?.canvas) return;

        const cols = this._getFrameProp(frame, 'frameCols') || 2;
        const rows = this._getFrameProp(frame, 'frameRows') || 2;
        const { x: frameX, y: frameY, w: frameW, h: frameH } = this._getFrameTopLeft(frame);
        const slotWidth = frameW / cols;
        const slotHeight = frameH / rows;
        const slotCol = (slotId - 1) % cols;
        const slotRow = Math.floor((slotId - 1) / cols);

        // Slot merkezini hesapla (highlight rect origin: center)
        const centerX = frameX + (slotCol * slotWidth) + slotWidth / 2;
        const centerY = frameY + (slotRow * slotHeight) + slotHeight / 2;

        if (this.editor.objectFactory?.createRect) {
            this.editor.objectFactory.createRect({
                left: centerX,
                top: centerY,
                width: slotWidth - 2,
                height: slotHeight - 2,
                fill: 'rgba(34, 139, 230, 0.08)',
                stroke: '#228be6',
                strokeWidth: 2,
                strokeDashArray: [6, 3],
                selectable: false,
                evented: false,
                excludeFromExport: true,
                isTransient: true,
                isHelper: true,
                originX: 'center',
                originY: 'center'
            }).then(rect => {
                if (rect) {
                    this._slotHighlight = rect;
                    this.editor.canvas.requestRenderAll();
                }
            });
        }
    }

    /**
     * Slot highlight rect'ini canvas'tan kaldır
     */
    _removeSlotHighlight() {
        if (this._slotHighlight && this.editor?.canvas) {
            this.editor.canvas.remove(this._slotHighlight);
            this._slotHighlight = null;
            this.editor.canvas.requestRenderAll();
        }
    }

    /**
     * Slot sınır kontrolü — slot objelerinin sınır dışına taşınmasını engelle
     * + Frame taşındığında/boyutlandırıldığında slot objelerini ve highlight'ı güncelle
     */
    _setupSlotBoundaryEnforcement(canvas) {
        // --- Slot objeleri sınır kontrolü ---
        canvas.on('object:moving', (e) => {
            const obj = e.target;

            // Frame taşınıyorsa — slot objelerini ve highlight'ı güncelle
            if (this._isMultiProductFrame(obj)) {
                this._onFrameMoving(obj);
                return;
            }

            if (!obj || !obj.inMultiFrame || !obj.slotId) return;

            // Frame'i bul
            const frame = this._findParentFrame(obj, canvas);
            if (!frame) return;

            const cols = this._getFrameProp(frame, 'frameCols') || 2;
            const rows = this._getFrameProp(frame, 'frameRows') || 2;
            const { x: frameX, y: frameY, w: frameW, h: frameH } = this._getFrameTopLeft(frame);
            const slotWidth = frameW / cols;
            const slotHeight = frameH / rows;
            const slotCol = (obj.slotId - 1) % cols;
            const slotRow = Math.floor((obj.slotId - 1) / cols);

            // Slot sınırları (sol-üst köşe bazlı)
            const slotLeft = frameX + (slotCol * slotWidth);
            const slotTop = frameY + (slotRow * slotHeight);

            // Obje center origin ile çalışıyor — yarı genişlik/yükseklik hesapla
            const pad = 2;
            const minX = slotLeft + pad;
            const minY = slotTop + pad;
            const maxX = slotLeft + slotWidth - pad;
            const maxY = slotTop + slotHeight - pad;

            obj.set({
                left: Math.max(minX, Math.min(maxX, obj.left)),
                top: Math.max(minY, Math.min(maxY, obj.top))
            });
        });

        // --- Frame boyutlandırma ---
        canvas.on('object:scaling', (e) => {
            const obj = e.target;
            if (this._isMultiProductFrame(obj)) {
                this._onFrameScaling(obj);
            }
        });

        // --- Frame taşıma/boyutlandırma bittiğinde son güncelleme ---
        canvas.on('object:modified', (e) => {
            const obj = e.target;
            if (this._isMultiProductFrame(obj)) {
                this._onFrameModified(obj, canvas);
            }
        });
    }

    /**
     * Frame'i bul — parentFrameId ile veya aktif frame veya canvas'tan
     */
    _findParentFrame(obj, canvas) {
        // parentFrameId ile frame'i bul
        if (obj.parentFrameId) {
            const found = canvas.getObjects().find(
                o => this._isMultiProductFrame(o) && (o.id === obj.parentFrameId || o.objectId === obj.parentFrameId)
            );
            if (found) return found;
        }
        // Fallback: aktif frame veya ilk multi-product-frame
        return this._activeFrame || canvas.getObjects().find(
            o => this._isMultiProductFrame(o)
        );
    }

    /**
     * Frame taşınırken: slot objelerini delta kadar kaydır, highlight güncelle
     */
    _onFrameMoving(frame) {
        const canvas = this.editor?.canvas;
        if (!canvas) return;

        // Önceki frame pozisyonunu sakla (ilk seferde mevcut pozisyon)
        if (this._lastFramePos === undefined) {
            this._lastFramePos = { left: frame.left, top: frame.top };
        }

        const deltaX = frame.left - this._lastFramePos.left;
        const deltaY = frame.top - this._lastFramePos.top;

        if (deltaX === 0 && deltaY === 0) return;

        // Tüm slot objelerini delta kadar kaydır
        const frameId = frame.id || frame.objectId || 'frame';
        canvas.getObjects().forEach(obj => {
            // Slot içi objeler (metin, barkod, vs.)
            if (obj.inMultiFrame && (obj.parentFrameId === frameId || obj.parentFrameId === 'frame')) {
                obj.set({
                    left: obj.left + deltaX,
                    top: obj.top + deltaY
                });
                obj.setCoords();
            }
            // Transient slot görselleri (ayırıcı çizgiler, slot numaraları)
            if (obj.isSlotDivider || obj.isSlotLabel) {
                obj.set({
                    left: obj.left + deltaX,
                    top: obj.top + deltaY
                });
                // Line nesneleri için x1/y1/x2/y2 de güncellenmeli
                if (obj.x1 !== undefined) {
                    obj.set({ x1: obj.x1 + deltaX, y1: obj.y1 + deltaY, x2: obj.x2 + deltaX, y2: obj.y2 + deltaY });
                }
                obj.setCoords();
            }
        });

        this._lastFramePos = { left: frame.left, top: frame.top };

        // Highlight güncelle
        if (this._slotHighlight && this._activeSlotId) {
            this._slotHighlight.set({
                left: this._slotHighlight.left + deltaX,
                top: this._slotHighlight.top + deltaY
            });
            this._slotHighlight.setCoords();
        }

        canvas.requestRenderAll();
    }

    /**
     * Frame boyutlandırılırken: slot objelerini oransal olarak yeniden konumlandır
     */
    _onFrameScaling(frame) {
        const canvas = this.editor?.canvas;
        if (!canvas) return;

        // Ölçeklenme sırasında slot objelerini güncelle
        // Frame'in mevcut ölçekli boyutlarını ve önceki boyutlarını karşılaştır
        if (!this._lastFrameScale) {
            this._lastFrameScale = {
                scaleX: frame.scaleX || 1,
                scaleY: frame.scaleY || 1,
                left: frame.left,
                top: frame.top
            };
        }

        const prevTopLeft = {
            x: (frame.originX === 'center') ? this._lastFrameScale.left - (frame.width * this._lastFrameScale.scaleX) / 2 : this._lastFrameScale.left,
            y: (frame.originY === 'center') ? this._lastFrameScale.top - (frame.height * this._lastFrameScale.scaleY) / 2 : this._lastFrameScale.top,
            w: frame.width * this._lastFrameScale.scaleX,
            h: frame.height * this._lastFrameScale.scaleY
        };

        const newTopLeft = this._getFrameTopLeft(frame);

        const frameId = frame.id || frame.objectId || 'frame';
        canvas.getObjects().forEach(obj => {
            // Slot içi objeler: oransal pozisyon
            if (obj.inMultiFrame && (obj.parentFrameId === frameId || obj.parentFrameId === 'frame')) {
                const relX = (prevTopLeft.w > 0) ? (obj.left - prevTopLeft.x) / prevTopLeft.w : 0;
                const relY = (prevTopLeft.h > 0) ? (obj.top - prevTopLeft.y) / prevTopLeft.h : 0;

                obj.set({
                    left: newTopLeft.x + relX * newTopLeft.w,
                    top: newTopLeft.y + relY * newTopLeft.h
                });
                obj.setCoords();
            }

            // Transient slot görselleri (divider, label): oransal pozisyon
            if (obj.isSlotDivider || obj.isSlotLabel) {
                const relX = (prevTopLeft.w > 0) ? (obj.left - prevTopLeft.x) / prevTopLeft.w : 0;
                const relY = (prevTopLeft.h > 0) ? (obj.top - prevTopLeft.y) / prevTopLeft.h : 0;
                const newLeft = newTopLeft.x + relX * newTopLeft.w;
                const newTop = newTopLeft.y + relY * newTopLeft.h;

                obj.set({ left: newLeft, top: newTop });

                // Line objeleri: uç noktalarını da güncelle
                if (obj.x1 !== undefined && obj.isSlotDivider) {
                    const relX1 = (prevTopLeft.w > 0) ? (obj.x1 - prevTopLeft.x) / prevTopLeft.w : 0;
                    const relY1 = (prevTopLeft.h > 0) ? (obj.y1 - prevTopLeft.y) / prevTopLeft.h : 0;
                    const relX2 = (prevTopLeft.w > 0) ? (obj.x2 - prevTopLeft.x) / prevTopLeft.w : 0;
                    const relY2 = (prevTopLeft.h > 0) ? (obj.y2 - prevTopLeft.y) / prevTopLeft.h : 0;

                    obj.set({
                        x1: newTopLeft.x + relX1 * newTopLeft.w,
                        y1: newTopLeft.y + relY1 * newTopLeft.h,
                        x2: newTopLeft.x + relX2 * newTopLeft.w,
                        y2: newTopLeft.y + relY2 * newTopLeft.h
                    });
                }
                obj.setCoords();
            }
        });

        this._lastFrameScale = {
            scaleX: frame.scaleX || 1,
            scaleY: frame.scaleY || 1,
            left: frame.left,
            top: frame.top
        };

        // Highlight güncelle
        if (this._activeSlotId && this._activeFrame === frame) {
            this._highlightActiveSlot(this._activeSlotId);
        }

        canvas.requestRenderAll();
    }

    /**
     * Frame değişikliği tamamlandığında: pozisyon cache güncelle, divider/label yeniden oluştur
     */
    _onFrameModified(frame, canvas) {
        // Sonraki taşıma/ölçekleme için mevcut durumu kaydet
        this._lastFramePos = { left: frame.left, top: frame.top };
        this._lastFrameScale = {
            scaleX: frame.scaleX || 1,
            scaleY: frame.scaleY || 1,
            left: frame.left,
            top: frame.top
        };

        // Divider/label'ları yeniden oluştur (en temiz yaklaşım — konum hesaplama hataları önlenir)
        this._restoreMultiFrameVisuals();

        // Highlight'ı son pozisyona göre güncelle
        if (this._activeSlotId && this._activeFrame === frame) {
            this._highlightActiveSlot(this._activeSlotId);
        }

        canvas.requestRenderAll();
    }

    /**
     * Toolbar aksiyonlarını işle
     */
    async _handleToolbarAction(action, btn) {
        if (!this.editor) return;

        try {
            switch (action) {
                case 'add-text':
                    await this.editor.addText();
                    break;
                case 'add-shape':
                    await this.editor.addShape();
                    break;
                case 'add-rect':
                    await this.editor.addRect();
                    break;
                case 'add-circle':
                    await this.editor.addCircle();
                    break;
                case 'add-line':
                    await this._openLinePicker();
                    break;
                case 'add-image':
                    this._openMediaPicker('image');
                    break;
                case 'undo':
                    this.editor.undo();
                    break;
                case 'redo':
                    this.editor.redo();
                    break;
                case 'zoom-in':
                    this.editor.zoomIn();
                    this._updateZoomDisplay();
                    break;
                case 'zoom-out':
                    this.editor.zoomOut();
                    this._updateZoomDisplay();
                    break;
                case 'zoom-fit':
                    this.editor.zoomFit();
                    this._updateZoomDisplay();
                    break;
                case 'toggle-grid':
                    this.editor.toggleGrid();
                    btn?.classList.toggle('active');
                    break;
                case 'toggle-snap':
                    this.editor.toggleSnap();
                    btn?.classList.toggle('active');
                    break;
                case 'add-multi-frame':
                    const layout = btn?.dataset?.layout || '2x2';
                    await this._addMultiProductFrame(layout);
                    break;
                case 'toggle-inspector':
                    this._toggleFloatingInspector();
                    btn?.classList.toggle('active');
                    break;
                case 'save':
                    this._saveTemplate();
                    break;
                default:
                    Logger.warn('[EditorWrapper] Bilinmeyen aksiyon:', action);
            }
        } catch (error) {
            Logger.error('[EditorWrapper] Toolbar action error:', action, error);
        }
    }

    /**
     * Device preset uygula
     */
    _applyDevicePreset(presetId, width, height) {
        if (!this.editor) return;

        Logger.debug('[EditorWrapper] Device preset uygulanıyor:', presetId, width, height);

        // Canvas boyutunu değiştir
        this.editor.setCanvasSize(width, height);

        // UI güncelle
        this._updateCanvasSizeDisplay(width, height);
        document.getElementById('custom-width').value = width;
        document.getElementById('custom-height').value = height;

        // Preset ID'yi sakla
        this._currentPresetId = presetId;
    }

    /**
     * Özel boyut uygula
     */
    _applyCustomSize(width, height) {
        if (!this.editor) return;

        // Sınırları kontrol et
        width = Math.max(100, Math.min(3840, width));
        height = Math.max(100, Math.min(3840, height));

        Logger.debug('[EditorWrapper] Özel boyut uygulanıyor:', width, height);

        // Canvas boyutunu değiştir
        this.editor.setCanvasSize(width, height);

        // UI güncelle
        this._updateCanvasSizeDisplay(width, height);

        // Preset seçimini temizle
        document.querySelectorAll('.device-preset-btn').forEach(b => b.classList.remove('active'));
        this._currentPresetId = 'custom';
    }

    /**
     * Grid layout uygula
     */
    _applyGridLayout(layoutId) {
        if (!this.editor) return;

        Logger.debug('[EditorWrapper] Grid layout uygulanıyor:', layoutId);

        // Grid manager varsa ve applyLayout metodu varsa kullan
        if (this.editor.gridManager && typeof this.editor.gridManager.applyLayout === 'function') {
            this.editor.gridManager.applyLayout(layoutId);
        } else {
            Logger.warn('[EditorWrapper] GridManager.applyLayout metodu bulunamadı - v7 editörde henüz desteklenmiyor');
        }

        this._currentGridLayoutId = layoutId;
    }

    /**
     * Eleman ekle
     */
    async _addElement(elementType) {
        if (!this.editor) return;

        Logger.debug('[EditorWrapper] Eleman ekleniyor:', elementType);

        try {
            switch (elementType) {
                case 'text':
                    await this.editor.addText();
                    break;
                case 'media':
                    this._openMediaPicker('media');
                    break;
                case 'image':
                    this._openMediaPicker('image');
                    break;
                case 'video':
                    this._openMediaPicker('video');
                    break;
                case 'shape':
                    await this.editor.addShape();
                    break;
                case 'line':
                    await this._openLinePicker();
                    break;
                case 'border-frame':
                    await this.editor.addBorderFrame();
                    break;
                case 'background':
                    await this._openCanvasBackgroundPicker();
                    break;
                case 'rect':
                    await this.editor.addRect();
                    break;
                case 'circle':
                    await this.editor.addCircle();
                    break;
                case 'barcode':
                    await this._addBarcode();
                    break;
                case 'qrcode':
                    await this._addQRCode();
                    break;
                case 'price':
                    await this._addPriceBox();
                    break;
                default:
                    Logger.warn('[EditorWrapper] Bilinmeyen eleman tipi:', elementType);
            }
        } catch (error) {
            Logger.error('[EditorWrapper] Element add error:', elementType, error);
        }
    }

    async _openLinePicker() {
        if (!this.editor) return;
        const { LinePicker } = await import('../../editor/components/LinePicker.js');

        LinePicker.open({
            __: (key) => this.__(key),
            onSelect: async (style) => {
                if (typeof this.editor.addLinePreset === 'function') {
                    await this.editor.addLinePreset(style);
                } else {
                    await this.editor.addLine({
                        x1: 60,
                        y1: 60,
                        x2: 300,
                        y2: 60,
                        stroke: style.stroke,
                        strokeWidth: style.strokeWidth,
                        strokeDashArray: style.strokeDashArray || null,
                        strokeLineCap: style.strokeLineCap || 'round',
                        strokeLineJoin: style.strokeLineJoin || 'round',
                        fill: null
                    });
                }
            }
        });
    }

    async _openCanvasBackgroundPicker() {
        if (!this.editor?.canvas) return;
        const currentRaw = String(this.editor.canvas.backgroundColor || '#ffffff');
        const current = /^#[0-9a-f]{6}$/i.test(currentRaw) ? currentRaw.toUpperCase() : '#FFFFFF';

        const content = `
            <div class="property-section-body">
                <div class="property-item">
                    <label>${this._t('editor.tools.background', 'Arkaplan')}</label>
                    <div class="property-color-input">
                        <input type="color" id="canvas-bg-color" class="form-color" value="${current}">
                        <input type="text" id="canvas-bg-hex" class="form-input form-color-hex" value="${current}" placeholder="#000000" maxlength="7" spellcheck="false" autocomplete="off">
                    </div>
                </div>
            </div>
        `;

        const syncInputs = () => {
            const colorInput = document.getElementById('canvas-bg-color');
            const hexInput = document.getElementById('canvas-bg-hex');
            if (!colorInput || !hexInput) return;

            colorInput.addEventListener('input', () => {
                hexInput.value = String(colorInput.value || '#000000').toUpperCase();
            });

            hexInput.addEventListener('input', () => {
                let next = String(hexInput.value || '').trim().toUpperCase();
                if (next && !next.startsWith('#')) next = `#${next}`;
                if (!/^#[0-9A-F]{0,6}$/.test(next)) return;
                hexInput.value = next;
                if (/^#[0-9A-F]{6}$/.test(next)) {
                    colorInput.value = next;
                }
            });
        };

        Modal.show({
            title: this._t('editor.tools.background', 'Arkaplan'),
            icon: 'ti-palette',
            content,
            size: 'sm',
            showFooter: true,
            confirmText: this.__('common.apply') || 'Uygula',
            cancelText: this.__('common.cancel') || 'Iptal',
            onConfirm: async () => {
                const colorInput = document.getElementById('canvas-bg-color');
                const hexInput = document.getElementById('canvas-bg-hex');
                const hex = String(hexInput?.value || '').trim().toUpperCase();
                const color = /^#[0-9A-F]{6}$/.test(hex)
                    ? hex
                    : (colorInput?.value || '#FFFFFF').toUpperCase();
                this.editor.canvas.backgroundColor = color;
                this.editor.canvas.requestRenderAll();
                this.editor._saveHistory?.();
            }
        });

        setTimeout(syncInputs, 0);
    }

    /**
     * Dinamik alan ekle
     */
    async _addDynamicField(fieldKey) {
        if (!this.editor) return;

        Logger.debug('[EditorWrapper] Dinamik alan ekleniyor:', fieldKey);

        const currencySymbol = this.app?.i18n?.getCurrencySymbol?.() || '₺';

        // Dinamik alan etiketleri
        const fieldLabels = {
            product_name: this.__('editor.dynamicFields.productName'),
            sku: 'SKU',
            barcode: 'Barkod',
            description: this.__('editor.dynamicFields.description'),
            slug: 'slug',
            current_price: `0.00 ${currencySymbol}`,
            previous_price: `0.00 ${currencySymbol}`,
            price_with_currency: `0.00 ${currencySymbol}`,
            vat_rate: '%18',
            discount_percent: '%0',
            campaign_text: 'KAMPANYA',
            price_updated_at: '01.01.2026',
            price_valid_until: '31.01.2026',
            category: this.__('editor.dynamicFields.category'),
            subcategory: this.__('editor.dynamicFields.subcategory'),
            brand: this.__('editor.dynamicFields.brand'),
            unit: this.__('editor.dynamicFields.unit'),
            weight: this.__('editor.dynamicFields.weight'),
            stock: '100',
            origin: this.__('editor.dynamicFields.origin'),
            production_type: 'Organik',
            shelf_location: 'A-12-3',
            supplier_code: 'SUP-001',
            image_url: `[${this.__('editor.dynamicFields.imageUrl')}]`,
            video_url: '[Video]',
            videos: '[Videolar]',
            kunye_no: '[QR Kod]',
            date_today: new Date().toLocaleDateString('tr-TR'),
            date_time: new Date().toLocaleString('tr-TR'),
            // HAL alanları
            uretici_adi: this.__('editor.dynamicFields.ureticiAdi'),
            malin_adi: this.__('editor.dynamicFields.malinAdi'),
            malin_cinsi: this.__('editor.dynamicFields.malinCinsi'),
            malin_turu: this.__('editor.dynamicFields.malinTuru'),
            uretim_yeri: this.__('editor.dynamicFields.uretimYeri'),
            uretim_sekli: 'Organik',
            ilk_bildirim_tarihi: '01.01.2026',
            malin_sahibi: this.__('editor.dynamicFields.malinSahibi'),
            tuketim_yeri: this.__('editor.dynamicFields.tuketimYeri'),
            tuketim_bildirim_tarihi: '01.01.2026',
            gumruk_kapisi: this.__('editor.dynamicFields.gumrukKapisi'),
            uretim_ithal_tarihi: '01.01.2026',
            miktar: '100 kg',
            alis_fiyati: `10.00 ${currencySymbol}`,
            isletme_adi: this.__('editor.dynamicFields.isletmeAdi'),
            sertifikasyon_kurulusu: this.__('editor.dynamicFields.sertifikasyonKurulusu'),
            sertifika_no: 'CERT-001',
            diger_bilgiler: this.__('editor.dynamicFields.digerBilgiler')
        };

        const label = fieldLabels[fieldKey] || `{{${fieldKey}}}`;

        try {
            // Dinamik görsel placeholder
            if (fieldKey === 'image_url') {
                await this._addDynamicImagePlaceholder(fieldKey);
                return;
            }

            // Dinamik video placeholder
            if (fieldKey === 'video_url' || fieldKey === 'videos') {
                await this._addDynamicVideoPlaceholder(fieldKey);
                return;
            }

            if (fieldKey === 'kunye_no') {
                // QR kod ekle
                await this._addQRCode(fieldKey);
                return;
            }

            if (fieldKey === 'barcode') {
                // Barkod ekle
                await this._addBarcode(fieldKey);
                return;
            }

            // Metin olarak ekle
            await this.editor.addText(label, {
                isDynamicField: true,
                isDataField: true,
                dynamicField: fieldKey,
                fontSize: fieldKey.includes('price') || fieldKey === 'alis_fiyati' ? 32 : 18
            });
        } catch (error) {
            Logger.error('[EditorWrapper] Dynamic field add error:', fieldKey, error);
        }
    }

    /**
     * Dinamik görsel placeholder ekle
     */
    async _addDynamicImagePlaceholder(fieldKey) {
        if (!this.editor) return;

        // Lokal SVG data URI ile placeholder (ağ bağımlılığı yok)
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
            <rect width="200" height="200" fill="#f0f0f0"/>
            <rect x="2" y="2" width="196" height="196" fill="none" stroke="#cccccc" stroke-width="2" stroke-dasharray="8,4"/>
            <text x="100" y="90" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#888888">Ürün</text>
            <text x="100" y="110" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#888888">Görseli</text>
            <path d="M70 130 L100 150 L130 130 L130 160 L70 160 Z" fill="#cccccc"/>
            <circle cx="85" cy="145" r="8" fill="#cccccc"/>
        </svg>`;
        const placeholderUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(placeholderSvg)));

        if (this.editor.addImage) {
            try {
                await this.editor.addImage(placeholderUrl, {
                    isDynamicField: true,
                    isDataField: true,
                    dynamicField: fieldKey,
                    customType: 'dynamic-image'
                });
                return;
            } catch (error) {
                Logger.warn('[EditorWrapper] Image placeholder failed, using rectangle fallback:', error);
            }
        }

        // Fallback: görsel yerine dikdörtgen placeholder
        if (this.editor.addRect) {
            await this.editor.addRect({
                width: 150,
                height: 150,
                fill: '#f0f0f0',
                stroke: '#cccccc',
                strokeWidth: 2,
                isDynamicField: true,
                isDataField: true,
                dynamicField: fieldKey,
                customType: 'dynamic-image'
            });
        }
    }

    /**
     * Dinamik video placeholder ekle
     */
    async _addDynamicVideoPlaceholder(fieldKey) {
        if (!this.editor) return;

        // Öncelik: TemplateEditorV7 native video placeholder (tek Group nesne)
        if (typeof this.editor._addDynamicField === 'function') {
            await this.editor._addDynamicField(fieldKey, {
                type: 'video',
                placeholder: fieldKey === 'videos' ? '{Videos}' : '{Video}'
            });
            return;
        }

        // Fallback: tek nesne olarak rect placeholder
        if (this.editor.addRect) {
            await this.editor.addRect({
                width: 200,
                height: 150,
                fill: '#1a1a2e',
                stroke: '#4a4a6a',
                strokeWidth: 2,
                isDynamicField: true,
                isDataField: true,
                dynamicField: fieldKey,
                customType: 'dynamic-video'
            });
        }
    }

    /**
     * Barkod ekle - Modal ile ayarlar
     */
    async _addBarcode(fieldKey = 'barcode') {
        if (!this.editor) return;

        // Barkod ayarları modalını göster
        this._showBarcodeSettingsModal(fieldKey);
    }

    /**
     * Barkod ayarları modalı
     */
    _showBarcodeSettingsModal(fieldKey = 'barcode') {
        const barcodeTypes = [
            { id: 'EAN13', label: 'EAN-13', desc: this.__('editor.elementSettings.barcodeTypes.ean13') || '13 haneli Avrupa standart barkod' },
            { id: 'EAN8', label: 'EAN-8', desc: this.__('editor.elementSettings.barcodeTypes.ean8') },
            { id: 'CODE128', label: 'Code 128', desc: this.__('editor.elementSettings.barcodeTypes.code128') },
            { id: 'CODE39', label: 'Code 39', desc: this.__('editor.elementSettings.barcodeTypes.code39') },
            { id: 'UPC', label: 'UPC-A', desc: this.__('editor.elementSettings.barcodeTypes.upc') || '12 haneli Amerikan barkod' },
            { id: 'ITF14', label: 'ITF-14', desc: this.__('editor.elementSettings.barcodeTypes.itf14') || '14 haneli koli/palet barkod' }
        ];

        const dataSources = [
            { id: '{{barcode}}', label: this.__('editor.dynamicFields.barcode') || 'Barkod (Dinamik)' },
            { id: '{{sku}}', label: this.__('editor.dynamicFields.sku') || 'SKU (Dinamik)' },
            { id: 'custom', label: this.__('editor.elementSettings.customValue') }
        ];

        const content = `
            <div class="element-settings-modal">
                <div class="settings-group">
                    <label class="settings-label">${this.__('editor.elementSettings.dataSource')}</label>
                    <select id="barcode-data-source" class="settings-select">
                        ${dataSources.map((src, i) => `
                            <option value="${src.id}" ${i === 0 ? 'selected' : ''}>${src.label}</option>
                        `).join('')}
                    </select>
                </div>

                <div id="barcode-auto-detect-info" class="settings-info-box">
                    <i class="ti ti-info-circle"></i>
                    <span>${this.__('editor.elementSettings.barcodeAutoDetect')}</span>
                </div>

                <div class="settings-group custom-value-group" style="display: none;">
                    <label class="settings-label">${this.__('editor.elementSettings.customValue')}</label>
                    <input type="text" id="barcode-custom-value" class="settings-input" placeholder="8690000000001">
                    <div id="barcode-validation-msg" class="settings-validation-msg"></div>
                </div>

                <div id="barcode-type-section" class="settings-group" style="display: none;">
                    <label class="settings-label">${this.__('editor.elementSettings.barcodeType')}</label>
                    <div class="barcode-type-grid">
                        ${barcodeTypes.map((type, i) => `
                            <label class="barcode-type-option ${i === 0 ? 'selected' : ''}">
                                <input type="radio" name="barcode-type" value="${type.id}" ${i === 0 ? 'checked' : ''}>
                                <div class="barcode-type-content">
                                    <span class="barcode-type-name">${type.label}</span>
                                    <span class="barcode-type-desc">${type.desc}</span>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="settings-group">
                    <label class="settings-label">${this.__('editor.elementSettings.displayValue')}</label>
                    <label class="settings-checkbox">
                        <input type="checkbox" id="barcode-display-value" checked>
                        <span>${this.__('editor.elementSettings.showBarcodeNumber')}</span>
                    </label>
                </div>

                <div class="settings-preview">
                    <label class="settings-label">${this.__('editor.elementSettings.preview')}</label>
                    <div id="barcode-preview-container" class="barcode-preview"></div>
                </div>
            </div>
        `;

        Modal.show({
            title: this.__('editor.elementSettings.barcodeSettings'),
            icon: 'ti-barcode',
            content: content,
            size: 'md',
            confirmText: this.__('actions.add') || 'Ekle',
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const dataSource = document.getElementById('barcode-data-source')?.value || '{{barcode}}';
                const customValue = document.getElementById('barcode-custom-value')?.value || '';
                const displayValue = document.getElementById('barcode-display-value')?.checked ?? true;
                const isCustom = dataSource === 'custom';

                let barcodeType;
                let barcodeValue;

                if (isCustom) {
                    // Özel değer: Kullanıcı türü seçer, uyumluluk kontrol edilir
                    barcodeType = document.querySelector('input[name="barcode-type"]:checked')?.value || 'CODE128';
                    barcodeValue = customValue;

                    if (!customValue.trim()) {
                        Toast.warning(this.__('editor.elementSettings.enterBarcodeValue'));
                        return false;
                    }

                    // Uyumluluk kontrolü
                    const validation = this._validateBarcodeCompatibility(customValue, barcodeType);
                    if (!validation.compatible) {
                        Toast.warning(validation.message);
                        return false;
                    }
                } else {
                    // Dinamik alan: Tür otomatik algılanacak, CODE128 fallback olarak sakla
                    barcodeType = 'AUTO';
                    barcodeValue = dataSource;
                }

                await this._createBarcodeElement({
                    barcodeType,
                    barcodeValue,
                    displayValue,
                    dynamicField: !isCustom ? dataSource.replace(/[{}]/g, '') : null
                });
            }
        });

        // Modal açıldıktan sonra event'ları bağla
        setTimeout(() => {
            // Tür seçimi (sadece özel değer modunda görünür)
            document.querySelectorAll('.barcode-type-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    document.querySelectorAll('.barcode-type-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    opt.querySelector('input').checked = true;
                    this._updateBarcodePreview();
                    this._validateBarcodeInput();
                });
            });

            // Veri kaynağı değişimi
            document.getElementById('barcode-data-source')?.addEventListener('change', (e) => {
                const isCustom = e.target.value === 'custom';
                const customGroup = document.querySelector('.custom-value-group');
                const typeSection = document.getElementById('barcode-type-section');
                const autoDetectInfo = document.getElementById('barcode-auto-detect-info');

                if (customGroup) customGroup.style.display = isCustom ? 'block' : 'none';
                if (typeSection) typeSection.style.display = isCustom ? 'block' : 'none';
                if (autoDetectInfo) autoDetectInfo.style.display = isCustom ? 'none' : 'flex';

                this._updateBarcodePreview();
            });

            // Özel değer girişi - otomatik tür algılama ve uyumluluk kontrolü
            document.getElementById('barcode-custom-value')?.addEventListener('input', () => {
                this._validateBarcodeInput();
                this._updateBarcodePreview();
            });

            // Değer göster checkbox
            document.getElementById('barcode-display-value')?.addEventListener('change', () => {
                this._updateBarcodePreview();
            });

            // İlk önizleme
            this._updateBarcodePreview();
        }, 100);
    }

    /**
     * Barkod değeri ile seçili tür arasındaki uyumluluğu kontrol et
     */
    _validateBarcodeCompatibility(value, format) {
        if (!value || !value.trim()) {
            return { compatible: true, message: '' };
        }

        const cleaned = value.replace(/[\s\-]/g, '');
        const isNumeric = /^\d+$/.test(cleaned);

        const rules = {
            'EAN13': { numeric: true, length: 13, name: 'EAN-13' },
            'EAN8':  { numeric: true, length: 8, name: 'EAN-8' },
            'UPC':   { numeric: true, length: 12, name: 'UPC-A' },
            'ITF14': { numeric: true, length: 14, name: 'ITF-14' },
            'CODE39': { pattern: /^[A-Z0-9\-\.$/+% ]+$/i, maxLength: 43, name: 'Code 39' },
            'CODE128': { maxLength: 80, name: 'Code 128' }
        };

        const rule = rules[format];
        if (!rule) return { compatible: true, message: '' };

        if (rule.numeric && !isNumeric) {
            return {
                compatible: false,
                message: `${rule.name} sadece rakam içerebilir`
            };
        }

        if (rule.length && cleaned.length !== rule.length) {
            return {
                compatible: false,
                message: `${rule.name} tam olarak ${rule.length} hane olmalıdır (şu an: ${cleaned.length})`
            };
        }

        if (rule.pattern && !rule.pattern.test(value)) {
            return {
                compatible: false,
                message: `${rule.name} sadece harf, rakam ve - . $ / + % karakterlerini destekler`
            };
        }

        if (rule.maxLength && value.length > rule.maxLength) {
            return {
                compatible: false,
                message: `${rule.name} en fazla ${rule.maxLength} karakter olabilir`
            };
        }

        // Ek: EAN/UPC check digit doğrulama
        if (format === 'EAN13' && cleaned.length === 13) {
            if (!BarcodeUtils.validateEAN13(cleaned)) {
                return { compatible: true, message: '', warning: this.__('editor.elementSettings.barcodeCheckDigitError') };
            }
        }
        if (format === 'EAN8' && cleaned.length === 8) {
            if (!BarcodeUtils.validateEAN8(cleaned)) {
                return { compatible: true, message: '', warning: this.__('editor.elementSettings.barcodeCheckDigitError') };
            }
        }

        return { compatible: true, message: '' };
    }

    /**
     * Özel değer girişinde otomatik tür algılama ve uyumluluk bildirimi
     */
    _validateBarcodeInput() {
        const customValue = document.getElementById('barcode-custom-value')?.value || '';
        const msgEl = document.getElementById('barcode-validation-msg');
        if (!msgEl) return;

        if (!customValue.trim()) {
            msgEl.innerHTML = '';
            return;
        }

        const detected = BarcodeUtils.detectType(customValue);
        const selectedFormat = document.querySelector('input[name="barcode-type"]:checked')?.value || 'CODE128';

        // Tür algılama sonucunu göster
        const detectedJsBarcode = this._mapBarcodeUtilsToJsBarcode(detected.type);
        const compatibility = this._validateBarcodeCompatibility(customValue, selectedFormat);

        if (!compatibility.compatible) {
            msgEl.innerHTML = `<span class="validation-error"><i class="ti ti-alert-triangle"></i> ${compatibility.message}</span>`;
            if (detectedJsBarcode) {
                msgEl.innerHTML += `<span class="validation-hint"><i class="ti ti-bulb"></i> Algılanan tür: <strong>${BarcodeUtils.getTypeName(detected.type)}</strong></span>`;
            }
        } else if (compatibility.warning) {
            msgEl.innerHTML = `<span class="validation-warning"><i class="ti ti-alert-circle"></i> ${compatibility.warning}</span>`;
        } else if (detected.type && detectedJsBarcode !== selectedFormat) {
            msgEl.innerHTML = `<span class="validation-hint"><i class="ti ti-bulb"></i> Algılanan tür: <strong>${BarcodeUtils.getTypeName(detected.type)}</strong> — seçili tür farklı</span>`;
        } else {
            msgEl.innerHTML = `<span class="validation-success"><i class="ti ti-check"></i> ${detected.message || 'Uyumlu'}</span>`;
        }
    }

    /**
     * BarcodeUtils type → JsBarcode format mapping
     */
    _mapBarcodeUtilsToJsBarcode(type) {
        const map = {
            'ean13': 'EAN13', 'ean8': 'EAN8', 'upca': 'UPC', 'upce': 'UPCE',
            'itf14': 'ITF14', 'code39': 'CODE39', 'code128': 'CODE128'
        };
        return map[type] || null;
    }

    /**
     * Barkod önizlemesini güncelle
     */
    _updateBarcodePreview() {
        const container = document.getElementById('barcode-preview-container');
        if (!container) return;

        const dataSource = document.getElementById('barcode-data-source')?.value || '{{barcode}}';
        const customValue = document.getElementById('barcode-custom-value')?.value || '';
        const displayValue = document.getElementById('barcode-display-value')?.checked ?? true;
        const isCustom = dataSource === 'custom';

        let value, format;

        if (isCustom) {
            // Özel değer: Kullanıcının seçtiği tür + girdiği değer
            format = document.querySelector('input[name="barcode-type"]:checked')?.value || 'CODE128';
            value = customValue || this._getBarcodeDemoValue(format);
        } else {
            // Dinamik alan: Otomatik algılama ile demo değer
            // Demo barkod değeri EAN-13 formatında (en yaygın)
            value = '8690000000001';
            format = 'EAN13';
        }

        container.innerHTML = '';

        try {
            if (typeof JsBarcode !== 'undefined') {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

                try {
                    JsBarcode(svg, value, {
                        format: format,
                        width: 2,
                        height: 60,
                        displayValue: displayValue,
                        fontSize: 14,
                        margin: 10,
                        background: '#ffffff'
                    });
                } catch (formatError) {
                    Logger.warn(`Barkod önizleme format hatası (${format}):`, formatError.message);
                    JsBarcode(svg, value, {
                        format: 'CODE128',
                        width: 2,
                        height: 60,
                        displayValue: displayValue,
                        fontSize: 14,
                        margin: 10,
                        background: '#ffffff'
                    });
                }

                container.appendChild(svg);

                // Dinamik modda bilgi notu ekle
                if (!isCustom) {
                    const infoNote = document.createElement('div');
                    infoNote.className = 'barcode-preview-note';
                    infoNote.textContent = this.__('editor.elementSettings.barcodePreviewNote');
                    container.appendChild(infoNote);
                }
            } else {
                container.innerHTML = `<div class="barcode-preview-placeholder">${value}</div>`;
            }
        } catch (e) {
            container.innerHTML = `<div class="barcode-preview-error">${this.__('editor.elementSettings.invalidBarcode')}</div>`;
        }
    }

    /**
     * Barkod türüne göre demo değer döndür
     */
    _getBarcodeDemoValue(format) {
        const demoValues = {
            'EAN13': '8690000000001',
            'EAN8': '96385074',
            'CODE128': 'ABC-12345',
            'CODE39': 'CODE39',
            'UPC': '012345678905',
            'ITF14': '10012345678902'
        };
        return demoValues[format] || 'ABC-12345';
    }

    /**
     * Barkod elemanı oluştur
     */
    async _createBarcodeElement(options = {}) {
        if (!this.editor) return;

        const { barcodeType = 'EAN13', barcodeValue = '{{barcode}}', displayValue = true, dynamicField = null } = options;

        // Otomatik algılama: barcodeType=AUTO ise demo değerden algıla, fallback CODE128
        let resolvedType = barcodeType;
        if (barcodeType === 'AUTO') {
            resolvedType = 'CODE128'; // Dinamik alanlar için CODE128 en geniş uyumluluk sağlar
        }

        // Demo değerler
        const demoValues = {
            'EAN13': '8690000000001',
            'EAN8': '96385074',
            'CODE128': 'ABC-12345',
            'CODE39': 'CODE39',
            'UPC': '012345678905',
            'ITF14': '10012345678902'
        };

        // Gerçek görsel değer
        const displayText = barcodeValue.startsWith('{{') ? (demoValues[resolvedType] || 'ABC-12345') : barcodeValue;

        // TemplateEditorV7'nin addBarcode metodunu kullan
        if (this.editor.addBarcode) {
            try {
                await this.editor.addBarcode(displayText, {
                    format: resolvedType,
                    isDynamicField: !!dynamicField,
                    isDataField: !!dynamicField,
                    dynamicField: dynamicField,
                    displayValue: displayValue,
                    barcodeAutoDetect: barcodeType === 'AUTO'
                });
                return;
            } catch (error) {
                Logger.warn('[EditorWrapper] Barkod oluşturulamadı, fallback kullanılıyor:', error);
            }
        }

        // Fallback: JsBarcode ile SVG oluştur ve Image olarak ekle
        try {
            if (typeof JsBarcode !== 'undefined') {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                JsBarcode(svg, displayText, {
                    format: resolvedType,
                    width: 2,
                    height: 80,
                    displayValue: displayValue,
                    fontSize: 14,
                    margin: 10,
                    background: '#ffffff'
                });

                // SVG'yi data URL'e çevir
                const svgData = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);

                if (this.editor.addImage) {
                    await this.editor.addImage(url, {
                        isDynamicField: !!dynamicField,
                        isDataField: !!dynamicField,
                        dynamicField: dynamicField,
                        customType: 'barcode',
                        barcodeType: barcodeType === 'AUTO' ? 'AUTO' : resolvedType,
                        barcodeValue: barcodeValue,
                        barcodeAutoDetect: barcodeType === 'AUTO'
                    });
                    URL.revokeObjectURL(url);
                    return;
                }
            }
        } catch (svgError) {
            Logger.warn('[EditorWrapper] SVG barkod oluşturulamadı:', svgError);
        }

        // Son fallback: Placeholder metin
        await this.editor.addText(`[BARCODE: ${displayText}]`, {
            fontFamily: 'Courier New',
            fontSize: 18,
            isDynamicField: !!dynamicField,
            isDataField: !!dynamicField,
            dynamicField: dynamicField,
            customType: 'barcode'
        });
    }

    /**
     * QR Kod ekle
     */
    async _addQRCode(fieldKey = 'kunye_no') {
        if (!this.editor) return;

        // QR kod ayarları modalını göster
        this._showQRCodeSettingsModal(fieldKey);
    }

    /**
     * QR Kod ayarları modalı
     */
    _showQRCodeSettingsModal(fieldKey = 'kunye_no') {
        const qrSizes = [
            { id: '60', label: this.__('editor.elementSettings.qrSizes.small'), size: 60 },
            { id: '80', label: this.__('editor.elementSettings.qrSizes.medium') || 'Orta (80x80)', size: 80 },
            { id: '100', label: this.__('editor.elementSettings.qrSizes.large'), size: 100 },
            { id: '120', label: this.__('editor.elementSettings.qrSizes.xlarge'), size: 120 }
        ];

        const dataSources = [
            { id: '{{kunye_no}}', label: this.__('editor.dynamicFields.kunyeNo') },
            { id: '{{sku}}', label: this.__('editor.dynamicFields.sku') || 'SKU (Dinamik)' },
            { id: '{{barcode}}', label: this.__('editor.dynamicFields.barcode') || 'Barkod (Dinamik)' },
            { id: 'custom', label: this.__('editor.elementSettings.customValue') }
        ];

        // Varsayılan seçimi ayarla
        const defaultSource = fieldKey ? `{{${fieldKey}}}` : '{{kunye_no}}';
        const defaultIndex = dataSources.findIndex(s => s.id === defaultSource);

        const content = `
            <div class="element-settings-modal">
                <div class="settings-group">
                    <label class="settings-label">${this.__('editor.elementSettings.dataSource')}</label>
                    <select id="qr-data-source" class="settings-select">
                        ${dataSources.map((src, i) => `
                            <option value="${src.id}" ${i === (defaultIndex >= 0 ? defaultIndex : 0) ? 'selected' : ''}>${src.label}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="settings-group custom-value-group" style="display: none;">
                    <label class="settings-label">${this.__('editor.elementSettings.customValue')}</label>
                    <input type="text" id="qr-custom-value" class="settings-input" placeholder="https://example.com veya metin">
                </div>

                <div class="settings-group">
                    <label class="settings-label">${this.__('editor.elementSettings.size') || 'Boyut'}</label>
                    <div class="qr-size-grid">
                        ${qrSizes.map((size, i) => `
                            <label class="qr-size-option ${i === 1 ? 'selected' : ''}">
                                <input type="radio" name="qr-size" value="${size.id}" ${i === 1 ? 'checked' : ''}>
                                <div class="qr-size-content">
                                    <span class="qr-size-preview" style="width: ${Math.min(size.size / 2, 40)}px; height: ${Math.min(size.size / 2, 40)}px;"></span>
                                    <span class="qr-size-label">${size.label}</span>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="settings-group">
                    <label class="settings-label">${this.__('editor.elementSettings.foreground')}</label>
                    <input type="color" id="qr-foreground-color" class="settings-color" value="#000000">
                </div>

                <div class="settings-group">
                    <label class="settings-label">${this.__('editor.elementSettings.background') || 'Arkaplan Rengi'}</label>
                    <input type="color" id="qr-background-color" class="settings-color" value="#ffffff">
                </div>

                <div class="settings-preview">
                    <label class="settings-label">${this.__('editor.elementSettings.preview')}</label>
                    <div id="qr-preview-container" class="qr-preview"></div>
                </div>
            </div>
        `;

        Modal.show({
            title: this.__('editor.elementSettings.qrcodeSettings'),
            icon: 'ti-qrcode',
            content: content,
            size: 'md',
            confirmText: this.__('actions.add') || 'Ekle',
            cancelText: this.__('actions.cancel'),
            onConfirm: async () => {
                const dataSource = document.getElementById('qr-data-source')?.value || '{{kunye_no}}';
                const customValue = document.getElementById('qr-custom-value')?.value || '';
                const size = parseInt(document.querySelector('input[name="qr-size"]:checked')?.value || '80');
                const foreground = document.getElementById('qr-foreground-color')?.value || '#000000';
                const background = document.getElementById('qr-background-color')?.value || '#ffffff';

                const qrValue = dataSource === 'custom' ? customValue : dataSource;

                await this._createQRCodeElement({
                    qrValue,
                    size,
                    foreground,
                    background,
                    dynamicField: dataSource !== 'custom' ? dataSource.replace(/[{}]/g, '') : null
                });
            }
        });

        // Modal açıldıktan sonra event'ları bağla
        setTimeout(() => {
            // Boyut seçimi
            document.querySelectorAll('.qr-size-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    document.querySelectorAll('.qr-size-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    opt.querySelector('input').checked = true;
                    this._updateQRCodePreview();
                });
            });

            // Veri kaynağı değişimi
            document.getElementById('qr-data-source')?.addEventListener('change', (e) => {
                const customGroup = document.querySelector('.custom-value-group');
                if (customGroup) {
                    customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
                }
                this._updateQRCodePreview();
            });

            // Özel değer girişi
            document.getElementById('qr-custom-value')?.addEventListener('input', () => {
                this._updateQRCodePreview();
            });

            // Renk değişimleri
            document.getElementById('qr-foreground-color')?.addEventListener('input', () => {
                this._updateQRCodePreview();
            });
            document.getElementById('qr-background-color')?.addEventListener('input', () => {
                this._updateQRCodePreview();
            });

            // İlk önizleme
            this._updateQRCodePreview();
        }, 100);
    }

    /**
     * QR Kod önizlemesini güncelle
     */
    _updateQRCodePreview() {
        const container = document.getElementById('qr-preview-container');
        if (!container) return;

        const dataSource = document.getElementById('qr-data-source')?.value || '{{kunye_no}}';
        const customValue = document.getElementById('qr-custom-value')?.value || '';
        const size = parseInt(document.querySelector('input[name="qr-size"]:checked')?.value || '80');
        const foreground = document.getElementById('qr-foreground-color')?.value || '#000000';
        const background = document.getElementById('qr-background-color')?.value || '#ffffff';

        // Demo değerler
        const demoValues = {
            '{{kunye_no}}': '2073079250202837944',
            '{{sku}}': 'SKU-12345',
            '{{barcode}}': '8690000000001'
        };

        const value = dataSource === 'custom' && customValue ? customValue : (demoValues[dataSource] || 'DEMO-QR-CODE');

        container.innerHTML = '';

        try {
            if (typeof QRCode !== 'undefined') {
                const qrDiv = document.createElement('div');
                qrDiv.style.cssText = `display: inline-block; background: ${background}; padding: 8px; border-radius: 8px;`;
                container.appendChild(qrDiv);

                new QRCode(qrDiv, {
                    text: value,
                    width: size,
                    height: size,
                    colorDark: foreground,
                    colorLight: background,
                    correctLevel: QRCode.CorrectLevel.M
                });
            } else {
                // qrcodejs yüklenmemişse placeholder göster
                container.innerHTML = `
                    <div class="qr-preview-placeholder" style="width: ${size}px; height: ${size}px; background: ${background}; border: 2px solid ${foreground}; display: flex; align-items: center; justify-content: center;">
                        <span style="color: ${foreground}; font-size: 10px; text-align: center;">QR<br>${value.substring(0, 10)}...</span>
                    </div>
                `;
            }
        } catch (e) {
            Logger.warn('[EditorWrapper] QR önizleme hatası:', e);
            container.innerHTML = `<div class="qr-preview-error">${this.__('editor.elementSettings.invalidQR')}</div>`;
        }
    }

    /**
     * QR Kod elemanı oluştur
     */
    async _createQRCodeElement(options = {}) {
        if (!this.editor) return;

        const { qrValue = '{{kunye_no}}', size = 80, foreground = '#000000', background = '#ffffff', dynamicField = null } = options;

        // Görüntülenecek değer (dinamik alanlar için placeholder)
        const displayValue = dynamicField ? `Demo: ${qrValue}` : qrValue;

        // TemplateEditorV7'nin addQRCode metodunu kullan
        if (this.editor.addQRCode) {
            try {
                await this.editor.addQRCode(displayValue.replace(/[{}]/g, ''), {
                    isDynamicField: !!dynamicField,
                    isDataField: !!dynamicField,
                    dynamicField: dynamicField,
                    width: size,
                    height: size,
                    colorDark: foreground,
                    colorLight: background,
                    qrValue: qrValue
                });
                return;
            } catch (error) {
                Logger.warn('[EditorWrapper] QR kod oluşturulamadı, fallback kullanılıyor:', error);
            }
        }

        // Fallback: qrcodejs ile canvas oluştur ve Image olarak ekle
        try {
            if (typeof QRCode !== 'undefined') {
                const tempDiv = document.createElement('div');
                tempDiv.style.cssText = 'position: absolute; left: -9999px; top: -9999px;';
                document.body.appendChild(tempDiv);

                new QRCode(tempDiv, {
                    text: displayValue.replace(/[{}]/g, ''),
                    width: size,
                    height: size,
                    colorDark: foreground,
                    colorLight: background,
                    correctLevel: QRCode.CorrectLevel.M
                });

                // QRCode canvas veya img oluşturur, kısa bir gecikme ile yakala
                await new Promise(resolve => setTimeout(resolve, 100));

                const canvas = tempDiv.querySelector('canvas');
                const img = tempDiv.querySelector('img');
                let dataUrl;

                if (canvas) {
                    dataUrl = canvas.toDataURL('image/png');
                } else if (img) {
                    dataUrl = img.src;
                }

                document.body.removeChild(tempDiv);

                if (dataUrl && this.editor.addImage) {
                    await this.editor.addImage(dataUrl, {
                        isDynamicField: !!dynamicField,
                        isDataField: !!dynamicField,
                        dynamicField: dynamicField,
                        customType: 'qrcode',
                        qrValue: qrValue,
                        qrSize: size,
                        qrForeground: foreground,
                        qrBackground: background
                    });
                    return;
                }
            }
        } catch (qrError) {
            Logger.warn('[EditorWrapper] QRCode ile oluşturulamadı:', qrError);
        }

        // Son fallback: Placeholder dikdörtgen
        await this.editor.addRect({
            width: size,
            height: size,
            fill: background,
            stroke: foreground,
            strokeWidth: 2,
            isDynamicField: !!dynamicField,
            isDataField: !!dynamicField,
            dynamicField: dynamicField,
            customType: 'qrcode',
            qrValue: qrValue
        });
    }

    /**
     * Çoklu ürün çerçevesi ekle
     * @param {string} layout - Layout formatı (1x2, 2x1, 2x2, 3x1, 2x3)
     */
    async _addMultiProductFrame(layout) {
        if (!this.editor) return;

        const [cols, rows] = layout.split('x').map(Number);
        if (!cols || !rows) {
            Logger.warn('[EditorWrapper] Geçersiz layout:', layout);
            return;
        }

        try {
            // ObjectFactory varsa kullan
            if (this.editor.objectFactory?.createMultiProductFrame) {
                const canvasWidth = this.editor.canvas?.width || 800;
                const canvasHeight = this.editor.canvas?.height || 1280;
                const frameWidth = Math.min(canvasWidth - 100, cols * 200);
                const frameHeight = Math.min(canvasHeight - 100, rows * 200);
                // originX/Y: 'center' olduğu için left/top merkez noktasıdır
                const frame = await this.editor.objectFactory.createMultiProductFrame(cols, rows, {
                    left: canvasWidth / 2,
                    top: canvasHeight / 2,
                    width: frameWidth,
                    height: frameHeight
                });
                if (frame) {
                    // NOT: ObjectFactory.createMultiProductFrame zaten canvas'a ekliyor
                    this.editor.canvas.setActiveObject(frame);
                    this.editor.canvas.requestRenderAll();
                    Logger.log('[EditorWrapper] Multi-product frame eklendi:', layout);
                }
            } else {
                // Fallback: Manuel çerçeve oluştur
                const canvasWidth = this.editor.canvas?.width || 800;
                const canvasHeight = this.editor.canvas?.height || 1280;

                const frameWidth = Math.min(canvasWidth - 100, cols * 200);
                const frameHeight = Math.min(canvasHeight - 100, rows * 200);
                const slotWidth = frameWidth / cols;
                const slotHeight = frameHeight / rows;

                // Ana çerçeve dikdörtgeni
                await this.editor.addRect({
                    left: 50,
                    top: 50,
                    width: frameWidth,
                    height: frameHeight,
                    fill: 'transparent',
                    stroke: '#228be6',
                    strokeWidth: 2,
                    strokeDashArray: [5, 5],
                    customType: 'multi-product-frame',
                    frameCols: cols,
                    frameRows: rows,
                    frameWidth: frameWidth,
                    frameHeight: frameHeight,
                    selectable: true
                });

                // Slot ayırıcı çizgileri (render'a yansımaz)
                for (let i = 1; i < cols; i++) {
                    await this.editor.addLine({
                        x1: 50 + (i * slotWidth),
                        y1: 50,
                        x2: 50 + (i * slotWidth),
                        y2: 50 + frameHeight,
                        stroke: '#cccccc',
                        strokeWidth: 1,
                        strokeDashArray: [3, 3],
                        selectable: false,
                        evented: false,
                        excludeFromExport: true,
                        isTransient: true
                    });
                }

                for (let j = 1; j < rows; j++) {
                    await this.editor.addLine({
                        x1: 50,
                        y1: 50 + (j * slotHeight),
                        x2: 50 + frameWidth,
                        y2: 50 + (j * slotHeight),
                        stroke: '#cccccc',
                        strokeWidth: 1,
                        strokeDashArray: [3, 3],
                        selectable: false,
                        evented: false,
                        excludeFromExport: true,
                        isTransient: true
                    });
                }

                // Slot numaraları (render'a yansımaz)
                let slotNum = 1;
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        await this.editor.addText(`Slot ${slotNum}`, {
                            left: 50 + (col * slotWidth) + (slotWidth / 2) - 25,
                            top: 50 + (row * slotHeight) + (slotHeight / 2) - 10,
                            fontSize: 14,
                            fill: '#888888',
                            customType: 'slot-label',
                            isSlotLabel: true,
                            slotId: slotNum,
                            selectable: false,
                            evented: false,
                            excludeFromExport: true,
                            isTransient: true
                        });
                        slotNum++;
                    }
                }

                Logger.log('[EditorWrapper] Multi-product frame (fallback) eklendi:', layout);
            }
        } catch (error) {
            Logger.error('[EditorWrapper] Multi-product frame ekleme hatası:', error);
        }
    }

    /**
     * Fiyat kutusu ekle
     */
    async _addPriceBox() {
        if (!this.editor) return;
        const currencySymbol = this.app?.i18n?.getCurrencySymbol?.() || '₺';

        // Fiyat kutusu (dikdörtgen + metin grubu)
        await this.editor.addRect({
            width: 150,
            height: 60,
            fill: '#ff4444',
            stroke: '#cc0000',
            strokeWidth: 2
        });

        // Kısa bir gecikmeyle metin ekle
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.editor.addText(`0.00 ${currencySymbol}`, {
            fontSize: 28,
            fill: '#ffffff',
            fontWeight: 'bold',
            isDynamicField: true,
            isDataField: true,
            dynamicField: 'current_price'
        });
    }

    /**
     * Dinamik alanları filtrele
     */
    _filterDynamicFields(searchText) {
        const container = document.getElementById('dynamic-fields-container');
        if (!container) return;

        const search = searchText.toLowerCase().trim();

        container.querySelectorAll('.field-btn').forEach(btn => {
            const fieldName = btn.textContent.toLowerCase();
            const fieldKey = btn.dataset.field?.toLowerCase() || '';
            const matches = fieldName.includes(search) || fieldKey.includes(search);
            btn.style.display = matches ? '' : 'none';
        });

        // Boş grup başlıklarını gizle
        container.querySelectorAll('.field-group').forEach(group => {
            const visibleButtons = group.querySelectorAll('.field-btn:not([style*="display: none"])');
            group.style.display = visibleButtons.length > 0 ? '' : 'none';
        });
    }

    /**
     * Panel aç/kapat
     */
    _togglePanel(panelId, header) {
        const panel = document.getElementById(`${panelId}-panel`);
        if (!panel) return;

        const isExpanded = header.classList.contains('expanded');

        if (isExpanded) {
            header.classList.remove('expanded');
            panel.style.display = 'none';
        } else {
            header.classList.add('expanded');
            panel.style.display = '';
        }
    }

    /**
     * Ortak şablon seçeneğini sadece label_printer için göster
     */
    _toggleCommonTemplateVisibility(type) {
        const commonGroup = document.getElementById('template-common-group');
        if (!commonGroup) return;
        const isLabelPrinter = type === 'label_printer';
        commonGroup.style.display = isLabelPrinter ? '' : 'none';
        if (!isLabelPrinter) {
            const commonToggle = document.getElementById('template-common');
            if (commonToggle) commonToggle.checked = false;
        }
    }

    /**
     * Canvas boyut göstergesini güncelle
     */
    _updateCanvasSizeDisplay(width, height) {
        const sizeInfo = document.getElementById('canvas-size-info');
        if (sizeInfo) {
            sizeInfo.textContent = `${width} × ${height}`;
        }
    }

    /**
     * Zoom göstergesini güncelle
     */
    _updateZoomDisplay() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel && this.editor) {
            const zoom = this.editor.getZoom ? this.editor.getZoom() : 1;
            zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
        }
    }

    /**
     * Şablonu kaydet
     */
    async _saveTemplate() {
        if (!this.editor) return;
        if (this._isSavingTemplate) return;
        this._isSavingTemplate = true;

        try {
            // Form verilerini al
            const name = document.getElementById('template-name')?.value?.trim();
            const description = document.getElementById('template-description')?.value?.trim();
            const type = document.getElementById('template-type')?.value || 'label';
            const isShared = document.getElementById('template-shared')?.checked;
            const isCommon = document.getElementById('template-common')?.checked;

            if (!name) {
                Toast.error(this.__('validation.nameRequired'));
                document.getElementById('template-name')?.focus();
                return;
            }

            if (name.length > 255) {
                Toast.error(this.__('validation.nameTooLong'));
                document.getElementById('template-name')?.focus();
                return;
            }

            // Canvas verilerini al
            const canvasData = this.editor.toJSON ? this.editor.toJSON() : {};
            const objectCount = canvasData.objects?.length || 0;
            Logger.debug('[EditorWrapper] Canvas JSON alındı:', objectCount, 'nesne');

            // Boyutları getCanvasSize() ile al (zoom değil, orijinal boyutlar)
            const canvasSize = this.editor.getCanvasSize ? this.editor.getCanvasSize() : { width: 800, height: 1280 };
            const width = canvasSize.width || this.editor.options?.width || 800;
            const height = canvasSize.height || this.editor.options?.height || 1280;
            Logger.debug('[EditorWrapper] Canvas boyutları:', width, 'x', height);

            // Thumbnail (önizleme görseli) oluştur
            let thumbnail = null;
            try {
                if (this.editor.toDataURL) {
                    // V7: Canvas'ın hazır olduğundan emin ol
                    if (this.editor.canvas) {
                        // Önce render'ı zorla (V7 için önemli)
                        Logger.debug('[EditorWrapper] Canvas render öncesi nesne sayısı:', this.editor.canvas.getObjects().length);
                        Logger.debug('[EditorWrapper] Canvas backgroundColor:', this.editor.canvas.backgroundColor);

                        // calcOffset ve renderAll çağır
                        if (this.editor.canvas.calcOffset) {
                            this.editor.canvas.calcOffset();
                        }
                        this.editor.canvas.renderAll();

                        Logger.debug('[EditorWrapper] Canvas render edildi');
                    }

                    // Daha küçük bir önizleme görseli oluştur
                    const maxSize = 400;
                    const scale = Math.min(maxSize / width, maxSize / height, 1);
                    Logger.debug('[EditorWrapper] Thumbnail oluşturuluyor, scale:', scale);
                    thumbnail = this.editor.toDataURL({
                        format: 'png',
                        quality: 0.8,
                        multiplier: scale
                    });

                    // Thumbnail kontrolü
                    if (!thumbnail || thumbnail === 'data:,' || thumbnail.length < 100) {
                        Logger.warn('[EditorWrapper] Thumbnail boş veya çok küçük:', thumbnail?.length || 0, 'bytes');
                        // İkinci deneme: multiplier olmadan
                        thumbnail = this.editor.toDataURL({
                            format: 'png',
                            quality: 1
                        });
                        Logger.debug('[EditorWrapper] İkinci deneme sonucu:', thumbnail?.length || 0, 'bytes');
                    } else {
                        Logger.debug('[EditorWrapper] Thumbnail oluşturuldu, scale:', scale, 'boyut:', Math.round(thumbnail.length / 1024), 'KB');
                    }
                }
            } catch (e) {
                Logger.warn('[EditorWrapper] Thumbnail oluşturulamadı:', e);
            }

            const data = {
                name,
                description,
                type,
                width,
                height,
                content: JSON.stringify(canvasData),
                design_data: JSON.stringify(canvasData),
                target_device_type: this._currentPresetId || 'custom',
                grid_layout: this._currentGridLayoutId || 'single',
                grid_visible: this.editor?.gridManager?.isGridVisible() ?? true,
                orientation: height > width ? 'portrait' : 'landscape',
                preview_image: thumbnail,
                thumbnail: thumbnail,
                is_shared: !!isShared,
                is_default: type === 'label_printer' ? !!isCommon : false,
                responsive_mode: document.getElementById('responsive-mode')?.value || 'off',
                scale_policy: document.getElementById('scale-policy')?.value || 'contain',
                design_width: width,
                design_height: height
            };

            Logger.debug('[EditorWrapper] Şablon kaydediliyor:', { name, type, width, height, objectCount, hasThumbnail: !!thumbnail });

            // API'ye kaydet
            await this._handleSave(data);

            // Başarılı mesajı
            Toast.success(this.__('toast.saved'));

        } catch (error) {
            Logger.error('[EditorWrapper] Kaydetme hatası:', error);
            Toast.error(this.__('toast.saveError'));
        } finally {
            this._isSavingTemplate = false;
        }
    }

    /**
     * Responsive önizleme modalı
     */
    _showResponsivePreview() {
        if (!this.editor) return;

        // Farklı boyut presetleri oluştur
        const presets = [
            { name: 'ESL 2.9"', width: 296, height: 128 },
            { name: 'ESL 4.2"', width: 400, height: 300 },
            { name: 'ESL 7.5"', width: 800, height: 480 },
            { name: 'ESL 10.1" P', width: 800, height: 1280 },
            { name: 'ESL 10.1" L', width: 1280, height: 800 },
            { name: 'HD 1080p', width: 1920, height: 1080 },
            { name: '4K', width: 3840, height: 2160 }
        ];

        // Mevcut canvas boyutunu presetlerden çıkar (kaynak boyut)
        const currentW = this.editor.options?.width || 800;
        const currentH = this.editor.options?.height || 1280;
        const filtered = presets.filter(p => p.width !== currentW || p.height !== currentH);

        showResponsivePreview(this.editor, (key) => this.__(key), filtered);
    }

    /**
     * Şablon önizle
     */
    _previewTemplate() {
        if (!this.editor) return;

        Logger.debug('[EditorWrapper] Önizleme açılıyor...');

        // Canvas'ı data URL olarak al
        const dataUrl = this.editor.toDataURL ? this.editor.toDataURL() : null;

        if (dataUrl) {
            // Yeni pencerede göster
            const previewWindow = window.open('', '_blank', 'width=900,height=700');
            previewWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Şablon Önizleme</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 20px;
                            background: #f5f5f5;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                        }
                        img {
                            max-width: 100%;
                            max-height: 90vh;
                            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                            background: white;
                        }
                    </style>
                </head>
                <body>
                    <img src="${dataUrl}" alt="${this.__('editor.preview.title')}">
                </body>
                </html>
            `);
        }
    }

    /**
     * v7 Editor HTML yapısını render et
     */
    _renderV7EditorHTML() {
        // Device presets - kategorilere göre gruplandırılmış
        const groupedPresets = getGroupedPresets();

        // Grid layouts
        const gridLayouts = getAllGridLayouts();

        const isSuperAdmin = (this.app.auth?.getRole() || '').toLowerCase() === 'superadmin';

        // Düzenleme modu kontrolü
        const isEditMode = !!this._templateId;
        const pageTitle = isEditMode
            ? this.__('editor.editTitle')
            : this.__('editor.newTitle');
        const pageSubtitle = isEditMode
            ? this.__('editor.editSubtitle')
            : this.__('editor.subtitle');
        const pageIcon = isEditMode ? 'ti-edit' : 'ti-plus';

        return `
            <div class="template-editor-page">
                <!-- Page Header -->
                <div class="page-header">
                    <div class="page-header-breadcrumb">
                        <a href="#/dashboard">${this.__('breadcrumb.dashboard')}</a>
                        <span class="breadcrumb-separator">›</span>
                        <a href="#/templates">${this.__('title')}</a>
                        <span class="breadcrumb-separator">›</span>
                        <span class="breadcrumb-current">${pageTitle}</span>
                    </div>
                    <div class="page-header-main">
                        <div class="page-header-left">
                            <div class="page-header-icon purple">
                                <i class="ti ${pageIcon}"></i>
                            </div>
                            <div class="page-header-info">
                                <h1 class="page-title">${pageTitle}</h1>
                                <p class="page-subtitle">${pageSubtitle}</p>
                            </div>
                        </div>
                        <div class="page-header-right">
                            <a href="#/templates" class="btn btn-outline">
                                <i class="ti ti-arrow-left"></i>
                                <span class="btn-text">${this.__('editor.actions.back')}</span>
                            </a>
                            <button id="preview-btn" class="btn btn-outline">
                                <i class="ti ti-eye"></i>
                                <span class="btn-text">${this.__('editor.actions.preview')}</span>
                            </button>
                            <button id="responsive-preview-btn" class="btn btn-outline" title="${this.__('editor.responsive.previewTitle') || 'Responsive Önizleme'}">
                                <i class="ti ti-arrows-maximize"></i>
                                <span class="btn-text">${this.__('editor.responsive.preview') || 'Responsive'}</span>
                            </button>
                            <button id="save-btn" class="btn btn-primary">
                                <i class="ti ti-device-floppy"></i>
                                <span class="btn-text">${this.__('editor.actions.save') || 'Kaydet'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="template-editor-wrapper">
                    <!-- Sol Panel -->
                    <div class="editor-left-panel">
                        <!-- Şablon Özellikleri -->
                        <div class="chart-card">
                            <div class="chart-card-header">
                                <h4 class="chart-card-title">
                                    <i class="ti ti-file-settings"></i>
                                    ${this.__('editor.properties.title')}
                                </h4>
                            </div>
                            <div class="chart-card-body">
                                <div class="form-group">
                                    <label class="form-label">${this.__('form.fields.name')} *</label>
                                    <input type="text" id="template-name" class="form-input"
                                           maxlength="255"
                                           placeholder="${this.__('form.placeholders.name')}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('form.fields.description')}</label>
                                    <textarea id="template-description" class="form-input" rows="2"
                                              placeholder="${this.__('form.placeholders.description')}"></textarea>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">${this.__('form.fields.type')}</label>
                                    <select id="template-type" class="form-select">
                                        <option value="label">${this.__('form.types.esl') || 'ESL (Elektronik Raf Etiketi)'}</option>
                                        <option value="signage">${this.__('form.types.signage') || 'Dijital Tabela'}</option>
                                        <option value="tv">${this.__('form.types.tv')}</option>
                                        <option value="label_printer">${this.__('form.types.label_printer')}</option>
                                    </select>
                                </div>
                                <div class="form-group" id="template-common-group" style="display: none;">
                                    <label class="form-label">${this.__('form.fields.commonTemplate')}</label>
                                    <label class="form-checkbox-label">
                                        <input type="checkbox" id="template-common" class="form-checkbox">
                                        <span>${this.__('form.hints.commonTemplate')}</span>
                                    </label>
                                </div>
                                ${isSuperAdmin ? `
                                <div class="form-group">
                                    <label class="form-label">${this.__('form.fields.sharedTemplate')}</label>
                                    <label class="form-checkbox-label">
                                        <input type="checkbox" id="template-shared" class="form-checkbox">
                                        <span>${this.__('form.hints.sharedTemplate')}</span>
                                    </label>
                                </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Cihaz Boyutu -->
                        <div class="chart-card">
                            <div class="chart-card-header collapsible expanded" data-toggle-panel="device">
                                <h4 class="chart-card-title">
                                    <i class="ti ti-device-desktop"></i>
                                    ${this.__('editor.deviceSelector.title') || 'Cihaz Boyutu'}
                                </h4>
                                <i class="ti ti-chevron-down toggle-icon"></i>
                            </div>
                            <div class="chart-card-body device-presets-body" id="device-panel">
                                ${groupedPresets.map((category, catIdx) => `
                                    <div class="device-category">
                                        <div class="device-category-header">
                                            <i class="ti ${category.icon}"></i>
                                            <span>${category.name}</span>
                                        </div>
                                        <div class="device-preset-grid">
                                            ${category.items.map((preset, idx) => `
                                                <button class="device-preset-btn ${preset.id === this._currentPresetId ? 'active' : ''} ${preset.recommended ? 'recommended' : ''}"
                                                        data-preset="${preset.id}"
                                                        data-width="${preset.width}"
                                                        data-height="${preset.height}"
                                                        title="${preset.name} (${preset.width}×${preset.height})">
                                                    <i class="ti ${preset.icon}"></i>
                                                    <span class="preset-name">${preset.name}</span>
                                                    <span class="preset-size">${preset.width}×${preset.height}</span>
                                                    ${preset.recommended ? '<span class="preset-badge">★</span>' : ''}
                                                </button>
                                            `).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                                <!-- Özel Boyut -->
                                <div class="custom-size-section">
                                    <div class="custom-size-label">${this.__('editor.deviceSelector.customSize')}</div>
                                    <div class="custom-size-inputs">
                                        <input type="number" id="custom-width" class="form-input form-input-sm" placeholder="Genişlik" value="800">
                                        <span class="size-separator">×</span>
                                        <input type="number" id="custom-height" class="form-input form-input-sm" placeholder="Yükseklik" value="1280">
                                        <button id="apply-custom-size-btn" class="btn btn-sm btn-outline">
                                            <i class="ti ti-check"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Grid Düzeni -->
                        <div class="chart-card">
                            <div class="chart-card-header collapsible expanded" data-toggle-panel="grid">
                                <h4 class="chart-card-title">
                                    <i class="ti ti-layout-grid"></i>
                                    ${this.__('editor.gridLayout.title')}
                                </h4>
                                <i class="ti ti-chevron-down toggle-icon"></i>
                            </div>
                            <div class="chart-card-body" id="grid-panel">
                                <div class="grid-layout-grid">
                                    ${gridLayouts.map((layout, idx) => `
                                        <button class="grid-layout-btn ${layout.id === this._currentGridLayoutId ? 'active' : ''}" data-layout="${layout.id}" title="${layout.name}">
                                            <div class="grid-preview">${this._renderGridPreview(layout)}</div>
                                            <span>${layout.name}</span>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- Responsive Ayarları -->
                        <div class="chart-card">
                            <div class="chart-card-header collapsible" data-toggle-panel="responsive">
                                <h4 class="chart-card-title">
                                    <i class="ti ti-arrows-maximize"></i>
                                    ${this.__('editor.responsive.title') || 'Responsive Ayarları'}
                                </h4>
                                <i class="ti ti-chevron-down toggle-icon"></i>
                            </div>
                            <div class="chart-card-body" id="responsive-panel" style="display: none;">
                                <div class="form-group">
                                    <label class="form-label">${this.__('editor.responsive.mode') || 'Responsive Mod'}</label>
                                    <select id="responsive-mode" class="form-select">
                                        <option value="off">${this.__('editor.responsive.modeOff') || 'Kapalı'}</option>
                                        <option value="proportional">${this.__('editor.responsive.modeProportional') || 'Oransal Ölçekleme'}</option>
                                    </select>
                                    <small class="form-hint">${this.__('editor.responsive.modeHint') || 'Aktifken şablon farklı cihaz boyutlarına otomatik uyum sağlar'}</small>
                                </div>
                                <div class="form-group" id="scale-policy-group" style="display: none;">
                                    <label class="form-label">${this.__('editor.responsive.scalePolicy') || 'Ölçek Politikası'}</label>
                                    <select id="scale-policy" class="form-select">
                                        <option value="contain">${this.__('editor.responsive.policyContain') || 'Sığdır (Contain)'}</option>
                                        <option value="cover">${this.__('editor.responsive.policyCover') || 'Kapla (Cover)'}</option>
                                        <option value="stretch">${this.__('editor.responsive.policyStretch') || 'Esnet (Stretch)'}</option>
                                    </select>
                                    <small class="form-hint">${this.__('editor.responsive.scalePolicyHint') || 'Contain: oranı koruyarak sığdırır. Cover: kaplar ve kırpar. Stretch: esnetir.'}</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Canvas Alanı -->
                    <div class="editor-canvas-area">
                        <div class="canvas-toolbar" id="canvas-toolbar">
                            <div class="toolbar-group">
                                <button class="toolbar-btn" data-action="add-text" title="${this.__('editor.tools.text') || 'Metin Ekle'}">
                                    <i class="ti ti-text-size"></i>
                                </button>
                                <button class="toolbar-btn" data-action="add-shape" title="${this.__('editor.tools.shape') || 'Şekil'}">
                                    <i class="ti ti-shape"></i>
                                </button>
                                <button class="toolbar-btn" data-action="add-image" title="${this.__('editor.tools.image')}">
                                    <i class="ti ti-photo"></i>
                                </button>
                                <!-- Çoklu Ürün Çerçevesi Dropdown -->
                                <div class="toolbar-dropdown">
                                    <button class="toolbar-btn toolbar-dropdown-toggle" title="${this.__('editor.tools.multiProductFrame')}">
                                        <i class="ti ti-layout-grid"></i>
                                        <i class="ti ti-chevron-down dropdown-arrow"></i>
                                    </button>
                                    <div class="toolbar-dropdown-menu">
                                        <button class="toolbar-dropdown-item" data-action="add-multi-frame" data-layout="1x2">
                                            <i class="ti ti-layout-rows"></i> 1×2 ${this.__('editor.tools.frame')}
                                        </button>
                                        <button class="toolbar-dropdown-item" data-action="add-multi-frame" data-layout="2x1">
                                            <i class="ti ti-layout-columns"></i> 2×1 ${this.__('editor.tools.frame')}
                                        </button>
                                        <button class="toolbar-dropdown-item" data-action="add-multi-frame" data-layout="2x2">
                                            <i class="ti ti-grid-dots"></i> 2×2 ${this.__('editor.tools.frame')}
                                        </button>
                                        <button class="toolbar-dropdown-item" data-action="add-multi-frame" data-layout="3x1">
                                            <i class="ti ti-layout-distribute-horizontal"></i> 3×1 ${this.__('editor.tools.frame')}
                                        </button>
                                        <button class="toolbar-dropdown-item" data-action="add-multi-frame" data-layout="2x3">
                                            <i class="ti ti-layout-board"></i> 2×3 ${this.__('editor.tools.frame')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="toolbar-separator"></div>
                            <div class="toolbar-group">
                                <button class="toolbar-btn" id="undo-btn" data-action="undo" title="${this.__('actions.undo') || 'Geri Al'}" disabled>
                                    <i class="ti ti-arrow-back-up"></i>
                                </button>
                                <button class="toolbar-btn" id="redo-btn" data-action="redo" title="${this.__('actions.redo')}" disabled>
                                    <i class="ti ti-arrow-forward-up"></i>
                                </button>
                            </div>
                            <div class="toolbar-separator"></div>
                            <div class="toolbar-group">
                                <button class="toolbar-btn" data-action="zoom-in" title="${this.__('editor.zoom.in')}">
                                    <i class="ti ti-zoom-in"></i>
                                </button>
                                <span id="zoom-level" class="zoom-level">100%</span>
                                <button class="toolbar-btn" data-action="zoom-out" title="${this.__('editor.zoom.out')}">
                                    <i class="ti ti-zoom-out"></i>
                                </button>
                                <button class="toolbar-btn" data-action="zoom-fit" title="${this.__('editor.zoom.fit')}">
                                    <i class="ti ti-zoom-reset"></i>
                                </button>
                            </div>
                            <div class="toolbar-separator"></div>
                            <div class="toolbar-group">
                                <button class="toolbar-btn active" data-action="toggle-grid" title="${this.__('editor.tools.grid') || 'Grid'}">
                                    <i class="ti ti-grid-dots"></i>
                                </button>
                                <button class="toolbar-btn" data-action="toggle-snap" title="${this.__('editor.tools.snap') || 'Snap'}">
                                    <i class="ti ti-magnet"></i>
                                </button>
                            </div>
                            <div class="toolbar-separator"></div>
                            <div class="toolbar-group">
                                <button class="toolbar-btn active" data-action="toggle-inspector" title="${this.__('editor.inspector.title') || 'Inspector'}">
                                    <i class="ti ti-adjustments"></i>
                                </button>
                            </div>
                            <div class="toolbar-spacer"></div>
                            <div class="toolbar-group">
                                <span class="canvas-size-info">
                                    <i class="ti ti-dimensions"></i>
                                    <span id="canvas-size-info">800 × 1280</span>
                                </span>
                            </div>
                        </div>
                        <div class="canvas-wrapper" id="canvas-wrapper">
                            <canvas id="template-canvas"></canvas>
                        </div>

                    </div>

                    <!-- Sağ Panel -->
                    <div class="editor-right-panel">
                        <!-- Elemanlar -->
                        <div class="chart-card">
                            <div class="chart-card-header collapsible expanded" data-toggle-panel="elements">
                                <h4 class="chart-card-title">
                                    <i class="ti ti-components"></i>
                                    ${this.__('editor.elements.title') || 'Elemanlar'}
                                </h4>
                                <i class="ti ti-chevron-down toggle-icon"></i>
                            </div>
                            <div class="chart-card-body" id="elements-panel">
                                <div class="element-buttons-grid">
                                    <button class="element-btn" data-element="text">
                                        <i class="ti ti-typography"></i>
                                        <span>${this.__('editor.tools.text') || 'Metin'}</span>
                                    </button>
                                    <button class="element-btn" data-element="media">
                                        <i class="ti ti-photo-video"></i>
                                        <span>${this.__('editor.tools.media') || 'Medya'}</span>
                                    </button>
                                    <button class="element-btn" data-element="shape">
                                        <i class="ti ti-shape"></i>
                                        <span>${this.__('editor.tools.shape') || 'Şekil'}</span>
                                    </button>
                                    <button class="element-btn" data-element="line">
                                        <i class="ti ti-line-dashed"></i>
                                        <span>${this.__('editor.tools.line') || 'Cizgi'}</span>
                                    </button>
                                    <button class="element-btn" data-element="border-frame">
                                        <i class="ti ti-border-all"></i>
                                        <span>${this.__('editor.tools.borderFrame') || 'Cerceve'}</span>
                                    </button>
                                    <button class="element-btn" data-element="barcode">
                                        <i class="ti ti-barcode"></i>
                                        <span>${this.__('editor.tools.barcode') || 'Barkod'}</span>
                                    </button>
                                    <button class="element-btn" data-element="qrcode">
                                        <i class="ti ti-qrcode"></i>
                                        <span>${this.__('editor.tools.qrcode') || 'QR Kod'}</span>
                                    </button>
                                    <button class="element-btn" data-element="price">
                                        <i class="ti ti-currency-lira"></i>
                                        <span>${this.__('editor.tools.priceBox') || 'Fiyat Kutusu'}</span>
                                    </button>
                                    <button class="element-btn" data-element="background">
                                        <i class="ti ti-palette"></i>
                                        <span>${this._t('editor.tools.background', 'Arkaplan')}</span>
                                    </button>
                                </div>

                                <!-- Çoklu Ürün Çerçevesi -->
                                <div class="element-section-divider">
                                    <span>${this.__('editor.tools.multiProductFrame')}</span>
                                </div>
                                <div class="element-buttons-grid multi-frame-grid">
                                    <button class="element-btn multi-frame-btn" data-element="multi-frame-1x2" data-cols="1" data-rows="2" title="${this.__('editor.tools.multiFrame1x2')}">
                                        <i class="ti ti-layout-columns"></i>
                                        <span>${this.__('editor.tools.multiFrame1x2') || '1x2'}</span>
                                    </button>
                                    <button class="element-btn multi-frame-btn" data-element="multi-frame-2x1" data-cols="2" data-rows="1" title="${this.__('editor.tools.multiFrame2x1')}">
                                        <i class="ti ti-layout-rows"></i>
                                        <span>${this.__('editor.tools.multiFrame2x1') || '2x1'}</span>
                                    </button>
                                    <button class="element-btn multi-frame-btn" data-element="multi-frame-2x2" data-cols="2" data-rows="2" title="${this.__('editor.tools.multiFrame2x2')}">
                                        <i class="ti ti-layout-grid"></i>
                                        <span>${this.__('editor.tools.multiFrame2x2') || '2x2'}</span>
                                    </button>
                                    <button class="element-btn multi-frame-btn" data-element="multi-frame-3x1" data-cols="3" data-rows="1" title="${this.__('editor.tools.multiFrame3x1')}">
                                        <i class="ti ti-layout-distribute-horizontal"></i>
                                        <span>${this.__('editor.tools.multiFrame3x1') || '3x1'}</span>
                                    </button>
                                    <button class="element-btn multi-frame-btn" data-element="multi-frame-2x3" data-cols="2" data-rows="3" title="${this.__('editor.tools.multiFrame2x3')}">
                                        <i class="ti ti-layout-board"></i>
                                        <span>${this.__('editor.tools.multiFrame2x3') || '2x3'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Dinamik Alanlar -->
                        <div class="chart-card">
                            <div class="chart-card-header collapsible expanded" data-toggle-panel="dynamicFields">
                                <h4 class="chart-card-title">
                                    <i class="ti ti-database"></i>
                                    ${this.__('editor.dynamicFields.title') || 'Dinamik Alanlar'}
                                </h4>
                                <i class="ti ti-chevron-down toggle-icon"></i>
                            </div>
                            <div class="chart-card-body" id="dynamic-fields-panel">
                                <div class="dynamic-fields-search">
                                    <input type="text" id="dynamic-field-search" class="form-input form-input-sm" placeholder="${this.__('actions.search') || 'Ara...'}">
                                </div>
                                <div class="dynamic-fields-groups" id="dynamic-fields-container">
                                    <!-- Temel Alanlar -->
                                    <div class="field-group">
                                        <div class="field-group-header">
                                            <i class="ti ti-tag"></i>
                                            <span>${this.__('editor.dynamicFields.groups.basic') || 'Temel'}</span>
                                        </div>
                                        <div class="field-buttons">
                                            <button class="field-btn" data-field="product_name">${this.__('editor.dynamicFields.productName')}</button>
                                            <button class="field-btn" data-field="sku">${this.__('editor.dynamicFields.sku') || 'SKU'}</button>
                                            <button class="field-btn" data-field="barcode">${this.__('editor.dynamicFields.barcode') || 'Barkod'}</button>
                                            <button class="field-btn" data-field="description">${this.__('editor.dynamicFields.description')}</button>
                                            <button class="field-btn" data-field="slug">${this.__('editor.dynamicFields.slug') || 'Slug'}</button>
                                        </div>
                                    </div>
                                    <!-- Fiyat Alanları -->
                                    <div class="field-group">
                                        <div class="field-group-header">
                                            <i class="ti ti-currency-lira"></i>
                                            <span>${this.__('editor.dynamicFields.groups.price') || 'Fiyat'}</span>
                                        </div>
                                        <div class="field-buttons">
                                            <button class="field-btn" data-field="current_price">${this.__('editor.dynamicFields.currentPrice')}</button>
                                            <button class="field-btn" data-field="previous_price">${this.__('editor.dynamicFields.previousPrice') || 'Eski Fiyat'}</button>
                                            <button class="field-btn" data-field="price_with_currency">${this.__('editor.dynamicFields.priceWithCurrency') || `Fiyat + ${currencySymbol}`}</button>
                                            <button class="field-btn" data-field="vat_rate">${this.__('editor.dynamicFields.vatRate')}</button>
                                            <button class="field-btn" data-field="discount_percent">${this.__('editor.dynamicFields.discountPercent')}</button>
                                            <button class="field-btn" data-field="campaign_text">${this.__('editor.dynamicFields.campaignText') || 'Kampanya Metni'}</button>
                                            <button class="field-btn" data-field="price_updated_at">${this.__('editor.dynamicFields.priceUpdatedAt')}</button>
                                            <button class="field-btn" data-field="price_valid_until">${this.__('editor.dynamicFields.priceValidUntil')}</button>
                                        </div>
                                    </div>
                                    <!-- Kategori & Marka -->
                                    <div class="field-group">
                                        <div class="field-group-header">
                                            <i class="ti ti-category"></i>
                                            <span>${this.__('editor.dynamicFields.groups.category') || 'Kategori & Marka'}</span>
                                        </div>
                                        <div class="field-buttons">
                                            <button class="field-btn" data-field="category">${this.__('editor.dynamicFields.category') || 'Kategori'}</button>
                                            <button class="field-btn" data-field="subcategory">${this.__('editor.dynamicFields.subcategory') || 'Alt Kategori'}</button>
                                            <button class="field-btn" data-field="brand">${this.__('editor.dynamicFields.brand') || 'Marka'}</button>
                                        </div>
                                    </div>
                                    <!-- Detay Alanları -->
                                    <div class="field-group">
                                        <div class="field-group-header">
                                            <i class="ti ti-info-circle"></i>
                                            <span>${this.__('editor.dynamicFields.groups.detail') || 'Detay'}</span>
                                        </div>
                                        <div class="field-buttons">
                                            <button class="field-btn" data-field="unit">${this.__('editor.dynamicFields.unit') || 'Birim'}</button>
                                            <button class="field-btn" data-field="weight">${this.__('editor.dynamicFields.weight')}</button>
                                            <button class="field-btn" data-field="stock">${this.__('editor.dynamicFields.stock') || 'Stok'}</button>
                                            <button class="field-btn" data-field="origin">${this.__('editor.dynamicFields.origin')}</button>
                                            <button class="field-btn" data-field="production_type">${this.__('editor.dynamicFields.productionType')}</button>
                                        </div>
                                    </div>
                                    <!-- Konum & Lojistik -->
                                    <div class="field-group">
                                        <div class="field-group-header">
                                            <i class="ti ti-map-pin"></i>
                                            <span>${this.__('editor.dynamicFields.groups.location') || 'Konum & Lojistik'}</span>
                                        </div>
                                        <div class="field-buttons">
                                            <button class="field-btn" data-field="shelf_location">${this.__('editor.dynamicFields.shelfLocation') || 'Raf Konumu'}</button>
                                            <button class="field-btn" data-field="supplier_code">${this.__('editor.dynamicFields.supplierCode')}</button>
                                        </div>
                                    </div>
                                    <!-- Künye -->
                                    <div class="field-group">
                                        <div class="field-group-header">
                                            <i class="ti ti-qrcode"></i>
                                            <span>${this.__('editor.dynamicFields.groups.kunye')}</span>
                                        </div>
                                        <div class="field-buttons">
                                            <button class="field-btn" data-field="kunye_no">${this.__('editor.dynamicFields.kunyeNo')}</button>
                                        </div>
                                    </div>
                                    <!-- HAL Künye Bilgileri -->
                                    <div class="field-group">
                                        <div class="field-group-header">
                                            <i class="ti ti-leaf"></i>
                                            <span>${this.__('editor.dynamicFields.groups.hal')}</span>
                                        </div>
                                        <div class="field-buttons">
                                            <button class="field-btn" data-field="uretici_adi">${this.__('editor.dynamicFields.ureticiAdi')}</button>
                                            <button class="field-btn" data-field="malin_adi">${this.__('editor.dynamicFields.malinAdi')}</button>
                                            <button class="field-btn" data-field="malin_cinsi">${this.__('editor.dynamicFields.malinCinsi')}</button>
                                            <button class="field-btn" data-field="malin_turu">${this.__('editor.dynamicFields.malinTuru')}</button>
                                            <button class="field-btn" data-field="uretim_yeri">${this.__('editor.dynamicFields.uretimYeri')}</button>
                                            <button class="field-btn" data-field="uretim_sekli">${this.__('editor.dynamicFields.uretimSekli')}</button>
                                            <button class="field-btn" data-field="ilk_bildirim_tarihi">${this.__('editor.dynamicFields.ilkBildirimTarihi')}</button>
                                            <button class="field-btn" data-field="malin_sahibi">${this.__('editor.dynamicFields.malinSahibi')}</button>
                                            <button class="field-btn" data-field="tuketim_yeri">${this.__('editor.dynamicFields.tuketimYeri')}</button>
                                            <button class="field-btn" data-field="tuketim_bildirim_tarihi">${this.__('editor.dynamicFields.tuketimBildirimTarihi')}</button>
                                            <button class="field-btn" data-field="gumruk_kapisi">${this.__('editor.dynamicFields.gumrukKapisi')}</button>
                                            <button class="field-btn" data-field="uretim_ithal_tarihi">${this.__('editor.dynamicFields.uretimIthalTarihi')}</button>
                                            <button class="field-btn" data-field="miktar">${this.__('editor.dynamicFields.miktar') || 'Miktar'}</button>
                                            <button class="field-btn" data-field="alis_fiyati">${this.__('editor.dynamicFields.alisFiyati')}</button>
                                            <button class="field-btn" data-field="isletme_adi">${this.__('editor.dynamicFields.isletmeAdi')}</button>
                                            <button class="field-btn" data-field="sertifikasyon_kurulusu">${this.__('editor.dynamicFields.sertifikasyonKurulusu')}</button>
                                            <button class="field-btn" data-field="sertifika_no">${this.__('editor.dynamicFields.sertifikaNo') || 'Sertifika No'}</button>
                                            <button class="field-btn" data-field="diger_bilgiler">${this.__('editor.dynamicFields.digerBilgiler')}</button>
                                        </div>
                                    </div>
                                    <!-- Medya Alanları -->
                                    <div class="field-group">
                                        <div class="field-group-header">
                                            <i class="ti ti-photo"></i>
                                            <span>${this.__('editor.dynamicFields.groups.media') || 'Medya'}</span>
                                        </div>
                                        <div class="field-buttons">
                                            <button class="field-btn" data-field="image_url">${this.__('editor.dynamicFields.imageUrl')}</button>
                                            <button class="field-btn" data-field="video_url">${this.__('editor.dynamicFields.videoUrl')}</button>
                                            <button class="field-btn" data-field="videos">${this.__('editor.dynamicFields.videos') || 'Video Listesi'}</button>
                                        </div>
                                    </div>
                                    <!-- Özel Alanlar -->
                                    <div class="field-group">
                                        <div class="field-group-header">
                                            <i class="ti ti-sparkles"></i>
                                            <span>${this.__('editor.dynamicFields.groups.special')}</span>
                                        </div>
                                        <div class="field-buttons">
                                            <button class="field-btn" data-field="date_today">${this.__('editor.dynamicFields.dateToday')}</button>
                                            <button class="field-btn" data-field="date_time">${this.__('editor.dynamicFields.dateTime') || 'Tarih ve Saat'}</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Özellikler ve Katmanlar artık Floating Inspector Panel'de -->
                        <!-- Gizli container'lar (PropertyPanel ve LayersPanel sağ panelde mount edilmek istenirse) -->
                        <div id="properties-panel" style="display:none;">
                            <div id="property-panel-container"></div>
                        </div>
                        <div id="layers-panel" style="display:none;">
                            <div id="layers-panel-container"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Kaydetme işlemi
     */
    async _handleSave(data) {
        try {
            // Validasyon - isim kontrolü
            if (!data.name || data.name.trim() === '') {
                // Form alanından ismi al (Ctrl+S ile kaydederken _templateMeta boş olabilir)
                const formName = document.getElementById('template-name')?.value?.trim();
                if (!formName) {
                    Toast.error(this.__('validation.nameRequired'));
                    document.getElementById('template-name')?.focus();
                    return;
                }
                data.name = formName;
            }

            // İsim uzunluğu kontrolü
            if (data.name && data.name.length > 255) {
                Toast.error(this.__('validation.nameTooLong'));
                document.getElementById('template-name')?.focus();
                return;
            }

            // API'ye kaydet
            if (this._templateId) {
                await this.app.api.put(`/templates/${this._templateId}`, data);
            } else {
                const response = await this.app.api.post('/templates', data);
                this._templateId = response.data?.id;
            }
            Logger.debug('[EditorWrapper] Şablon kaydedildi');
        } catch (error) {
            Logger.error('[EditorWrapper] Kaydetme hatası:', error);
            throw error;
        }
    }

    /**
     * MediaPicker'ı başlat (lazy initialization)
     */
    _initMediaPicker() {
        if (this.mediaPicker) return;

        // Container oluştur (eğer yoksa)
        let container = document.getElementById('media-picker-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'media-picker-container';
            document.body.appendChild(container);
        }

        this.mediaPicker = initMediaPicker({
            container,
            app: this.app,
            onSelect: (result) => this._handleMediaSelect(result)
        });
    }

    /**
     * Medya seçici modalını aç
     * @param {string} type - 'image' veya 'video'
     */
    _openMediaPicker(type = 'image') {
        this._initMediaPicker();

        if (type === 'video') {
            this.mediaPicker.showVideoPicker();
        } else if (type === 'media') {
            this.mediaPicker.showImagePicker({ includeVideos: true });
        } else {
            this.mediaPicker.showImagePicker();
        }
    }

    /**
     * Medya seçimi sonucu işle
     * @param {Object} result - Seçim sonucu
     */
    async _handleMediaSelect(result) {
        if (!this.editor) return;

        Logger.debug('[EditorWrapper] Medya seçildi:', result);

        try {
            const selectedMedia = Array.isArray(result?.media) ? result.media[0] : result?.media;

            // Slot içine medya ekleme modu
            if (this._slotMediaInsertContext) {
                const slotContext = this._slotMediaInsertContext;
                this._slotMediaInsertContext = null;
                if (selectedMedia?.url) {
                    await this._insertMediaIntoSlot(selectedMedia, slotContext);
                    Toast.success(this.__('toast.fieldAdded') || 'Alan eklendi');
                }
                return;
            }

            // Görsel değiştirme modu - mevcut nesnenin kaynağını değiştir
            if (this._replaceSelectedImage && selectedMedia?.url) {
                const obj = this._replaceSelectedImage;
                this._replaceSelectedImage = null;
                await this._replaceImageObjectMedia(obj, selectedMedia);
                return;
            }
            this._replaceSelectedImage = null;

            if (result.mode === 'single' && result.media) {
                const media = result.media;
                const mediaType = String(media?.file_type || media?.fileType || media?.type || '').toLowerCase();
                const isVideoLike = mediaType === 'video' || /\.(mp4|webm|avi|mov|mkv|wmv|flv)(\?.*)?$/i.test(String(media?.url || media?.filename || ''));
                if (isVideoLike) {
                    await this._insertVideoSelection([media]);
                    return;
                }
                if (this.editor.addImage) {
                    await this.editor.addImage(media.url, {
                        filename: media.filename
                    });
                }
            } else if (result.mode === 'multi-image' && result.media) {
                // Çoklu görsel
                for (const media of result.media) {
                    if (this.editor.addImage) {
                        await this.editor.addImage(media.url, {
                            filename: media.filename
                        });
                    }
                }
                        } else if (result.mode === 'multi-video' && result.media) {
                await this._insertVideoSelection(result.media);
            }
        } catch (error) {
            Logger.error('[EditorWrapper] Medya ekleme hatası:', error);
            Toast.error(this.__('editor.errors.mediaAddFailed'));
        }
    }

    /**
     * Frame + slotId için slot koordinatlarını hesapla.
     */
    async _insertVideoSelection(mediaInput) {
        if (!this.editor) return null;

        const selectedVideos = (Array.isArray(mediaInput) ? mediaInput : [mediaInput])
            .filter(v => v && v.url)
            .map(v => ({
                url: v.url,
                path: v.path || v.url,
                filename: v.filename || ''
            }));

        if (selectedVideos.length === 0) return null;

        const dynamicField = selectedVideos.length > 1 ? 'videos' : 'video_url';
        let videoObj = null;

        if (typeof this.editor._addDynamicField === 'function') {
            videoObj = await this.editor._addDynamicField(dynamicField, {
                type: 'video',
                placeholder: selectedVideos.length > 1 ? '{Videos}' : '{Video}'
            });
        } else if (this.editor.addRect) {
            videoObj = await this.editor.addRect({
                width: 320,
                height: 180,
                fill: '#1a1a2e',
                stroke: '#4a4a6a',
                strokeWidth: 2,
                [CUSTOM_PROPS.CUSTOM_TYPE]: CUSTOM_TYPES.VIDEO_PLACEHOLDER,
                [CUSTOM_PROPS.IS_DATA_FIELD]: true,
                [CUSTOM_PROPS.DYNAMIC_FIELD]: dynamicField,
                [CUSTOM_PROPS.IS_VIDEO_PLACEHOLDER]: true,
                [CUSTOM_PROPS.IS_MULTIPLE_VIDEOS]: selectedVideos.length > 1
            });
        }

        if (videoObj && typeof videoObj.set === 'function') {
            videoObj.set(CUSTOM_PROPS.CUSTOM_TYPE, CUSTOM_TYPES.VIDEO_PLACEHOLDER);
            videoObj.set(CUSTOM_PROPS.IS_DATA_FIELD, true);
            videoObj.set(CUSTOM_PROPS.DYNAMIC_FIELD, dynamicField);
            videoObj.set(CUSTOM_PROPS.IS_VIDEO_PLACEHOLDER, true);
            videoObj.set(CUSTOM_PROPS.IS_MULTIPLE_VIDEOS, selectedVideos.length > 1);
            videoObj.set(CUSTOM_PROPS.STATIC_VIDEOS, selectedVideos);
            videoObj.set(CUSTOM_PROPS.VIDEO_PLACEHOLDER_URL, selectedVideos[0]?.url || '');
            this.editor.canvas?.requestRenderAll?.();
        }

        return videoObj;
    }

    _getSlotRect(frame, slotId) {
        if (!frame || !slotId) return null;

        const cols = this._getFrameProp(frame, 'frameCols') || 2;
        const rows = this._getFrameProp(frame, 'frameRows') || 2;
        const { x: frameX, y: frameY, w: frameW, h: frameH } = this._getFrameTopLeft(frame);
        const slotWidth = frameW / cols;
        const slotHeight = frameH / rows;
        const slotCol = (slotId - 1) % cols;
        const slotRow = Math.floor((slotId - 1) / cols);
        const left = frameX + (slotCol * slotWidth);
        const top = frameY + (slotRow * slotHeight);
        return {
            left,
            top,
            width: slotWidth,
            height: slotHeight,
            centerX: left + slotWidth / 2,
            centerY: top + slotHeight / 2
        };
    }

    /**
     * Nesneyi slot içine sığdır (taşmayı azaltır).
     */
    _fitObjectIntoSlot(obj, slotRect, padding = 10) {
        if (!obj || !slotRect) return;

        const targetW = Math.max(8, slotRect.width - (padding * 2));
        const targetH = Math.max(8, slotRect.height - (padding * 2));
        const baseW = obj.width || obj.getScaledWidth?.() || targetW;
        const baseH = obj.height || obj.getScaledHeight?.() || targetH;
        const fitScale = Math.min(targetW / Math.max(1, baseW), targetH / Math.max(1, baseH));

        if (Number.isFinite(fitScale) && fitScale > 0) {
            obj.set({
                scaleX: fitScale,
                scaleY: fitScale,
                left: slotRect.centerX,
                top: slotRect.centerY,
                originX: 'center',
                originY: 'center'
            });
        } else {
            obj.set({
                left: slotRect.centerX,
                top: slotRect.centerY,
                originX: 'center',
                originY: 'center'
            });
        }

        if (typeof obj.setCoords === 'function') obj.setCoords();
    }

    /**
     * Media picker'dan seçilen görseli aktif slot içine ekle.
     */
    async _insertMediaIntoSlot(media, slotContext) {
        if (!media?.url || !this.editor?.canvas) return;

        const canvas = this.editor.canvas;
        const mediaType = String(media?.file_type || media?.fileType || media?.type || '').toLowerCase();
        const isVideoLike = mediaType === 'video' || /\.(mp4|webm|avi|mov|mkv|wmv|flv)(\?.*)?$/i.test(String(media?.url || media?.filename || ''));
        const frame = slotContext.frame && canvas.getObjects().includes(slotContext.frame)
            ? slotContext.frame
            : (canvas.getObjects().find(o => this._isMultiProductFrame(o) && (o.id === slotContext.frameId || o.objectId === slotContext.frameId))
                || this._activeFrame
                || canvas.getObjects().find(o => this._isMultiProductFrame(o)));

        const slotRect = frame ? this._getSlotRect(frame, slotContext.slotId) : null;

        if (isVideoLike) {
            const videoObj = await this._insertVideoSelection([media]);
            if (!videoObj) return;

            if (slotRect) this._fitObjectIntoSlot(videoObj, slotRect, 10);
            if (typeof videoObj.set === 'function') {
                videoObj.set({
                    customType: 'slot-media',
                    slotId: slotContext.slotId,
                    inMultiFrame: true,
                    parentFrameId: frame?.id || frame?.objectId || slotContext.frameId || 'frame'
                });
                videoObj.setCoords?.();
            } else {
                videoObj.customType = 'slot-media';
                videoObj.slotId = slotContext.slotId;
                videoObj.inMultiFrame = true;
                videoObj.parentFrameId = frame?.id || frame?.objectId || slotContext.frameId || 'frame';
            }
            canvas.setActiveObject(videoObj);
            canvas.requestRenderAll();
            return;
        }

        if (!this.editor?.addImage) return;

        if (!frame) {
            await this.editor.addImage(media.url, { filename: media.filename });
            return;
        }

        const imageObj = await this.editor.addImage(media.url, {
            left: slotRect?.centerX ?? frame.left,
            top: slotRect?.centerY ?? frame.top,
            customType: 'slot-media',
            slotId: slotContext.slotId,
            inMultiFrame: true,
            parentFrameId: frame.id || frame.objectId || slotContext.frameId || 'frame',
            filename: media.filename,
            originalSrc: media.url
        });

        if (imageObj) {
            if (slotRect) this._fitObjectIntoSlot(imageObj, slotRect, 10);
            imageObj.customType = 'slot-media';
            imageObj.slotId = slotContext.slotId;
            imageObj.inMultiFrame = true;
            imageObj.parentFrameId = frame.id || frame.objectId || slotContext.frameId || 'frame';
            canvas.setActiveObject(imageObj);
            canvas.requestRenderAll();
        }
    }

    /**
     * Seçili görsel nesnesinin kaynağını media picker sonucu ile değiştir.
     */
    async _replaceImageObjectMedia(obj, media) {
        if (!obj || !media?.url || !this.editor?.canvas) return;

        const canvas = this.editor.canvas;
        const isImageObject = obj.type === 'image' || obj.type === 'Image';
        const isInSlot = !!obj.slotId && !!obj.inMultiFrame;
        const parentFrame = isInSlot ? this._findParentFrame(obj, canvas) : null;
        const slotRect = (isInSlot && parentFrame) ? this._getSlotRect(parentFrame, Number(obj.slotId)) : null;

        // image nesnesiyse element'i doğrudan değiştir
        if (isImageObject && typeof obj.setElement === 'function') {
            try {
                const { FabricImage } = await import('../../editor/core/FabricExports.js');
                const img = await FabricImage.fromURL(media.url, { crossOrigin: 'anonymous' });
                obj.setElement(img.getElement());
                obj.originalSrc = media.url;
                if (isInSlot && slotRect) {
                    this._fitObjectIntoSlot(obj, slotRect, 10);
                    obj.set({
                        customType: 'slot-media',
                        slotId: Number(obj.slotId),
                        inMultiFrame: true,
                        parentFrameId: obj.parentFrameId || parentFrame?.id || parentFrame?.objectId || 'frame'
                    });
                }
                obj.setCoords?.();
                canvas.requestRenderAll();
                Logger.debug('[EditorWrapper] Görsel değiştirildi:', media.filename);
                return;
            } catch (err) {
                Logger.error('[EditorWrapper] Görsel değiştirme hatası:', err);
            }
        }

        // Placeholder/rect ise yeni image ekleyip eskisini kaldır
        const slotContext = isInSlot
            ? {
                frame: parentFrame,
                frameId: obj.parentFrameId || parentFrame?.id || parentFrame?.objectId || 'frame',
                slotId: Number(obj.slotId)
            }
            : null;

        if (slotContext) {
            await this._insertMediaIntoSlot(media, slotContext);
            canvas.remove(obj);
            canvas.requestRenderAll();
            return;
        }

        await this.editor.addImage(media.url, {
            left: obj.left,
            top: obj.top,
            angle: obj.angle || 0,
            opacity: obj.opacity ?? 1,
            filename: media.filename
        });
        canvas.remove(obj);
        canvas.requestRenderAll();
    }

    /**
     * Grid layout preview HTML'i oluştur
     */
    _renderGridPreview(layout) {
        if (!layout || !layout.regions) {
            return '<div style="background: var(--color-primary-light); width: 100%; height: 100%;"></div>';
        }

        // Grid preview için region'ları CSS absolute position ile render et
        const regionColors = [
            'var(--color-primary-light)',
            'var(--bg-secondary)',
            'var(--color-success-light, #d4edda)',
            'var(--color-warning-light, #fff3cd)'
        ];

        return layout.regions.map((region, idx) => `
            <div style="
                position: absolute;
                left: ${region.x}%;
                top: ${region.y}%;
                width: ${region.widthPercent}%;
                height: ${region.heightPercent}%;
                background: ${regionColors[idx % regionColors.length]};
                border: 1px solid var(--border-color);
                box-sizing: border-box;
            "></div>
        `).join('');
    }

    /**
     * Yükleme ekranını gizle
     */
    _hideLoadingScreen() {
        // Yükleme ekranını gizle
        const loading = document.getElementById('editor-loading');
        if (loading) {
            loading.classList.add('hidden');
            setTimeout(() => loading.remove(), 300);
        }

        // Yükleme sırasındaki page header'ı gizle (full editor kendi header'ını içeriyor)
        const pageHeader = document.getElementById('editor-page-header');
        if (pageHeader) {
            pageHeader.remove();
        }
    }

    /**
     * Hata ekranı göster
     */
    _showError(error) {
        this._hideMultiFrameSlotSelector();

        const container = document.getElementById('editor-container');
        if (container) {
            container.innerHTML = `
                <div class="editor-error">
                    <div class="editor-error-icon">
                        <i class="ti ti-alert-circle"></i>
                    </div>
                    <h3 class="editor-error-title">${this.__('editor.loadError')}</h3>
                    <p class="editor-error-message">${error.message}</p>
                    <div class="editor-error-actions">
                        <button class="btn btn-primary" onclick="window.location.reload()">
                            <i class="ti ti-refresh"></i>
                            ${this.__('actions.retry') || 'Tekrar Dene'}
                        </button>
                        <a href="#/templates" class="btn btn-outline">
                            <i class="ti ti-arrow-left"></i>
                            ${this.__('actions.back')}
                        </a>
                    </div>
                </div>
            `;
        }

        const loading = document.getElementById('editor-loading');
        if (loading) loading.remove();
    }

    /**
     * Destroy
     */
    destroy() {
        this._hideMultiFrameSlotSelector();
        this._slotMediaInsertContext = null;
        this._replaceSelectedImage = null;

        if (this._toolbarHandlers) {
            const { toolbar, onToolbarActionClick, onToolbarDropdownClick, onDocumentClick } = this._toolbarHandlers;
            if (toolbar && onToolbarActionClick) toolbar.removeEventListener('click', onToolbarActionClick);
            if (toolbar && onToolbarDropdownClick) toolbar.removeEventListener('click', onToolbarDropdownClick);
            if (onDocumentClick) document.removeEventListener('click', onDocumentClick);
            this._toolbarHandlers = null;
        }

        if (Array.isArray(this._eventUnsubs)) {
            this._eventUnsubs.forEach((unsub) => {
                try {
                    if (typeof unsub === 'function') unsub();
                } catch (e) {
                    // ignore
                }
            });
            this._eventUnsubs = [];
        }

        if (this.editor && typeof this.editor.dispose === 'function') {
            this.editor.dispose();
        } else if (this.editor && typeof this.editor.destroy === 'function') {
            this.editor.destroy();
        }
        this.editor = null;

        // MediaPicker temizle
        if (this.mediaPicker && typeof this.mediaPicker.destroy === 'function') {
            this.mediaPicker.destroy();
        }
        this.mediaPicker = null;

        // i18n temizle
        this.app.i18n.clearPageTranslations();
    }

    /**
     * Editor versiyonunu al
     */
    getVersion() {
        return 'v7';
    }

    /**
     * Editor instance'ını al
     */
    getEditor() {
        return this.editor;
    }
}

// ==========================================
// DEFAULT EXPORT
// ==========================================

export default EditorWrapper;
