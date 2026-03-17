/**
 * Omnex Player - Main Application
 * Digital Signage PWA Player
 *
 * @version 1.0.0
 */

// Dynamic import paths based on player location
const basePath = window.PLAYER_PATH || '/player/';
const jsPath = basePath + 'assets/js/';

// Use dynamic imports with full paths for Android TV compatibility
let api, storage;

function parsePositiveIntSetting(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBooleanSetting(value, fallback) {
    if (value === null || typeof value === 'undefined' || value === '') {
        return fallback;
    }

    const normalized = String(value).trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
        return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
        return false;
    }

    return fallback;
}

async function loadDependencies() {
    const apiModule = await import(jsPath + 'api.js');
    const storageModule = await import(jsPath + 'storage.js');
    api = apiModule.api;
    storage = storageModule.storage;
}

class OmnexPlayer {
    constructor() {
        const globalPlayerConfig = window.PLAYER_CONFIG || {};
        const queryParams = new URLSearchParams(window.location.search);
        const apkUrlFromQuery = queryParams.get('apk_url') || queryParams.get('apkUrl');
        const perfProfileFromQuery = (queryParams.get('perf_profile') || queryParams.get('perfProfile') || '').trim().toLowerCase();
        const heartbeatSeconds = parsePositiveIntSetting(
            queryParams.get('heartbeat'),
            parsePositiveIntSetting(globalPlayerConfig.heartbeatSeconds, 5)
        );
        const syncSeconds = parsePositiveIntSetting(
            queryParams.get('sync'),
            parsePositiveIntSetting(globalPlayerConfig.syncSeconds, 60)
        );
        const verifyPollingMs = parsePositiveIntSetting(
            queryParams.get('verify_ms') || queryParams.get('verifyMs'),
            parsePositiveIntSetting(globalPlayerConfig.verifyPollingMs, 3000)
        );
        const enableServiceWorker = parseBooleanSetting(
            queryParams.get('sw'),
            globalPlayerConfig.enableServiceWorker !== false
        );
        const enableMediaPrecache = parseBooleanSetting(
            queryParams.get('precache'),
            globalPlayerConfig.enableMediaPrecache !== false
        );

        // State
        this.state = 'loading'; // loading, registration, playing, error
        this.deviceConfig = null;
        this.playlist = null;
        this.currentIndex = 0;
        this.isPlaying = false;

        // Current content tracking for seamless transitions
        this._currentContentType = null; // 'image', 'video', 'template', 'html'
        this._currentVideoUrl = null;    // Track current video URL to avoid reload
        this._currentElement = null;     // Track currently visible content element
        this._transitionType = 'none';   // Transition type from playlist
        this._transitionDuration = 500;  // Transition duration in ms
        this._runtimeTransitionType = null; // Resolved transition for the current swap
        this._htmlPrefetchUrl = null;
        this._htmlPrefetchController = null;

        // Timers
        this.heartbeatInterval = null;
        this.syncInterval = null;
        this.contentTimer = null;
        this.verifyPollingInterval = null;
        this.syncCodeTimer = null;
        this.statusBarTimer = null;
        this.performanceProfile = perfProfileFromQuery || String(globalPlayerConfig.performanceProfile || 'default');
        this._syncInFlight = false;
        this._queuedSyncPending = false;
        this._queuedSyncForceRestart = false;

        // Configuration
        this.config = {
            heartbeatSeconds: heartbeatSeconds,
            syncSeconds: syncSeconds,
            defaultDuration: 10,
            verifyPollingMs: verifyPollingMs,
            syncCodeExpiryMinutes: 15,
            statusBarHideDelay: 3000, // 3 seconds
            enableServiceWorker: enableServiceWorker,
            enableMediaPrecache: enableMediaPrecache,
            showInstallPromptInAndroidApp: globalPlayerConfig.showInstallPromptInAndroidApp === true,
            apkDownloadUrl: (apkUrlFromQuery || globalPlayerConfig.apkDownloadUrl || '').trim() || null
        };
        this.preferredOrientation = null;
        this.nextMediaWarmup = null;
        this.nextMediaWarmupUrl = null;

        // DOM Elements
        this.screens = {};
        this.elements = {};

        // HLS player
        this.hls = null;

        // Debug mode
        this.debug = window.location.search.includes('debug');

        // PWA Install
        this.deferredInstallPrompt = null;
        this.isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone === true;

        // iOS PWA Video Autoplay Fix
        this._iosInteractionGranted = false;
        this._isIOSPWA = this._detectIOSPWA();

        // Android Native App Bridge
        this.isAndroidApp = typeof window.AndroidBridge !== 'undefined';
        this.androidBridge = this.isAndroidApp ? window.AndroidBridge : null;
        this.lastDisplayMetrics = null;
        this.currentContentOrientation = null;
        this.videoDebugTimer = null;
        this.videoDebugOverlay = null;
        this._nativeVideoMode = false;
        this._enterTransitionTimers = new WeakMap();
        this._exitTransitionTimers = new WeakMap();

        // Dual video element ping-pong for seamless video-to-video crossfade
        this._activeVideoSlot = 'primary'; // 'primary' or 'alt'
        this._activeHtmlSlot = 'primary';  // 'primary' or 'alt'
        this._pendingExitElement = null;   // Deferred exit transition until next content is ready
        this._isEdgeBrowser = /Edg\//i.test(navigator.userAgent || '');
        this._isEdgePwa = this._isEdgeBrowser && this.isInstalled;
        this._lastEdgeTransitionFallbackLog = null;
    }

    isLegacyProfile() {
        return this.performanceProfile === 'legacy';
    }

    isBalancedProfile() {
        return this.performanceProfile === 'balanced';
    }

    isConstrainedProfile() {
        return this.isLegacyProfile() || this.isBalancedProfile();
    }

    getEdgeTransitionFallback(transitionType) {
        if (!this._isEdgePwa || !transitionType || transitionType === 'none') {
            return transitionType;
        }

        const fallbackMap = {
            'wipe-left': 'push-left',
            'wipe-right': 'push-right',
            'wipe-up': 'push-up',
            'wipe-down': 'push-down'
        };

        const fallbackTransition = fallbackMap[transitionType] || transitionType;
        if (fallbackTransition !== transitionType) {
            const fallbackLogKey = `${transitionType}->${fallbackTransition}`;
            if (this._lastEdgeTransitionFallbackLog !== fallbackLogKey) {
                console.log(`[Player] Edge PWA transition fallback: ${transitionType} -> ${fallbackTransition}`);
                this._lastEdgeTransitionFallbackLog = fallbackLogKey;
            }
        }

        return fallbackTransition;
    }

    getElementDebugLabel(element) {
        if (!element) {
            return 'none';
        }

        if (element.id) {
            return element.id;
        }

        if (element.tagName) {
            return element.tagName.toLowerCase();
        }

        return 'unknown';
    }

    traceDebug(scope, message, payload) {
        // Detailed trace logs disabled in production code path.
        // Keep method as no-op to avoid touching transition flow call sites.
        return;
    }

    roundDebugValue(value, precision = 2) {
        const n = Number(value);
        if (!Number.isFinite(n)) {
            return 0;
        }
        const factor = Math.pow(10, precision);
        return Math.round(n * factor) / factor;
    }

    getElementLayoutSnapshot(element) {
        if (!element) {
            return null;
        }

        const computed = window.getComputedStyle ? window.getComputedStyle(element) : null;
        const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : null;
        const transitionClasses = Array.from(element.classList || []).filter(cls =>
            cls === 'transition-enter' ||
            cls === 'transition-exit' ||
            cls.endsWith('-enter') ||
            cls.endsWith('-exit') ||
            cls === 'loading'
        );

        let mediaSource = '';
        if (element.tagName === 'VIDEO') {
            mediaSource = element.currentSrc || element.src || '';
        } else if (element.tagName === 'IFRAME') {
            mediaSource = element.src || '';
        } else if (element.tagName === 'IMG') {
            mediaSource = element.currentSrc || element.src || '';
        }

        return {
            id: this.getElementDebugLabel(element),
            display: element.style.display || '',
            computedDisplay: computed ? computed.display : '',
            visibility: element.style.visibility || '',
            computedVisibility: computed ? computed.visibility : '',
            opacity: element.style.opacity || '',
            computedOpacity: computed ? computed.opacity : '',
            zIndex: element.style.zIndex || '',
            computedZIndex: computed ? computed.zIndex : '',
            transitionClasses: transitionClasses.join(' '),
            rect: rect ? {
                left: this.roundDebugValue(rect.left, 1),
                top: this.roundDebugValue(rect.top, 1),
                width: this.roundDebugValue(rect.width, 1),
                height: this.roundDebugValue(rect.height, 1)
            } : null,
            srcTail: mediaSource ? mediaSource.slice(-180) : ''
        };
    }

    traceTransitionSnapshot(stage, payload = {}) {
        // Detailed state snapshots disabled in production code path.
        // Keep method as no-op to avoid touching transition flow call sites.
        return;
    }

    /**
     * Get device info from Android Bridge or browser
     * @returns {Object} Device information
     */
    getDeviceInfo() {
        if (this.isAndroidApp && this.androidBridge) {
            try {
                return JSON.parse(this.androidBridge.getDeviceInfo());
            } catch (e) {
                // Fallback to browser detection
            }
        }

        // Browser-based detection
        const fallbackAppVersion = (window.OmnexConfig && window.OmnexConfig.appVersion)
            ? String(window.OmnexConfig.appVersion)
            : 'unknown';
        return {
            model: navigator.userAgent,
            manufacturer: 'Browser',
            brand: navigator.vendor || 'Unknown',
            androidVersion: null,
            sdkVersion: null,
            appVersion: fallbackAppVersion,
            isTV: this._detectTV(),
            isAndroidApp: this.isAndroidApp
        };
    }

    /**
     * Detect if running on a TV device
     */
    _detectTV() {
        const ua = navigator.userAgent.toLowerCase();
        return ua.includes('tv') ||
               ua.includes('android tv') ||
               ua.includes('google tv') ||
               ua.includes('smart-tv') ||
               ua.includes('hbbtv') ||
               ua.includes('web0s') ||
               ua.includes('tizen');
    }

    /**
     * Show toast message (Android app or fallback)
     */
    showToastMessage(message) {
        if (this.isAndroidApp && this.androidBridge) {
            this.androidBridge.showToast(message);
        } else {
            this.showToast(message, 'info');
        }
    }

    /**
     * Keep screen on (Android app only)
     */
    setKeepScreenOn(enable) {
        if (this.isAndroidApp && this.androidBridge) {
            this.androidBridge.keepScreenOn(enable);
        }
        // For browser, use Wake Lock API if available
        else if ('wakeLock' in navigator) {
            if (enable) {
                navigator.wakeLock.request('screen').catch(() => {});
            }
        }
    }

    /**
     * Reload page (Android app or browser)
     */
    reloadPlayer() {
        if (this.isAndroidApp && this.androidBridge) {
            this.androidBridge.reloadPage();
        } else {
            window.location.reload();
        }
    }

    showVideoDebugUrl(url, item) {
        if (!this.isLegacyProfile() || !url) {
            return;
        }

        const mediaType = item && item.type ? String(item.type) : 'video';
        const text = `[VIDEO_DEBUG] ${mediaType}: ${url}`;
        console.log(text);

        if (!document.body) {
            return;
        }

        if (!this.videoDebugOverlay) {
            const overlay = document.createElement('div');
            overlay.id = 'video-debug-overlay';
            overlay.style.position = 'fixed';
            overlay.style.left = '12px';
            overlay.style.right = '12px';
            overlay.style.bottom = '12px';
            overlay.style.zIndex = '99999';
            overlay.style.padding = '8px 10px';
            overlay.style.background = 'rgba(0, 0, 0, 0.85)';
            overlay.style.color = '#fff';
            overlay.style.fontSize = '12px';
            overlay.style.lineHeight = '1.4';
            overlay.style.fontFamily = 'monospace';
            overlay.style.wordBreak = 'break-all';
            overlay.style.pointerEvents = 'none';
            overlay.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            overlay.style.borderRadius = '6px';
            overlay.style.display = 'none';
            document.body.appendChild(overlay);
            this.videoDebugOverlay = overlay;
        }

        this.videoDebugOverlay.textContent = text;
        this.videoDebugOverlay.style.display = 'block';

        if (this.videoDebugTimer) {
            clearTimeout(this.videoDebugTimer);
        }

        this.videoDebugTimer = setTimeout(() => {
            if (this.videoDebugOverlay) {
                this.videoDebugOverlay.style.display = 'none';
            }
            this.videoDebugTimer = null;
        }, 8000);
    }

    /**
     * Detect if running as iOS PWA (standalone mode on iOS)
     */
    _detectIOSPWA() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        // Check standalone mode - navigator.standalone is iOS specific
        let isStandalone = false;
        if (typeof window.navigator.standalone === 'boolean') {
            isStandalone = window.navigator.standalone;
        } else if (window.matchMedia) {
            try {
                isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            } catch (e) {
                isStandalone = false;
            }
        }

        return isIOS && isStandalone;
    }

    /**
     * Detect if running on iOS (any mode)
     */
    _isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    /**
     * Initialize the player
     */
    async init() {
        try {
            // Log Android Bridge status
            if (this.isAndroidApp) {
                const deviceInfo = this.getDeviceInfo();
                console.log('[Omnex Player] Running in Android App:', deviceInfo);
                this.setKeepScreenOn(true);
            }

            this.captureInstallPrompt();
            this.cacheElements();
            this.applyDeviceProfileClasses();
            this.setupFullscreenListener();

            await storage.init();
            await this.registerServiceWorker();

            const hasSession = await api.init();

            if (hasSession) {
                await this.initializePlayer();
            } else {
                await this.startRegistration();
            }

            this.setupEventListeners();
            this.startClock();
        } catch (error) {
            console.error('[Omnex Player] Init error:', error);
            this.showError('Başlatma hatası: ' + (error.message || 'Bilinmeyen hata'));
        }
    }

    /**
     * Capture beforeinstallprompt event for PWA installation
     */
    captureInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredInstallPrompt = e;
            this.updateInstallButtonVisibility();
        });

        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.deferredInstallPrompt = null;
            this.hideInstallPrompt();
            this.updateInstallButtonVisibility();
        });
    }

    /**
     * Show PWA install modal
     */
    showInstallPrompt() {
        this.showInstallPromptWithCallback(null);
    }

    /**
     * Show PWA install modal with callback after user action
     * @param {Function} onComplete - Called after user installs or skips
     */
    showInstallPromptWithCallback(onComplete) {
        if (this.isAndroidApp && !this.config.showInstallPromptInAndroidApp) {
            if (onComplete) onComplete();
            return;
        }

        const existingModal = document.getElementById('pwa-install-modal');
        if (existingModal) {
            if (onComplete) {
                this._installPromptCallback = onComplete;
            }
            return;
        }

        // If already installed, skip to callback immediately
        if (this.isInstalled) {
            if (onComplete) onComplete();
            return;
        }

        const canShowNativePrompt = !!this.deferredInstallPrompt;
        const deviceInfo = this.detectDeviceType();

        const modal = document.createElement('div');
        modal.id = 'pwa-install-modal';
        modal.className = 'pwa-install-modal';

        // Build install instructions based on device type
        let installInstructions = '';
        let installButtonHtml = '';
        let apkButtonHtml = '';

        const canOfferApkDownload = !!this.config.apkDownloadUrl && !this.isAndroidApp;
        if (canOfferApkDownload) {
            apkButtonHtml = `
                <a class="btn-install btn-install-apk" id="btn-apk-download" href="#" target="_blank" rel="noopener">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="7" y="2" width="10" height="14" rx="2"/>
                        <path d="M9 19h6M12 11v9M9 17l3 3 3-3"/>
                    </svg>
                    APK İndir (Android)
                </a>`;
        }

        if (canShowNativePrompt) {
            // Native install prompt available
            installButtonHtml = `
                <button class="btn-install" id="btn-pwa-install">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12l7 7 7-7"/>
                    </svg>
                    PWA Olarak Yükle
                </button>`;
        } else {
            // Show manual instructions based on device type
            if (deviceInfo.isTV || deviceInfo.isAndroidTV) {
                installInstructions = `
                    <div class="manual-install-hint">
                        <p style="font-size: 0.9rem; color: var(--player-text-muted); margin-bottom: 0.75rem;">
                            <strong>Android TV / Google TV:</strong>
                        </p>
                        <p style="font-size: 0.85rem; color: var(--player-text-muted); margin-bottom: 0.5rem;">
                            1. Tarayıcı menüsünü açın (menü simgesi)
                        </p>
                        <p style="font-size: 0.85rem; color: var(--player-text-muted); margin-bottom: 0.5rem;">
                            2. "Ana ekrana ekle" veya "Kısayol oluştur" seçin
                        </p>
                        <p style="font-size: 0.85rem; color: var(--player-text-muted);">
                            3. Uygulama ana ekranda görünecektir
                        </p>
                    </div>`;
            } else if (deviceInfo.isIOS) {
                installInstructions = `
                    <div class="manual-install-hint">
                        <p style="font-size: 0.9rem; color: var(--player-text-muted); margin-bottom: 0.5rem;">
                            <strong>iOS / iPad:</strong>
                        </p>
                        <p style="font-size: 0.85rem; color: var(--player-text-muted);">
                            Safari'de
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
                            </svg>
                            simgesine basın -> "Ana Ekrana Ekle"
                        </p>
                    </div>`;
            } else if (deviceInfo.isMobile || deviceInfo.isTablet) {
                installInstructions = `
                    <div class="manual-install-hint">
                        <p style="font-size: 0.9rem; color: var(--player-text-muted); margin-bottom: 0.5rem;">
                            <strong>${deviceInfo.isTablet ? 'Tablet' : 'Mobil'}:</strong>
                        </p>
                        <p style="font-size: 0.85rem; color: var(--player-text-muted);">
                            Tarayıcı menüsü (menü simgesi) -> "Ana ekrana ekle"
                        </p>
                    </div>`;
            } else {
                // Desktop / PC
                installInstructions = `
                    <div class="manual-install-hint">
                        <p style="font-size: 0.9rem; color: var(--player-text-muted); margin-bottom: 0.5rem;">
                            <strong>Masaüstü:</strong>
                        </p>
                        <p style="font-size: 0.85rem; color: var(--player-text-muted);">
                            Adres çubuğundaki
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                                <path d="M12 5v14M5 12l7 7 7-7"/>
                            </svg>
                            yükle simgesine tıklayın
                        </p>
                    </div>`;
            }

            // Always show a download button that will try native or show instructions
            installButtonHtml = `
                <button class="btn-install" id="btn-pwa-install">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12l7 7 7-7"/>
                    </svg>
                    PWA Olarak Yükle
                </button>`;
        }

        modal.innerHTML = `
            <div class="pwa-install-content">
                <div class="pwa-install-icon">
                    <img src="../branding/icon-192.png?v=5" alt="Omnex" width="60" height="60" style="border-radius: 12px;">
                </div>
                <h2>Kurulum Seçenekleri</h2>
                <p>Tarayıcı için PWA kurabilir veya Android cihazlar için APK indirebilirsiniz.</p>
                <div class="pwa-install-features">
                    <div class="feature-item">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12l5 5L20 7"/>
                        </svg>
                        <span>Tam ekran deneyimi</span>
                    </div>
                    <div class="feature-item">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12l5 5L20 7"/>
                        </svg>
                        <span>Çevrimdışı çalışma</span>
                    </div>
                    <div class="feature-item">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12l5 5L20 7"/>
                        </svg>
                        <span>Hızlı başlatma</span>
                    </div>
                </div>
                ${installInstructions}
                <div class="pwa-install-buttons">
                    ${installButtonHtml}
                    ${apkButtonHtml}
                    <button class="btn-skip" id="btn-pwa-skip">Şimdi Değil</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Store callback for later use
        this._installPromptCallback = onComplete;

        // Install button handler
        document.getElementById('btn-pwa-install').addEventListener('click', async () => {
            if (canShowNativePrompt) {
                // Use native install prompt
                await this.installPWA();
            } else {
                // Try to trigger install manually or show instructions
                await this.tryManualInstall(deviceInfo);
            }
            if (this._installPromptCallback) {
                this._installPromptCallback();
                this._installPromptCallback = null;
            }
        });

        const apkDownloadBtn = document.getElementById('btn-apk-download');
        if (apkDownloadBtn) {
            apkDownloadBtn.href = this.config.apkDownloadUrl;
            apkDownloadBtn.addEventListener('click', () => {
                this.hideInstallPrompt();
                if (this._installPromptCallback) {
                    this._installPromptCallback();
                    this._installPromptCallback = null;
                }
            });
        }

        document.getElementById('btn-pwa-skip').addEventListener('click', () => {
            this.hideInstallPrompt();
            if (this._installPromptCallback) {
                this._installPromptCallback();
                this._installPromptCallback = null;
            }
        });

        requestAnimationFrame(() => {
            modal.classList.add('visible');
        });
    }

    /**
     * Detect device type for appropriate install instructions
     */
    detectDeviceType() {
        const ua = navigator.userAgent.toLowerCase();
        const metrics = this.getDisplayMetrics();
        const displayWidth = Math.max(metrics.screenWidth, metrics.viewportWidth);
        const hasCoarsePointer = window.matchMedia &&
            (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(any-pointer: coarse)').matches);
        const hasNoHover = window.matchMedia &&
            (window.matchMedia('(hover: none)').matches || window.matchMedia('(any-hover: none)').matches);
        const isPhoneOrTabletUa = /mobile|phone|tablet|ipad|iphone/.test(ua);
        const isLikelyTvDisplay = displayWidth >= 1280 && hasNoHover && !isPhoneOrTabletUa;
        const isAndroidTvUa = /android/.test(ua) && /tv|aftt|aftm|aftb|googletv|bravia|fire tv/.test(ua);
        const isSmartTvUa = /smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast|webos|tizen/.test(ua) || /tv/.test(ua);

        return {
            isIOS: /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
            isAndroid: /android/.test(ua),
            isAndroidTV: isAndroidTvUa || (/android/.test(ua) && isLikelyTvDisplay),
            isTV: isSmartTvUa || isLikelyTvDisplay,
            isMobile: /mobile|phone/.test(ua),
            isTablet: /tablet|ipad/.test(ua) || (displayWidth >= 768 && displayWidth <= 1280 && 'ontouchstart' in window && !isLikelyTvDisplay),
            isDesktop: !(/mobile|phone|tablet|android|iphone|ipad/.test(ua)) && !isLikelyTvDisplay && !isSmartTvUa
        };
    }

    /**
     * Try to trigger manual install or show helpful instructions
     */
    async tryManualInstall(deviceInfo) {
        // First, try using Web Share API if available (works on some TVs and mobile)
        if (navigator.share && (deviceInfo.isTV || deviceInfo.isAndroidTV || deviceInfo.isMobile)) {
            try {
                await navigator.share({
                    title: 'Omnex Player',
                    text: 'Omnex Display Hub Player',
                    url: window.location.href
                });
                this.showToast('Paylaşılan linki ana ekrana ekleyebilirsiniz', 'success', 3000);
                this.hideInstallPrompt();
                return;
            } catch (err) {
                // Share was cancelled or failed, continue with other methods
            }
        }

        // Try to create a download link for manifest (some browsers support this)
        if (deviceInfo.isAndroid || deviceInfo.isAndroidTV) {
            try {
                // Try triggering install via manifest
                const link = document.createElement('a');
                link.href = window.location.href;
                link.rel = 'manifest';

                // Some browsers respond to clicking the current URL when manifest is present
                const manifestLink = document.querySelector('link[rel="manifest"]');
                if (manifestLink) {
                    // Force reload to trigger install banner
                    if ('getInstalledRelatedApps' in navigator) {
                        const relatedApps = await navigator.getInstalledRelatedApps();
                        if (relatedApps.length === 0) {
                            // App not installed, show detailed instructions
                            this.showDetailedInstallInstructions(deviceInfo);
                            return;
                        }
                    }
                }
            } catch (e) {
                // Continue with instructions
            }
        }

        // Show detailed instructions based on device
        this.showDetailedInstallInstructions(deviceInfo);
    }

    /**
     * Show detailed install instructions overlay
     */
    showDetailedInstallInstructions(deviceInfo) {
        // Remove existing instruction overlay if any
        const existingOverlay = document.getElementById('install-instructions-overlay');
        if (existingOverlay) existingOverlay.remove();

        let instructions = '';
        let browserIcon = 'menü simgesi';

        if (deviceInfo.isTV || deviceInfo.isAndroidTV) {
            instructions = `
                <div class="instruction-step">
                    <span class="step-number">1</span>
                    <span>TV kumandanızla tarayıcı menüsünü açın (${browserIcon})</span>
                </div>
                <div class="instruction-step">
                    <span class="step-number">2</span>
                    <span>"Ana ekrana ekle" veya "Kısayol oluştur" seçin</span>
                </div>
                <div class="instruction-step">
                    <span class="step-number">3</span>
                    <span>İsim olarak "Omnex Player" yazın</span>
                </div>
                <div class="instruction-step">
                    <span class="step-number">4</span>
                    <span>Ana ekranda uygulama ikonunu göreceksiniz</span>
                </div>
                <div class="instruction-note">
                    <strong>Not:</strong> Chrome tarayıcı kullanıyorsanız, adres çubuğunun sağındaki
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                        <path d="M12 5v14M5 12l7 7 7-7"/>
                    </svg>
                    simgesine de tıklayabilirsiniz.
                </div>
            `;
        } else if (deviceInfo.isIOS) {
            instructions = `
                <div class="instruction-step">
                    <span class="step-number">1</span>
                    <span>Safari'de alt menüdeki paylaş
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
                        </svg>
                        simgesine dokunun
                    </span>
                </div>
                <div class="instruction-step">
                    <span class="step-number">2</span>
                    <span>"Ana Ekrana Ekle" seçeneğini bulun</span>
                </div>
                <div class="instruction-step">
                    <span class="step-number">3</span>
                    <span>Sağ üstteki "Ekle" düğmesine dokunun</span>
                </div>
            `;
        } else if (deviceInfo.isMobile || deviceInfo.isTablet) {
            instructions = `
                <div class="instruction-step">
                    <span class="step-number">1</span>
                    <span>Tarayıcı menüsünü açın (${browserIcon})</span>
                </div>
                <div class="instruction-step">
                    <span class="step-number">2</span>
                    <span>"Ana ekrana ekle" veya "Uygulama yükle" seçin</span>
                </div>
                <div class="instruction-step">
                    <span class="step-number">3</span>
                    <span>"Ekle" ile onaylayın</span>
                </div>
            `;
        } else {
            // Desktop
            instructions = `
                <div class="instruction-step">
                    <span class="step-number">1</span>
                    <span>Chrome: Adres çubuğunun sağındaki
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                            <path d="M12 5v14M5 12l7 7 7-7"/>
                        </svg>
                        simgesine tıklayın
                    </span>
                </div>
                <div class="instruction-step">
                    <span class="step-number">2</span>
                    <span>Edge: Menü (üç nokta) -> "Uygulamalar" -> "Bu siteyi uygulama olarak yükle"</span>
                </div>
                <div class="instruction-step">
                    <span class="step-number">3</span>
                    <span>"Yükle" ile onaylayın</span>
                </div>
            `;
        }

        const overlay = document.createElement('div');
        overlay.id = 'install-instructions-overlay';
        overlay.className = 'install-instructions-overlay';
        overlay.innerHTML = `
            <div class="install-instructions-content">
                <h3>Uygulama Nasıl Yüklenir?</h3>
                <div class="instructions-list">
                    ${instructions}
                </div>
                <div class="instructions-actions">
                    <button class="btn-close-instructions" id="btn-close-instructions">Anladım</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Add styles if not present
        if (!document.getElementById('install-instructions-styles')) {
            const styles = document.createElement('style');
            styles.id = 'install-instructions-styles';
            styles.textContent = `
                .install-instructions-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10002;
                    animation: fadeIn 0.3s ease;
                }
                .install-instructions-content {
                    background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
                    border-radius: 16px;
                    padding: 2rem;
                    max-width: 500px;
                    width: 90%;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .install-instructions-content h3 {
                    color: white;
                    margin: 0 0 1.5rem 0;
                    font-size: 1.25rem;
                    text-align: center;
                }
                .instructions-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .instruction-step {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    color: rgba(255,255,255,0.9);
                    font-size: 0.95rem;
                    line-height: 1.5;
                }
                .step-number {
                    background: #18c8c8;
                    color: white;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    font-weight: bold;
                    flex-shrink: 0;
                }
                .instruction-note {
                    margin-top: 1rem;
                    padding: 0.75rem;
                    background: rgba(24, 200, 200, 0.2);
                    border-radius: 8px;
                    color: rgba(255,255,255,0.8);
                    font-size: 0.85rem;
                    line-height: 1.4;
                }
                .instructions-actions {
                    margin-top: 1.5rem;
                    text-align: center;
                }
                .btn-close-instructions {
                    background: #18c8c8;
                    color: white;
                    border: none;
                    padding: 0.75rem 2rem;
                    border-radius: 8px;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .btn-close-instructions:hover {
                    background: #4338ca;
                }
            `;
            document.head.appendChild(styles);
        }

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });

        document.getElementById('btn-close-instructions').addEventListener('click', () => {
            overlay.remove();
            this.hideInstallPrompt();
        });
    }

    /**
     * Hide install prompt modal
     */
    hideInstallPrompt() {
        const modal = document.getElementById('pwa-install-modal');
        if (modal) {
            modal.classList.remove('visible');
            setTimeout(() => modal.remove(), 300);
        }
    }

    /**
     * Trigger PWA installation
     */
    async installPWA() {
        if (!this.deferredInstallPrompt) {
            return;
        }

        try {
            this.deferredInstallPrompt.prompt();
            const { outcome } = await this.deferredInstallPrompt.userChoice;

            if (outcome === 'accepted') {
                this.isInstalled = true;
            }

            this.deferredInstallPrompt = null;
            this.hideInstallPrompt();
            this.updateInstallButtonVisibility();
        } catch (error) {
            // Silent fail
        }
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.screens = {
            loading: document.getElementById('loading-screen'),
            registration: document.getElementById('registration-screen'),
            player: document.getElementById('player-screen'),
            error: document.getElementById('error-screen')
        };

        this.elements = {
            loadingMessage: document.getElementById('loading-message'),
            syncCode: document.getElementById('sync-code'),
            syncTimer: document.getElementById('sync-timer'),
            deviceFingerprint: document.getElementById('device-fingerprint'),
            screenResolution: document.getElementById('screen-resolution'),
            installActions: document.getElementById('floating-install-actions'),
            pwaInstallBtn: document.getElementById('pwa-install-btn'),
            apkInstallBtn: document.getElementById('apk-install-btn'),
            orientationToggleBtn: document.getElementById('orientation-toggle-btn'),
            registrationStatus: document.getElementById('registration-status'),
            qrContainer: document.getElementById('qr-container'),
            imageContent: document.getElementById('image-content'),
            videoContent: document.getElementById('video-content'),
            videoContentAlt: document.getElementById('video-content-alt'),
            htmlContent: document.getElementById('html-content'),
            htmlContentAlt: document.getElementById('html-content-alt'),
            fallbackContent: document.getElementById('fallback-content'),
            fallbackMessage: document.getElementById('fallback-message'),
            statusBar: document.getElementById('status-bar'),
            connectionStatus: document.getElementById('connection-status'),
            deviceName: document.getElementById('device-name'),
            currentItemInfo: document.getElementById('current-item-info'),
            currentTime: document.getElementById('current-time'),
            errorMessage: document.getElementById('error-message'),
            btnRetry: document.getElementById('btn-retry'),
            debugPanel: document.getElementById('debug-panel'),
            debugLog: document.getElementById('debug-log')
        };
    }

    /**
     * Show specific screen
     */
    showScreen(screenName) {
        Object.entries(this.screens).forEach(([name, screen]) => {
            if (screen) {
                screen.classList.remove('active');
                screen.style.setProperty('display', 'none', 'important');
            }
        });

        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
            this.screens[screenName].style.setProperty('display', 'flex', 'important');
        }

        this.state = screenName;
        this.updateInstallButtonVisibility();
        this.updateOrientationToggleVisibility();

        // Note: Auto-fullscreen removed due to browser security restrictions
        // (requires user gesture). Users can double-tap/click to go fullscreen.
    }

    /**
     * Calculate robust display metrics for TV/mobile/browser differences.
     * Uses visual viewport + layout viewport + screen metrics together.
     */
    getDisplayMetrics() {
        const vv = window.visualViewport || null;
        const dpr = window.devicePixelRatio || 1;

        const viewportWidth = Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || screen.width || 0);
        const viewportHeight = Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || screen.height || 0);
        const rawScreenWidth = Math.round(screen.width || viewportWidth || 0);
        const rawScreenHeight = Math.round(screen.height || viewportHeight || 0);
        const isPortraitViewport = viewportHeight >= viewportWidth;

        const normalizedScreenWidth = Math.min(rawScreenWidth || viewportWidth, rawScreenHeight || viewportHeight);
        const normalizedScreenHeight = Math.max(rawScreenWidth || viewportWidth, rawScreenHeight || viewportHeight);
        const screenWidth = isPortraitViewport ? normalizedScreenWidth : normalizedScreenHeight;
        const screenHeight = isPortraitViewport ? normalizedScreenHeight : normalizedScreenWidth;

        const renderWidth = viewportWidth;
        const renderHeight = viewportHeight;
        const physicalRenderWidth = Math.round(renderWidth * dpr);
        const physicalRenderHeight = Math.round(renderHeight * dpr);

        return {
            viewportWidth,
            viewportHeight,
            screenWidth,
            screenHeight,
            renderWidth,
            renderHeight,
            physicalViewportWidth: Math.round(viewportWidth * dpr),
            physicalViewportHeight: Math.round(viewportHeight * dpr),
            physicalRenderWidth,
            physicalRenderHeight,
            physicalScreenWidth: Math.round(screenWidth * dpr),
            physicalScreenHeight: Math.round(screenHeight * dpr),
            devicePixelRatio: Number(dpr.toFixed(2))
        };
    }

    /**
     * Add device profile classes to <body> for responsive layout targeting.
     */
    applyDeviceProfileClasses() {
        if (!document.body) return;
        const deviceInfo = this.detectDeviceType();
        const body = document.body;

        body.classList.remove('device-tv', 'device-mobile', 'device-tablet', 'device-desktop');

        let deviceType = 'desktop';
        if (deviceInfo.isTV || deviceInfo.isAndroidTV) {
            body.classList.add('device-tv');
            deviceType = 'tv';
        } else if (deviceInfo.isMobile) {
            body.classList.add('device-mobile');
            deviceType = 'mobile';
        } else if (deviceInfo.isTablet) {
            body.classList.add('device-tablet');
            deviceType = 'tablet';
        } else {
            body.classList.add('device-desktop');
        }

        body.setAttribute('data-device-type', deviceType);
    }

    /**
     * Build human-readable display summary for registration UI.
     */
    formatDisplayMetrics(metrics) {
        if (!metrics) return '-';
        return `${metrics.renderWidth}x${metrics.renderHeight} CSS | ${metrics.physicalRenderWidth}x${metrics.physicalRenderHeight} px | DPR ${metrics.devicePixelRatio}`;
    }

    /**
     * Local template URLs can be saved as localhost. On remote devices this fails.
     * Replace localhost targets with the active host so the same path remains reachable.
     */
    normalizeLocalhostUrl(url) {
        if (!url) return url;

        try {
            const resolved = new URL(url, window.location.href);
            const localHosts = ['localhost', '127.0.0.1', '::1'];
            const activeHost = window.location.hostname;

            if (localHosts.includes(resolved.hostname) && activeHost && !localHosts.includes(activeHost)) {
                resolved.hostname = activeHost;
                if (!resolved.port && window.location.port) {
                    resolved.port = window.location.port;
                }
            }

            return resolved.toString();
        } catch (error) {
            return url;
        }
    }

    /**
     * Update screen resolution text on registration screen.
     */
    updateScreenResolutionLabel() {
        if (!this.elements.screenResolution) return;
        const metrics = this.getDisplayMetrics();
        this.lastDisplayMetrics = metrics;
        this.elements.screenResolution.textContent = this.formatDisplayMetrics(metrics);
    }

    /**
     * PWA install button should remain accessible before and after pairing.
     */
    updateInstallButtonVisibility() {
        const canInstall = !this.isInstalled &&
            (!this.isAndroidApp || this.config.showInstallPromptInAndroidApp);
        const visibleOnState = this.state !== 'error';
        const pwaBtn = this.elements?.pwaInstallBtn;
        const apkBtn = this.elements?.apkInstallBtn;
        const actionWrap = this.elements?.installActions;

        if (pwaBtn) {
            const pwaVisible = canInstall && visibleOnState;
            pwaBtn.style.display = pwaVisible ? 'inline-flex' : 'none';
            pwaBtn.classList.toggle('visible', pwaVisible);
        }

        const canInstallApk = !!this.config.apkDownloadUrl && !this.isAndroidApp;
        if (apkBtn) {
            const apkVisible = canInstallApk && visibleOnState;
            apkBtn.style.display = apkVisible ? 'inline-flex' : 'none';
            apkBtn.classList.toggle('visible', apkVisible);
            if (apkVisible) {
                apkBtn.href = this.config.apkDownloadUrl;
            }
        }

        if (actionWrap) {
            const hasVisibleAction = (pwaBtn && pwaBtn.style.display !== 'none') ||
                (apkBtn && apkBtn.style.display !== 'none');
            actionWrap.style.display = hasVisibleAction ? 'flex' : 'none';
        }
    }

    /**
     * Show/hide orientation toggle button.
     */
    updateOrientationToggleVisibility() {
        const btn = this.elements?.orientationToggleBtn;
        if (!btn) return;
        const visible = this.state === 'player';
        btn.style.display = visible ? 'inline-flex' : 'none';
        btn.classList.toggle('visible', visible);
        this.updateOrientationToggleState();
    }

    getPlaylistOrientation() {
        if (this.playlist && (this.playlist.orientation === 'landscape' || this.playlist.orientation === 'portrait')) {
            return this.playlist.orientation;
        }
        return 'landscape';
    }

    normalizeOrientationValue(value) {
        if (!value && value !== 0) return null;
        const normalized = String(value).trim().toLowerCase();
        if (!normalized) return null;

        if (['landscape', 'horizontal', 'yatay', 'l'].includes(normalized)) return 'landscape';
        if (['portrait', 'vertical', 'dikey', 'p'].includes(normalized)) return 'portrait';
        return null;
    }

    getOrientationFromDimensions(width, height) {
        const w = Number(width);
        const h = Number(height);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
        return w >= h ? 'landscape' : 'portrait';
    }

    parseDimensionPair(value) {
        if (!value) return null;
        const text = String(value);
        const match = text.match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
        if (!match) return null;

        const width = Number(match[1]);
        const height = Number(match[2]);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
        return { width, height };
    }

    resolveItemOrientation(item) {
        if (!item || typeof item !== 'object') {
            return this.getPlaylistOrientation();
        }

        const explicitOrientation = this.normalizeOrientationValue(
            item.orientation ||
            item.content_orientation ||
            item.screen_orientation ||
            (item.media && item.media.orientation) ||
            (item.template && item.template.orientation)
        );
        if (explicitOrientation) return explicitOrientation;

        const sizePairs = [
            { width: item.width, height: item.height },
            item.dimensions,
            item.size,
            { width: item.media && item.media.width, height: item.media && item.media.height },
            (item.media && item.media.dimensions) || null,
            { width: item.template && item.template.width, height: item.template && item.template.height },
            (item.template && item.template.dimensions) || null
        ];

        for (const pair of sizePairs) {
            if (!pair) continue;
            const orientation = this.getOrientationFromDimensions(pair.width, pair.height);
            if (orientation) return orientation;
        }

        const resolutionValues = [
            item.resolution,
            item.size_label,
            item.media && item.media.resolution,
            item.media && item.media.size_label,
            item.template && item.template.resolution
        ];

        for (const value of resolutionValues) {
            const pair = this.parseDimensionPair(value);
            if (!pair) continue;
            const orientation = this.getOrientationFromDimensions(pair.width, pair.height);
            if (orientation) return orientation;
        }

        return this.getPlaylistOrientation();
    }

    getRequestedOrientation() {
        return (this.preferredOrientation === 'landscape' || this.preferredOrientation === 'portrait')
            ? this.preferredOrientation
            : null;
    }

    getBaseContentOrientation() {
        return this.currentContentOrientation || this.getPlaylistOrientation();
    }

    shouldVirtualizePlaylistOrientation() {
        // When user explicitly requests portrait/landscape with the toggle,
        // treat playlist layout orientation as requested screen orientation.
        // This keeps content geometry/transition paths consistent across types.
        return !!this.getRequestedOrientation();
    }

    getLayoutOrientationState() {
        const requestedOrientation = this.getRequestedOrientation();
        const baseOrientation = this.getBaseContentOrientation();
        const virtualized = !!requestedOrientation && this.shouldVirtualizePlaylistOrientation();

        return {
            requestedOrientation,
            baseOrientation,
            layoutOrientation: virtualized ? requestedOrientation : baseOrientation,
            source: virtualized ? 'requested-screen' : 'content-or-playlist',
            virtualized
        };
    }

    getEffectiveOrientationState() {
        return this.getRequestedOrientation() || this.getCurrentScreenOrientation();
    }

    getViewportOrientation() {
        const metrics = this.getDisplayMetrics();
        return metrics.viewportHeight >= metrics.viewportWidth ? 'portrait' : 'landscape';
    }

    getNativeBridgeOrientation() {
        if (!this.isAndroidApp || !this.androidBridge || typeof this.androidBridge.getOrientation !== 'function') {
            return null;
        }
        try {
            return this.normalizeOrientationValue(this.androidBridge.getOrientation());
        } catch (e) {
            return null;
        }
    }

    getCurrentScreenOrientation() {
        return this.getNativeBridgeOrientation() || this.getViewportOrientation();
    }

    /**
     * Apply rotation fallback when browser orientation lock is unavailable.
     */
    applyOrientationRotation(container, requestedOrientation) {
        if (!container) return;

        container.classList.remove('force-rotate-landscape', 'force-rotate-portrait');
        if (requestedOrientation !== 'landscape' && requestedOrientation !== 'portrait') return;

        const metrics = this.getDisplayMetrics();
        const isViewportPortrait = metrics.viewportHeight >= metrics.viewportWidth;

        if (requestedOrientation === 'landscape' && isViewportPortrait) {
            container.classList.add('force-rotate-landscape');
            return;
        }
        if (requestedOrientation === 'portrait' && !isViewportPortrait) {
            container.classList.add('force-rotate-portrait');
        }
    }

    /**
     * Keep toggle icon/title aligned with current orientation state.
     */
    updateOrientationToggleState() {
        const btn = this.elements?.orientationToggleBtn;
        if (!btn) return;

        const current = this.getEffectiveOrientationState();
        const next = current === 'landscape' ? 'portrait' : 'landscape';
        btn.classList.toggle('portrait', current === 'portrait');
        btn.title = next === 'landscape' ? 'Yataya Cevir' : 'Dikeye Cevir';
    }

    /**
     * Toggle preferred orientation between landscape and portrait.
     */
    async togglePreferredOrientation() {
        const current = this.getEffectiveOrientationState();
        const next = current === 'landscape' ? 'portrait' : 'landscape';

        let nativeRequestSent = false;
        let browserLockApplied = false;

        // Android APK: Use native bridge for reliable orientation change
        if (this.isAndroidApp && this.androidBridge && typeof this.androidBridge.setOrientation === 'function') {
            try {
                this.androidBridge.setOrientation(next);
                nativeRequestSent = true;
            } catch (e) {
                // Fallback below
            }
        }

        // Browser/PWA: Try Screen Orientation API
        if (!nativeRequestSent) {
            try {
                if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
                    await window.screen.orientation.lock(next);
                    browserLockApplied = true;
                }
            } catch (e) {
                // Orientation lock may fail when not supported.
            }
        }

        this.preferredOrientation = next;

        const applyOrientationState = () => {
            this.applyPlaylistOrientation();
            this.updateOrientationToggleState();
            const layoutState = this.getLayoutOrientationState();
            if (this.debug) {
                console.log('[Player] Orientation toggle result:', {
                    from: current,
                    requested: next,
                    nativeRequestSent,
                    browserLockApplied,
                    currentScreen: this.getCurrentScreenOrientation(),
                    layout: layoutState.layoutOrientation,
                    source: layoutState.source
                });
            }
            this.traceTransitionSnapshot('orientation-toggle-applied', {
                from: current,
                requested: next,
                nativeRequestSent,
                browserLockApplied,
                layoutOrientation: layoutState.layoutOrientation,
                layoutSource: layoutState.source,
                virtualizedPlaylistOrientation: layoutState.virtualized
            });
        };

        // Wait for native/browser orientation propagation before computing fallback classes.
        if (nativeRequestSent || browserLockApplied) {
            setTimeout(() => {
                applyOrientationState();
            }, 350);
        } else {
            applyOrientationState();
        }

        this.showToast(next === 'portrait' ? 'Dikey gorunum secildi' : 'Yatay gorunum secildi', 'info', 1800);
    }

    /**
     * Show status bar with auto-hide
     */
    showStatusBar() {
        // Only show status bar when on player screen
        if (this.state !== 'player') return;

        const statusBar = this.elements.statusBar;
        if (!statusBar) return;

        statusBar.classList.add('visible');

        // Clear existing timer
        if (this.statusBarTimer) {
            clearTimeout(this.statusBarTimer);
        }

        // Set new hide timer
        this.statusBarTimer = setTimeout(() => {
            this.hideStatusBar();
        }, this.config.statusBarHideDelay);
    }

    /**
     * Hide status bar
     */
    hideStatusBar() {
        const statusBar = this.elements.statusBar;
        if (statusBar) {
            statusBar.classList.remove('visible');
        }
    }

    /**
     * Request fullscreen mode
     */
    async requestFullscreen() {
        try {
            const elem = document.documentElement;

            if (document.fullscreenElement || document.webkitFullscreenElement) {
                return;
            }

            const video = this.getActiveVideoElement();
            const wasPlaying = video && !video.paused && video.currentTime > 0;
            const currentTime = (video && video.currentTime) ? video.currentTime : 0;

            if (elem.requestFullscreen) {
                await elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                await elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                await elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
                await elem.msRequestFullscreen();
            }

            if (wasPlaying && video) {
                setTimeout(() => {
                    video.currentTime = currentTime;
                    video.play().catch(() => {});
                }, 100);
            }
        } catch (error) {
            // Fullscreen may fail silently on some devices
        }
    }

    /**
     * Setup fullscreen change listener
     */
    setupFullscreenListener() {
        const handleFullscreenChange = () => {
            const video = this.getActiveVideoElement();
            if (video && video.style.display !== 'none' && video.src) {
                setTimeout(() => {
                    if (video.paused && this.isPlaying) {
                        video.play().catch(() => {});
                    }
                }, 200);
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    }

    /**
     * Update loading message
     */
    setLoadingMessage(message) {
        if (this.elements.loadingMessage) {
            this.elements.loadingMessage.textContent = message;
        }
    }

    /**
     * Parse device details from User Agent string
     * Extracts brand, model, OS version, device type
     */
    parseDeviceDetails(userAgent) {
        const ua = userAgent || navigator.userAgent;
        const result = {
            deviceType: 'unknown',
            brand: null,
            model: null,
            os: null,
            osVersion: null,
            browser: null,
            browserVersion: null
        };

        // Detect OS and Version
        if (/Android/i.test(ua)) {
            result.os = 'Android';
            const match = ua.match(/Android\s+([\d.]+)/i);
            if (match) result.osVersion = match[1];
        } else if (/iPhone|iPad|iPod/i.test(ua)) {
            result.os = 'iOS';
            const match = ua.match(/OS\s+([\d_]+)/i);
            if (match) result.osVersion = match[1].replace(/_/g, '.');
        } else if (/Windows/i.test(ua)) {
            result.os = 'Windows';
            if (/Windows NT 10/i.test(ua)) result.osVersion = '10/11';
            else if (/Windows NT 6.3/i.test(ua)) result.osVersion = '8.1';
            else if (/Windows NT 6.2/i.test(ua)) result.osVersion = '8';
            else if (/Windows NT 6.1/i.test(ua)) result.osVersion = '7';
        } else if (/Mac OS X/i.test(ua)) {
            result.os = 'macOS';
            const match = ua.match(/Mac OS X\s+([\d_]+)/i);
            if (match) result.osVersion = match[1].replace(/_/g, '.');
        } else if (/Linux/i.test(ua)) {
            result.os = 'Linux';
        } else if (/CrOS/i.test(ua)) {
            result.os = 'Chrome OS';
        }

        // Detect Browser
        if (/Edg\//i.test(ua)) {
            result.browser = 'Edge';
            const match = ua.match(/Edg\/([\d.]+)/i);
            if (match) result.browserVersion = match[1];
        } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
            result.browser = 'Opera';
            const match = ua.match(/(?:OPR|Opera)[\/\s]([\d.]+)/i);
            if (match) result.browserVersion = match[1];
        } else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) {
            result.browser = 'Chrome';
            const match = ua.match(/Chrome\/([\d.]+)/i);
            if (match) result.browserVersion = match[1];
        } else if (/Firefox/i.test(ua)) {
            result.browser = 'Firefox';
            const match = ua.match(/Firefox\/([\d.]+)/i);
            if (match) result.browserVersion = match[1];
        } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
            result.browser = 'Safari';
            const match = ua.match(/Version\/([\d.]+)/i);
            if (match) result.browserVersion = match[1];
        }

        // Detect Device Type
        const isTvUa = /Android/i.test(ua) && /TV|BRAVIA|AFT|AFTM|Fire TV|SmartTV/i.test(ua);
        const isSmartTvUa = /Smart-?TV|Tizen|webOS|NetCast|VIDAA/i.test(ua);

        if (isTvUa || isSmartTvUa) {
            result.deviceType = 'tv';
        } else if (/iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
            result.deviceType = 'tablet';
        } else if (/iPhone|iPod/i.test(ua) || (/Android/i.test(ua) && /Mobile/i.test(ua))) {
            result.deviceType = 'mobile';
        } else if (/Windows|Macintosh|Linux/i.test(ua) && !/Mobile/i.test(ua)) {
            result.deviceType = 'desktop';
        }

        // Detect Brand and Model for Android devices
        if (/Android/i.test(ua)) {
            // Common Android device patterns: "Build/MODEL" or "BRAND MODEL Build"
            // Try to extract from Build info
            const buildMatch = ua.match(/;\s*([^;]+)\s+Build\//i);
            if (buildMatch) {
                const deviceString = buildMatch[1].trim();

                // Known brand patterns
                const brandPatterns = [
                    { regex: /^(Samsung)\s+(.+)/i, brand: 'Samsung' },
                    { regex: /^(SM-[A-Z]\d+)/i, brand: 'Samsung', modelOnly: true },
                    { regex: /^(Galaxy\s+\S+)/i, brand: 'Samsung', modelOnly: true },
                    { regex: /^(Xiaomi|Redmi|POCO|Mi)\s*(.+)/i, brand: 'Xiaomi' },
                    { regex: /^(HUAWEI|Honor)\s*(.+)/i, brand: match => match[1] },
                    { regex: /^(OPPO|CPH\d+)/i, brand: 'OPPO' },
                    { regex: /^(vivo|V\d+)/i, brand: 'Vivo' },
                    { regex: /^(OnePlus)\s*(.+)/i, brand: 'OnePlus' },
                    { regex: /^(Pixel)\s*(.+)/i, brand: 'Google' },
                    { regex: /^(Nexus)\s*(.+)/i, brand: 'Google' },
                    { regex: /^(LG|LM-)/i, brand: 'LG' },
                    { regex: /^(Sony|Xperia)/i, brand: 'Sony' },
                    { regex: /^(Motorola|moto|XT\d+)/i, brand: 'Motorola' },
                    { regex: /^(Nokia)/i, brand: 'Nokia' },
                    { regex: /^(ASUS|ZenFone|ROG)/i, brand: 'ASUS' },
                    { regex: /^(Lenovo|Tab|Legion)/i, brand: 'Lenovo' },
                    { regex: /^(Realme|RMX)/i, brand: 'Realme' },
                    { regex: /^(ZTE|Blade)/i, brand: 'ZTE' },
                    { regex: /^(Meizu)/i, brand: 'Meizu' },
                    { regex: /^(TCL)/i, brand: 'TCL' },
                    { regex: /^(Alcatel)/i, brand: 'Alcatel' },
                    { regex: /^(HTC)/i, brand: 'HTC' },
                    { regex: /^(Amazon|KF|Fire)/i, brand: 'Amazon' },
                    { regex: /^(Casper)/i, brand: 'Casper' },
                    { regex: /^(General Mobile|GM)/i, brand: 'General Mobile' },
                    { regex: /^(Vestel)/i, brand: 'Vestel' },
                    { regex: /^(Reeder)/i, brand: 'Reeder' },
                    { regex: /^(Hometech)/i, brand: 'Hometech' }
                ];

                let matched = false;
                for (const pattern of brandPatterns) {
                    const brandMatch = deviceString.match(pattern.regex);
                    if (brandMatch) {
                        result.brand = typeof pattern.brand === 'function'
                            ? pattern.brand(brandMatch)
                            : pattern.brand;
                        result.model = pattern.modelOnly
                            ? brandMatch[1]
                            : (brandMatch[2] || brandMatch[1]);
                        matched = true;
                        break;
                    }
                }

                // If no brand matched, use the whole string as model
                if (!matched) {
                    // Try to split by space, first part might be brand
                    const parts = deviceString.split(/\s+/);
                    if (parts.length > 1) {
                        result.brand = parts[0];
                        result.model = parts.slice(1).join(' ');
                    } else {
                        result.model = deviceString;
                    }
                }
            }
        }

        // Detect Brand for iOS devices
        if (/iPhone/i.test(ua)) {
            result.brand = 'Apple';
            result.model = 'iPhone';
        } else if (/iPad/i.test(ua)) {
            result.brand = 'Apple';
            result.model = 'iPad';
        } else if (/iPod/i.test(ua)) {
            result.brand = 'Apple';
            result.model = 'iPod';
        }

        // Clean up model string
        if (result.model) {
            result.model = result.model.trim().replace(/\s+/g, ' ');
        }

        return result;
    }

    /**
     * Calculate approximate screen diagonal in inches
     */
    calculateScreenDiagonal() {
        try {
            // Use physical resolution if available
            const width = screen.width * (window.devicePixelRatio || 1);
            const height = screen.height * (window.devicePixelRatio || 1);
            const diagonal = Math.sqrt(width * width + height * height);

            // Estimate PPI based on device type
            // This is approximate - actual PPI varies by device
            let ppi = 96; // Default desktop PPI

            const ua = navigator.userAgent;
            if (/iPhone/i.test(ua)) {
                ppi = 326; // Retina iPhone
            } else if (/iPad/i.test(ua)) {
                ppi = 264; // Retina iPad
            } else if (/Android/i.test(ua)) {
                // Android devices vary widely
                // Use screen density hints if available
                if (window.devicePixelRatio >= 3) {
                    ppi = 480; // xxhdpi
                } else if (window.devicePixelRatio >= 2) {
                    ppi = 320; // xhdpi
                } else if (window.devicePixelRatio >= 1.5) {
                    ppi = 240; // hdpi
                } else {
                    ppi = 160; // mdpi
                }
            }

            const inches = diagonal / ppi;
            return Math.round(inches * 10) / 10; // Round to 1 decimal
        } catch (e) {
            return null;
        }
    }

    /**
     * Get network connection type
     */
    getConnectionType() {
        if ('connection' in navigator) {
            const conn = navigator.connection;
            return {
                type: conn.effectiveType || conn.type || 'unknown',
                downlink: conn.downlink || null,
                rtt: conn.rtt || null,
                saveData: conn.saveData || false
            };
        }
        return { type: 'unknown' };
    }

    // ==================== Registration Flow ====================

    /**
     * Start device registration
     */
    async startRegistration() {
        this.showScreen('loading');
        this.setLoadingMessage('Cihaz kaydediliyor...');

        try {
            const fingerprint = await storage.generateFingerprint();

            // Store fingerprint for retry attempts
            this._registrationFingerprint = fingerprint;

            // Parse detailed device info from User Agent
            const deviceDetails = this.parseDeviceDetails(navigator.userAgent);
            const displayMetrics = this.getDisplayMetrics();

            const deviceInfo = {
                fingerprint,
                // Screen info
                screenWidth: displayMetrics.renderWidth,
                screenHeight: displayMetrics.renderHeight,
                screenResolution: `${displayMetrics.renderWidth}x${displayMetrics.renderHeight}`,
                colorDepth: screen.colorDepth,
                devicePixelRatio: displayMetrics.devicePixelRatio,
                viewportWidth: displayMetrics.viewportWidth,
                viewportHeight: displayMetrics.viewportHeight,
                physicalViewportWidth: displayMetrics.physicalViewportWidth,
                physicalViewportHeight: displayMetrics.physicalViewportHeight,
                // Calculate approximate screen size in inches
                screenDiagonal: this.calculateScreenDiagonal(),
                // Device details parsed from UA
                deviceType: deviceDetails.deviceType,
                brand: deviceDetails.brand,
                model: deviceDetails.model,
                os: deviceDetails.os,
                osVersion: deviceDetails.osVersion,
                browser: deviceDetails.browser,
                browserVersion: deviceDetails.browserVersion,
                // Additional info
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                // Hardware info
                cores: navigator.hardwareConcurrency || null,
                memory: navigator.deviceMemory || null,
                touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
                // Connection info
                connectionType: this.getConnectionType()
            };

            // Show registration screen immediately with loading state
            this.showRegistrationScreen(null, fingerprint);

            // Try to register
            await this.attemptRegistration(deviceInfo, fingerprint);

        } catch (error) {
            // Even if fingerprint generation fails, show registration screen
            this.showRegistrationScreen(null, 'Oluşturuluyor...');
            this.elements.registrationStatus.textContent = 'Bağlantı bekleniyor...';
            this.elements.registrationStatus.className = 'info-value status-waiting';

            // Retry after delay
            setTimeout(() => this.startRegistration(), 5000);
        }
    }

    /**
     * Attempt to register device with server
     */
    async attemptRegistration(deviceInfo, fingerprint, retryCount = 0) {
        const maxRetries = 5;
        const retryDelay = 3000;

        try {
            const response = await api.register(deviceInfo);

            if (response.success) {
                await storage.saveDeviceConfig({
                    fingerprint,
                    syncCode: response.data.syncCode,
                    syncCodeExpires: response.data.expiresAt,
                    registeredAt: new Date().toISOString()
                });

                // Update registration screen with sync code
                this.updateRegistrationCode(response.data.syncCode);
                this.startVerifyPolling(response.data.syncCode);
            } else {
                throw new Error(response.message || 'Registration failed');
            }
        } catch (error) {
            if (retryCount < maxRetries) {
                // Update status to show retry
                this.elements.registrationStatus.textContent =
                    `Bağlantı kuruluyor... (${retryCount + 1}/${maxRetries})`;
                this.elements.registrationStatus.className = 'info-value status-waiting';
                this.elements.syncCode.textContent = '------';

                // Retry after delay
                setTimeout(() => {
                    this.attemptRegistration(deviceInfo, fingerprint, retryCount + 1);
                }, retryDelay);
            } else {
                // Max retries reached, show error but stay on registration screen
                this.elements.registrationStatus.textContent = 'Bağlantı hatası - Tekrar deneniyor...';
                this.elements.registrationStatus.className = 'info-value status-error';

                // Keep retrying indefinitely with longer delay
                setTimeout(() => {
                    this.attemptRegistration(deviceInfo, fingerprint, 0);
                }, 10000);
            }
        }
    }

    /**
     * Update registration screen with sync code
     */
    updateRegistrationCode(syncCode) {
        const formattedCode = syncCode.toString().padStart(6, '0');
        this.elements.syncCode.textContent = formattedCode;
        this.elements.registrationStatus.textContent = 'Onay Bekleniyor';
        this.elements.registrationStatus.className = 'info-value status-waiting';

        this.startSyncCodeTimer();
        this.generateQRCode(syncCode);
    }

    /**
     * Show registration screen with sync code
     */
    showRegistrationScreen(syncCode, fingerprint) {
        this.showScreen('registration');

        // Handle null/undefined sync code (loading state)
        if (syncCode) {
            const formattedCode = syncCode.toString().padStart(6, '0');
            this.elements.syncCode.textContent = formattedCode;
        } else {
            this.elements.syncCode.textContent = '------';
            this.elements.registrationStatus.textContent = 'Sunucuya bağlanılıyor...';
            this.elements.registrationStatus.className = 'info-value status-waiting';
        }

        // Handle fingerprint display
        if (fingerprint && fingerprint.length > 12) {
            this.elements.deviceFingerprint.textContent = fingerprint.substring(0, 12) + '...';
        } else {
            this.elements.deviceFingerprint.textContent = fingerprint || 'Oluşturuluyor...';
        }

        this.updateScreenResolutionLabel();

        // Only start timer and QR if we have a sync code
        if (syncCode) {
            this.startSyncCodeTimer();
            this.generateQRCode(syncCode);
        }
    }

    /**
     * Start sync code countdown timer
     */
    startSyncCodeTimer() {
        let remainingSeconds = this.config.syncCodeExpiryMinutes * 60;

        const updateTimer = () => {
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            this.elements.syncTimer.textContent =
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (remainingSeconds <= 0) {
                clearInterval(this.syncCodeTimer);
                this.handleSyncCodeExpired();
            }

            remainingSeconds--;
        };

        updateTimer();
        this.syncCodeTimer = setInterval(updateTimer, 1000);
    }

    /**
     * Handle expired sync code
     */
    async handleSyncCodeExpired() {
        this.elements.registrationStatus.textContent = 'Kod süresi doldu, yenileniyor...';
        this.elements.registrationStatus.className = 'info-value status-expired';

        setTimeout(() => {
            this.startRegistration();
        }, 2000);
    }

    /**
     * Generate QR code for sync code
     * Uses qrcodejs library (davidshimjs/qrcodejs)
     */
    generateQRCode(syncCode) {
        const qrContainer = this.elements.qrContainer;
        if (!qrContainer) return;

        // Clear container
        qrContainer.innerHTML = '';

        // Create a div for qrcodejs (it creates its own canvas/table)
        const qrDiv = document.createElement('div');
        qrDiv.id = 'qr-code';
        qrDiv.style.cssText = 'display: inline-block; background: #0f0f23; padding: 8px; border-radius: 8px;';
        qrContainer.appendChild(qrDiv);

        // Check if QRCode library is loaded (qrcodejs)
        if (typeof QRCode !== 'undefined') {
            try {
                // Calculate size based on viewport
                const size = Math.min(120, Math.floor(window.innerWidth * 0.2));

                // Generate QR code with qrcodejs API
                new QRCode(qrDiv, {
                    text: syncCode,
                    width: size,
                    height: size,
                    colorDark: '#18c8c8',   // QR code color (purple)
                    colorLight: '#0f0f23',  // Background (dark theme)
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (e) {
                this.showQRFallback(qrContainer, syncCode);
            }
        } else {
            // QRCode library not loaded yet, wait and retry
            setTimeout(() => {
                if (typeof QRCode !== 'undefined') {
                    this.generateQRCode(syncCode);
                } else {
                    this.showQRFallback(qrContainer, syncCode);
                }
            }, 500);
        }
    }

    /**
     * Show QR fallback when library fails
     */
    showQRFallback(container, syncCode) {
        container.innerHTML = `
            <div class="qr-placeholder" style="text-align: center; padding: 1rem;">
                <svg viewBox="0 0 100 100" width="80" height="80" style="opacity: 0.5;">
                    <rect x="10" y="10" width="80" height="80" fill="none" stroke="#18c8c8" stroke-width="2"/>
                    <rect x="20" y="20" width="20" height="20" fill="#18c8c8"/>
                    <rect x="60" y="20" width="20" height="20" fill="#18c8c8"/>
                    <rect x="20" y="60" width="20" height="20" fill="#18c8c8"/>
                    <rect x="45" y="45" width="10" height="10" fill="#18c8c8"/>
                </svg>
                <p style="color: rgba(255,255,255,0.6); font-size: 0.75rem; margin-top: 0.5rem;">Kodu panele girin</p>
            </div>
        `;
    }

    /**
     * Start polling for approval
     */
    startVerifyPolling(syncCode) {
        this.verifyPollingInterval = setInterval(async () => {
            try {
                const response = await api.verify(syncCode);

                if (response.success && response.data.status === 'approved') {
                    clearInterval(this.verifyPollingInterval);
                    clearInterval(this.syncCodeTimer);

                    await storage.saveDeviceConfig({
                        deviceId: response.data.deviceId,
                        token: response.data.token,
                        companyId: response.data.companyId,
                        approvedAt: new Date().toISOString()
                    });

                    api.setToken(response.data.token, response.data.deviceId);

                    this.elements.registrationStatus.textContent = 'Onaylandı!';
                    this.elements.registrationStatus.className = 'info-value status-approved';

                    // Request notification permission first
                    setTimeout(() => {
                        this.requestNotificationPermission();
                    }, 500);

                    // Show PWA install prompt and wait for user action before continuing
                    setTimeout(() => {
                        this.showInstallPromptWithCallback(() => {
                            // After install prompt is dismissed, start player
                            this.initializePlayer();
                        });
                    }, 1000);
                } else if (response.data.status === 'rejected') {
                    clearInterval(this.verifyPollingInterval);
                    clearInterval(this.syncCodeTimer);

                    this.elements.registrationStatus.textContent = 'Reddedildi';
                    this.elements.registrationStatus.className = 'info-value status-rejected';

                    setTimeout(() => {
                        this.startRegistration();
                    }, 3000);
                }
            } catch (error) {
                // Continue polling on error
            }
        }, this.config.verifyPollingMs);
    }

    // ==================== Player Initialization ====================

    /**
     * Initialize player with content
     */
    async initializePlayer() {
        this.showScreen('loading');
        this.setLoadingMessage('İçerik yükleniyor...');

        try {
            const response = await api.init_player();

            if (!response.success) {
                throw new Error(response.message || 'Player init failed');
            }

            const data = response.data;

            if (!data) {
                throw new Error('Sunucudan veri alınamadı');
            }

            this.deviceConfig = {
                deviceId: data.device ? data.device.id : null,
                deviceName: (data.device && data.device.name) ? data.device.name : 'Omnex Player',
                companyName: data.company ? data.company.name : null
            };

            this.elements.deviceName.textContent = this.deviceConfig.deviceName;

            if (data.playlist) {
                this.playlist = data.playlist;
                this.applyPlaylistPlaybackSettings();

                // Check if playlist has items
                if (!this.playlist.items || this.playlist.items.length === 0) {
                    this.showScreen('player');
                    this.showFallback('Yayın listesi boş\n\nYönetim panelinden playlist\'e medya ekleyin');
                } else {
                    await storage.savePlaylist(this.playlist);

                    this.showScreen('player');
                    this.startPlayback();
                    // No bulk precache on init - prepareNextMedia() handles
                    // progressive caching (next 2 items) on each video advance.
                }
            } else {
                this.showScreen('player');
                this.showFallback('Yayın listesi atanmadı\n\nYönetim panelinden bu cihaza playlist atayın');
            }

            this.startHeartbeat();
            this.startSyncChecker();

        } catch (error) {
            const cachedConfig = await storage.getDeviceConfig();
            if (cachedConfig && cachedConfig.lastPlaylist) {
                this.playlist = await storage.getPlaylist(cachedConfig.lastPlaylist);
                if (this.playlist) {
                    this.showScreen('player');
                    this.startPlayback();
                    return;
                }
            }

            const statusCode = error && typeof error.status === 'number' ? error.status : 0;
            const errorText = String((error && (error.message || error.statusText)) || '').toLowerCase();
            const shouldReRegister =
                statusCode === 401 ||
                statusCode === 403 ||
                errorText.includes('token') ||
                errorText.includes('device') ||
                errorText.includes('cihaz');

            if (shouldReRegister) {
                await storage.clearDeviceConfig();
                api.clearCredentials();
                await this.startRegistration();
                return;
            }

            const errorMsg = error.message || error.statusText || 'Bağlantı hatası';
            this.showError('İçerik yüklenemedi: ' + errorMsg);
        }
    }

    /**
     * Check if a URL is valid for Service Worker caching
     */
    isValidCacheableUrl(url) {
        if (!url || typeof url !== 'string') return false;

        // Reject data URIs (SW cannot fetch these)
        if (url.startsWith('data:')) return false;

        // Reject hash routes (e.g. #/dashboard)
        if (url.includes('#/') || url.startsWith('#')) return false;

        // Reject blob URLs
        if (url.startsWith('blob:')) return false;

        // Must be a proper http/https URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

        const lowerUrl = url.toLowerCase();
        // Never precache live HLS manifest/stream endpoints.
        if (lowerUrl.includes('/api/stream/') || lowerUrl.includes('.m3u8')) return false;

        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch (e) {
            return false;
        }

        const path = (parsedUrl.pathname || '').toLowerCase();
        const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm'];
        const hasKnownMediaExtension = mediaExtensions.some((ext) => path.endsWith(ext));
        const looksLikeMediaPath = path.includes('/storage/') || path.includes('/media/');

        // SW MEDIA cache should only target actual media assets, not HTML/web URLs.
        if (!hasKnownMediaExtension && !looksLikeMediaPath) {
            return false;
        }

        // Reject URLs with unresolved template variables
        if (url.includes('%7B') || url.includes('%7D') ||
            url.includes('{') || url.includes('}')) return false;

        return true;
    }

    /**
     * Pre-cache media files
     */
    /**
     * Pre-cache upcoming media files progressively.
     * Only caches the next PRECACHE_AHEAD items from current position
     * instead of ALL playlist items. This prevents network saturation
     * that was causing every ~6th video to load slowly.
     *
     * @param {boolean} pruneStale - Also prune stale cache entries (full playlist context)
     */
    async precacheMedia(pruneStale = false) {
        if (!this.config.enableMediaPrecache) return;
        if (!this.playlist || !this.playlist.items || !this.playlist.items.length) return;
        if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;

        const items = this.playlist.items;
        const len = items.length;
        const PRECACHE_AHEAD = 2; // Only cache next 2 items - minimal network impact

        // Collect next N upcoming URLs from current position
        const upcomingUrls = [];
        for (let offset = 1; offset <= Math.min(PRECACHE_AHEAD, len - 1); offset++) {
            const idx = (this.currentIndex + offset) % len;
            const it = items[idx];
            if (!it) continue;
            const itemType = String(it.type || '').toLowerCase();
            const mimeType = String(it.mime_type || '').toLowerCase();
            const isMediaType =
                itemType === 'image' ||
                itemType === 'video' ||
                itemType === 'stream' ||
                mimeType.startsWith('image/') ||
                mimeType.startsWith('video/');
            if (!isMediaType) continue;
            const rawUrl = it.url || (it.media && it.media.url);
            if (!rawUrl) continue;
            const url = this.normalizeLocalhostUrl(api.getMediaUrl(rawUrl));
            if (this.isValidCacheableUrl(url)) {
                upcomingUrls.push(url);
            }
        }

        if (upcomingUrls.length > 0) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CACHE_MEDIA',
                data: { urls: upcomingUrls }
            });
        }

        // Prune stale entries only on playlist change (not every item advance)
        if (pruneStale) {
            const allMediaUrls = items
                .filter((item) => {
                    if (!(item.url || (item.media && item.media.url))) return false;
                    const itemType = String(item.type || '').toLowerCase();
                    const mimeType = String(item.mime_type || '').toLowerCase();
                    return itemType === 'image' ||
                        itemType === 'video' ||
                        itemType === 'stream' ||
                        mimeType.startsWith('image/') ||
                        mimeType.startsWith('video/');
                })
                .map(function(item) { return api.getMediaUrl(item.url || (item.media && item.media.url)); })
                .map((url) => this.normalizeLocalhostUrl(url))
                .filter((url) => this.isValidCacheableUrl(url));
            const uniqueMediaUrls = Array.from(new Set(allMediaUrls));

            navigator.serviceWorker.controller.postMessage({
                type: 'PRUNE_MEDIA_CACHE',
                data: { keepUrls: uniqueMediaUrls }
            });
        }
    }

    /**
     * Schedule deferred precache with prune (for playlist changes).
     */
    _scheduleDeferredPrecache() {
        if (this._deferredPrecacheTimer) {
            clearTimeout(this._deferredPrecacheTimer);
        }
        this._deferredPrecacheTimer = setTimeout(() => {
            this._deferredPrecacheTimer = null;
            this.precacheMedia(true); // prune stale on playlist change
        }, 5000);
    }

    cleanupNextMediaWarmup() {
        const warmup = this.nextMediaWarmup;
        if (!warmup) {
            this.nextMediaWarmupUrl = null;
            return;
        }

        if (warmup.tagName === 'VIDEO') {
            warmup.pause();
            warmup.removeAttribute('src');
            warmup.load();
        }

        this.nextMediaWarmup = null;
        this.nextMediaWarmupUrl = null;
    }

    cleanupHtmlPrefetch() {
        if (this._htmlPrefetchController && typeof this._htmlPrefetchController.abort === 'function') {
            try {
                this._htmlPrefetchController.abort();
                this.traceDebug('HTML', 'prefetch aborted', { url: this._htmlPrefetchUrl || '' });
            } catch (e) {
                // Silent abort
            }
        }
        this._htmlPrefetchController = null;
        this._htmlPrefetchUrl = null;
    }

    resolveHtmlPlaybackUrl(item) {
        const originalUrl = this.normalizeLocalhostUrl(item?.url || (item?.template && item.template.url) || '');
        if (!originalUrl) {
            return { originalUrl: '', finalUrl: '', isVideoEmbed: false };
        }

        let finalUrl = this.convertToEmbedUrl(originalUrl);
        const isVideoEmbed = !!finalUrl;

        if (!finalUrl) {
            finalUrl = originalUrl;
            const useProxy = item?.useProxy !== false; // Default: use proxy for external pages

            try {
                const urlObj = new URL(originalUrl);
                const currentHost = window.location.hostname;
                const targetHost = urlObj.hostname;

                if (useProxy && targetHost !== currentHost && targetHost !== 'localhost' && targetHost !== '127.0.0.1') {
                    const apiBasePath = window.PLAYER_BASE_PATH || '';
                    finalUrl = `${apiBasePath}/api/proxy/fetch.php?url=${encodeURIComponent(originalUrl)}`;
                }
            } catch (e) {
                // Could not parse URL, use as-is
            }
        }

        this.traceDebug('HTML', 'resolved playback url', {
            originalUrl,
            finalUrl,
            isVideoEmbed
        });

        return { originalUrl, finalUrl, isVideoEmbed };
    }

    prefetchHtmlDocument(item) {
        const htmlTarget = this.resolveHtmlPlaybackUrl(item);
        if (!htmlTarget.finalUrl) {
            this.cleanupHtmlPrefetch();
            return;
        }

        if (this._htmlPrefetchUrl === htmlTarget.finalUrl) {
            return;
        }

        this.traceDebug('HTML', 'start prefetch', {
            url: htmlTarget.finalUrl
        });

        this.cleanupHtmlPrefetch();

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        this._htmlPrefetchController = controller;
        this._htmlPrefetchUrl = htmlTarget.finalUrl;

        let requestMode = 'cors';
        let requestCredentials = 'omit';
        try {
            const parsedUrl = new URL(htmlTarget.finalUrl, window.location.href);
            if (parsedUrl.origin === window.location.origin) {
                requestMode = 'same-origin';
                requestCredentials = 'include';
            } else if (htmlTarget.finalUrl.includes('/api/proxy/fetch.php?')) {
                requestCredentials = 'include';
            } else {
                requestMode = 'no-cors';
            }
        } catch (e) {
            requestMode = 'no-cors';
        }

        const requestOptions = {
            method: 'GET',
            cache: 'force-cache',
            credentials: requestCredentials,
            mode: requestMode
        };

        if (controller && controller.signal) {
            requestOptions.signal = controller.signal;
        }

        fetch(htmlTarget.finalUrl, requestOptions)
            .then(() => {
                this.traceDebug('HTML', 'prefetch completed', { url: htmlTarget.finalUrl });
            })
            .catch(() => {})
            .finally(() => {
                if (this._htmlPrefetchUrl === htmlTarget.finalUrl) {
                    this._htmlPrefetchController = null;
                }
            });
    }

    prepareNextMedia() {
        if (!this.playlist || !this.playlist.items || this.playlist.items.length < 2) return;

        // Look ahead to find the next VIDEO item (skip images/templates for preload).
        // Image warmup is cheap but ExoPlayer preload is expensive - only preload the
        // next video we'll actually play to avoid releasing/recreating ExoPlayer instances.
        const items = this.playlist.items;
        const len = items.length;
        let nextImageIndex = -1;
        let nextVideoIndex = -1;

        for (let offset = 1; offset < len; offset++) {
            const idx = (this.currentIndex + offset) % len;
            const it = items[idx];
            if (!it) continue;
            const t = it.type || '';
            const m = it.mime_type || '';

            if (nextImageIndex < 0 && (t === 'image' || m.indexOf('image/') === 0)) {
                nextImageIndex = idx;
            }
            if (nextVideoIndex < 0 && (t === 'video' || t === 'stream' || m.indexOf('video/') === 0)) {
                nextVideoIndex = idx;
            }
            if (nextImageIndex >= 0 && nextVideoIndex >= 0) break;
        }

        // Image warmup (immediate next only)
        const immNextIdx = (this.currentIndex + 1) % len;
        const immNext = items[immNextIdx];
        if (immNext) {
            const immType = immNext.type || '';
            const immMime = immNext.mime_type || '';
            const isImage = immType === 'image' || immMime.indexOf('image/') === 0;
            const isHtml = immType === 'html';

            if (isImage) {
                const nextUrl = api.getMediaUrl(immNext.url || (immNext.media && immNext.media.url));
                if (nextUrl && nextUrl !== this.nextMediaWarmupUrl) {
                    this.cleanupNextMediaWarmup();
                    const warmImage = new Image();
                    warmImage.decoding = 'async';
                    warmImage.src = nextUrl;
                    this.nextMediaWarmup = warmImage;
                    this.nextMediaWarmupUrl = nextUrl;
                }
            }

            if (isHtml) {
                this.prefetchHtmlDocument(immNext);
            } else {
                this.cleanupHtmlPrefetch();
            }
        } else {
            this.cleanupHtmlPrefetch();
        }

        const immediateNextType = immNext ? String(immNext.type || '').toLowerCase() : '';
        const mediaPrecacheEnabled = this.config.enableMediaPrecache !== false;
        const deviceInfo = this.detectDeviceType();
        const isNativeTvDevice =
            this.hasNativeVideoSupport() &&
            (deviceInfo.isTV || deviceInfo.isAndroidTV);
        const shouldSkipNativePreload =
            !mediaPrecacheEnabled ||
            (
                isNativeTvDevice &&
                (this._currentContentType === 'html' || immediateNextType === 'html')
            );

        // ExoPlayer preload: find the next video item in playlist and preload it.
        // ExoPlayerManager.preloadNextVideo() is idempotent (skips if same URL).
        if (shouldSkipNativePreload) {
            // Keep native preload aligned with profile and avoid decoder contention.
            this.clearNativePreloadedVideo(
                mediaPrecacheEnabled ? 'tv-html-preload-guard' : 'profile-precache-disabled'
            );
        } else if (nextVideoIndex >= 0 && this.hasNativeVideoSupport()) {
            const videoItem = items[nextVideoIndex];
            const sourceVideoUrl = api.getMediaUrl(videoItem.url || (videoItem.media && videoItem.media.url));
            const videoUrl = this.getConstrainedTvPlaybackUrl(sourceVideoUrl);
            if (videoUrl && videoUrl !== this._currentVideoUrl) {
                try {
                    window.AndroidBridge.preloadNextVideoNative(videoUrl);
                } catch (e) {
                    // Preload failed silently
                }
            }
        }

        // Progressive SW precache: cache next 2 upcoming items from current position.
        // This replaces the old "cache ALL 15 at once" approach that saturated network.
        this.precacheMedia(false);
    }

    // ==================== Playback Control ====================

    /**
     * Start playback
     */
    startPlayback() {
        if (!this.playlist || !this.playlist.items || !this.playlist.items.length) {
            this.showFallback('İçerik bulunamadı');
            return;
        }

        // Apply playlist orientation to content container
        this.applyPlaylistOrientation();

        // iOS (both PWA and Safari): Check if we need user interaction for video playback
        // iOS always requires user gesture for video autoplay
        if (this._isIOS() && !this._iosInteractionGranted) {
            // Check if playlist has any video content
            const hasVideo = this.playlist.items.some(item => {
                const type = item.type || '';
                const mimeType = item.mime_type || '';
                return type === 'video' || mimeType.startsWith('video/');
            });

            if (hasVideo) {
                this._showIOSTapToPlayOverlay();
                return;
            }
        }

        this.isPlaying = true;
        this.currentIndex = 0;
        this.playCurrentItem();
    }

    /**
     * Show tap-to-play overlay for iOS PWA (required for video autoplay)
     */
    _showIOSTapToPlayOverlay() {
        // Remove existing overlay if any
        const existing = document.getElementById('ios-tap-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ios-tap-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
        `;

        overlay.innerHTML = `
            <div style="text-align: center; color: white; padding: 2rem;">
                <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="#18c8c8" stroke-width="1.5" style="margin-bottom: 1.5rem;">
                    <circle cx="12" cy="12" r="10"/>
                    <polygon points="10,8 16,12 10,16" fill="#18c8c8"/>
                </svg>
                <h2 style="font-size: 1.5rem; margin: 0 0 0.75rem 0; font-weight: 600;">Oynatmak için Dokunun</h2>
                <p style="font-size: 1rem; opacity: 0.7; margin: 0;">Videoları oynatmak için ekrana dokunun</p>
            </div>
        `;

        let tapped = false;
        const startPlaybackAfterTap = (e) => {
            if (tapped) return; // Prevent double trigger
            tapped = true;

            e.preventDefault();
            e.stopPropagation();

            // Grant interaction permission
            this._iosInteractionGranted = true;

            // Pre-warm video element with a silent play (iOS unlock)
            const video = this.getActiveVideoElement();
            if (video) {
                video.muted = true;
                video.setAttribute('playsinline', '');
                video.setAttribute('webkit-playsinline', ''); // Old iOS

                // Try to play - this unlocks video on user gesture
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        video.pause();
                        video.currentTime = 0;
                        this._startActualPlayback(overlay);
                    }).catch(() => {
                        // Even if play fails, the gesture should unlock video
                        this._startActualPlayback(overlay);
                    });
                } else {
                    // Old browsers don't return a promise
                    setTimeout(() => {
                        video.pause();
                        video.currentTime = 0;
                        this._startActualPlayback(overlay);
                    }, 100);
                }
            } else {
                this._startActualPlayback(overlay);
            }
        };

        overlay.addEventListener('click', startPlaybackAfterTap, false);
        overlay.addEventListener('touchstart', startPlaybackAfterTap, false);

        document.body.appendChild(overlay);
    }

    /**
     * Helper to start actual playback after iOS tap overlay
     */
    _startActualPlayback(overlay) {
        // Remove overlay
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }

        // Start actual playback
        this.isPlaying = true;
        this.currentIndex = 0;
        this.playCurrentItem();
    }

    /**
     * Apply playlist orientation to content container
     */
    applyPlaylistOrientation(contentOrientation = null) {
        const container = document.getElementById('content-container');
        if (!container) return;

        const normalizedContentOrientation = this.normalizeOrientationValue(contentOrientation);
        if (normalizedContentOrientation) {
            this.currentContentOrientation = normalizedContentOrientation;
        }
        const layoutState = this.getLayoutOrientationState();
        const orientation = layoutState.layoutOrientation || 'landscape';

        // Remove existing orientation classes
        container.classList.remove('orientation-landscape', 'orientation-portrait');

        // Add current orientation class
        container.classList.add(`orientation-${orientation}`);
        this.applyOrientationRotation(container, layoutState.requestedOrientation);
        this.updateOrientationToggleState();

        if (this.debug) {
            console.log('[Player] Applied content orientation:', orientation, 'requested screen:', layoutState.requestedOrientation || '(auto)', 'source:', layoutState.source);
        }
        this.traceTransitionSnapshot('orientation-applied', {
            appliedOrientation: orientation,
            requestedScreenOrientation: layoutState.requestedOrientation || '(auto)',
            baseContentOrientation: layoutState.baseOrientation,
            orientationSource: layoutState.source,
            virtualizedPlaylistOrientation: layoutState.virtualized
        });
    }

    /**
     * Play current playlist item
     */
    playCurrentItem() {
        if (!this.isPlaying) return;

        const items = this.playlist.items;
        if (!items || !items.length) {
            this.showFallback('Yayın listesi boş\n\nYönetim panelinden playlist\'e medya ekleyin');
            return;
        }

        const item = items[this.currentIndex];
        const itemOrientation = this.resolveItemOrientation(item);
        this.applyPlaylistOrientation(itemOrientation);

        if (this.debug) {
            console.log(`[Player] Playing item ${this.currentIndex + 1}/${items.length}:`, {
                name: item.name,
                type: item.type,
                url: item.url,
                duration: item.duration,
                orientation: itemOrientation,
                muted: item.muted  // ğŸ› DEBUG: Check muted value
            });
        }
        this.traceTransitionSnapshot('playCurrentItem', {
            itemIndex: this.currentIndex,
            itemName: item?.name || '',
            itemType: item?.type || '',
            itemOrientation
        });

        // Determine content type - check type field, fallback to mime_type analysis
        let contentType = item.type;
        if (!contentType || contentType === 'unknown') {
            // Try to determine from URL patterns first
            const itemUrl = item.url || (item.media && item.media.url) || '';
            if (itemUrl.includes('.m3u8') || itemUrl.includes('/master.m3u8')) {
                contentType = 'stream';
            } else {
                // Try to determine from mime_type
                const mimeType = item.mime_type || '';
                if (mimeType.startsWith('image/')) {
                    contentType = 'image';
                } else if (mimeType.startsWith('video/')) {
                    contentType = 'video';
                } else if (mimeType.includes('html') || mimeType.includes('text')) {
                    contentType = 'html';
                }
            }
        }

        this.elements.currentItemInfo.textContent =
            `${this.currentIndex + 1}/${items.length} - ${item.name || contentType}`;

        // Determine if we're switching away from video
        const previousContentType = this._currentContentType;
        const wasVideo = previousContentType === 'video' || previousContentType === 'stream';
        const isVideo = contentType === 'video' || contentType === 'stream';

        this.hideAllContent(contentType);

        // Clean up video AFTER hideAllContent so exit transition can play on the video element.
        // Delay cleanup by transition duration to allow crossfade.
        if (wasVideo && !isVideo) {
            if (this._transitionType !== 'none') {
                const cleanupDelay = this._transitionDuration + 100;
                setTimeout(() => {
                    // Only cleanup if we haven't switched back to video
                    const currentType = this._currentContentType;
                    if (currentType !== 'video' && currentType !== 'stream') {
                        this.cleanupVideo();
                    }
                }, cleanupDelay);
            } else {
                this.cleanupVideo();
            }
        }

        // Track current content type
        this._currentContentType = contentType;

        // For video/stream: prepareNextMedia() is called inside playVideo()
        // AFTER ExoPlayer consumes the preload (async .then callback).
        // For other types: call it immediately after play starts.
        switch (contentType) {
            case 'image':
                this.playImage(item);
                this.prepareNextMedia();
                break;
            case 'video':
                this.playVideo(item); // prepareNextMedia() called inside .then()
                break;
            case 'stream':
                this.playVideo(item); // prepareNextMedia() called inside .then()
                break;
            case 'template':
                this.playTemplate(item);
                this.prepareNextMedia();
                break;
            case 'html':
                this.playHtml(item);
                this.prepareNextMedia();
                break;
            default:
                console.warn(`[Player] Unknown content type: ${contentType}, skipping`);
                this.scheduleNext(this.getScheduledDuration(item));
                this.prepareNextMedia();
        }
    }

    /**
     * Hide all content elements with seamless crossfade support.
     * Instead of immediately hiding everything (which causes black screen gaps),
     * the current element gets an exit transition while staying visible.
     * The new content will show on top with an enter transition.
     */
    hideAllContent(nextContentType) {
        const prevElement = this._currentElement;
        const hasTransition = this._transitionType !== 'none';

        // Determine which element the next content will use
        const nextElement = this._getElementForContentType(nextContentType);

        this.traceDebug('TRANS', 'hideAllContent start', {
            fromType: this._currentContentType || 'none',
            toType: nextContentType || 'unknown',
            prevElement: this.getElementDebugLabel(prevElement),
            nextElement: this.getElementDebugLabel(nextElement),
            transition: this._transitionType,
            durationMs: this._transitionDuration
        });
        this.traceTransitionSnapshot('hideAllContent-start', {
            fromType: this._currentContentType || 'none',
            toType: nextContentType || 'unknown',
            prevElement: this.getElementDebugLabel(prevElement),
            nextElement: this.getElementDebugLabel(nextElement)
        });

        // Same element reuse (image→image, video→video): can't crossfade with itself,
        // so just clear classes and let the new content enter-animate on the same element.
        const sameElementReuse = prevElement && nextElement && prevElement === nextElement;

        // Clear any leftover deferred exit
        this._pendingExitElement = null;

        if (prevElement && hasTransition && !sameElementReuse) {
            const shouldDeferExit =
                nextContentType === 'video' ||
                nextContentType === 'stream' ||
                nextContentType === 'html';

            if (shouldDeferExit) {
                // Keep previous content visible until the next content is actually ready.
                // This avoids black/flash gaps on slower Android TV/WebView devices.
                this._pendingExitElement = prevElement;
                this.traceDebug('TRANS', 'defer exit until next content ready', {
                    pendingExitElement: this.getElementDebugLabel(prevElement),
                    toType: nextContentType
                });
            } else {
                this.applyExitTransition(prevElement);
            }

            // Hide ONLY elements that are NOT the current one and NOT the next one
            const allContent = [
                this.elements.imageContent,
                this.elements.videoContent,
                this.elements.videoContentAlt,
                this.elements.htmlContent,
                this.elements.htmlContentAlt
            ];
            for (const el of allContent) {
                if (el && el !== prevElement && el !== nextElement) {
                    el.style.display = 'none';
                    el.style.zIndex = '0';
                    this.clearTransitionClasses(el);
                }
            }
        } else {
            // No transition, or same-element reuse - hide other elements
            const allContent = [
                this.elements.imageContent,
                this.elements.videoContent,
                this.elements.videoContentAlt,
                this.elements.htmlContent,
                this.elements.htmlContentAlt
            ];
            for (const el of allContent) {
                if (!el) continue;
                // For same-element reuse, keep that element visible (don't flash black)
                if (sameElementReuse && el === prevElement) {
                    this.clearTransitionClasses(el);
                    continue;
                }
                el.style.display = 'none';
                el.style.zIndex = '0';
                this.clearTransitionClasses(el);
            }
        }

        this.elements.fallbackContent.style.display = 'none';
        this.elements.fallbackContent.classList.remove('visible');

        // Clear image handlers
        this.elements.imageContent.onload = null;
        this.elements.imageContent.onerror = null;

        // Clear iframe src only when switching AWAY from html content
        // (not for html→html transitions — playHtml will set new src directly)
        if (this._currentContentType === 'html' && nextContentType !== 'html') {
            // Delay clearing iframe to allow exit transition to play
            const clearIframes = () => {
                // Only clear if we've moved past html content
                if (this._currentContentType !== 'html') {
                    if (this.elements.htmlContent) {
                        this.elements.htmlContent.src = 'about:blank';
                    }
                    if (this.elements.htmlContentAlt) {
                        this.elements.htmlContentAlt.src = 'about:blank';
                    }
                    this.traceDebug('HTML', 'cleared iframe sources after leaving html');
                }
            };

            if (hasTransition && (prevElement === this.elements.htmlContent || prevElement === this.elements.htmlContentAlt)) {
                setTimeout(() => {
                    clearIframes();
                }, this._transitionDuration + 50);
            } else {
                clearIframes();
            }
        }

        // Remove overlay mask (will be re-added by playHtml if needed)
        const contentContainer = document.getElementById('content-container');
        if (contentContainer) {
            contentContainer.classList.remove('show-overlay-mask');
        }
        this.traceTransitionSnapshot('hideAllContent-end', {
            nextContentType: nextContentType || 'unknown',
            pendingExitElement: this.getElementDebugLabel(this._pendingExitElement)
        });
    }

    /**
     * Apply exit transition to an element (including video).
     * The element stays visible during the transition, then gets hidden.
     */
    applyExitTransition(element) {
        if (!element || this._transitionType === 'none') {
            if (element) element.style.display = 'none';
            return;
        }

        const resolvedTransitionType = this.getResolvedTransitionType();
        const domTransitionType = this.getDomTransitionTypeForCurrentLayout(resolvedTransitionType);

        this.traceDebug('TRANS', 'applyExitTransition', {
            element: this.getElementDebugLabel(element),
            transition: this._transitionType,
            resolvedTransition: resolvedTransitionType,
            domTransition: domTransitionType,
            durationMs: this._transitionDuration
        });
        this.traceTransitionSnapshot('exit-transition-start', {
            element: this.getElementDebugLabel(element),
            resolvedTransition: resolvedTransitionType,
            domTransition: domTransitionType
        });

        // Remove any existing transition classes
        this.clearTransitionClasses(element);

        // Ensure element is visible and on a lower z-layer during exit
        element.style.display = 'block';
        element.style.visibility = 'visible';
        element.style.zIndex = '1';

        // Add exit transition class
        element.classList.add('transition-exit', `${domTransitionType}-exit`);

        // Hide element after transition completes
        const duration = this._transitionDuration;
        const exitElement = element;
        const prevTimer = this._exitTransitionTimers.get(exitElement);
        if (prevTimer) {
            clearTimeout(prevTimer);
        }
        const exitTimerId = setTimeout(() => {
            // Check if this element is now the current element (being used for new content)
            if (this._currentElement === exitElement) {
                // Element is being reused for new content, just clear transition classes
                this.clearTransitionClasses(exitElement);
            } else {
                // Element is no longer current, safe to hide
                exitElement.style.display = 'none';
                exitElement.style.zIndex = '0';
                this.clearTransitionClasses(exitElement);

                // If it's a video element, fully release resources after exit transition.
                // On low-RAM devices (e.g. 1.8 GB TV), keeping the old video buffer in
                // memory while the new video is playing causes swap thrashing.
                if (this._isVideoElement(exitElement)) {
                    this._cleanupVideoElement(exitElement, true);
                }
            }
            this.traceDebug('TRANS', 'exit transition completed', {
                element: this.getElementDebugLabel(exitElement),
                stillCurrent: this._currentElement === exitElement
            });
            this.traceTransitionSnapshot('exit-transition-end', {
                element: this.getElementDebugLabel(exitElement),
                stillCurrent: this._currentElement === exitElement
            });
            // releaseResolvedTransitionType() buradan kaldirildi.
            // Exit ve enter ayni resolved type'i paylasir; release sadece
            // applyEnterTransition() sonunda yapilir (tek nokta).
            this._exitTransitionTimers.delete(exitElement);
        }, duration);
        this._exitTransitionTimers.set(exitElement, exitTimerId);
    }

    /**
     * Apply enter transition to an element.
     * New content enters on top (z-index: 2) while old content exits below.
     */
    applyEnterTransition(element) {
        if (!element) return;

        const resolvedTransitionType = this.getResolvedTransitionType();
        const domTransitionType = this.getDomTransitionTypeForCurrentLayout(resolvedTransitionType);

        this.traceDebug('TRANS', 'applyEnterTransition', {
            element: this.getElementDebugLabel(element),
            resolvedTransition: resolvedTransitionType,
            domTransition: domTransitionType,
            durationMs: this._transitionDuration
        });
        this.traceTransitionSnapshot('enter-transition-start', {
            element: this.getElementDebugLabel(element),
            resolvedTransition: resolvedTransitionType,
            domTransition: domTransitionType
        });

        // Clear any existing transition classes
        this.clearTransitionClasses(element);

        // Show element
        element.style.display = 'block';
        element.style.visibility = 'visible';
        element.style.opacity = '1';
        element.style.zIndex = '2';

        if (domTransitionType !== 'none') {
            // Add enter transition class (z-index: 2 via CSS)
            element.classList.add('transition-enter', `${domTransitionType}-enter`);

            // Track current element
            this._currentElement = element;
            this.flushPendingExitTransition(element);

            // Remove transition classes after animation completes
            const enterElement = element;
            const prevTimer = this._enterTransitionTimers.get(enterElement);
            if (prevTimer) {
                clearTimeout(prevTimer);
            }
            const enterTimerId = setTimeout(() => {
                this.clearTransitionClasses(enterElement);
                // z-index temizlemeyi kaldir: CSS .content-item base z-index:0
                // sağlar, transition class'lari kaldiginda CSS z-index devralir.
                // Inline style silmek icerik katmanini arka plana dusuruyordu.
                this.releaseResolvedTransitionType();
                this.traceDebug('TRANS', 'enter transition completed', {
                    element: this.getElementDebugLabel(enterElement)
                });
                this.traceTransitionSnapshot('enter-transition-end', {
                    element: this.getElementDebugLabel(enterElement)
                });
                this._enterTransitionTimers.delete(enterElement);
            }, this._transitionDuration);
            this._enterTransitionTimers.set(enterElement, enterTimerId);
        } else {
            this._currentElement = element;
            this.flushPendingExitTransition(element);
        }
    }

    flushPendingExitTransition(currentElement) {
        if (!this._pendingExitElement || this._pendingExitElement === currentElement) {
            return;
        }

        const exitEl = this._pendingExitElement;
        this._pendingExitElement = null;
        this.traceDebug('TRANS', 'flushing pending exit', {
            currentElement: this.getElementDebugLabel(currentElement),
            exitElement: this.getElementDebugLabel(exitEl)
        });
        this.traceTransitionSnapshot('pending-exit-flush', {
            currentElement: this.getElementDebugLabel(currentElement),
            exitElement: this.getElementDebugLabel(exitEl)
        });
        this.applyExitTransition(exitEl);
    }

    /**
     * Get the active video element (for ping-pong dual video crossfade).
     */
    getActiveVideoElement() {
        return this._activeVideoSlot === 'alt'
            ? this.elements.videoContentAlt
            : this.elements.videoContent;
    }

    /**
     * Get the alternate (next) video element and switch slot.
     */
    getNextVideoElement() {
        // Swap slot
        this._activeVideoSlot = this._activeVideoSlot === 'alt' ? 'primary' : 'alt';
        return this.getActiveVideoElement();
    }

    getActiveHtmlElement() {
        return this._activeHtmlSlot === 'alt'
            ? this.elements.htmlContentAlt
            : this.elements.htmlContent;
    }

    getNextHtmlElement() {
        this._activeHtmlSlot = this._activeHtmlSlot === 'alt' ? 'primary' : 'alt';
        return this.getActiveHtmlElement();
    }

    /**
     * Get the DOM element that will be used for a given content type.
     * For video, returns the NEXT (alternate) video element if switching from video.
     */
    _getElementForContentType(contentType) {
        switch (contentType) {
            case 'image':
            case 'template':
                return this.elements.imageContent;
            case 'video':
            case 'stream':
                // If previous content was also video, use the alternate element for crossfade
                const prevType = this._currentContentType;
                if (prevType === 'video' || prevType === 'stream') {
                    return this.getNextVideoElement();
                }
                return this.getActiveVideoElement();
            case 'html':
                if (this._currentContentType === 'html') {
                    return this.getNextHtmlElement();
                }
                return this.getActiveHtmlElement();
            default:
                return null;
        }
    }

    /**
     * Check if an element is one of the video elements
     */
    _isVideoElement(el) {
        return el === this.elements.videoContent || el === this.elements.videoContentAlt;
    }

    getResolvedTransitionType() {
        if (this._transitionType === 'none') {
            return 'none';
        }

        if (this._transitionType !== 'random-safe') {
            this._runtimeTransitionType = this._transitionType;
            return this.getEdgeTransitionFallback(this._runtimeTransitionType);
        }

        if (!this._runtimeTransitionType) {
            const safeTransitions = [
                'fade',
                'crossfade',
                'push-left',
                'push-right',
                'push-up',
                'push-down',
                'wipe-left',
                'wipe-right',
                'wipe-up',
                'wipe-down',
                'zoom',
                'zoom-in',
                'zoom-out'
            ];
            const index = Math.floor(Math.random() * safeTransitions.length);
            this._runtimeTransitionType = safeTransitions[index];
        }

        return this.getEdgeTransitionFallback(this._runtimeTransitionType);
    }

    mapDirectionalTransition(transitionType, directionMap) {
        if (!transitionType || !directionMap) {
            return transitionType;
        }

        const match = String(transitionType).match(/^(.*)-(left|right|up|down)$/);
        if (!match) {
            return transitionType;
        }

        const prefix = match[1];
        const direction = match[2];
        const mappedDirection = directionMap[direction];
        if (!mappedDirection || mappedDirection === direction) {
            return transitionType;
        }

        return `${prefix}-${mappedDirection}`;
    }

    getDomTransitionTypeForCurrentLayout(resolvedTransitionType) {
        const transition = resolvedTransitionType || 'none';
        if (transition === 'none') {
            return transition;
        }

        const layoutState = this.getLayoutOrientationState();
        if (layoutState.virtualized) {
            // Manual orientation override already virtualizes playlist layout.
            // Avoid second directional remap to prevent rule stacking conflicts.
            return transition;
        }

        const container = document.getElementById('content-container');
        const isForceRotateLandscape = !!(container && container.classList.contains('force-rotate-landscape'));
        const isForceRotatePortrait = !!(container && container.classList.contains('force-rotate-portrait'));

        // Keep transition direction aligned with the CURRENT SCREEN axis.
        // When container is rotated via fallback classes, remap DOM classes so
        // "push-down" still looks like down on screen.
        if (isForceRotateLandscape) {
            return this.mapDirectionalTransition(transition, {
                left: 'down',
                right: 'up',
                up: 'left',
                down: 'right'
            });
        }

        if (isForceRotatePortrait) {
            return this.mapDirectionalTransition(transition, {
                left: 'up',
                right: 'down',
                up: 'right',
                down: 'left'
            });
        }

        return transition;
    }

    getNativeTransitionTypeForCurrentLayout(resolvedTransitionType) {
        const transition = resolvedTransitionType || 'none';
        // Native player view is rendered in screen coordinates. After DOM-side
        // layout remap, native transition can follow the resolved playlist type directly.
        return transition;
    }

    releaseResolvedTransitionType() {
        this._runtimeTransitionType = null;
    }

    /**
     * Clear all transition classes from an element
     */
    clearTransitionClasses(element) {
        if (!element) return;

        const transitionClasses = [
            'transition-enter', 'transition-exit',
            'fade-enter', 'fade-exit',
            'crossfade-enter', 'crossfade-exit',
            'slide-left-enter', 'slide-left-exit',
            'slide-right-enter', 'slide-right-exit',
            'slide-up-enter', 'slide-up-exit',
            'slide-down-enter', 'slide-down-exit',
            'push-left-enter', 'push-left-exit',
            'push-right-enter', 'push-right-exit',
            'push-up-enter', 'push-up-exit',
            'push-down-enter', 'push-down-exit',
            'wipe-left-enter', 'wipe-left-exit',
            'wipe-right-enter', 'wipe-right-exit',
            'wipe-up-enter', 'wipe-up-exit',
            'wipe-down-enter', 'wipe-down-exit',
            'zoom-enter', 'zoom-exit',
            'zoom-in-enter', 'zoom-in-exit',
            'zoom-out-enter', 'zoom-out-exit'
        ];

        transitionClasses.forEach(cls => element.classList.remove(cls));
    }

    /**
     * Clean up video element completely (only call when needed)
     */
    /**
     * Clean a single video element (handlers, pause, optionally reset source)
     */
    _cleanupVideoElement(video, resetSource = true) {
        if (!video) return;

        const enterTimer = this._enterTransitionTimers.get(video);
        if (enterTimer) {
            clearTimeout(enterTimer);
            this._enterTransitionTimers.delete(video);
        }
        const exitTimer = this._exitTransitionTimers.get(video);
        if (exitTimer) {
            clearTimeout(exitTimer);
            this._exitTransitionTimers.delete(video);
        }

        video.onended = null;
        video.onerror = null;
        video.onpause = null;
        video.onplay = null;
        video.onplaying = null;
        video.oncanplay = null;
        video.oncanplaythrough = null;
        video.onloadedmetadata = null;
        video.onloadeddata = null;

        this.hideVideoElement(video);
        video.pause();
        if (resetSource) {
            video.removeAttribute('src');
            video.load();
        }
    }

    /**
     * Clean up ALL video elements completely
     */
    cleanupVideo(resetSource = true) {
        this._cleanupVideoElement(this.elements.videoContent, resetSource);
        this._cleanupVideoElement(this.elements.videoContentAlt, resetSource);

        this._currentVideoUrl = null;
        this._currentVideoItem = null;
        this._currentLoopCount = 0;

        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
    }

    /**
     * Play image content
     */
    playImage(item) {
        this.setNativeVideoMode(false);
        this.traceTransitionSnapshot('playImage-start', {
            itemName: item?.name || '',
            itemUrl: item?.url || ''
        });
        const img = this.elements.imageContent;

        // Don't force-hide elements that are mid-exit-transition (crossfade).
        // hideAllContent() already started exit transitions; let them finish.
        // Only hide fallback and ensure overlay mask is removed.
        this.elements.fallbackContent.style.display = 'none';

        // Remove overlay mask (only needed for video embeds)
        const contentContainer = document.getElementById('content-container');
        if (contentContainer) {
            contentContainer.classList.remove('show-overlay-mask');
        }

        // Try multiple URL sources
        const possibleUrls = [
            item.url,
            (item.media && item.media.url) ? item.media.url : null,
            item.media_url
        ].filter(Boolean);

        const url = api.getMediaUrl(possibleUrls[0]);

        if (!url) {
            this.scheduleNext(2);
            return;
        }

        // Clear previous handlers
        img.onload = null;
        img.onerror = null;

        // Track if image loaded
        let imageLoaded = false;

        img.onload = () => {
            imageLoaded = true;
            const detectedOrientation = this.getOrientationFromDimensions(img.naturalWidth, img.naturalHeight);
            if (detectedOrientation) {
                this.applyPlaylistOrientation(detectedOrientation);
            }
            this.applyEnterTransition(img);
            this.scheduleNext(this.getScheduledDuration(item));
        };

        img.onerror = () => {
            imageLoaded = true;
            this.scheduleNext(2);
        };

        // Set source to load the image
        img.src = url;

        // Safety: if image is already cached/complete, onload may not fire.
        // Check immediately after setting src (in next microtask).
        if (img.complete && img.naturalWidth > 0 && !imageLoaded) {
            if (this.debug) {
                console.log('[Player] Image already complete (cached), triggering onload manually');
            }
            // Use setTimeout to let the wrapper assignment below complete first
            setTimeout(() => {
                if (!imageLoaded && img.onload) {
                    img.onload();
                }
            }, 0);
        }

        // Fallback timeout - if image doesn't load or error within 10s, skip
        const timeoutId = setTimeout(() => {
            if (!imageLoaded) {
                img.onload = null;
                img.onerror = null;
                this.scheduleNext(2);
            }
        }, 10000);

        // âœ… MEMORY LEAK FIX: Clear timeout on success/error
        const originalOnLoad = img.onload;
        img.onload = () => {
            clearTimeout(timeoutId);
            if (originalOnLoad) originalOnLoad.call(img);
        };

        const originalOnError = img.onerror;
        img.onerror = () => {
            clearTimeout(timeoutId);
            if (originalOnError) originalOnError.call(img);
        };
    }

    /**
     * Play template content (shows template preview image)
     */
    playTemplate(item) {
        this.setNativeVideoMode(false);
        this.traceTransitionSnapshot('playTemplate-start', {
            itemName: item?.name || '',
            itemUrl: item?.url || ''
        });
        const img = this.elements.imageContent;

        // Don't force-hide elements mid-exit-transition (crossfade)
        this.elements.fallbackContent.style.display = 'none';

        // Template items have url pointing to preview image
        const possibleUrls = [
            item.url,
            item.preview_url,
            (item.template && item.template.preview_image) ? item.template.preview_image : null
        ].filter(Boolean);

        const url = api.getMediaUrl(possibleUrls[0]);

        if (!url) {
            // Show template info as fallback
            this.showTemplateFallback(item);
            this.scheduleNext(this.getScheduledDuration(item));
            return;
        }

        // Clear previous handlers
        img.onload = null;
        img.onerror = null;

        let imageLoaded = false;

        img.onload = () => {
            imageLoaded = true;
            const detectedOrientation = this.getOrientationFromDimensions(img.naturalWidth, img.naturalHeight);
            if (detectedOrientation) {
                this.applyPlaylistOrientation(detectedOrientation);
            }
            this.applyEnterTransition(img);
            this.scheduleNext(this.getScheduledDuration(item));
        };

        img.onerror = () => {
            imageLoaded = true;
            this.showTemplateFallback(item);
            this.scheduleNext(this.getScheduledDuration(item));
        };

        img.src = url;

        // Safety: cached image may not fire onload
        if (img.complete && img.naturalWidth > 0 && !imageLoaded) {
            setTimeout(() => {
                if (!imageLoaded && img.onload) {
                    img.onload();
                }
            }, 0);
        }

        // Fallback timeout
        setTimeout(() => {
            if (!imageLoaded) {
                img.onload = null;
                img.onerror = null;
                this.showTemplateFallback(item);
                this.scheduleNext(this.getScheduledDuration(item));
            }
        }, 10000);
    }

    /**
     * Show template fallback (when preview image is unavailable)
     */
    showTemplateFallback(item) {
        this.elements.fallbackContent.style.display = 'flex';
        this.elements.fallbackContent.classList.add('visible');
        this.elements.fallbackMessage.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">WEB</div>
                <div style="font-size: 1.5rem; font-weight: bold;">${item.name || 'Şablon'}</div>
                <div style="font-size: 1rem; opacity: 0.7; margin-top: 0.5rem;">
                    ${item.template_type === 'signage' ? 'Signage Şablonu' :
                      item.template_type === 'tv' ? 'TV Şablonu' : 'Şablon'}
                </div>
                ${item.width && item.height ? `<div style="font-size: 0.875rem; opacity: 0.5; margin-top: 0.25rem;">${item.width}x${item.height}</div>` : ''}
            </div>
        `;
    }

    /**
     * âœ… PHASE 2: Check if native video playback is available (ExoPlayer)
     */
    hasNativeVideoSupport() {
        if (!window.AndroidBridge || typeof window.AndroidBridge.playVideoNative !== 'function') {
            return false;
        }
        return true;
    }

    isConstrainedTvProfile() {
        const deviceInfo = this.detectDeviceType();
        return (deviceInfo.isTV || deviceInfo.isAndroidTV) &&
            this.config.enableMediaPrecache === false;
    }

    getConstrainedTvPlaybackUrl(url) {
        if (!url) return url;

        if (!this.isConstrainedTvProfile()) {
            return url;
        }

        // Prefer baseline 360p variant for decoder-fragile TV profiles.
        return url.replace(/\/(1080p|720p|540p)\/playlist\.m3u8(?=$|\?)/i, '/360p/playlist.m3u8');
    }

    isNativePlaybackActive() {
        if (!this.hasNativeVideoSupport() || !window.AndroidBridge || typeof window.AndroidBridge.isPlayingNatively !== 'function') {
            return false;
        }

        try {
            return window.AndroidBridge.isPlayingNatively();
        } catch (e) {
            return false;
        }
    }

    clearNativePreloadedVideo(reason = 'content-swap') {
        if (!this.hasNativeVideoSupport() || !window.AndroidBridge || typeof window.AndroidBridge.clearPreloadedVideoNative !== 'function') {
            return false;
        }

        try {
            window.AndroidBridge.clearPreloadedVideoNative();
            this.traceDebug('TRANS', 'requested native preload clear', {
                reason
            });
            this.traceTransitionSnapshot('native-preload-cleared', {
                reason
            });
            return true;
        } catch (error) {
            if (this.debug) {
                console.warn('[Player] Failed to clear native preload', error);
            }
            return false;
        }
    }

    stopNativeVideoForTransition(reason = 'content-swap') {
        if (!this.isNativePlaybackActive()) {
            return false;
        }
        if (!window.AndroidBridge || typeof window.AndroidBridge.stopVideoNative !== 'function') {
            return false;
        }

        try {
            window.AndroidBridge.stopVideoNative();
            this.setNativeVideoMode(false);
            this.traceDebug('TRANS', 'requested native stop for web transition', {
                reason,
                transition: this._transitionType || 'none',
                durationMs: this._transitionDuration || 0
            });
            this.traceTransitionSnapshot('native-stop-requested', {
                reason,
                transition: this._transitionType || 'none'
            });
            return true;
        } catch (error) {
            if (this.debug) {
                console.warn('[Player] Failed to stop native video for transition', error);
            }
            return false;
        }
    }

    /**
     * âœ… PHASE 2: Try playing video with ExoPlayer, fallback to WebView
     * @param {string} url Video URL
     * @param {boolean} muted Audio muted state (default: true)
     * @returns {Promise<{success: boolean, mode: string, error?: string}>}
     */
    async tryNativeVideoPlayback(url, muted = true) {
        if (!this.hasNativeVideoSupport()) {
            return { success: false, mode: 'webview', error: 'Native playback not available' };
        }

        try {
            const resultJson = window.AndroidBridge.playVideoNative(url, muted);
            const result = JSON.parse(resultJson);

            if (this.debug) {
                console.log('[Player] Native playback result:', result, 'muted:', muted);
            }

            return result;
        } catch (error) {
            if (this.debug) {
                console.error('[Player] Native playback error:', error);
            }
            return { success: false, mode: 'webview', error: error.message };
        }
    }

    /**
     * âœ… PHASE 2: Fallback handler when ExoPlayer fails
     */
    fallbackToWebView(url, error) {
        if (this.debug) {
            console.log('[Player] Falling back to WebView for:', url, 'Error:', error);
        }
        this.setNativeVideoMode(false);
        // WebView will handle playback through normal HTML5 video element
        // The video element is already set up, just continue with normal playback
    }

    setNativeVideoMode(active) {
        const nextState = active === true;
        if (this._nativeVideoMode === nextState) {
            return;
        }

        this._nativeVideoMode = nextState;

        const root = document.documentElement;
        const body = document.body;
        const playerScreen = document.getElementById('player-screen');
        const contentContainer = document.getElementById('content-container');
        const backgroundValue = nextState ? 'transparent' : '';

        if (window.AndroidBridge && typeof window.AndroidBridge.setWebViewTransparent === 'function') {
            try {
                window.AndroidBridge.setWebViewTransparent(nextState);
            } catch (error) {
                if (this.debug) {
                    console.warn('[Player] Failed to toggle native WebView transparency', error);
                }
            }
        }

        if (root) {
            root.style.background = backgroundValue;
            root.classList.toggle('native-video-active', nextState);
        }
        if (body) {
            body.style.background = backgroundValue;
        }
        if (playerScreen) {
            playerScreen.style.background = backgroundValue;
        }
        if (contentContainer) {
            contentContainer.style.background = backgroundValue;
        }
        this.traceTransitionSnapshot('native-video-mode-changed', {
            nextState
        });
    }

    handleNativeVideoStarted(item, url, video) {
        const isNewNativeItem = this._currentVideoUrl !== url || this._currentVideoItem !== item;
        if (isNewNativeItem) {
            this._currentLoopCount = 0;
        }

        this.cleanupVideo();
        this.setNativeVideoMode(true);
        video.style.display = 'none';
        this._currentVideoUrl = url;
        this._currentVideoItem = item;
        // Native playback is rendered by ExoPlayer overlay, not this DOM video element.
        // Keep current element null so the placeholder video node is never exit-animated.
        this._currentElement = null;
        this.traceTransitionSnapshot('native-video-started', {
            itemName: item?.name || '',
            urlTail: (url || '').slice(-180)
        });

        // Native playback has no DOM enter transition callback.
        // Flush deferred exits immediately so previous HTML/image/video can
        // complete its exit animation and not stay above ExoPlayer.
        if (this._pendingExitElement && this._pendingExitElement !== video) {
            this.traceDebug('TRANS', 'native video start - flushing pending exit', {
                pendingExitElement: this.getElementDebugLabel(this._pendingExitElement),
                nativePlaceholder: this.getElementDebugLabel(video)
            });
            this.flushPendingExitTransition(null);
        }

        // Native enter transition runs on APK side, so release resolved transition
        // token here to avoid carrying it into unrelated future swaps.
        this.releaseResolvedTransitionType();

        const setDuration = this.getScheduledDuration(item, 0);
        if (setDuration > 0) {
            this.scheduleNext(setDuration);
        }

        if (window.AndroidBridge && window.AndroidBridge.onPlaybackStarted) {
            window.AndroidBridge.onPlaybackStarted();
        }
    }

    onNativeVideoEnded() {
        if (!this.isPlaying) {
            return;
        }

        this.setNativeVideoMode(false);
        this.traceTransitionSnapshot('native-video-ended', {
            loopCount: this._currentLoopCount
        });

        const item = this._currentVideoItem;
        if (!item) {
            if (!this.contentTimer) {
                this.playNext();
            }
            return;
        }

        const maxLoops = parseInt(item.loop, 10) || 0;
        if (!this.contentTimer && maxLoops > 0 && this._currentLoopCount < maxLoops - 1) {
            this._currentLoopCount++;
            this.playVideo(item);
            return;
        }

        this._currentLoopCount = 0;
        this._currentVideoItem = null;

        if (!this.contentTimer) {
            this.playNext();
        }
    }

    hideVideoElement(video) {
        if (!video) return;

        // Video starts hidden until first frame is decoded.
        // Use visibility:hidden so it still occupies layout and decodes frames.
        video.classList.add('loading');
        video.style.display = 'block';
        video.style.visibility = 'hidden';
        video.style.opacity = '1';
    }

    revealVideoElement(video, item) {
        if (!video) return;
        if (!this.isPlaying || this._currentVideoItem !== item) return;

        const wasLoading = video.classList.contains('loading');
        const hasPendingExit = !!(this._pendingExitElement && this._pendingExitElement !== video);
        const alreadyVisible =
            !wasLoading &&
            this._currentElement === video &&
            video.style.display !== 'none' &&
            video.style.visibility !== 'hidden';

        if (alreadyVisible && !hasPendingExit) {
            return;
        }

        const previousCurrentElement = this._currentElement;

        const contentContainer = document.getElementById('content-container');
        if (contentContainer && contentContainer.classList.contains('show-overlay-mask')) {
            contentContainer.classList.remove('show-overlay-mask');
        }

        video.classList.remove('loading');
        video.style.display = 'block';
        video.style.visibility = 'visible';
        video.style.opacity = '1';
        video.style.zIndex = '2';
        this._currentElement = video;

        // Apply enter transition for seamless crossfade
        const shouldRunEnterTransition =
            this._transitionType !== 'none' &&
            (wasLoading || previousCurrentElement !== video || hasPendingExit);
        if (shouldRunEnterTransition) {
            this.applyEnterTransition(video);
        } else {
            this.flushPendingExitTransition(video);
        }

    }

    getItemDurationValue(item) {
        if (!item || item.duration === undefined || item.duration === null || item.duration === '') {
            return null;
        }

        const parsed = parseInt(item.duration, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }

    getScheduledDuration(item, fallbackSeconds = this.config.defaultDuration) {
        const duration = this.getItemDurationValue(item);
        if (duration === null) {
            return fallbackSeconds;
        }

        if (duration === 0) {
            const itemType = String(item?.type || '').toLowerCase();
            return (itemType === 'video' || itemType === 'stream') ? 0 : fallbackSeconds;
        }

        return duration;
    }

    buildPlaylistItemSignature(item) {
        if (!item) {
            return '';
        }

        const itemType = String(item.type || '').toLowerCase();
        const muted = item.muted !== undefined ? item.muted : 1;
        const duration = this.getItemDurationValue(item);
        const loop = item.loop !== undefined && item.loop !== null && item.loop !== ''
            ? (parseInt(item.loop, 10) || 0)
            : 0;

        let stableIdentity = item.media_id || item.template_id || '';
        if (!stableIdentity) {
            if (itemType === 'html' && item.url) {
                stableIdentity = `html:${item.url}`;
            } else {
                stableIdentity = item.id || item.url || '';
            }
        }

        return [
            stableIdentity,
            itemType,
            item.url || '',
            duration === null ? '' : duration,
            loop,
            muted
        ].join(':');
    }

    buildPlaylistConfigSignature(playlist) {
        if (!playlist) {
            return '';
        }

        const transition = playlist.transition || playlist.transition_type || '';
        const transitionDuration = playlist.transition_duration ?? '';
        const orientation = playlist.orientation || '';
        const layoutType = playlist.layout_type || '';
        const templateId = playlist.template_id || '';
        const defaultDuration = playlist.default_duration ?? playlist.duration ?? '';

        return [
            transition,
            transitionDuration,
            orientation,
            layoutType,
            templateId,
            defaultDuration
        ].join(':');
    }

    applyPlaylistPlaybackSettings() {
        if (!this.playlist) {
            return;
        }

        this.releaseResolvedTransitionType();
        this._transitionType = this.playlist.transition || 'none';
        this._transitionDuration = parseInt(this.playlist.transition_duration, 10) || 500;

        if (this.isLegacyProfile() && this._transitionType !== 'none') {
            this._transitionDuration = Math.min(this._transitionDuration, 300);
        }

        document.documentElement.style.setProperty('--transition-duration', this._transitionDuration + 'ms');

        if (this.debug) {
            console.log(`[Player] Transition: ${this._transitionType}, Duration: ${this._transitionDuration}ms`);
        }
    }

    /**
     * Play video content (PHASE 2: Hybrid native/WebView playback)
     */
    playVideo(item) {
        // Use the active video element (ping-pong dual video for crossfade)
        const video = this.getActiveVideoElement();
        const applyVideoOrientationFromMetadata = () => {
            const detectedOrientation = this.getOrientationFromDimensions(video.videoWidth, video.videoHeight);
            if (detectedOrientation) {
                this.applyPlaylistOrientation(detectedOrientation);
            }
        };

        // Don't force-hide elements mid-exit-transition (crossfade)
        this.elements.fallbackContent.style.display = 'none';

        // Remove overlay mask (only needed for iframe video embeds)
        const contentContainer = document.getElementById('content-container');
        if (contentContainer) {
            contentContainer.classList.remove('show-overlay-mask');
        }

        const sourceUrl = api.getMediaUrl(item.url || (item.media && item.media.url));
        const url = this.getConstrainedTvPlaybackUrl(sourceUrl);

        if (!url) {
            this.scheduleNext(2);
            return;
        }

        this.traceTransitionSnapshot('playVideo-start', {
            itemName: item?.name || '',
            urlTail: url.slice(-180)
        });

        // âœ… PHASE 2: Try native playback first (ExoPlayer on Android)
        const shouldTryNative =
            this.hasNativeVideoSupport() &&
            (url.includes('.m3u8') || url.includes('.mp4') || url.includes('.webm'));

        this.traceTransitionSnapshot('playVideo-mode-decision', {
            shouldTryNative,
            hasNativeSupport: this.hasNativeVideoSupport()
        });

        if (shouldTryNative) {
            // Pass transition info to native player before starting video
            if (window.AndroidBridge && typeof window.AndroidBridge.setVideoTransition === 'function') {
                try {
                    const resolvedTransitionType = this.getResolvedTransitionType();
                    const domTransitionType = this.getDomTransitionTypeForCurrentLayout(resolvedTransitionType);
                    const nativeTransitionType = this.getNativeTransitionTypeForCurrentLayout(resolvedTransitionType);
                    window.AndroidBridge.setVideoTransition(
                        nativeTransitionType || 'none',
                        this._transitionDuration || 500
                    );
                    this.traceDebug('TRANS', 'native transition prepared', {
                        requested: this._transitionType || 'none',
                        resolved: resolvedTransitionType,
                        domMapped: domTransitionType,
                        nativeMapped: nativeTransitionType,
                        durationMs: this._transitionDuration || 500,
                        forceRotateLandscape: !!document.getElementById('content-container')?.classList.contains('force-rotate-landscape'),
                        forceRotatePortrait: !!document.getElementById('content-container')?.classList.contains('force-rotate-portrait')
                    });
                    this.traceTransitionSnapshot('native-transition-prepared', {
                        requested: this._transitionType || 'none',
                        resolved: resolvedTransitionType,
                        domMapped: domTransitionType,
                        nativeMapped: nativeTransitionType
                    });
                } catch (e) { }
            }

            const shouldMute = item.muted !== undefined ? (item.muted === 1 || item.muted === true) : true;

            this.tryNativeVideoPlayback(url, shouldMute).then(result => {
                if (result.success && result.mode === 'exoplayer') {
                    // ExoPlayer is handling playback
                    if (this.debug) {
                        console.log('[Player] âœ… Using ExoPlayer for video:', url);
                    }

                    this.handleNativeVideoStarted(item, url, video);
                    this.traceTransitionSnapshot('playVideo-native-started', {
                        resultMode: result.mode,
                        itemName: item?.name || ''
                    });
                    // Preload NEXT video AFTER ExoPlayer consumed the current preload
                    this.prepareNextMedia();

                    return; // ExoPlayer handling, skip WebView playback
                } else {
                    // Fallback to WebView
                    if (this.debug) {
                        console.log('[Player] âš ï¸ ExoPlayer failed, using WebView:', result.error);
                    }
                    this.playVideoWebView(item, url, video, applyVideoOrientationFromMetadata);
                    this.traceTransitionSnapshot('playVideo-fallback-webview', {
                        resultMode: result.mode || 'unknown',
                        error: result.error || ''
                    });
                    this.prepareNextMedia();
                }
            }).catch(error => {
                if (this.debug) {
                    console.error('[Player] Native playback error:', error);
                }
                this.playVideoWebView(item, url, video, applyVideoOrientationFromMetadata);
                this.traceTransitionSnapshot('playVideo-native-error-webview', {
                    error: error?.message || String(error || '')
                });
                this.prepareNextMedia();
            });

            return; // Async native playback attempt, will call playVideoWebView if needed
        }

        // No native support or unsupported format - use WebView
        this.playVideoWebView(item, url, video, applyVideoOrientationFromMetadata);
        this.traceTransitionSnapshot('playVideo-direct-webview', {
            itemName: item?.name || ''
        });
        this.prepareNextMedia();
    }

    /**
     * âœ… PHASE 2: WebView-based video playback (original logic)
     */
    playVideoWebView(item, url, video, applyVideoOrientationFromMetadata) {
        this.setNativeVideoMode(false);
        // Clear any exit transition classes from previous crossfade (video-to-video reuse)
        this.clearTransitionClasses(video);
        video.style.display = 'block';
        this._currentElement = video;

        // Track loop count for this item
        this._currentLoopCount = 0;
        const maxLoops = parseInt(item.loop) || 0;

        // Check if we already have this video loaded (same URL)
        const isSameVideoUrl = this._currentVideoUrl === url;
        const isNewVideo = this._currentVideoUrl !== url;

        // Clean only THIS video element's handlers (not both) before loading new source
        if (isNewVideo) {
            this._cleanupVideoElement(video, false);
        }

        // âœ… FIX: Set _currentVideoItem AFTER cleanupVideo to prevent
        // revealVideoElement guard check failure (cleanupVideo nullifies _currentVideoItem)
        this._currentVideoItem = item;

        const isVideoPlaying = !video.paused && !video.ended;
        const isVideoEnded = video.ended;
        const hasVideoSrc = video.src && video.src !== '';

        // Case 1: Same video is currently playing - just continue
        if (isSameVideoUrl && isVideoPlaying) {
            if (this.debug) {
                console.log('[Player] Same video already playing, continuing');
            }
            applyVideoOrientationFromMetadata();
            this.revealVideoElement(video, item);

            const setDuration = this.getScheduledDuration(item, 0);
            if (setDuration > 0) {
                this.scheduleNext(setDuration);
            }
            return;
        }

        // Case 2: Same video URL but ended - restart from beginning without reload
        if (isSameVideoUrl && isVideoEnded && hasVideoSrc) {
            if (this.debug) {
                console.log('[Player] Same video ended, restarting from beginning');
            }
            applyVideoOrientationFromMetadata();
            this.revealVideoElement(video, item);

            video.currentTime = 0;
            video.play().catch(() => {});

            const setDuration = this.getScheduledDuration(item, 0);
            if (setDuration > 0) {
                this.scheduleNext(setDuration);
            }
            // Re-setup onended for the restarted video
            video.onended = () => {
                if (maxLoops > 0 && this._currentLoopCount < maxLoops - 1) {
                    this._currentLoopCount++;
                    video.currentTime = 0;
                    video.play().catch(() => {});
                } else {
                    this._currentVideoItem = null;
                    this._currentLoopCount = 0;
                    this.playNext();
                }
            };
            return;
        }

        // Case 3: Different video or first load - need to load new source
        // Clear previous handlers to avoid conflicts
        video.onended = null;
        video.onerror = null;
        video.onpause = null;
        video.onplay = null;
        video.onplaying = null;
        video.oncanplay = null;
        video.oncanplaythrough = null;
        video.onloadedmetadata = null;
        video.onloadeddata = null;

        // Keep video fully hidden until an actual frame is ready.
        this.hideVideoElement(video);

        let startupWatchdog = null;
        const clearStartupWatchdog = () => {
            if (startupWatchdog) {
                clearTimeout(startupWatchdog);
                startupWatchdog = null;
            }
        };
        const revealWebViewVideo = () => {
            clearStartupWatchdog();
            this.revealVideoElement(video, item);
        };
        startupWatchdog = setTimeout(() => {
            if (!this.isPlaying || this._currentVideoItem !== item) {
                return;
            }
            this.hideVideoElement(video);
            this._currentVideoItem = null;
            this.scheduleNext(2);
        }, 9000);

        // Track current video URL
        this._currentVideoUrl = url;
        this.showVideoDebugUrl(url, item);
        video.onloadedmetadata = applyVideoOrientationFromMetadata;

        if (url.includes('.m3u8')) {
            this.playHlsVideo(video, url, item);
        } else {
            video.src = url;
            video.load();

            // Show video only when ready to play
            video.oncanplaythrough = () => {
                revealWebViewVideo();
            };

            // Fallback - show after loadeddata if canplaythrough doesn't fire
            video.onloadeddata = () => {
                setTimeout(() => {
                    revealWebViewVideo();
                }, 50);
            };

            video.onended = () => {
                clearStartupWatchdog();
                // If loop count is set and we haven't reached it yet, restart video
                if (maxLoops > 0 && this._currentLoopCount < maxLoops - 1) {
                    this._currentLoopCount++;
                    video.currentTime = 0;
                    video.play().catch(() => {});
                } else {
                    // Loop count reached or no loop - move to next
                    this._currentVideoItem = null;
                    this._currentLoopCount = 0;

                    // Only call playNext if no duration timer is set
                    // (if duration is set, scheduleNext will handle the transition)
                    if (!this.contentTimer) {
                        this.playNext();
                    }
                }
            };

            video.onerror = () => {
                clearStartupWatchdog();
                this.hideVideoElement(video);
                this._currentVideoItem = null;
                this.scheduleNext(2);
            };

            video.onplay = () => {
                revealWebViewVideo();
            };

            video.onplaying = () => {
                revealWebViewVideo();
            };

            // Only auto-resume if video paused unexpectedly (not at end)
            video.onpause = () => {
                // Don't auto-resume if video has ended naturally
                if (video.ended) {
                    return;
                }

                if (this.isPlaying && this._currentVideoItem === item) {
                    setTimeout(() => {
                        // Double-check: video must still be paused, not ended, and same item
                        if (video.paused && !video.ended && this.isPlaying && this._currentVideoItem === item) {
                            video.play().catch(() => {});
                        }
                    }, 100);
                }
            };

            // âœ… Video ses kontrolü - muted: 0=unmuted (ses açık), 1=muted (ses kapalı)
            const shouldMute = item.muted !== undefined ? (item.muted === 1 || item.muted === true) : true;

            // âœ… Platform detection for Chrome autoplay policy
            const isChromeBrowser = !window.AndroidBridge && /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);

            // âœ… Chrome autoplay policy fix: Başlangıçta MUTED başlat
            video.muted = true; // Her zaman muted başlat

            if (this.debug) {
                console.log(`[Player] Video starting muted=true (target muted=${shouldMute}, raw item.muted=${item.muted}, isChrome=${isChromeBrowser})`);
            }

            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', ''); // Old iOS support

            const playPromise = video.play();
            if (playPromise !== undefined && typeof playPromise.then === 'function') {
                playPromise.then(() => {
                    // âœ… WATCHDOG: Notify Android that playback started
                    if (window.AndroidBridge) {
                        AndroidBridge.onPlaybackStarted();
                    }

                    // Some WebViews never fire the ready callbacks reliably.
                    revealWebViewVideo();

                    // âœ… Chrome browser autoplay policy workaround
                    if (isChromeBrowser) {
                        // Chrome browser: Video MUTED KALACAK (unmute kullanıcı etkileşimi gerektirir)
                        // Digital Signage kullanımında bu kabul edilebilir - ses zaten opsiyoneldir
                        // Video muted=true kalsın (Chrome policy requirement)
                    } else {
                        // Android/Native: Autoplay başarılı - HEMEN hedef muted durumuna geç
                        video.muted = shouldMute;
                    }

                    // Handle duration and loop settings
                    const setDuration = this.getScheduledDuration(item, 0);

                    if (setDuration > 0) {
                        // Duration is set - schedule next but DON'T call playNext if video is still playing
                        // The timer will handle transition
                        this.scheduleNext(setDuration);

                        // âœ… When duration timer fires, stop video before transitioning
                        // This prevents video from continuing in background
                    }
                    // If no duration and no loop, onended will call playNext
                    // If loop is true, onended handles the loop restart
                }).catch(err => {
                    if (err.name === 'AbortError') {
                        setTimeout(() => {
                            if (this.isPlaying && this._currentVideoItem === item) {
                                video.play().catch(() => {
                                    clearStartupWatchdog();
                                    this._currentVideoItem = null;
                                    this.scheduleNext(2);
                                });
                            }
                        }, 500);
                    } else if (err.name === 'NotAllowedError' && this._isIOS()) {
                        // iOS: Video autoplay blocked, need user interaction
                        this._iosInteractionGranted = false;
                        this._showIOSTapToPlayOverlay();
                    } else {
                        clearStartupWatchdog();
                        this._currentVideoItem = null;
                        this.scheduleNext(2);
                    }
                });
            } else {
                // Old browsers (iOS 9 and earlier) don't return a promise
                setTimeout(() => {
                    if (video.readyState >= 2) {
                        revealWebViewVideo();
                    }
                }, 120);

                setTimeout(() => {
                    revealWebViewVideo();
                }, 400);

                // Just schedule based on duration if set
                const setDuration = this.getScheduledDuration(item, 0);
                if (setDuration > 0) {
                    this.scheduleNext(setDuration);
                }
            }
        }
    }

    /**
     * Play HLS video stream
     */
    playHlsVideo(video, url, item) {
        video.style.display = 'block';
        this._currentElement = video;
        this._currentVideoItem = item;

        let startupWatchdog = null;
        const clearStartupWatchdog = () => {
            if (startupWatchdog) {
                clearTimeout(startupWatchdog);
                startupWatchdog = null;
            }
        };
        const revealHlsVideo = () => {
            clearStartupWatchdog();
            this.revealVideoElement(video, item);
        };
        startupWatchdog = setTimeout(() => {
            if (!this.isPlaying || this._currentVideoItem !== item) {
                return;
            }
            this.hideVideoElement(video);
            this._currentVideoItem = null;
            this.scheduleNext(2);
        }, 9000);

        // âœ… Video ses kontrolü - item.muted varsa kullan, yoksa varsayılan true
        const shouldMute = item.muted !== undefined ? item.muted : true;
        video.muted = shouldMute;

        if (this.debug) {
            console.log(`[Player] HLS Video muted setting: ${shouldMute} (item.muted=${item.muted})`);
        }

        // Clear previous handlers
        video.onpause = null;
        video.onplay = null;
        video.onplaying = null;

        video.onpause = () => {
            // Don't auto-resume if video has ended
            if (video.ended) {
                return;
            }

            if (this.isPlaying && this._currentVideoItem === item) {
                setTimeout(() => {
                    if (video.paused && !video.ended && this.isPlaying && this._currentVideoItem === item) {
                        video.play().catch(() => {});
                    }
                }, 100);
            }
        };

        video.onplay = () => {
            revealHlsVideo();
        };

        video.onplaying = () => {
            revealHlsVideo();
        };

        // Keep video fully hidden until playback is actually ready.
        this.hideVideoElement(video);

        if (Hls.isSupported()) {
            // âœ… MEMORY LEAK FIX: Destroy old HLS instance first
            if (this.hls) {
                this.hls.off(Hls.Events.MANIFEST_PARSED);
                this.hls.off(Hls.Events.ERROR);
                this.hls.destroy();
                this.hls = null;
            }

            this.hls = new Hls();
            this.hls.loadSource(url);
            this.hls.attachMedia(video);

            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                revealHlsVideo();
                const hlsPlayPromise = video.play();
                if (hlsPlayPromise !== undefined && typeof hlsPlayPromise.then === 'function') {
                    hlsPlayPromise.then(() => {
                        revealHlsVideo();
                    }).catch(err => {
                        if (err.name === 'NotAllowedError' && this._isIOS()) {
                            // iOS PWA: Video autoplay blocked, need user interaction
                            this._iosInteractionGranted = false;
                            this._showIOSTapToPlayOverlay();
                        }
                    });
                }
            });

            this.hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    clearStartupWatchdog();
                    this.hideVideoElement(video);
                    this._currentVideoItem = null;
                    this.scheduleNext(2);
                }
            });

            const scheduledDuration = this.getScheduledDuration(item, 0);
            if (scheduledDuration > 0) {
                this.scheduleNext(scheduledDuration);
            }
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;

            video.oncanplaythrough = () => {
                revealHlsVideo();
            };

            const nativeHlsPlayPromise = video.play();
            if (nativeHlsPlayPromise !== undefined && typeof nativeHlsPlayPromise.then === 'function') {
                nativeHlsPlayPromise.then(() => {
                    revealHlsVideo();
                }).catch(err => {
                    if (err.name === 'NotAllowedError' && this._isIOS()) {
                        // iOS PWA: Video autoplay blocked, need user interaction
                        this._iosInteractionGranted = false;
                        this._showIOSTapToPlayOverlay();
                    }
                });
            }

            const scheduledDuration = this.getScheduledDuration(item, 0);
            if (scheduledDuration > 0) {
                this.scheduleNext(scheduledDuration);
            }
        } else {
            clearStartupWatchdog();
            video.classList.remove('loading');
            this._currentVideoItem = null;
            this.scheduleNext(2);
        }
    }

    /**
     * Convert video platform URLs to embed format
     */
    convertToEmbedUrl(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();

            // YouTube - multiple URL formats
            if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
                let videoId = null;

                // youtube.com/watch?v=VIDEO_ID
                if (urlObj.searchParams.has('v')) {
                    videoId = urlObj.searchParams.get('v');
                }
                // youtube.com/live/VIDEO_ID
                else if (urlObj.pathname.includes('/live/')) {
                    var liveParts = urlObj.pathname.split('/live/');
                    videoId = liveParts[1] ? liveParts[1].split(/[?&#]/)[0] : null;
                }
                // youtu.be/VIDEO_ID
                else if (hostname === 'youtu.be') {
                    videoId = urlObj.pathname.slice(1).split(/[?&#]/)[0];
                }
                // youtube.com/embed/VIDEO_ID (already embed)
                else if (urlObj.pathname.includes('/embed/')) {
                    return url; // Already embed URL
                }
                // youtube.com/v/VIDEO_ID
                else if (urlObj.pathname.includes('/v/')) {
                    var vParts = urlObj.pathname.split('/v/');
                    videoId = vParts[1] ? vParts[1].split(/[?&#]/)[0] : null;
                }

                if (videoId) {
                    // Add parameters for clean signage display - hide all UI elements
                    const params = [
                        'autoplay=1',           // Auto start
                        'mute=1',               // Muted (required for autoplay)
                        'loop=1',               // Loop video
                        `playlist=${videoId}`,  // Required for loop to work
                        'controls=0',           // Hide player controls
                        'modestbranding=1',     // Minimal YouTube branding
                        'rel=0',                // Don't show related videos
                        'fs=0',                 // Hide fullscreen button
                        'iv_load_policy=3',     // Hide video annotations
                        'disablekb=1',          // Disable keyboard controls
                        'playsinline=1',        // Play inline (mobile)
                        'showinfo=0',           // Hide video title/info (deprecated but still works on some)
                        'cc_load_policy=0',     // Don't show captions by default
                        'origin=' + window.location.origin  // Security: set origin
                    ].join('&');
                    const embedUrl = `https://www.youtube.com/embed/${videoId}?${params}`;
                    return embedUrl;
                }
            }

            // Vimeo
            if (hostname.includes('vimeo.com')) {
                const vimeoMatch = urlObj.pathname.match(/\/(\d+)/);
                if (vimeoMatch) {
                    // Vimeo parameters for clean signage display
                    const params = [
                        'autoplay=1',       // Auto start
                        'muted=1',          // Muted
                        'loop=1',           // Loop video
                        'background=1',     // Background mode (hides all UI)
                        'controls=0',       // Hide controls (redundant with background but safe)
                        'title=0',          // Hide title
                        'byline=0',         // Hide byline
                        'portrait=0',       // Hide portrait
                        'playsinline=1',    // Play inline
                        'dnt=1'             // Do not track
                    ].join('&');
                    const embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}?${params}`;
                    return embedUrl;
                }
            }

            // Dailymotion
            if (hostname.includes('dailymotion.com') || hostname === 'dai.ly') {
                let videoId = null;
                if (hostname === 'dai.ly') {
                    videoId = urlObj.pathname.slice(1);
                } else {
                    const dmMatch = urlObj.pathname.match(/\/video\/([a-zA-Z0-9]+)/);
                    if (dmMatch) videoId = dmMatch[1];
                }
                if (videoId) {
                    // Dailymotion parameters for clean signage display
                    const params = [
                        'autoplay=1',       // Auto start
                        'mute=1',           // Muted
                        'controls=0',       // Hide controls
                        'queue-autoplay-next=0',  // Don't autoplay next
                        'queue-enable=0',   // Disable queue
                        'sharing-enable=0', // Hide sharing
                        'ui-logo=0',        // Hide logo
                        'ui-start-screen-info=0'  // Hide start screen info
                    ].join('&');
                    const embedUrl = `https://www.dailymotion.com/embed/video/${videoId}?${params}`;
                    return embedUrl;
                }
            }

        } catch (e) {
            // Could not parse URL for embed conversion
        }

        return null; // No conversion available
    }

    hardenSameOriginIframeContent(iframe) {
        if (!iframe) return;

        // Constrained TV devices are decoder-fragile; avoid forcing iframe video
        // element rewrites/autoplay hooks that can overlap with native decoder teardown.
        if (this.isConstrainedTvProfile()) {
            return;
        }

        let doc = null;
        try {
            doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document) || null;
        } catch (e) {
            // Cross-origin iframe, cannot mutate safely
            return;
        }

        if (!doc) {
            return;
        }

        try {
            const styleId = 'omnex-player-iframe-guard-style';
            if (!doc.getElementById(styleId)) {
                const style = doc.createElement('style');
                style.id = styleId;
                style.textContent = `
                    html, body { margin: 0 !important; padding: 0 !important; background: #000 !important; overflow: hidden !important; }
                    video { background: #000 !important; }
                    video::-webkit-media-controls,
                    video::-webkit-media-controls-panel,
                    video::-webkit-media-controls-play-button,
                    video::-webkit-media-controls-start-playback-button,
                    video::-webkit-media-controls-overlay-play-button,
                    video::-webkit-media-controls-overlay-enclosure,
                    video::-webkit-media-controls-enclosure {
                        display: none !important;
                        opacity: 0 !important;
                        visibility: hidden !important;
                    }
                    video::poster {
                        display: none !important;
                    }
                `;
                const parentNode = doc.head || doc.documentElement || doc.body;
                if (parentNode) {
                    parentNode.appendChild(style);
                }
            }

            const constrainedTv = this.isConstrainedTvProfile();
            const videos = doc.querySelectorAll('video');
            videos.forEach((video) => {
                video.controls = false;
                video.removeAttribute('controls');
                video.removeAttribute('poster');
                video.playsInline = true;
                video.setAttribute('playsinline', '');
                video.setAttribute('webkit-playsinline', '');
                video.muted = true;
                video.defaultMuted = true;
                video.setAttribute('muted', '');
                if (!video.getAttribute('preload')) {
                    video.setAttribute('preload', 'auto');
                }

                const sources = video.querySelectorAll('source');
                let sourceUpdated = false;
                if (video.src) {
                    const adaptedVideoSrc = this.getConstrainedTvPlaybackUrl(video.src);
                    if (adaptedVideoSrc !== video.src) {
                        video.src = adaptedVideoSrc;
                        sourceUpdated = true;
                    }
                }
                sources.forEach((sourceNode) => {
                    const sourceSrc = sourceNode.getAttribute('src');
                    if (!sourceSrc) return;
                    const adaptedSourceSrc = this.getConstrainedTvPlaybackUrl(sourceSrc);
                    if (adaptedSourceSrc !== sourceSrc) {
                        sourceNode.setAttribute('src', adaptedSourceSrc);
                        sourceUpdated = true;
                    }
                });
                if (sourceUpdated && typeof video.load === 'function') {
                    try {
                        video.load();
                    } catch (e) {}
                }

                if (constrainedTv) {
                    video.style.visibility = 'visible';
                    video.style.opacity = '1';
                } else {
                    video.style.opacity = '0';
                    video.style.visibility = 'hidden';
                    video.style.transition = 'opacity 120ms linear';
                }

                const revealVideo = () => {
                    video.style.visibility = 'visible';
                    video.style.opacity = '1';
                };
                const revealIfReady = () => {
                    const hasFrame = video.readyState >= 2;
                    if (hasFrame) {
                        revealVideo();
                        return true;
                    }
                    return false;
                };

                if (video.dataset.omnexGuardAttached !== '1') {
                    video.dataset.omnexGuardAttached = '1';
                    ['playing', 'canplay', 'loadeddata', 'timeupdate'].forEach((eventName) => {
                        video.addEventListener(eventName, revealIfReady);
                    });
                }

                // Keep video hidden until an actual decoded frame is available.
                if (!constrainedTv) {
                    setTimeout(revealIfReady, 1200);
                    setTimeout(revealIfReady, 2600);
                    setTimeout(() => {
                        if (!revealIfReady()) {
                            revealVideo();
                        }
                    }, 4200);
                }

                if (video.paused && video.autoplay) {
                    const playPromise = video.play();
                    if (playPromise && typeof playPromise.catch === 'function') {
                        playPromise.then(revealIfReady).catch(() => {});
                    }
                } else if (!video.paused) {
                    revealIfReady();
                }
            });
        } catch (e) {
            // Best-effort hardening only
        }
    }

    finalizeHtmlPlayback(iframe, item, duration) {
        if (!iframe) return;

        this.traceDebug('HTML', 'finalize playback', {
            iframe: this.getElementDebugLabel(iframe),
            url: item?.url || '',
            duration
        });

        this.hardenSameOriginIframeContent(iframe);
        this.clearNativePreloadedVideo('html-ready');
        this.stopNativeVideoForTransition('html-ready');
        this.traceTransitionSnapshot('html-finalize-before-enter', {
            iframe: this.getElementDebugLabel(iframe),
            itemName: item?.name || '',
            duration
        });
        this.applyEnterTransition(iframe);

        // Small paint buffer avoids timer starting before first stable frame.
        setTimeout(() => {
            if (this.isPlaying && this._currentElement === iframe) {
                this.scheduleNext(duration);
            }
        }, 120);
    }

    /**
     * Play HTML/webpage content in iframe
     */
    playHtml(item) {
        this.clearNativePreloadedVideo('play-html-start');

        if (this.isConstrainedTvProfile()) {
            this.stopNativeVideoForTransition('play-html-start-constrained');
            this.setNativeVideoMode(false);
        } else if (!this.isNativePlaybackActive()) {
            this.setNativeVideoMode(false);
        } else {
            this.traceDebug('TRANS', 'playHtml waiting with native video active', {
                itemId: item?.id || '',
                itemName: item?.name || ''
            });
        }
        const iframe = this.getActiveHtmlElement();
        if (!iframe) {
            this.scheduleNext(this.getScheduledDuration(item));
            return;
        }

        this.traceDebug('HTML', 'playHtml start', {
            itemId: item?.id || '',
            itemName: item?.name || '',
            itemUrl: item?.url || '',
            iframe: this.getElementDebugLabel(iframe)
        });
        this.traceTransitionSnapshot('playHtml-start', {
            itemId: item?.id || '',
            itemName: item?.name || '',
            iframe: this.getElementDebugLabel(iframe)
        });

        // Don't force-hide elements mid-exit-transition (crossfade)
        this.elements.fallbackContent.style.display = 'none';

        const resolvedTarget = this.resolveHtmlPlaybackUrl(item);
        if (!resolvedTarget.originalUrl || !resolvedTarget.finalUrl) {
            this.scheduleNext(this.getScheduledDuration(item));
            return;
        }
        let finalUrl = resolvedTarget.finalUrl;
        const originalUrl = resolvedTarget.originalUrl;
        const isVideoEmbed = resolvedTarget.isVideoEmbed;

        // Get content container for overlay mask
        const contentContainer = document.getElementById('content-container');

        // Add overlay mask for YouTube/Vimeo/Dailymotion embeds to hide their UI
        if (isVideoEmbed && contentContainer) {
            contentContainer.classList.add('show-overlay-mask');
        } else if (contentContainer) {
            contentContainer.classList.remove('show-overlay-mask');
        }

        // Prepare iframe (hidden until loaded)
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.backgroundColor = '#000';
        iframe.style.display = 'block';
        iframe.style.visibility = 'hidden';
        iframe.style.opacity = '1';
        iframe.style.zIndex = '2';

        // Clear previous handlers
        iframe.onload = null;
        iframe.onerror = null;

        let loaded = false;
        const loadToken = `${Date.now()}_${Math.random()}`;
        iframe.dataset.loadToken = loadToken;
        const duration = this.getScheduledDuration(item);

        const finalizeLoad = () => {
            if (loaded) return;
            if (iframe.dataset.loadToken !== loadToken) return;
            loaded = true;
            this.traceDebug('HTML', 'iframe finalized load', {
                iframe: this.getElementDebugLabel(iframe),
                finalUrl
            });
            this.traceTransitionSnapshot('playHtml-iframe-ready', {
                iframe: this.getElementDebugLabel(iframe),
                finalUrlTail: (finalUrl || '').slice(-180)
            });
            this.finalizeHtmlPlayback(iframe, item, duration);
        };

        iframe.onload = () => {
            if (loaded) return;
            if (iframe.dataset.loadToken !== loadToken) return;
            this.traceDebug('HTML', 'iframe onload', {
                iframe: this.getElementDebugLabel(iframe),
                finalUrl
            });
            finalizeLoad();
        };

        iframe.onerror = () => {
            if (loaded) return;
            if (iframe.dataset.loadToken !== loadToken) return;

            this.traceDebug('HTML', 'iframe onerror', {
                iframe: this.getElementDebugLabel(iframe),
                finalUrl,
                fallbackToOriginal: finalUrl !== originalUrl
            });

            // Handle load errors - try direct URL as fallback if proxy failed
            if (finalUrl !== originalUrl) {
                finalUrl = originalUrl;
                iframe.src = originalUrl;
                return;
            }
            finalizeLoad();
        };

        const sameTarget =
            (() => {
                try {
                    return new URL(iframe.src, window.location.href).toString() ===
                        new URL(finalUrl, window.location.href).toString();
                } catch (e) {
                    return false;
                }
            })();

        let canFinalizeImmediately = false;
        if (sameTarget) {
            try {
                const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document) || null;
                canFinalizeImmediately = !!doc && doc.readyState === 'complete';
            } catch (e) {
                // Cross-origin iframe cannot be inspected; assume ready if same src is already mounted.
                canFinalizeImmediately = true;
            }
        }

        // Set URL (proxied or direct) — triggers load when source differs.
        if (!sameTarget) {
            iframe.src = finalUrl;
            this.traceDebug('HTML', 'iframe src assigned', {
                iframe: this.getElementDebugLabel(iframe),
                finalUrl
            });
        } else if (canFinalizeImmediately) {
            setTimeout(() => {
                finalizeLoad();
            }, 0);
            this.traceDebug('HTML', 'iframe reused existing loaded src', {
                iframe: this.getElementDebugLabel(iframe),
                finalUrl
            });
        } else {
            this.traceDebug('HTML', 'iframe same src but waiting load event', {
                iframe: this.getElementDebugLabel(iframe),
                finalUrl
            });
        }

        // Safety timeout: if onload doesn't fire, show anyway.
        setTimeout(() => {
            if (!loaded) {
                this.traceDebug('HTML', 'iframe safety timeout fired', {
                    iframe: this.getElementDebugLabel(iframe),
                    finalUrl
                });
                finalizeLoad();
            }
        }, 7000);
    }

    /**
     * Show fallback content
     */
    showFallback(message) {
        this.hideAllContent();
        this.elements.fallbackContent.style.display = 'flex';
        this.elements.fallbackContent.classList.add('visible');
        this.elements.fallbackMessage.textContent = message;
    }

    /**
     * Schedule next item (âœ… Fixed: Stop video before transition)
     */
    scheduleNext(seconds) {
        if (this.contentTimer) {
            clearTimeout(this.contentTimer);
        }

        // Ensure minimum duration of 1 second to prevent instant skipping
        const duration = Math.max(1, seconds || this.config.defaultDuration);

        if (this.debug) {
            console.log(`[Player] scheduleNext: ${duration}s for item ${this.currentIndex + 1}`);
        }

        this.contentTimer = setTimeout(() => {
            this.contentTimer = null; // Clear timer reference before calling playNext

            // Don't immediately stop video here - let crossfade handle it.
            // hideAllContent() in playCurrentItem will apply exit transition to video,
            // then the exit transition timeout will pause/hide it after duration.

            const items = Array.isArray(this.playlist?.items) ? this.playlist.items : [];
            const nextIndex = items.length > 0 ? ((this.currentIndex + 1) % items.length) : -1;
            const nextType = nextIndex >= 0 ? String(items[nextIndex]?.type || '').toLowerCase() : '';
            this.traceTransitionSnapshot('scheduleNext-tick', {
                currentIndex: this.currentIndex,
                nextIndex,
                nextType
            });

            // Keep current native frame alive while waiting html iframe readiness,
            // then stop native right before html enter starts (in finalizeHtmlPlayback()).
            const shouldDeferNativeStop = nextType === 'html' && !this.isConstrainedTvProfile();

            // Only stop native ExoPlayer since it can't be crossfaded via CSS
            if (this.isNativePlaybackActive()) {
                if (shouldDeferNativeStop) {
                    this.clearNativePreloadedVideo('schedule-html-defer');
                    this.traceDebug('TRANS', 'defer native stop until html is ready', {
                        currentIndex: this.currentIndex,
                        nextIndex,
                        nextType
                    });
                    this.traceTransitionSnapshot('scheduleNext-defer-native-stop', {
                        nextType
                    });
                } else if (window.AndroidBridge.stopVideoNative) {
                    window.AndroidBridge.stopVideoNative();
                    this.setNativeVideoMode(false);
                    if (this.debug) {
                        console.log('[Player] Stopped ExoPlayer before transition');
                    }
                    this.traceTransitionSnapshot('scheduleNext-stop-native-now', {
                        nextType
                    });
                }
            }

            this.playNext();
        }, duration * 1000);
    }

    /**
     * Play next item
     */
    playNext() {
        if (!this.isPlaying) return;

        const prevIndex = this.currentIndex;
        this.currentIndex++;
        if (this.currentIndex >= this.playlist.items.length) {
            this.currentIndex = 0;
        }

        if (this.debug) {
            console.log(`[Player] playNext: ${prevIndex} -> ${this.currentIndex} (total: ${this.playlist.items.length})`);
        }

        this.playCurrentItem();
    }

    /**
     * Stop playback (PHASE 2: Also stop ExoPlayer)
     */
    stopPlayback() {
        this.isPlaying = false;

        if (this.contentTimer) {
            clearTimeout(this.contentTimer);
            this.contentTimer = null;
        }

        // âœ… PHASE 2: Stop native video playback
        if (this.hasNativeVideoSupport() && window.AndroidBridge.isPlayingNatively && window.AndroidBridge.isPlayingNatively()) {
            if (window.AndroidBridge.stopVideoNative) {
                window.AndroidBridge.stopVideoNative();
            }
            this.setNativeVideoMode(false);
        }

        // Clean up video when stopping playback
        this.cleanupVideo();
        this.cleanupNextMediaWarmup();
        this.cleanupHtmlPrefetch();

        // Reset content type tracking
        this._currentContentType = null;
        this._activeHtmlSlot = 'primary';
        this._pendingExitElement = null;

        this.hideAllContent();
    }

    // ==================== Heartbeat & Sync ====================

    /**
     * Start heartbeat
     */
    startHeartbeat() {
        this.sendHeartbeat();

        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, this.config.heartbeatSeconds * 1000);
    }

    /**
     * âœ… iOS PWA FIX: Pause heartbeat when app goes to background
     */
    pauseHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * âœ… iOS PWA FIX: Resume heartbeat when app returns to foreground
     */
    resumeHeartbeat() {
        if (!this.heartbeatInterval) {
            this.startHeartbeat();
        }
    }

    /**
     * Send heartbeat to server
     */
    async sendHeartbeat() {
        try {
            var currentItem = null;
            if (this.playlist && this.playlist.items && this.playlist.items[this.currentIndex]) {
                currentItem = this.playlist.items[this.currentIndex].id;
            }

            // âœ… Playlist bilgisi ekle
            const playlistInfo = this.playlist ? {
                playlist_id: this.playlist.id,
                playlist_name: this.playlist.name,
                current_index: this.currentIndex,
                total_items: this.playlist.items ? this.playlist.items.length : 0,
                last_sync: this.lastSyncTime || null
            } : null;

            const status = {
                status: this.isPlaying ? 'playing' : 'idle',
                currentItem: currentItem,
                battery: await this.getBatteryLevel(),
                memory: this.getMemoryUsage(),
                uptime: Math.floor(performance.now() / 1000),
                playlist: playlistInfo  // âœ… YENİ
            };

            const response = await api.heartbeat(status);

            this.elements.connectionStatus.className = 'status-icon online';

            const data = response.data || response;
            const commands = data.commands || [];

            if (commands.length) {
                await this.processCommands(commands);
            }

            if (data.shouldSync) {
                this.syncContent();
            }
        } catch (error) {
            this.elements.connectionStatus.className = 'status-icon offline';
        }
    }

    /**
     * Get battery level
     */
    async getBatteryLevel() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                return Math.round(battery.level * 100);
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    /**
     * Get memory usage
     */
    getMemoryUsage() {
        if (performance.memory) {
            return Math.round((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100);
        }
        return null;
    }

    /**
     * Start sync checker
     */
    startSyncChecker() {
        this.syncInterval = setInterval(() => {
            this.syncContent();
        }, this.config.syncSeconds * 1000);
    }

    /**
     * Sync content with server
     */
    async syncContent(options = {}) {
        const forceRestart = options.forceRestart === true;

        // Serialize sync calls to avoid racing comparisons from mixed snapshots.
        if (this._syncInFlight) {
            this._queuedSyncPending = true;
            this._queuedSyncForceRestart = this._queuedSyncForceRestart || forceRestart;
            return;
        }

        this._syncInFlight = true;
        try {
            const currentPlaylist = this.playlist;
            const currentPlaylistId = currentPlaylist ? currentPlaylist.id : null;
            const currentItems = (currentPlaylist && currentPlaylist.items) ? currentPlaylist.items : [];
            const currentItemCount = currentItems.length;
            const currentConfigSignature = this.buildPlaylistConfigSignature(currentPlaylist);
            const savedIndex = this.currentIndex;
            const wasPlaying = this.isPlaying;
            const currentItemKeys = currentItems.map((i) => this.buildPlaylistItemSignature(i));
            const currentItemsHash = currentItemKeys.join(',');
            const currentSlotSignature = currentItemKeys[savedIndex] || '';

            const response = await api.init_player();

            if (!response.success) {
                return;
            }

            const data = response.data;

            if (data.playlist) {
                const newPlaylistId = data.playlist.id;
                const newItemCount = (data.playlist.items && data.playlist.items.length) ? data.playlist.items.length : 0;
                const newConfigSignature = this.buildPlaylistConfigSignature(data.playlist);

                const playlistChanged = currentPlaylistId !== newPlaylistId;
                const itemsChanged = currentItemCount !== newItemCount;
                const configChanged = currentConfigSignature !== newConfigSignature;

                // âœ… CRITICAL FIX: medya kimliği + url + duration + loop + muted değerlerini hash'e dahil et
                var newItemsHash = '';
                var newItemKeys = [];
                if (data.playlist.items) {
                    newItemKeys = data.playlist.items.map((i) => this.buildPlaylistItemSignature(i));
                    newItemsHash = newItemKeys.join(',');
                }
                const contentChanged = currentItemsHash !== newItemsHash;
                const currentSlotChanged = currentSlotSignature !== (newItemKeys[savedIndex] || '');

                // âœ… DEBUG: Her zaman hash karşılaştırmasını logla
                if (this.debug) {
                    console.log('[Player] syncContent - Hash comparison:');
                    console.log('  Old hash:', currentItemsHash);
                    console.log('  New hash:', newItemsHash);
                    console.log('  Content changed:', contentChanged);
                    console.log('  Current slot changed:', currentSlotChanged);
                    console.log('  Playlist changed:', playlistChanged);
                    console.log('  Items changed:', itemsChanged);
                    console.log('  Config changed:', configChanged);
                }

                if (playlistChanged || itemsChanged || contentChanged || configChanged || forceRestart) {
                    this.playlist = data.playlist;
                    this.applyPlaylistPlaybackSettings();
                    this.lastSyncTime = new Date().toISOString(); // âœ… Sync zamanını kaydet
                    await storage.savePlaylist(this.playlist);

                    // Prune stale cache entries on playlist change.
                    // Actual caching happens progressively in prepareNextMedia().
                    this._scheduleDeferredPrecache();

                    const onlyContentChanged = !playlistChanged && !itemsChanged && contentChanged && !configChanged && !forceRestart;
                    this.traceDebug('SYNC', 'sync decision', {
                        onlyContentChanged,
                        wasPlaying,
                        currentIndex: savedIndex,
                        currentSlotChanged,
                        forceRestart
                    });

                    // Keep playback seamless only when the active item payload changed.
                    if (onlyContentChanged && wasPlaying) {
                        // âœ… CRITICAL FIX: Her seamless update'te şu anki item'ın muted değerini kontrol et ve uygula
                        if (this.playlist.items && this.playlist.items[this.currentIndex]) {
                            const currentItem = this.playlist.items[this.currentIndex];
                            // muted: 0=unmuted (ses açık), 1=muted (ses kapalı) - INTEGER olarak gelir
                            const shouldMute = currentItem.muted !== undefined ? (currentItem.muted === 1 || currentItem.muted === true) : true;

                            if (this.debug) {
                                console.log(`[Player] Seamless update - checking muted state: ${shouldMute} (item.muted=${currentItem.muted})`);
                            }

                            // âœ… Native video çalıyorsa ses değişikliğini uygula
                            if (
                                window.AndroidBridge &&
                                typeof window.AndroidBridge.isPlayingNatively === 'function' &&
                                typeof window.AndroidBridge.setVideoVolume === 'function'
                            ) {
                                try {
                                    const isNative = window.AndroidBridge.isPlayingNatively();
                                    if (isNative) {
                                        const volume = shouldMute ? 0.0 : 1.0;
                                        window.AndroidBridge.setVideoVolume(volume);
                                        if (this.debug) {
                                            console.log(`[Player] Applied muted=${shouldMute} to NATIVE video (volume=${volume}), raw item.muted=${currentItem.muted}`);
                                        }
                                    }
                                } catch (e) {
                                    console.warn('[Player] Native video control failed:', e);
                                }
                            }

                            // âœ… WebView video çalıyorsa (check both video elements)
                            const activeVid = this.getActiveVideoElement();
                            if (activeVid && !activeVid.paused) {
                                activeVid.muted = shouldMute;
                                if (this.debug) {
                                    console.log(`[Player] Applied muted=${shouldMute} to WEBVIEW video, raw item.muted=${currentItem.muted}`);
                                }
                            }
                        }

                        if (this.debug) {
                            console.log('[Player] Seamless content update, continuing playback');
                        }

                        if (currentSlotChanged) {
                            this.traceDebug('SYNC', 'restarting current slot due signature change', {
                                index: savedIndex,
                                oldSignature: currentSlotSignature,
                                newSignature: newItemKeys[savedIndex] || ''
                            });
                            if (this.contentTimer) {
                                clearTimeout(this.contentTimer);
                                this.contentTimer = null;
                            }
                            this.currentIndex = Math.min(savedIndex, this.playlist.items.length - 1);
                            this.playCurrentItem();
                        } else {
                            this.prepareNextMedia();
                        }
                    } else {
                        // Different playlist or item count changed - restart
                        this.stopPlayback();
                        this.startPlayback();
                    }
                }
            } else if (this.playlist && !data.playlist) {
                this.playlist = null;
                this.stopPlayback();
                this.showFallback('Yayın listesi atanmadı\n\nYönetim panelinden bu cihaza playlist atayın');
            }

            await storage.put('config', { key: 'lastSync', value: new Date().toISOString() });
        } catch (error) {
            // Silent fail
        } finally {
            this._syncInFlight = false;

            // Run one consolidated sync if requests arrived while in-flight.
            if (this._queuedSyncPending) {
                const queuedForceRestart = this._queuedSyncForceRestart === true;
                this._queuedSyncPending = false;
                this._queuedSyncForceRestart = false;
                setTimeout(() => {
                    this.syncContent({ forceRestart: queuedForceRestart });
                }, 0);
            }
        }
    }

    // ==================== Command Processing ====================

    /**
     * Process commands from server
     */
    async processCommands(commands) {
        for (const cmd of commands) {
            try {
                let result = null;

                switch (cmd.command) {
                    case 'start':
                        // Explicit start should always pull latest content and restart from the first item.
                        await this.syncContent({ forceRestart: true });
                        this.showNotification('Yayın Başlatıldı', {
                            body: 'İçerik oynatılıyor',
                            type: 'success'
                        });
                        result = { success: true, status: 'playing' };
                        break;

                    case 'resume':
                        // âœ… FIX: Playlist sync yaparak muted değişikliklerini al
                        await this.syncContent();
                        if (!this.isPlaying) {
                            this.startPlayback();
                        }
                        this.showNotification('Yayın Başlatıldı', {
                            body: 'İçerik oynatılıyor',
                            type: 'success'
                        });
                        result = { success: true, status: 'playing' };
                        break;

                    case 'stop':
                        this.stopPlayback();
                        this.showFallback('Yayın durduruldu');
                        this.showNotification('Yayın Durduruldu', {
                            body: 'Yayın uzaktan durduruldu',
                            type: 'warning'
                        });
                        result = { success: true, status: 'stopped' };
                        break;

                    case 'restart':
                        // âœ… Yeniden başlatma - sync + stop + start
                        await this.syncContent();
                        this.stopPlayback();
                        this.startPlayback();
                        this.showNotification('Yayın Yeniden Başlatıldı', {
                            body: 'İçerik güncel haliyle oynatılıyor',
                            type: 'success'
                        });
                        result = { success: true, status: 'restarted' };
                        break;

                    case 'pause':
                        if (this.isPlaying) {
                            this.isPlaying = false;
                            if (this.contentTimer) {
                                clearTimeout(this.contentTimer);
                            }
                            // Pause both video elements
                            if (this.elements.videoContent && !this.elements.videoContent.paused) {
                                this.elements.videoContent.pause();
                            }
                            if (this.elements.videoContentAlt && !this.elements.videoContentAlt.paused) {
                                this.elements.videoContentAlt.pause();
                            }
                        }
                        this.showToast('Yayın duraklatıldı', 'info');
                        result = { success: true, status: 'paused' };
                        break;

                    case 'next':
                        this.playNext();
                        result = { success: true, currentIndex: this.currentIndex };
                        break;

                    case 'prev':
                        if (this.currentIndex > 0) {
                            this.currentIndex -= 2;
                        } else {
                            this.currentIndex = this.playlist.items.length - 2;
                        }
                        this.playNext();
                        result = { success: true, currentIndex: this.currentIndex };
                        break;

                    case 'goto':
                        var gotoIndex = (cmd.parameters && typeof cmd.parameters.index !== 'undefined') ? cmd.parameters.index : 0;
                        var itemsLength = (this.playlist && this.playlist.items) ? this.playlist.items.length : 0;
                        if (gotoIndex >= 0 && gotoIndex < itemsLength) {
                            this.currentIndex = gotoIndex - 1;
                            this.playNext();
                            result = { success: true, currentIndex: this.currentIndex };
                        } else {
                            result = { success: false, error: 'Invalid index' };
                        }
                        break;

                    case 'refresh':
                    case 'refresh_content':
                    case 'sync':
                        this.showToast('İçerik yenileniyor...', 'info');
                        await this.syncContent({ forceRestart: true });
                        this.showNotification('İçerik Güncellendi', {
                            body: 'Yeni içerik yüklendi',
                            type: 'success'
                        });
                        result = { success: true };
                        break;

                    case 'reboot':
                        this.showNotification('Cihaz Yeniden Başlatılıyor', {
                            body: 'Player yeniden yüklenecek',
                            type: 'warning'
                        });
                        result = { success: true };
                        setTimeout(() => window.location.reload(), 1000);
                        break;

                    case 'clear_cache':
                        await storage.clearAll();
                        if ('caches' in window) {
                            const keys = await caches.keys();
                            for (const key of keys) {
                                await caches.delete(key);
                            }
                        }
                        this.showToast('Önbellek temizlendi', 'success');
                        result = { success: true };
                        break;

                    case 'set_volume':
                        var volumeLevel = (cmd.parameters && typeof cmd.parameters.level !== 'undefined') ? cmd.parameters.level : 100;
                        var volVal = volumeLevel / 100;
                        if (this.elements.videoContent) this.elements.videoContent.volume = volVal;
                        if (this.elements.videoContentAlt) this.elements.videoContentAlt.volume = volVal;
                        result = { success: true, volume: volumeLevel };
                        break;

                    case 'display_message':
                        var msgText = (cmd.parameters && cmd.parameters.text) ? cmd.parameters.text : '';
                        var msgDuration = (cmd.parameters && cmd.parameters.duration) ? cmd.parameters.duration : undefined;
                        this.showTemporaryMessage(msgText, msgDuration);
                        this.showNotification('Mesaj', {
                            body: msgText || 'Yeni mesaj',
                            type: 'info'
                        });
                        result = { success: true };
                        break;

                    case 'screenshot':
                        result = { success: false, error: 'Not supported in PWA' };
                        break;

                    default:
                        result = { success: false, error: 'Unknown command' };
                }

                await api.acknowledgeCommand(cmd.id, result);
            } catch (error) {
                await api.acknowledgeCommand(cmd.id, { success: false, error: error.message });
            }
        }
    }

    /**
     * Show temporary message overlay
     */
    showTemporaryMessage(text, duration = 5) {
        const overlay = document.createElement('div');
        overlay.className = 'message-overlay';
        overlay.innerHTML = `<div class="message-content">${text}</div>`;
        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.remove();
        }, duration * 1000);
    }

    // ==================== Notifications ====================

    /**
     * Request notification permission
     */
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission !== 'denied') {
            try {
                const permission = await Notification.requestPermission();
                return permission === 'granted';
            } catch (error) {
                return false;
            }
        }

        return false;
    }

    /**
     * Show desktop/push notification
     * In Android app: toast + system notification bar
     * In browser: toast + Web Notification API
     */
    async showNotification(title, options = {}) {
        this.showToast(options.body || title, options.type || 'info');

        // Android app: use native system notification via bridge
        if (this.isAndroidApp && this.androidBridge && typeof this.androidBridge.showSystemNotification === 'function') {
            try {
                this.androidBridge.showSystemNotification(
                    title,
                    options.body || title,
                    options.type || 'info'
                );
            } catch (e) {
                // Bridge call failed silently
            }
            return;
        }

        // Browser: use Web Notification API
        if (!('Notification' in window)) {
            return;
        }

        if (Notification.permission !== 'granted') {
            return;
        }

        try {
            const defaultOptions = {
                icon: '/player/assets/images/icon-192.png',
                badge: '/player/assets/images/icon-192.png',
                tag: 'omnex-player-' + Date.now(),
                requireInteraction: false,
                silent: false,
                ...options
            };

            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(title, defaultOptions);
            } else {
                const notification = new Notification(title, defaultOptions);

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };

                setTimeout(() => notification.close(), 10000);
            }
        } catch (error) {
            // Silent fail
        }
    }

    /**
     * Show in-app toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type: info, success, warning, error
     * @param {number} duration - Duration in milliseconds (default: 3000)
     */
    showToast(message, type = 'info', duration = 3000) {
        // When ExoPlayer is active (native PlayerView covers WebView),
        // web-based toast is invisible. Use native Android Toast instead.
        if (this.isAndroidApp && this.androidBridge && typeof this.androidBridge.isPlayingNatively === 'function') {
            try {
                if (this.androidBridge.isPlayingNatively()) {
                    this.androidBridge.showToast(message);
                    return;
                }
            } catch (e) {
                // Fallback to web toast below
            }
        }

        const existingToast = document.querySelector('.player-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const iconMap = {
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `player-toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${iconMap[type] || iconMap.info}</div>
            <div class="toast-message">${message}</div>
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ==================== Error Handling ====================

    /**
     * Show error screen
     */
    showError(message) {
        this.showScreen('error');
        this.elements.errorMessage.textContent = message;
    }

    // ==================== Event Listeners ====================

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.elements.btnRetry) {
            this.elements.btnRetry.addEventListener('click', () => {
                this.init();
            });
        }

        if (this.elements.pwaInstallBtn) {
            this.elements.pwaInstallBtn.addEventListener('click', () => {
                this.showInstallPrompt();
            });
        }

        if (this.elements.apkInstallBtn) {
            this.elements.apkInstallBtn.addEventListener('click', () => {
                if (!this.config.apkDownloadUrl) return;
                window.open(this.config.apkDownloadUrl, '_blank', 'noopener');
            });
        }

        if (this.elements.orientationToggleBtn) {
            this.elements.orientationToggleBtn.addEventListener('click', () => {
                this.togglePreferredOrientation();
            });
        }

        const refreshScreenMetrics = () => {
            this.applyDeviceProfileClasses();
            this.updateScreenResolutionLabel();
            this.applyPlaylistOrientation();
        };

        window.addEventListener('resize', refreshScreenMetrics);
        window.addEventListener('orientationchange', refreshScreenMetrics);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', refreshScreenMetrics);
        }

        window.addEventListener('online', () => {
            this.elements.connectionStatus.className = 'status-icon online';
            this.sendHeartbeat();
        });

        window.addEventListener('offline', () => {
            this.elements.connectionStatus.className = 'status-icon offline';
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // iOS PWA FIX: App backgrounded - pause heartbeat + video
                this.pauseHeartbeat();
                const activeVideo = this.getActiveVideoElement();
                if (activeVideo && !activeVideo.paused) {
                    activeVideo.pause();
                }
                if (this.debug) console.log('[Player] App backgrounded - heartbeat & video paused');
            } else {
                // iOS PWA FIX: App foregrounded - resume heartbeat + video + sync
                this.resumeHeartbeat();
                const activeVideo = this.getActiveVideoElement();
                if (activeVideo && activeVideo.paused && activeVideo.readyState >= 2) {
                    activeVideo.play().catch(() => {});
                }
                this.syncContent();
                if (this.debug) console.log('[Player] App foregrounded - syncing playlist');
                this.sendHeartbeat();
            }
        });

        if (this.debug) {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'd' && e.ctrlKey) {
                    this.toggleDebugPanel();
                }
            });
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                const { type } = event.data;

                if (type === 'CONTENT_UPDATE') {
                    this.syncContent();
                }
            });
        }

        let lastTap = 0;
        const handleDoubleTap = () => {
            const video = this.getActiveVideoElement();
            if (video && !video.paused && video.style.display !== 'none') {
                return;
            }
            this.requestFullscreen();
        };

        if (this.screens.player) {
            this.screens.player.addEventListener('dblclick', handleDoubleTap);
            this.screens.player.addEventListener('touchend', function(e) {
                var currentTime = new Date().getTime();
                var tapLength = currentTime - lastTap;
                if (tapLength < 300 && tapLength > 0) {
                    handleDoubleTap();
                }
                lastTap = currentTime;
            });
        }

        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // Status bar activity detection - show on mouse move or touch
        const showStatusBarOnActivity = () => this.showStatusBar();

        document.addEventListener('mousemove', showStatusBarOnActivity);
        document.addEventListener('touchstart', showStatusBarOnActivity);
        document.addEventListener('keydown', showStatusBarOnActivity);

        // Also show on scroll (for remote controls)
        document.addEventListener('wheel', showStatusBarOnActivity);
    }

    /**
     * Start clock update
     */
    startClock() {
        const updateClock = () => {
            const now = new Date();
            this.elements.currentTime.textContent =
                now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        };

        updateClock();
        setInterval(updateClock, 1000);
    }

    // ==================== Service Worker ====================

    /**
     * Register service worker
     */
    async registerServiceWorker() {
        if (!this.config.enableServiceWorker) {
            return;
        }
        if ('serviceWorker' in navigator) {
            try {
                const scopeUrl = new URL(window.PLAYER_PATH || '/player/', window.location.origin);
                let scopePath = scopeUrl.pathname;
                if (!scopePath.endsWith('/')) {
                    scopePath += '/';
                }

                const registration = await navigator.serviceWorker.register(scopePath + 'sw.js', {
                    scope: scopePath
                });

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });
            } catch (error) {
                // Silent fail
            }
        }
    }

    // ==================== Debug ====================

    /**
     * Toggle debug panel
     */
    toggleDebugPanel() {
        const panel = this.elements.debugPanel;
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    // ==================== Cleanup ====================

    /**
     * Cleanup on unload
     */
    cleanup() {
        this.stopPlayback();
        this.cleanupVideo();

        // âœ… MEMORY LEAK FIX: Clear all timers
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.syncInterval) clearInterval(this.syncInterval);
        if (this.verifyPollingInterval) clearInterval(this.verifyPollingInterval);
        if (this.syncCodeTimer) clearInterval(this.syncCodeTimer);
        if (this.contentTimer) clearTimeout(this.contentTimer);
    }
}

// Initialize on load
async function startPlayer() {
    // Only run in top-level window, not in iframes
    if (window !== window.top) {
        console.log('[Player] Running inside iframe, skipping initialization');
        return;
    }

    // Prevent double initialization
    if (window.OmnexPlayer && window.OmnexPlayer.initialized) {
        console.log('[Player] Already initialized, skipping');
        return;
    }

    try {
        await loadDependencies();

        const player = new OmnexPlayer();
        window.OmnexPlayer = player;

        await player.init();
        player.initialized = true;

        window.addEventListener('beforeunload', () => player.cleanup());
    } catch (error) {
        console.error('[Player] Failed to start:', error);
        const loadingMsg = document.getElementById('loading-message');
        if (loadingMsg) {
            loadingMsg.innerHTML = 'Başlatma hatası:<br>' + error.message;
            loadingMsg.style.color = '#ef4444';
        }
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPlayer);
} else {
    startPlayer();
}
