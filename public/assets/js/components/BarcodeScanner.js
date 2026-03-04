/**
 * BarcodeScanner - Camera-based barcode/QR code scanning component
 *
 * Uses native BarcodeDetector API (Chrome 83+, Edge, Android Chrome) as primary.
 * Falls back to html5-qrcode library from CDN when native API is unavailable.
 * Provides manual text input as final fallback when camera is not available.
 *
 * Usage:
 *   import { BarcodeScanner } from '../components/BarcodeScanner.js';
 *
 *   const scanner = new BarcodeScanner({ formats: ['ean_13', 'qr_code'] });
 *   scanner.onDetected(result => console.log(result.rawValue, result.format));
 *   scanner.onError(err => console.error(err));
 *   await scanner.start(document.getElementById('scanner-container'));
 *   // ... later
 *   scanner.destroy();
 *
 * @version 1.0.0
 * @package OmnexDisplayHub
 */

import { Logger } from '../core/Logger.js';

/**
 * Supported barcode format names (BarcodeDetector API naming)
 * @type {string[]}
 */
const DEFAULT_FORMATS = [
    'qr_code',
    'ean_13',
    'ean_8',
    'code_128',
    'code_39',
    'upc_a',
    'itf'
];

/**
 * Map BarcodeDetector format names to html5-qrcode format constants.
 * html5-qrcode uses its own enum (Html5QrcodeSupportedFormats).
 * We map at runtime after the library is loaded.
 */
const ZX_FORMAT_MAP = {
    'qr_code':    'QR_CODE',
    'ean_13':     'EAN_13',
    'ean_8':      'EAN_8',
    'code_128':   'CODE_128',
    'code_39':    'CODE_39',
    'upc_a':      'UPC_A',
    'upc_e':      'UPC_E',
    'itf':        'ITF',
    'codabar':    'CODABAR',
    'data_matrix': 'DATA_MATRIX',
    'aztec':      'AZTEC',
    'pdf417':     'PDF_417'
};

/**
 * CDN URL for html5-qrcode fallback library
 */
const HTML5_QRCODE_CDN = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';

/**
 * Scanner states
 * @enum {string}
 */
const ScannerState = {
    IDLE:     'idle',
    STARTING: 'starting',
    SCANNING: 'scanning',
    PAUSED:   'paused',
    ERROR:    'error'
};

export class BarcodeScanner {
    /**
     * @param {Object} options - Scanner configuration
     * @param {string[]} [options.formats] - Barcode formats to detect
     * @param {string} [options.preferredCamera='environment'] - Camera facing mode: 'environment' (back) or 'user' (front)
     * @param {number} [options.scanInterval=200] - Milliseconds between detection attempts
     * @param {boolean} [options.beepOnScan=true] - Play beep sound on successful scan
     * @param {boolean} [options.vibrateOnScan=true] - Vibrate device on successful scan
     * @param {string} [options.highlightColor='#00ff00'] - Color for scan region overlay
     * @param {number} [options.deduplicateMs=2000] - Ignore same barcode within this time window
     * @param {boolean} [options.continuous=true] - Keep scanning after first detection
     */
    constructor(options = {}) {
        this._formats = options.formats || [...DEFAULT_FORMATS];
        this._preferredCamera = options.preferredCamera || 'environment';
        this._scanInterval = Math.max(50, options.scanInterval || 200);
        this._beepOnScan = options.beepOnScan !== false;
        this._vibrateOnScan = options.vibrateOnScan !== false;
        this._highlightColor = options.highlightColor || '#00ff00';
        this._deduplicateMs = options.deduplicateMs || 2000;
        this._continuous = options.continuous !== false;

        // Internal state
        this._state = ScannerState.IDLE;
        this._stream = null;
        this._videoEl = null;
        this._canvasEl = null;
        this._canvasCtx = null;
        this._containerEl = null;
        this._overlayEl = null;
        this._detector = null;         // Native BarcodeDetector instance
        this._html5Scanner = null;     // html5-qrcode instance
        this._scanTimerId = null;
        this._rafId = null;
        this._torchOn = false;
        this._detectionMethod = null;  // 'native' | 'zxing' | 'manual'
        this._audioCtx = null;
        this._lastScans = new Map();   // barcode value -> timestamp (dedup)

        // Callbacks
        this._onDetectedCb = null;
        this._onErrorCb = null;

        // Bound handlers for cleanup
        this._boundVisibilityChange = this._onVisibilityChange.bind(this);
        this._boundBeforeUnload = this._onBeforeUnload.bind(this);
    }

    // ─── Static Methods ────────────────────────────────────────────

    /**
     * Check if camera-based barcode scanning is supported in this browser
     * @returns {Promise<boolean>}
     */
    static async isSupported() {
        // Camera API must exist
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return false;
        }

        // At least one detection method must be available
        const method = await BarcodeScanner.getDetectionMethod();
        return method !== 'manual';
    }

    /**
     * Determine the best available barcode detection method
     * @returns {Promise<'native'|'zxing'|'manual'>}
     */
    static async getDetectionMethod() {
        // 1. Check native BarcodeDetector
        if (typeof BarcodeDetector !== 'undefined') {
            try {
                const supported = await BarcodeDetector.getSupportedFormats();
                if (supported && supported.length > 0) {
                    return 'native';
                }
            } catch (e) {
                Logger.debug('[BarcodeScanner] Native BarcodeDetector check failed:', e);
            }
        }

        // 2. Check if html5-qrcode is already loaded or can be loaded
        if (typeof Html5Qrcode !== 'undefined') {
            return 'zxing';
        }

        // Optimistically report zxing if we can load scripts
        if (typeof document !== 'undefined') {
            return 'zxing';
        }

        return 'manual';
    }

    // ─── Public Instance Methods ───────────────────────────────────

    /**
     * Register callback for successful barcode detection
     * @param {Function} callback - Called with { rawValue: string, format: string, timestamp: number }
     */
    onDetected(callback) {
        this._onDetectedCb = callback;
    }

    /**
     * Register callback for errors
     * @param {Function} callback - Called with Error instance
     */
    onError(callback) {
        this._onErrorCb = callback;
    }

    /**
     * Get current scanner state
     * @returns {'idle'|'starting'|'scanning'|'paused'|'error'}
     */
    getState() {
        return this._state;
    }

    /**
     * Start scanning and mount video preview into the given container element
     * @param {HTMLElement} containerElement - DOM element to mount the scanner into
     * @returns {Promise<void>}
     */
    async start(containerElement) {
        if (!containerElement) {
            throw new Error('BarcodeScanner.start() requires a container element');
        }

        if (this._state === ScannerState.SCANNING) {
            Logger.debug('[BarcodeScanner] Already scanning, ignoring start()');
            return;
        }

        this._state = ScannerState.STARTING;
        this._containerEl = containerElement;

        // Determine detection method
        this._detectionMethod = await BarcodeScanner.getDetectionMethod();
        Logger.debug('[BarcodeScanner] Detection method:', this._detectionMethod);

        // Register page lifecycle handlers
        document.addEventListener('visibilitychange', this._boundVisibilityChange);
        window.addEventListener('beforeunload', this._boundBeforeUnload);

        if (this._detectionMethod === 'manual') {
            this._mountManualInput();
            return;
        }

        try {
            if (this._detectionMethod === 'native') {
                await this._startNative();
            } else {
                await this._startZxing();
            }
        } catch (err) {
            Logger.error('[BarcodeScanner] Failed to start:', err);

            // Camera permission denied or not available - fall back to manual input.
            // Check both error name (native errors) and message (library-wrapped errors)
            const isCameraError = this._isCameraRelatedError(err);
            if (isCameraError) {
                Logger.debug('[BarcodeScanner] Camera unavailable, falling back to manual input');
                this._detectionMethod = 'manual';
                this._mountManualInput();
                return;
            }

            this._state = ScannerState.ERROR;
            this._emitError(err);
        }
    }

    /**
     * Stop scanning and release the camera
     * @returns {Promise<void>}
     */
    async stop() {
        this._stopDetectionLoop();

        // Stop html5-qrcode if active
        if (this._html5Scanner) {
            try {
                const state = this._html5Scanner.getState();
                // Html5QrcodeScannerState: NOT_STARTED=1, SCANNING=2, PAUSED=3
                if (state === 2 || state === 3) {
                    await this._html5Scanner.stop();
                }
            } catch (e) {
                Logger.debug('[BarcodeScanner] html5-qrcode stop error (safe to ignore):', e);
            }
            this._html5Scanner = null;
        }

        // Release camera stream
        if (this._stream) {
            this._stream.getTracks().forEach(track => track.stop());
            this._stream = null;
        }

        // Clean video element
        if (this._videoEl) {
            this._videoEl.srcObject = null;
        }

        this._torchOn = false;
        this._state = ScannerState.IDLE;

        Logger.debug('[BarcodeScanner] Stopped');
    }

    /**
     * Pause detection (camera stays open)
     */
    pause() {
        if (this._state !== ScannerState.SCANNING) return;
        this._stopDetectionLoop();
        this._state = ScannerState.PAUSED;
        Logger.debug('[BarcodeScanner] Paused');
    }

    /**
     * Resume detection after pause
     */
    resume() {
        if (this._state !== ScannerState.PAUSED) return;
        this._state = ScannerState.SCANNING;

        if (this._detectionMethod === 'native') {
            this._startDetectionLoop();
        }
        // html5-qrcode manages its own loop internally via resume()
        if (this._html5Scanner) {
            try {
                this._html5Scanner.resume();
            } catch (e) {
                Logger.debug('[BarcodeScanner] html5-qrcode resume error:', e);
            }
        }

        Logger.debug('[BarcodeScanner] Resumed');
    }

    /**
     * Switch between front and back camera
     * @returns {Promise<void>}
     */
    async switchCamera() {
        if (this._detectionMethod === 'manual') return;

        this._preferredCamera = this._preferredCamera === 'environment' ? 'user' : 'environment';
        Logger.debug('[BarcodeScanner] Switching camera to:', this._preferredCamera);

        // Restart with new camera
        await this.stop();
        if (this._containerEl) {
            await this.start(this._containerEl);
        }
    }

    /**
     * Toggle flashlight/torch on the active camera (if supported)
     * @returns {Promise<boolean>} Whether torch is now on
     */
    async toggleTorch() {
        if (!this._stream) return false;

        const track = this._stream.getVideoTracks()[0];
        if (!track) return false;

        try {
            const capabilities = track.getCapabilities();
            if (!capabilities.torch) {
                Logger.debug('[BarcodeScanner] Torch not supported on this device');
                return false;
            }

            this._torchOn = !this._torchOn;
            await track.applyConstraints({
                advanced: [{ torch: this._torchOn }]
            });
            Logger.debug('[BarcodeScanner] Torch:', this._torchOn ? 'ON' : 'OFF');
            return this._torchOn;
        } catch (err) {
            Logger.debug('[BarcodeScanner] Torch toggle failed:', err);
            return false;
        }
    }

    /**
     * Destroy the scanner, release all resources, remove DOM elements
     */
    destroy() {
        this.stop().catch(() => {});

        // Remove lifecycle handlers
        document.removeEventListener('visibilitychange', this._boundVisibilityChange);
        window.removeEventListener('beforeunload', this._boundBeforeUnload);

        // Close AudioContext
        if (this._audioCtx) {
            try { this._audioCtx.close(); } catch (e) {}
            this._audioCtx = null;
        }

        // Clear container
        if (this._containerEl) {
            this._containerEl.innerHTML = '';
        }

        // Clear references
        this._videoEl = null;
        this._canvasEl = null;
        this._canvasCtx = null;
        this._containerEl = null;
        this._overlayEl = null;
        this._detector = null;
        this._onDetectedCb = null;
        this._onErrorCb = null;
        this._lastScans.clear();

        this._state = ScannerState.IDLE;
        Logger.debug('[BarcodeScanner] Destroyed');
    }

    // ─── Native BarcodeDetector Path ───────────────────────────────

    /**
     * Start scanning using native BarcodeDetector API
     * @private
     */
    async _startNative() {
        // Filter formats to only those supported natively
        let supportedFormats;
        try {
            supportedFormats = await BarcodeDetector.getSupportedFormats();
        } catch (e) {
            supportedFormats = [];
        }

        const requestedFormats = this._formats.filter(f => supportedFormats.includes(f));
        if (requestedFormats.length === 0) {
            throw new Error('No requested barcode formats are supported by native BarcodeDetector');
        }

        this._detector = new BarcodeDetector({ formats: requestedFormats });
        Logger.debug('[BarcodeScanner] Native BarcodeDetector created, formats:', requestedFormats);

        // Open camera
        await this._openCamera();

        // Mount UI
        this._mountNativeUI();

        // Start detection loop
        this._state = ScannerState.SCANNING;
        this._startDetectionLoop();
    }

    /**
     * Open camera stream with preferred facing mode
     * @private
     */
    async _openCamera() {
        const constraints = {
            video: {
                facingMode: { ideal: this._preferredCamera },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        this._stream = await navigator.mediaDevices.getUserMedia(constraints);
        Logger.debug('[BarcodeScanner] Camera stream opened');
    }

    /**
     * Mount video element and overlay for native detection into the container
     * @private
     */
    _mountNativeUI() {
        // Clear container
        this._containerEl.innerHTML = '';

        // Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'barcode-scanner-wrapper';
        wrapper.style.cssText = 'position:relative;width:100%;overflow:hidden;background:#000;border-radius:8px;';

        // Video element
        this._videoEl = document.createElement('video');
        this._videoEl.className = 'barcode-scanner-video';
        this._videoEl.setAttribute('autoplay', '');
        this._videoEl.setAttribute('playsinline', '');
        this._videoEl.setAttribute('muted', '');
        this._videoEl.muted = true;
        this._videoEl.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        this._videoEl.srcObject = this._stream;
        wrapper.appendChild(this._videoEl);

        // Scan region overlay
        this._overlayEl = document.createElement('div');
        this._overlayEl.className = 'barcode-scanner-overlay';
        this._overlayEl.style.cssText = `
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-50%);
            width:70%;height:40%;
            border:2px solid ${this._highlightColor};
            border-radius:12px;
            box-shadow:0 0 0 9999px rgba(0,0,0,0.4);
            pointer-events:none;
            transition:border-color 0.2s;
        `;

        // Animated scan line
        const scanLine = document.createElement('div');
        scanLine.className = 'barcode-scanner-line';
        scanLine.style.cssText = `
            position:absolute;left:5%;right:5%;height:2px;
            background:${this._highlightColor};
            box-shadow:0 0 8px ${this._highlightColor};
            animation:barcodeScanLine 2s ease-in-out infinite;
            opacity:0.8;
        `;
        this._overlayEl.appendChild(scanLine);
        wrapper.appendChild(this._overlayEl);

        // Inject keyframes if not already present
        if (!document.getElementById('barcode-scanner-keyframes')) {
            const style = document.createElement('style');
            style.id = 'barcode-scanner-keyframes';
            style.textContent = `
                @keyframes barcodeScanLine {
                    0%, 100% { top: 10%; }
                    50% { top: 85%; }
                }
                .barcode-scanner-detected .barcode-scanner-overlay {
                    border-color: #fff !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Hidden canvas for frame capture
        this._canvasEl = document.createElement('canvas');
        this._canvasEl.style.display = 'none';
        wrapper.appendChild(this._canvasEl);

        this._containerEl.appendChild(wrapper);

        // Wait for video to be ready
        this._videoEl.addEventListener('loadedmetadata', () => {
            this._canvasEl.width = this._videoEl.videoWidth;
            this._canvasEl.height = this._videoEl.videoHeight;
            this._canvasCtx = this._canvasEl.getContext('2d', { willReadFrequently: true });
        });
    }

    /**
     * Start the frame-based detection loop (native path)
     * @private
     */
    _startDetectionLoop() {
        if (this._scanTimerId) return;

        const detect = async () => {
            if (this._state !== ScannerState.SCANNING || !this._detector || !this._videoEl) return;
            if (this._videoEl.readyState < 2) return; // HAVE_CURRENT_DATA

            try {
                const barcodes = await this._detector.detect(this._videoEl);
                if (barcodes && barcodes.length > 0) {
                    for (const barcode of barcodes) {
                        this._handleDetection(barcode.rawValue, barcode.format);
                    }
                }
            } catch (err) {
                // detect() can fail transiently (e.g. frame not ready)
                Logger.debug('[BarcodeScanner] Detection frame error (transient):', err.message);
            }
        };

        this._scanTimerId = setInterval(detect, this._scanInterval);
        Logger.debug('[BarcodeScanner] Detection loop started, interval:', this._scanInterval, 'ms');
    }

    /**
     * Stop the detection loop
     * @private
     */
    _stopDetectionLoop() {
        if (this._scanTimerId) {
            clearInterval(this._scanTimerId);
            this._scanTimerId = null;
        }
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    // ─── ZXing / html5-qrcode Fallback Path ───────────────────────

    /**
     * Start scanning using html5-qrcode library (fallback)
     * @private
     */
    async _startZxing() {
        // Load html5-qrcode library from CDN if not already present
        await this._loadHtml5QrcodeLib();

        // Create a container div for html5-qrcode (it manages its own video)
        this._containerEl.innerHTML = '';

        const scannerId = 'barcode-scanner-zxing-' + Date.now();
        const scannerDiv = document.createElement('div');
        scannerDiv.id = scannerId;
        scannerDiv.className = 'barcode-scanner-wrapper';
        scannerDiv.style.cssText = 'width:100%;border-radius:8px;overflow:hidden;';
        this._containerEl.appendChild(scannerDiv);

        // Map requested formats to html5-qrcode format IDs
        const Html5QrcodeSupportedFormats = window.Html5QrcodeSupportedFormats;
        const formatsConfig = [];
        if (Html5QrcodeSupportedFormats) {
            for (const fmt of this._formats) {
                const zxName = ZX_FORMAT_MAP[fmt];
                if (zxName && Html5QrcodeSupportedFormats[zxName] !== undefined) {
                    formatsConfig.push(Html5QrcodeSupportedFormats[zxName]);
                }
            }
        }

        // Create scanner instance
        this._html5Scanner = new Html5Qrcode(scannerId, {
            formatsToSupport: formatsConfig.length > 0 ? formatsConfig : undefined,
            verbose: false
        });

        const config = {
            fps: Math.round(1000 / this._scanInterval),
            qrbox: { width: 280, height: 160 },
            aspectRatio: 16 / 9,
            disableFlip: false,
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: false // We already checked native
            }
        };

        try {
            await this._html5Scanner.start(
                { facingMode: this._preferredCamera },
                config,
                (decodedText, decodedResult) => {
                    // Successful detection
                    const format = decodedResult?.result?.format?.formatName || 'unknown';
                    this._handleDetection(decodedText, this._normalizeFormat(format));
                },
                (errorMessage) => {
                    // Scan frame without detection (normal, not an error)
                }
            );

            // Capture the stream reference for torch control
            try {
                const videoEl = scannerDiv.querySelector('video');
                if (videoEl && videoEl.srcObject) {
                    this._stream = videoEl.srcObject;
                    this._videoEl = videoEl;
                }
            } catch (e) {}

            this._state = ScannerState.SCANNING;
            Logger.debug('[BarcodeScanner] html5-qrcode scanner started');
        } catch (err) {
            throw err;
        }
    }

    /**
     * Dynamically load html5-qrcode library from CDN
     * @private
     * @returns {Promise<void>}
     */
    async _loadHtml5QrcodeLib() {
        if (typeof Html5Qrcode !== 'undefined') {
            Logger.debug('[BarcodeScanner] html5-qrcode already loaded');
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = HTML5_QRCODE_CDN;
            script.async = true;

            script.onload = () => {
                Logger.debug('[BarcodeScanner] html5-qrcode loaded from CDN');
                resolve();
            };

            script.onerror = () => {
                const err = new Error('Failed to load html5-qrcode library from CDN');
                Logger.error('[BarcodeScanner]', err.message);
                reject(err);
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Normalize format names from html5-qrcode to BarcodeDetector naming
     * @private
     * @param {string} format - Format name from html5-qrcode
     * @returns {string} Normalized format name
     */
    _normalizeFormat(format) {
        if (!format) return 'unknown';

        const normalized = format.toLowerCase().replace(/[^a-z0-9]/g, '_');

        // Common transformations
        const map = {
            'qr_code': 'qr_code',
            'ean_13':  'ean_13',
            'ean_8':   'ean_8',
            'code_128': 'code_128',
            'code_39': 'code_39',
            'upc_a':   'upc_a',
            'upc_e':   'upc_e',
            'itf':     'itf',
            'codabar': 'codabar',
            'data_matrix': 'data_matrix',
            'aztec':   'aztec',
            'pdf_417': 'pdf417'
        };

        return map[normalized] || normalized;
    }

    // ─── Manual Input Fallback ─────────────────────────────────────

    /**
     * Mount a manual text input for barcode entry (fallback when camera is unavailable)
     * @private
     */
    _mountManualInput() {
        this._containerEl.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'barcode-scanner-wrapper barcode-scanner-manual';
        wrapper.style.cssText = `
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            gap:16px;padding:32px 24px;
            background:var(--bg-secondary, #f8f9fa);
            border:2px dashed var(--border-color, #dee2e6);
            border-radius:12px;text-align:center;
        `;

        // i18n helper: resolve translated string, returns fallback if key is returned as-is
        const _t = (key, fallback) => {
            if (typeof window.__ === 'function') {
                const result = window.__(key);
                // If i18n returns the key itself, the translation doesn't exist
                if (result && result !== key && !result.startsWith('barcodeScanner.')) {
                    return result;
                }
            }
            return fallback;
        };

        // Icon
        const iconEl = document.createElement('div');
        iconEl.innerHTML = '<i class="ti ti-camera-off" style="font-size:48px;color:var(--text-tertiary,#adb5bd);"></i>';
        wrapper.appendChild(iconEl);

        // Message
        const msgEl = document.createElement('p');
        msgEl.style.cssText = 'margin:0;color:var(--text-secondary,#6c757d);font-size:14px;line-height:1.5;';
        msgEl.textContent = _t(
            'scanner.cameraNotSupportedDesc',
            'Kamera kullanılamadı. Barkodu manuel olarak girebilirsiniz.'
        );
        wrapper.appendChild(msgEl);

        // Input group
        const inputGroup = document.createElement('div');
        inputGroup.style.cssText = 'display:flex;gap:8px;width:100%;max-width:400px;';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-input';
        input.placeholder = _t(
            'scanner.manualPlaceholder',
            'Barkod veya kodu yazın...'
        );
        input.style.cssText = 'flex:1;padding:10px 14px;border:1px solid var(--border-color,#dee2e6);border-radius:8px;font-size:16px;';
        input.setAttribute('inputmode', 'text');
        input.setAttribute('autocomplete', 'off');
        inputGroup.appendChild(input);

        const submitBtn = document.createElement('button');
        submitBtn.type = 'button';
        submitBtn.className = 'btn btn-primary';
        submitBtn.style.cssText = 'padding:10px 20px;border-radius:8px;white-space:nowrap;';
        submitBtn.innerHTML = '<i class="ti ti-search"></i>';
        inputGroup.appendChild(submitBtn);

        wrapper.appendChild(inputGroup);
        this._containerEl.appendChild(wrapper);

        // Handle submit
        const handleSubmit = () => {
            const value = input.value.trim();
            if (!value) return;

            this._handleDetection(value, 'manual');
            if (this._continuous) {
                input.value = '';
                input.focus();
            }
        };

        submitBtn.addEventListener('click', handleSubmit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        });

        this._state = ScannerState.SCANNING;
        Logger.debug('[BarcodeScanner] Manual input mode mounted');

        // Auto-focus
        setTimeout(() => input.focus(), 100);
    }

    // ─── Detection Handling ────────────────────────────────────────

    /**
     * Handle a detected barcode: deduplication, feedback, and callback
     * @private
     * @param {string} rawValue - Decoded barcode content
     * @param {string} format - Barcode format name
     */
    _handleDetection(rawValue, format) {
        if (!rawValue || this._state !== ScannerState.SCANNING) return;

        // Deduplication: ignore same barcode within the dedup window
        const now = Date.now();
        const lastSeen = this._lastScans.get(rawValue);
        if (lastSeen && (now - lastSeen) < this._deduplicateMs) {
            return;
        }
        this._lastScans.set(rawValue, now);

        // Purge old entries to prevent memory leak
        if (this._lastScans.size > 100) {
            const cutoff = now - this._deduplicateMs * 2;
            for (const [key, ts] of this._lastScans) {
                if (ts < cutoff) this._lastScans.delete(key);
            }
        }

        // Visual feedback
        this._flashOverlay();

        // Audio feedback
        if (this._beepOnScan) {
            this._playBeep();
        }

        // Haptic feedback
        if (this._vibrateOnScan) {
            this._vibrate();
        }

        // Build result
        const result = {
            rawValue: rawValue,
            format: format || 'unknown',
            timestamp: now
        };

        Logger.debug('[BarcodeScanner] Detected:', result);

        // Stop if not continuous
        if (!this._continuous) {
            this.pause();
        }

        // Emit to callback
        if (this._onDetectedCb) {
            try {
                this._onDetectedCb(result);
            } catch (err) {
                Logger.error('[BarcodeScanner] onDetected callback error:', err);
            }
        }
    }

    // ─── Feedback ──────────────────────────────────────────────────

    /**
     * Play a short beep sound using Web Audio API
     * @private
     */
    _playBeep() {
        try {
            const ctx = this._audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            this._audioCtx = ctx;

            // Resume AudioContext if suspended (browsers require user gesture)
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.frequency.value = 1800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.15);
        } catch (e) {
            // Audio not available - silently ignore
        }
    }

    /**
     * Vibrate the device briefly
     * @private
     */
    _vibrate() {
        try {
            if (navigator.vibrate) {
                navigator.vibrate(100);
            }
        } catch (e) {
            // Vibration not available - silently ignore
        }
    }

    /**
     * Flash the scan overlay to confirm detection
     * @private
     */
    _flashOverlay() {
        if (!this._overlayEl) return;

        const wrapper = this._overlayEl.closest('.barcode-scanner-wrapper');
        if (wrapper) {
            wrapper.classList.add('barcode-scanner-detected');
            setTimeout(() => wrapper.classList.remove('barcode-scanner-detected'), 300);
        }
    }

    // ─── Error Handling ────────────────────────────────────────────

    /**
     * Detect if an error is camera-related (permission denied, device not found, etc.)
     * html5-qrcode and different browsers throw errors with varying names/messages,
     * so we check both the error name and message content.
     * @private
     * @param {Error|string} err
     * @returns {boolean}
     */
    _isCameraRelatedError(err) {
        if (!err) return false;

        // Standard DOMException error names
        const cameraErrorNames = [
            'NotAllowedError',      // Permission denied
            'NotFoundError',        // No camera device
            'NotReadableError',     // Camera in use by another app
            'OverconstrainedError', // Camera constraints not satisfiable
            'AbortError',           // Camera access aborted
            'SecurityError'         // Insecure context (non-HTTPS)
        ];

        const name = err.name || '';
        if (cameraErrorNames.includes(name)) {
            return true;
        }

        // Check error message for camera-related keywords (library-wrapped errors)
        const msg = (typeof err === 'string' ? err : (err.message || '')).toLowerCase();
        const cameraKeywords = [
            'permission', 'denied', 'not allowed', 'notallowed',
            'camera', 'video', 'mediadevices', 'getusermedia',
            'not found', 'notfound', 'no device', 'no camera',
            'not readable', 'notreadable', 'overconstrained',
            'could not start', 'unable to', 'cannot access',
            'navigator.mediadevices', 'insecure context'
        ];

        return cameraKeywords.some(kw => msg.includes(kw));
    }

    /**
     * Emit an error through the registered callback
     * @private
     * @param {Error} error
     */
    _emitError(error) {
        if (this._onErrorCb) {
            try {
                this._onErrorCb(error);
            } catch (e) {
                Logger.error('[BarcodeScanner] onError callback error:', e);
            }
        }
    }

    // ─── Lifecycle Handlers ────────────────────────────────────────

    /**
     * Handle page visibility change (pause scanning when tab is hidden)
     * @private
     */
    _onVisibilityChange() {
        if (document.hidden) {
            if (this._state === ScannerState.SCANNING) {
                this._stopDetectionLoop();
                this._wasScanning = true;
                Logger.debug('[BarcodeScanner] Page hidden, pausing detection loop');
            }
        } else {
            if (this._wasScanning && this._state === ScannerState.SCANNING) {
                if (this._detectionMethod === 'native') {
                    this._startDetectionLoop();
                }
                this._wasScanning = false;
                Logger.debug('[BarcodeScanner] Page visible, resuming detection loop');
            }
        }
    }

    /**
     * Handle page unload - clean up resources
     * @private
     */
    _onBeforeUnload() {
        this.destroy();
    }
}

export default BarcodeScanner;
