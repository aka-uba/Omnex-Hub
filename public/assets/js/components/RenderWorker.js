/**
 * RenderWorker Component
 *
 * Arka planda render job'larını işleyen worker.
 * - Bekleyen job'ları alır
 * - Canvas'da render eder
 * - Sonucu cache'e kaydeder
 * - Toast/notification gösterir
 */

import { Toast } from './Toast.js';
import { getTemplateRenderer, shouldPreserveHelperObjectsForTemplate } from '../services/TemplateRenderer.js?v=1.0.73';

export class RenderWorker {
    constructor(app) {
        this.app = app;
        this.isRunning = false;
        this.isPaused = false;
        this.currentJob = null;
        this.canvas = null;
        this.processedCount = 0;
        this.errorCount = 0;
        this.listeners = new Map();
        this.checkInterval = 5000; // 5 saniyede bir kontrol
        this.intervalId = null;
        this.focusContext = null;
        this.notificationsEnabled = true;
    }

    /**
     * Worker'ı başlat
     */
    async start(options = {}) {
        if (options && (options.batchId || options.productIds || options.templateIds)) {
            this.setFocusContext(options);
        }

        if (Object.prototype.hasOwnProperty.call(options, 'notifications')) {
            this.setNotificationsEnabled(!!options.notifications);
        }

        if (this.isRunning) {
            if (this.isPaused) {
                this.resume();
            }
            return;
        }

        this.isRunning = true;
        this.isPaused = false;
        // Önceki yarım kalan çalışma state'i yeni oturumu bloklamasın.
        this.currentJob = null;

        // Fabric.js yükle (eğer yüklü değilse)
        await this._loadFabricJs();

        // Hidden canvas oluştur
        this._createCanvas();

        // Canvas oluşturulamadıysa hata ver
        if (!this.canvas) {
            console.error('[RenderWorker] Canvas could not be initialized. Fabric.js may not be loaded.');
            this.isRunning = false;
            this._emit('error', { message: 'Canvas not initialized' });
            return;
        }

        // İlk kontrol
        this._checkForJobs();

        // Periyodik kontrol
        this.intervalId = setInterval(() => {
            if (!this.isPaused) {
                this._checkForJobs();
            }
        }, this.checkInterval);

        this._emit('started');
        console.log('[RenderWorker] Started');
    }

    /**
     * Fabric.js kütüphanesini yükle
     */
    async _loadFabricJs() {
        if (typeof fabric !== 'undefined') {
            console.log('[RenderWorker] Fabric.js already loaded');
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const basePath = window.OmnexConfig?.basePath || '';
            script.src = `${basePath}/assets/vendor/fabric/fabric.min.js`;
            script.async = true;
            script.onload = () => {
                console.log('[RenderWorker] Fabric.js loaded');
                resolve();
            };
            script.onerror = () => {
                console.error('[RenderWorker] Failed to load Fabric.js');
                reject(new Error('Failed to load Fabric.js'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Worker'ı durdur
     */
    stop() {
        this.isRunning = false;
        this.isPaused = false;
        this.currentJob = null;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Canvas'ı temizle
        if (this.canvas) {
            this.canvas.dispose();
            this.canvas = null;
        }

        const canvasEl = document.getElementById('render-worker-canvas');
        if (canvasEl) canvasEl.remove();

        this._emit('stopped');
        console.log('[RenderWorker] Stopped');
    }

    /**
     * Worker'ı geçici duraklat
     */
    pause() {
        this.isPaused = true;
        this._emit('paused');
    }

    /**
     * Worker'ı devam ettir
     */
    resume() {
        this.isPaused = false;
        this._emit('resumed');
        this._checkForJobs();
    }

    /**
     * Worker'in odaklanacagi render isleri (batch/product/template filtresi)
     * @param {Object|null} context
     */
    setFocusContext(context = null) {
        if (!context) {
            this.focusContext = null;
            return;
        }

        const productIds = this._normalizeIdList(context.productIds);
        const templateIds = this._normalizeIdList(context.templateIds);
        const batchId = context.batchId ? String(context.batchId).trim() : '';

        this.focusContext = (batchId || productIds.length > 0 || templateIds.length > 0)
            ? {
                batchId: batchId || null,
                productIds,
                templateIds
            }
            : null;

        if (this.isRunning && !this.isPaused) {
            this._checkForJobs();
        }
    }

    _normalizeIdList(rawList) {
        if (!rawList) return [];
        const list = Array.isArray(rawList) ? rawList : [rawList];
        const uniq = new Set();

        list.forEach((item) => {
            const value = String(item || '').trim();
            if (value) uniq.add(value);
        });

        return [...uniq];
    }

    setNotificationsEnabled(enabled) {
        this.notificationsEnabled = !!enabled;
    }

    getNotificationsEnabled() {
        return !!this.notificationsEnabled;
    }

    /**
     * Event listener ekle
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Event listener kaldır
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) callbacks.splice(index, 1);
    }

    /**
     * Event emit
     */
    _emit(event, data = {}) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(cb => cb(data));
    }

    /**
     * API çağrılarını sonsuza kadar beklememek için timeout koruması.
     * @param {Promise<any>} promise
     * @param {number} timeoutMs
     * @param {string} label
     * @returns {Promise<any>}
     */
    async _withTimeout(promise, timeoutMs = 20000, label = 'request') {
        let timer = null;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error(`${label} timeout (${timeoutMs}ms)`));
            }, timeoutMs);
        });

        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    /**
     * Hidden canvas oluştur
     */
    _createCanvas() {
        // Mevcut canvas varsa kaldır
        const existing = document.getElementById('render-worker-canvas');
        if (existing) existing.remove();

        // Yeni canvas oluştur
        const container = document.createElement('div');
        container.id = 'render-worker-container';
        container.style.cssText = 'position: absolute; left: -9999px; top: -9999px; opacity: 0; pointer-events: none;';

        const canvasEl = document.createElement('canvas');
        canvasEl.id = 'render-worker-canvas';
        canvasEl.width = 800;
        canvasEl.height = 1280;

        container.appendChild(canvasEl);
        document.body.appendChild(container);

        // Fabric.js canvas
        if (typeof fabric !== 'undefined') {
            this.canvas = new fabric.Canvas('render-worker-canvas', {
                width: 800,
                height: 1280,
                backgroundColor: '#ffffff'
            });
        }
    }

    /**
     * Bekleyen job'ları kontrol et
     */
    async _checkForJobs() {
        if (!this.isRunning || this.isPaused || this.currentJob) return;

        try {
            let endpoint = '/render-cache/process';
            if (this.focusContext) {
                const params = new URLSearchParams();
                if (this.focusContext.batchId) {
                    params.set('batch_id', this.focusContext.batchId);
                }
                if (this.focusContext.productIds?.length) {
                    params.set('product_ids', this.focusContext.productIds.join(','));
                }
                if (this.focusContext.templateIds?.length) {
                    params.set('template_ids', this.focusContext.templateIds.join(','));
                }
                const query = params.toString();
                if (query) {
                    endpoint += `?${query}`;
                }
            }

            const response = await this._withTimeout(
                this.app.api.get(endpoint),
                20000,
                `RenderWorker GET ${endpoint}`
            );

            if (response.success && response.data?.has_job) {
                this.currentJob = response.data;
                await this._processJob(response.data);
            } else if (
                response.success &&
                this.focusContext &&
                (response.data?.pending_count ?? 0) === 0
            ) {
                // Focusli calismada hedef isler bittiginde global kuyruga dusme.
                // Aksi halde urun sayfasi tekli gonderimden sonra tum eski batch'ler
                // islenip gereksiz toast/notification yagmuru olusabiliyor.
                this._emit('focusCompleted', { context: this.focusContext });
                this.pause();
            } else if (response.success) {
                const pendingCount = response.data?.pending_count ?? '?';
                if (this.focusContext) {
                    console.log(`[RenderWorker] No job in focus. pending_count=${pendingCount}`);
                }
            }
        } catch (error) {
            console.error('[RenderWorker] Check jobs error:', error);
        }
    }

    /**
     * Job'u işle
     */
    async _processJob(jobData) {
        const { job, product, template } = jobData;
        console.log(`[RenderWorker] Processing job ${job?.id || '-'} (${job?.product_id || '-'}/${job?.template_id || '-'})`);

        this._emit('jobStarted', { job, product });

        try {
            // TemplateRenderer ile aynı render akışını kullan
            const renderer = getTemplateRenderer();
            const renderOptions = {
                preserveHelpers: shouldPreserveHelperObjectsForTemplate(template)
            };
            const imageBase64 = await renderer.render(template, product, renderOptions);

            if (!imageBase64) {
                throw new Error('Render output is empty');
            }

            // Sonucu kaydet
            await this._saveResult(job.id, imageBase64);

            this.processedCount++;
            this._emit('jobCompleted', { job, product, imageBase64 });

            // Bildirim göster
            if (this.notificationsEnabled && !this.focusContext) {
                this._showNotification('success', product.name);
            }

        } catch (error) {
            console.error('[RenderWorker] Process job error:', error);
            this.errorCount++;

            // Hatayı kaydet
            await this._failJob(job.id, error.message);

            this._emit('jobFailed', { job, product, error: error.message });
            if (this.notificationsEnabled && !this.focusContext) {
                this._showNotification('error', product.name, error.message);
            }

        } finally {
            this.currentJob = null;

            // Hemen sonraki job'u kontrol et
            setTimeout(() => this._checkForJobs(), 100);
        }
    }

    /**
     * Template'i canvas'a yükle
     */
    async _loadTemplateToCanvas(templateContent, product) {
        if (!this.canvas || !templateContent) return;

        return new Promise((resolve, reject) => {
            try {
                this.canvas.loadFromJSON(templateContent, () => {
                    // Dinamik alanları güncelle
                    this.canvas.getObjects().forEach(obj => {
                        if (obj.isDataField && obj.dynamicField) {
                            const fieldKey = obj.dynamicField;
                            let value = this._getProductFieldValue(product, fieldKey);

                            if (obj.type === 'textbox' || obj.type === 'text' || obj.type === 'i-text') {
                                obj.set('text', value || '');
                            }
                        }
                    });

                    this.canvas.renderAll();
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Ürün alanı değerini al
     */
    _getProductFieldValue(product, fieldKey) {
        const value = product[fieldKey];

        if (value === null || value === undefined) return '';

        // Fiyat formatı
        if (fieldKey.includes('price') && typeof value === 'number') {
            return value.toFixed(2).replace('.', ',') + ' ₺';
        }

        return String(value);
    }

    /**
     * Canvas'ı render et
     */
    async _renderCanvas() {
        if (!this.canvas) throw new Error('Canvas not initialized');

        return new Promise((resolve) => {
            const dataUrl = this.canvas.toDataURL({
                format: 'png',
                quality: 1,
                multiplier: 1
            });
            resolve(dataUrl);
        });
    }

    /**
     * Sonucu kaydet
     */
    async _saveResult(jobId, imageBase64) {
        const response = await this._withTimeout(
            this.app.api.post('/render-cache/process', {
                job_id: jobId,
                image_base64: imageBase64,
                success: true
            }),
            30000,
            'RenderWorker POST /render-cache/process'
        );

        if (!response.success) {
            throw new Error(response.message || 'Failed to save render result');
        }

        return response;
    }

    /**
     * Job'u başarısız olarak işaretle
     */
    async _failJob(jobId, errorMessage) {
        try {
            await this._withTimeout(
                this.app.api.post('/render-cache/process', {
                    job_id: jobId,
                    success: false,
                    error_message: errorMessage
                }),
                20000,
                'RenderWorker fail POST /render-cache/process'
            );
        } catch (error) {
            console.error('[RenderWorker] Failed to mark job as failed:', error);
        }
    }

    /**
     * Bildirim göster
     */
    _showNotification(type, productName, errorMessage = null) {
        const __ = (key) => (typeof window.__ === 'function' ? window.__(key) : null);

        if (type === 'success') {
            const msg = __('render.worker.renderSuccess') || `"${productName}" render edildi`;
            Toast.success(msg.replace('{product}', productName), { duration: 2000 });
        } else {
            const msg = __('render.worker.renderError') || `"${productName}" render hatası: ${errorMessage}`;
            Toast.error(msg.replace('{product}', productName).replace('{error}', errorMessage), { duration: 4000 });
        }

        // Browser-level desktop notifications are centralized in NotificationManager
        // to avoid duplicate system notifications.
    }

    /**
     * İstatistikleri al
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            processedCount: this.processedCount,
            errorCount: this.errorCount,
            hasCurrentJob: !!this.currentJob
        };
    }
}

// Singleton instance
let workerInstance = null;

export function getRenderWorker(app) {
    if (!workerInstance && app) {
        workerInstance = new RenderWorker(app);
    }
    return workerInstance;
}
