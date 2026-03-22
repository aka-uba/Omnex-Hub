package com.omnex.priceview

import android.annotation.SuppressLint
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.pm.ActivityInfo
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.exoplayer2.ui.PlayerView
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.abs
import kotlin.math.max

// PriceView imports
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.camera.view.PreviewView
import com.omnex.priceview.data.LocalDatabase
import com.omnex.priceview.network.ApiClient
import com.omnex.priceview.overlay.PriceViewOverlayManager
import com.omnex.priceview.print.PrintHelper
import com.omnex.priceview.settings.PriceViewConfig
import com.omnex.priceview.sync.DisplayTemplateSyncManager
import com.omnex.priceview.sync.SyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Omnex Player main activity.
 * Uses WebView to render the web player.
 * Phase 2: Hybrid video playback with ExoPlayer for better performance.
 */
open class MainActivity : AppCompatActivity() {

    companion object {
        private const val PREFS_NAME = "omnex_player"
        private const val PREF_INSTALL_PERMISSION_PROMPTED = "install_permission_prompted"
        private const val PREF_SSL_STRICT_MODE = "ssl_strict_mode"
        private const val PREF_DISPLAY_BRIGHTNESS_OVERRIDE = "display_brightness_override"
        private const val PREF_DISPLAY_CONTRAST_OVERRIDE = "display_contrast_override"
        private const val DISPLAY_BRIGHTNESS_MIN = 0.4f
        private const val DISPLAY_BRIGHTNESS_MAX = 1.0f
        private const val DISPLAY_CONTRAST_MIN = 1.0f
        private const val DISPLAY_CONTRAST_ABSOLUTE_MAX = 1.35f
        private const val DISPLAY_EPSILON = 0.01f
        private const val REQUEST_STORAGE_PERMISSION = 4001
        private const val REQUEST_NOTIFICATIONS_PERMISSION = 4002
        private const val REQUEST_CAMERA_PERMISSION = 4003
        private const val NOTIFICATION_CHANNEL_ID = "omnex_player_commands"
        private const val BARCODE_SCAN_DEBOUNCE_MS = 900L
        private var notificationIdCounter = 1000
    }

    private var webView: WebView? = null
    private var progressBar: ProgressBar? = null
    private var playerView: PlayerView? = null
    private var exoPlayerManager: ExoPlayerManager? = null

    private var lastBackPressAt = 0L
    private val backPressExitWindowMs = 2000L
    private var updateManager: UpdateManager? = null
    private lateinit var performanceProfile: PlayerPerformanceProfile

    // Ã¢Å"â€¦ Watchdog mekanizmasÃ„Â±
    private var playbackWatchdog: android.os.Handler? = null
    private val PLAYBACK_TIMEOUT = 10_000L
    private var isPlaybackActive = false
    private var retryCount = 0
    private var pendingUpdateInfo: UpdateManager.UpdateInfo? = null
    private var waitingForInstallPermission = false
    private var appliedDisplayBrightness = Float.NaN
    private var appliedDisplayContrast = Float.NaN

    // === PriceView Properties ===
    private var priceViewConfig: PriceViewConfig? = null
    private var priceViewDatabase: LocalDatabase? = null
    private var priceViewApiClient: ApiClient? = null
    private var priceViewOverlayManager: PriceViewOverlayManager? = null
    private var printHelper: PrintHelper? = null
    private val priceViewScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val barcodeBuffer = StringBuilder()
    private val barcodeBufferHandler = android.os.Handler(Looper.getMainLooper())
    private var barcodeBufferRunnable: Runnable? = null
    private var hardwareScannerReceiver: android.content.BroadcastReceiver? = null
    private val barcodeLookupInFlight = AtomicBoolean(false)
    private var lastHandledBarcode: String = ""
    private var lastHandledBarcodeAtMs: Long = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            setContentView(R.layout.activity_main)
            enableFullscreen()
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

            webView = findViewById(R.id.webView)
            progressBar = findViewById(R.id.progressBar)
            playerView = findViewById(R.id.playerView)

            if (webView == null || progressBar == null || playerView == null) {
                throw IllegalStateException("Player layout not initialized")
            }

            performanceProfile = PerformanceProfiles.resolve(this)
            android.util.Log.i("OmnexPlayer", "Performance profile: ${performanceProfile.id}")

            handleIncomingDeepLink(intent)
            setupWebView()
            applyDisplayTuning(force = true)
            configureBackHandling()
            if (performanceProfile.eagerExoPlayerInit) {
                setupExoPlayer()
            }
            loadPlayer()
            updateManager = UpdateManager(this)
            requestStartupPermissionsIfNeeded()

            // PriceView initialization
            initPriceView()

            // GÃƒÂ¼ncelleme kontrolÃƒÂ¼ (5 saniye sonra)
            checkForUpdates()
        } catch (error: Throwable) {
            android.util.Log.e("OmnexPlayer", "Startup failure", error)
            showStartupError(error)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val playerWebView = webView ?: return

        // Hardware acceleration (Surface pipeline iÃƒÂ§in)
        val webViewLayerType = if (performanceProfile.useHardwareLayer) {
            View.LAYER_TYPE_HARDWARE
        } else {
            View.LAYER_TYPE_NONE
        }
        playerWebView.setLayerType(webViewLayerType, null)
        playerWebView.setBackgroundColor(android.graphics.Color.BLACK)

        playerWebView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            userAgentString = "$userAgentString OmnexPriceView/${BuildConfig.VERSION_NAME} Android/${Build.VERSION.RELEASE}"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                offscreenPreRaster = performanceProfile.useHardwareLayer
            }
        }

        // Ã¢Å"â€¦ Android TV IME (keyboard) support for input fields
        playerWebView.isFocusable = true
        playerWebView.isFocusableInTouchMode = true
        playerWebView.requestFocus()

        // Key listener moved to interceptWebViewKeyEvents() in initPriceView()
        // Handles barcode scanning + TV remote IME in one place
        playerWebView.setOnKeyListener { _, _, _ -> false // Will be replaced by interceptWebViewKeyEvents()
        }

        playerWebView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                android.util.Log.i("OmnexPlayer", "Loading URL: $url")
                progressBar?.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar?.visibility = View.GONE
                injectBridgeCompatibilityPatch(view)
                injectBarcodeScannerScript(view)  // PriceView: capture hardware scanner events
                injectDeviceTokenBridge(view)    // PriceView: get device token from PWA player
                applyWebViewContrastFilter(resolveDisplayContrast())
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    android.util.Log.e(
                        "OmnexPlayer",
                        "Main frame error url=${request.url} code=${error?.errorCode} desc=${error?.description}"
                    )
                    // Ãƒâ€"zel hata sayfasÃ„Â± gÃƒÂ¶ster
                    showConnectionErrorPage(error?.description?.toString() ?: "Bilinmeyen hata")
                }
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                if (request?.isForMainFrame == true) {
                    val statusCode = errorResponse?.statusCode ?: 0
                    android.util.Log.e(
                        "OmnexPlayer",
                        "HTTP error url=${request.url} status=$statusCode"
                    )
                    // 404 veya diÃ„Å¸er HTTP hatalarÃ„Â± iÃƒÂ§in ÃƒÂ¶zel sayfa
                    if (statusCode in 400..599) {
                        showConnectionErrorPage("HTTP $statusCode - Sunucuya ulasilamiyor")
                    }
                }
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: android.net.http.SslError?
            ) {
                val errorUrl = error?.url ?: ""
                val isLocalNetwork = isLocalNetworkUrl(errorUrl)
                val strictSsl = isStrictSslModeEnabled()

                if (!strictSsl && isLocalNetwork) {
                    // Flexible mode + LAN: allow for self-signed certs on local servers
                    android.util.Log.w(
                        "OmnexPlayer",
                        "SSL warning (LAN) url=$errorUrl primary=${error?.primaryError}; proceeding"
                    )
                    handler?.proceed()
                } else {
                    // Strict mode OR public URL: block invalid SSL cert chain
                    android.util.Log.e(
                        "OmnexPlayer",
                        "SSL error url=$errorUrl primary=${error?.primaryError}; request cancelled (strict=$strictSsl, local=$isLocalNetwork)"
                    )
                    handler?.cancel()
                    showError(getString(R.string.ssl_error_blocked))
                }
            }
        }

        playerWebView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                consoleMessage?.let {
                    android.util.Log.d(
                        "OmnexPlayer",
                        "${it.message()} -- ${it.sourceId()}:${it.lineNumber()}"
                    )
                }
                return true
            }

            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                progressBar?.progress = newProgress
            }
        }

        val bridge = AndroidBridge(this)
        playerWebView.addJavascriptInterface(bridge, "AndroidBridge")
        // Backward compatibility for older web player builds still using window.Android.
        playerWebView.addJavascriptInterface(bridge, "Android")
    }

    private fun injectBridgeCompatibilityPatch(view: WebView?) {
        val webView = view ?: return
        val script = """
            (function () {
                try {
                    if (!window.AndroidBridge && window.Android) { window.AndroidBridge = window.Android; }
                    if (!window.Android && window.AndroidBridge) { window.Android = window.AndroidBridge; }
                    var bridge = window.AndroidBridge || window.Android;
                    if (!bridge || typeof bridge.setOrientation !== 'function') { return; }

                    function patchPlayer() {
                        if (!window.OmnexPlayer) { return false; }
                        var player = window.OmnexPlayer;
                        if (player.__apkOrientationPatch) { return true; }

                        // New player.js already has orientation recovery logic.
                        if (typeof player.getCurrentScreenOrientation === 'function') { return true; }

                        var originalToggle = player.togglePreferredOrientation;
                        player.__apkOrientationPatch = true;
                        player.togglePreferredOrientation = async function () {
                            try {
                                var current = null;
                                if (typeof bridge.getOrientation === 'function') {
                                    current = String(bridge.getOrientation() || '').toLowerCase();
                                }
                                if (current !== 'landscape' && current !== 'portrait') {
                                    current = window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape';
                                }

                                var next = current === 'landscape' ? 'portrait' : 'landscape';
                                bridge.setOrientation(next);

                                this.preferredOrientation = next;
                                try {
                                    if (window.localStorage) {
                                        window.localStorage.setItem('omnex.player.preferredOrientation', next);
                                    }
                                } catch (ignoreStorageError) {}

                                if (typeof this.applyPlaylistOrientation === 'function') {
                                    this.applyPlaylistOrientation();
                                }
                                if (typeof this.updateOrientationToggleState === 'function') {
                                    this.updateOrientationToggleState();
                                }
                                if (typeof this.showToast === 'function') {
                                    this.showToast(next === 'portrait' ? 'Dikey g\\u00f6r\\u00fcn\\u00fcm se\\u00e7ildi' : 'Yatay g\\u00f6r\\u00fcn\\u00fcm se\\u00e7ildi', 'info', 1800);
                                }
                                return;
                            } catch (ignorePatchError) {}

                            if (typeof originalToggle === 'function') {
                                return originalToggle.apply(this, arguments);
                            }
                        };
                        return true;
                    }

                    if (!patchPlayer()) {
                        var attempts = 0;
                        var timer = setInterval(function () {
                            attempts += 1;
                            if (patchPlayer() || attempts >= 20) {
                                clearInterval(timer);
                            }
                        }, 500);
                    }
                } catch (ignoreGlobalError) {}
            })();
        """.trimIndent()
        webView.evaluateJavascript(script, null)
    }

    /**
     * Inject JS barcode scanner into WebView - captures hardware scanner keyboard events
     * and forwards to AndroidBridge.onBarcodeScanned(). Same principle as FiyatGor onScan.js.
     */
    private fun injectBarcodeScannerScript(view: WebView?) {
        val webView = view ?: return
        val script = "(function(){" +
            "if(window._omnexBarcodeInjected)return;" +
            "window._omnexBarcodeInjected=true;" +
            "var buf='',lt=0,tm=null;" +
            "document.addEventListener('keydown',function(e){" +
            "var now=Date.now(),td=now-lt;lt=now;" +
            "if(e.key==='Enter'||e.keyCode===13){" +
            "if(buf.length>=4){e.preventDefault();e.stopPropagation();" +
            "var bc=buf.trim();buf='';" +
            "if(tm){clearTimeout(tm);tm=null;}" +
            "var br=window.AndroidBridge||window.Android;" +
            "if(br&&br.onBarcodeScanned){br.onBarcodeScanned(bc);}}" +
            "buf='';return;}" +
            "if(e.key&&e.key.length===1){" +
            "if(td>200){buf='';}" +
            "buf+=e.key;" +
            "if(tm)clearTimeout(tm);" +
            "tm=setTimeout(function(){" +
            "if(buf.length>=4){var bc=buf.trim();" +
            "var br=window.AndroidBridge||window.Android;" +
            "if(br&&br.onBarcodeScanned){br.onBarcodeScanned(bc);}}" +
            "buf='';},300);}},true);" +
            "console.log('[PriceView] Barcode scanner JS injected');" +
            "})();"
        webView.evaluateJavascript(script, null)
    }

    /**
     * Inject JS to extract device token from PWA player localStorage/IndexedDB
     * and pass it to AndroidBridge.setDeviceToken() for PriceView API auth.
     */
    private var tokenBridgeHandler: android.os.Handler? = null
    private var tokenBridgeRunnable: Runnable? = null

    /**
     * Start periodic token bridge polling.
     * Checks WebView localStorage/IndexedDB every 10s until token is found.
     * Once found, stops polling and triggers initial sync.
     */
    private fun injectDeviceTokenBridge(view: WebView?) {
        val webView = view ?: return
        // Already registered - no need to poll
        if (priceViewConfig?.isDeviceRegistered == true) {
            android.util.Log.i("PriceView", "Token bridge: already registered, triggering sync")
            triggerInitialSyncIfNeeded()
            return
        }

        // Stop any existing polling
        stopTokenBridgePolling()

        val handler = android.os.Handler(mainLooper)
        tokenBridgeHandler = handler

        val script = "(function(){" +
            "try{" +
            "var t=localStorage.getItem('omnex_device_token');" +
            "var d=localStorage.getItem('omnex_device_id');" +
            "var c=localStorage.getItem('omnex_company_id')||'';" +
            "if(t&&d){" +
            "var br=window.AndroidBridge||window.Android;" +
            "if(br&&br.setDeviceToken){br.setDeviceToken(t,d,c);}" +
            "return 'found';" +
            "}" +
            // IndexedDB fallback
            "var r=indexedDB.open('omnex_player_db',1);" +
            "r.onsuccess=function(ev){" +
            "try{var db=ev.target.result;" +
            "var tx=db.transaction('config','readonly');" +
            "var st=tx.objectStore('config');" +
            "var g=st.get('device');" +
            "g.onsuccess=function(){" +
            "var cfg=g.result;" +
            "if(cfg&&cfg.token&&cfg.deviceId){" +
            "var br=window.AndroidBridge||window.Android;" +
            "if(br&&br.setDeviceToken){br.setDeviceToken(cfg.token,cfg.deviceId,cfg.companyId||'');}}" +
            "};}catch(e){}};" +
            "return 'checking';" +
            "}catch(e){return 'error';}" +
            "})();"

        val runnable = object : Runnable {
            override fun run() {
                if (priceViewConfig?.isDeviceRegistered == true) {
                    android.util.Log.i("PriceView", "Token bridge: token acquired, stopping poll")
                    return
                }
                webView.evaluateJavascript(script) { result ->
                    android.util.Log.d("PriceView", "Token bridge poll result: $result")
                }
                handler.postDelayed(this, 10_000) // Retry every 10s
            }
        }
        tokenBridgeRunnable = runnable
        handler.post(runnable)
        android.util.Log.i("PriceView", "Token bridge: started polling (every 10s)")
    }

    private fun stopTokenBridgePolling() {
        tokenBridgeRunnable?.let { tokenBridgeHandler?.removeCallbacks(it) }
        tokenBridgeRunnable = null
        tokenBridgeHandler = null
    }

    /**
     * PHASE 2: Setup ExoPlayer manager for hybrid video playback
     */
    private fun configureBackHandling() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                handleBackPressed()
            }
        })
    }

    private fun handleBackPressed() {
        // PriceView: close camera/overlay first
        if (cameraPipActive) {
            closeCameraFullscreen()
            return
        }
        if (priceViewOverlayManager?.isVisible == true) {
            priceViewOverlayManager?.hide()
            return
        }

        // Double-back to exit (don't use WebView goBack - causes broken states with playlist iframes)
        val now = System.currentTimeMillis()
        if (now - lastBackPressAt <= backPressExitWindowMs) {
            moveTaskToBack(true)
            finishAffinity()
        } else {
            lastBackPressAt = now
            Toast.makeText(this, getString(R.string.back_press_exit_hint), Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Setup ExoPlayer manager for hybrid video playback.
     */
    private fun setupExoPlayer() {
        if (exoPlayerManager != null) {
            return
        }

        val webViewInstance = webView
        val playerViewInstance = playerView

        if (webViewInstance == null || playerViewInstance == null) {
            android.util.Log.e("OmnexPlayer", "Cannot setup ExoPlayer: views not initialized")
            return
        }

        try {
            exoPlayerManager = ExoPlayerManager(
                context = this,
                playerView = playerViewInstance,
                webView = webViewInstance,
                onPlaybackError = { error ->
                    android.util.Log.w("ExoPlayer", "Playback error, falling back to WebView: $error")
                    // Silent fallback - no user-visible Toast (WebView handles it)
                }
            )

            exoPlayerManager?.initialize()
            android.util.Log.i("OmnexPlayer", "ExoPlayer hybrid mode initialized")
        } catch (e: Exception) {
            android.util.Log.e("OmnexPlayer", "Failed to setup ExoPlayer, will use WebView only", e)
        }
    }

    private fun loadPlayer() {
        val targetUrl = getPlayerLoadUrl()
        android.util.Log.i("OmnexPlayer", "loadPlayer -> $targetUrl")
        webView?.loadUrl(targetUrl)
    }

    private fun getPlayerLoadUrl(): String {
        val baseUrl = getServerUrl()
        return Uri.parse(baseUrl)
            .buildUpon()
            .appendQueryParameter("perf_profile", performanceProfile.id)
            .appendQueryParameter("heartbeat", performanceProfile.heartbeatSeconds.toString())
            .appendQueryParameter("sync", performanceProfile.syncSeconds.toString())
            .appendQueryParameter("verify_ms", performanceProfile.verifyPollingMs.toString())
            .appendQueryParameter("precache", if (performanceProfile.enableMediaPrecache) "1" else "0")
            .appendQueryParameter("sw", if (performanceProfile.enableServiceWorker) "1" else "0")
            .build()
            .toString()
    }

    private fun ensureExoPlayerInitialized(): ExoPlayerManager? {
        if (exoPlayerManager != null) {
            return exoPlayerManager
        }

        if (Looper.myLooper() == Looper.getMainLooper()) {
            setupExoPlayer()
            return exoPlayerManager
        }

        val latch = CountDownLatch(1)
        runOnUiThread {
            try {
                setupExoPlayer()
            } finally {
                latch.countDown()
            }
        }

        if (!latch.await(2, TimeUnit.SECONDS)) {
            android.util.Log.w("OmnexPlayer", "Timed out while waiting for ExoPlayer initialization")
            return null
        }

        return exoPlayerManager
    }

    private fun resolveDisplayBrightness(): Float {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val overrideValue = prefs.getFloat(PREF_DISPLAY_BRIGHTNESS_OVERRIDE, Float.NaN)
        val baseValue = if (overrideValue.isFinite()) overrideValue else performanceProfile.displayBrightness
        return baseValue.coerceIn(DISPLAY_BRIGHTNESS_MIN, DISPLAY_BRIGHTNESS_MAX)
    }

    private fun resolveDisplayContrast(): Float {
        if (!performanceProfile.enableContrastTuning) {
            return 1.0f
        }

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val overrideValue = prefs.getFloat(PREF_DISPLAY_CONTRAST_OVERRIDE, Float.NaN)
        val profileValue = performanceProfile.displayContrast
        val baseValue = if (overrideValue.isFinite()) overrideValue else profileValue
        val safeMax = DISPLAY_CONTRAST_ABSOLUTE_MAX
        return baseValue.coerceIn(DISPLAY_CONTRAST_MIN, safeMax)
    }

    private fun createContrastPaint(contrast: Float): Paint? {
        if (abs(contrast - 1.0f) < DISPLAY_EPSILON) {
            return null
        }

        val translate = (1.0f - contrast) * 128.0f
        val matrix = android.graphics.ColorMatrix(
            floatArrayOf(
                contrast, 0f, 0f, 0f, translate,
                0f, contrast, 0f, 0f, translate,
                0f, 0f, contrast, 0f, translate,
                0f, 0f, 0f, 1f, 0f
            )
        )

        return Paint().apply {
            isFilterBitmap = true
            colorFilter = ColorMatrixColorFilter(matrix)
        }
    }

    private fun applyWindowBrightness(brightness: Float) {
        if (abs(appliedDisplayBrightness - brightness) < DISPLAY_EPSILON) {
            return
        }

        val params = window.attributes
        params.screenBrightness = brightness
        window.attributes = params
        appliedDisplayBrightness = brightness
    }

    private fun applyPlayerViewContrast(contrast: Float) {
        val targetPlayerView = playerView ?: return
        val paint = createContrastPaint(contrast)
        if (paint == null) {
            targetPlayerView.setLayerType(View.LAYER_TYPE_NONE, null)
            return
        }
        targetPlayerView.setLayerType(View.LAYER_TYPE_HARDWARE, paint)
    }

    private fun applyWebViewContrastFilter(contrast: Float) {
        val targetWebView = webView ?: return
        val paint = createContrastPaint(contrast)
        if (paint == null) {
            val baseLayerType = if (performanceProfile.useHardwareLayer) {
                View.LAYER_TYPE_HARDWARE
            } else {
                View.LAYER_TYPE_NONE
            }
            targetWebView.setLayerType(baseLayerType, null)
            return
        }
        targetWebView.setLayerType(View.LAYER_TYPE_HARDWARE, paint)
    }

    private fun applyDisplayTuning(force: Boolean = false) {
        val brightness = resolveDisplayBrightness()
        val contrast = resolveDisplayContrast()

        val brightnessChanged = force || !appliedDisplayBrightness.isFinite() || abs(appliedDisplayBrightness - brightness) >= DISPLAY_EPSILON
        val contrastChanged = force || !appliedDisplayContrast.isFinite() || abs(appliedDisplayContrast - contrast) >= DISPLAY_EPSILON

        if (brightnessChanged) {
            applyWindowBrightness(brightness)
        }

        if (contrastChanged) {
            applyPlayerViewContrast(contrast)
            applyWebViewContrastFilter(contrast)
            appliedDisplayContrast = contrast
        }
    }

    private fun setDisplayTuningOverride(brightness: Double, contrast: Double): Boolean {
        val brightnessValue = if (brightness.isFinite()) {
            brightness.toFloat().coerceIn(DISPLAY_BRIGHTNESS_MIN, DISPLAY_BRIGHTNESS_MAX)
        } else {
            resolveDisplayBrightness()
        }

        val contrastValue = if (performanceProfile.enableContrastTuning && contrast.isFinite()) {
            val safeMax = DISPLAY_CONTRAST_ABSOLUTE_MAX
            contrast.toFloat().coerceIn(DISPLAY_CONTRAST_MIN, safeMax)
        } else {
            resolveDisplayContrast()
        }

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putFloat(PREF_DISPLAY_BRIGHTNESS_OVERRIDE, brightnessValue)
            .putFloat(PREF_DISPLAY_CONTRAST_OVERRIDE, contrastValue)
            .apply()

        runOnUiThread {
            applyDisplayTuning(force = true)
        }
        return true
    }

    private fun clearDisplayTuningOverride(): Boolean {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .remove(PREF_DISPLAY_BRIGHTNESS_OVERRIDE)
            .remove(PREF_DISPLAY_CONTRAST_OVERRIDE)
            .apply()

        runOnUiThread {
            applyDisplayTuning(force = true)
        }
        return true
    }

    private fun getDisplayTuningJson(): String {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val overrideBrightness = prefs.getFloat(PREF_DISPLAY_BRIGHTNESS_OVERRIDE, Float.NaN)
        val overrideContrast = prefs.getFloat(PREF_DISPLAY_CONTRAST_OVERRIDE, Float.NaN)
        val brightness = resolveDisplayBrightness()
        val contrast = resolveDisplayContrast()
        val profileMaxContrast = DISPLAY_CONTRAST_ABSOLUTE_MAX
        val overrideBrightnessStr = if (overrideBrightness.isFinite()) {
            String.format(Locale.US, "%.3f", overrideBrightness)
        } else {
            "null"
        }
        val overrideContrastStr = if (overrideContrast.isFinite()) {
            String.format(Locale.US, "%.3f", overrideContrast)
        } else {
            "null"
        }

        return """
            {
                "brightness": ${String.format(Locale.US, "%.3f", brightness)},
                "contrast": ${String.format(Locale.US, "%.3f", contrast)},
                "profileBrightness": ${String.format(Locale.US, "%.3f", performanceProfile.displayBrightness)},
                "profileContrast": ${String.format(Locale.US, "%.3f", performanceProfile.displayContrast)},
                "profileMaxContrast": ${String.format(Locale.US, "%.3f", profileMaxContrast)},
                "contrastEnabled": ${performanceProfile.enableContrastTuning},
                "overrideBrightness": $overrideBrightnessStr,
                "overrideContrast": $overrideContrastStr
            }
        """.trimIndent()
    }

    private fun setWebViewTransparency(enabled: Boolean) {
        runOnUiThread {
            webView?.setBackgroundColor(
                if (enabled) Color.TRANSPARENT else Color.BLACK
            )
            applyWebViewContrastFilter(resolveDisplayContrast())
        }
    }

    private fun applyPerformanceProfileOverride(profileId: String): Boolean {
        val applied = PerformanceProfiles.setOverride(this, profileId)
        if (!applied) {
            return false
        }

        performanceProfile = PerformanceProfiles.resolve(this)
        android.util.Log.i("OmnexPlayer", "Performance profile changed: ${performanceProfile.id}")

        if (performanceProfile.eagerExoPlayerInit) {
            setupExoPlayer()
        } else {
            exoPlayerManager?.release()
            exoPlayerManager = null
        }

        applyDisplayTuning(force = true)

        runOnUiThread {
            loadPlayer()
        }
        return true
    }

    private fun showError(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    /**
     * BaÃ„Å¸lantÃ„Â± hatasÃ„Â± veya 404 durumunda ÃƒÂ¶zel hata sayfasÃ„Â± gÃƒÂ¶ster
     */
    private fun showConnectionErrorPage(errorMessage: String) {
        val serverUrl = getServerUrl()
        val errorHtml = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    :root { color-scheme: dark; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: "Segoe UI", "Noto Sans", sans-serif;
                        background:
                            radial-gradient(circle at 15% 20%, rgba(65, 126, 210, 0.5), transparent 30%),
                            radial-gradient(circle at 85% 80%, rgba(61, 195, 192, 0.35), transparent 28%),
                            linear-gradient(145deg, #061121 0%, #0A1D37 45%, #08162A 100%);
                        color: #F5F9FF;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        padding: clamp(1rem, 2vw, 2rem);
                    }
                    .error-container {
                        width: min(1100px, 96vw);
                        text-align: center;
                        padding: clamp(1.4rem, 2.6vw, 2.4rem);
                        border-radius: 28px;
                        border: 1px solid rgba(134, 189, 255, 0.38);
                        background: linear-gradient(180deg, rgba(19, 44, 79, 0.88), rgba(11, 25, 47, 0.9));
                        box-shadow: 0 20px 55px rgba(0, 0, 0, 0.36);
                    }
                    .brand-chip {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: clamp(0.75rem, 1.2vw, 1.2rem);
                        padding: 0.4rem 1rem;
                        border-radius: 999px;
                        font-size: clamp(0.85rem, 1vw, 1.1rem);
                        font-weight: 700;
                        letter-spacing: 0.03em;
                        color: #DFF1FF;
                        background: rgba(62, 124, 207, 0.25);
                        border: 1px solid rgba(133, 192, 255, 0.45);
                    }
                    .error-icon {
                        width: clamp(72px, 8vw, 108px);
                        height: clamp(72px, 8vw, 108px);
                        margin: 0 auto clamp(1.2rem, 1.7vw, 1.7rem);
                        border-radius: 50%;
                        display: grid;
                        place-items: center;
                        font-size: clamp(2rem, 3vw, 3rem);
                        font-weight: 800;
                        color: #8DD9FF;
                        border: 2px solid rgba(141, 217, 255, 0.55);
                        background: radial-gradient(circle at 40% 35%, rgba(73, 161, 244, 0.4), rgba(20, 53, 96, 0.72));
                    }
                    h1 {
                        font-size: clamp(2rem, 4.2vw, 3.9rem);
                        margin-bottom: clamp(0.75rem, 1.4vw, 1.2rem);
                        color: #E9F5FF;
                        letter-spacing: 0.01em;
                    }
                    .error-message {
                        font-size: clamp(1.1rem, 2.2vw, 2.05rem);
                        margin-bottom: clamp(0.75rem, 1.2vw, 1.1rem);
                        color: #CADAF1;
                        line-height: 1.35;
                    }
                    .server-url {
                        background: rgba(7, 17, 34, 0.68);
                        border: 1px solid rgba(118, 170, 233, 0.42);
                        padding: clamp(0.85rem, 1.8vw, 1.2rem) clamp(1rem, 2vw, 1.4rem);
                        border-radius: 14px;
                        font-family: Consolas, Menlo, Monaco, monospace;
                        font-size: clamp(0.95rem, 1.8vw, 1.7rem);
                        margin: clamp(1rem, 1.8vw, 1.8rem) 0;
                        color: #D8EAFF;
                        word-break: break-all;
                    }
                    .retry-info {
                        margin-top: clamp(1.1rem, 2.1vw, 2rem);
                        padding: clamp(0.95rem, 1.7vw, 1.4rem);
                        border-radius: 16px;
                        font-size: clamp(1.15rem, 2vw, 1.9rem);
                        font-weight: 700;
                        color: #A9ECFF;
                        background: linear-gradient(90deg, rgba(29, 94, 153, 0.34), rgba(29, 153, 153, 0.2));
                        border: 1px solid rgba(130, 214, 255, 0.34);
                    }
                    .spinner {
                        display: inline-flex;
                        width: clamp(20px, 2vw, 30px);
                        height: clamp(20px, 2vw, 30px);
                        border: 3px solid rgba(211, 236, 255, 0.35);
                        border-top-color: #7AE3FF;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin-right: 0.7rem;
                        vertical-align: middle;
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                    .help-text {
                        margin-top: clamp(1.1rem, 2.1vw, 2rem);
                        font-size: clamp(0.95rem, 1.5vw, 1.45rem);
                        color: #AFC4E2;
                        line-height: 1.5;
                    }
                    @media (max-width: 860px) {
                        .error-container {
                            border-radius: 20px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <div class="brand-chip">Omnex Player</div>
                    <div class="error-icon">!</div>
                    <h1>Sunucuya ulasilamiyor</h1>
                    <p class="error-message">$errorMessage</p>
                    <div class="server-url">$serverUrl</div>
                    <div class="retry-info">
                        <span class="spinner"></span>
                        <span>Playlist baglantisi 5 saniye icinde yeniden denenecek...</span>
                    </div>
                    <p class="help-text">
                        Sorun devam ederse: Sunucu adresini, internet baglantisini ve sunucu durumunu kontrol edin.
                    </p>
                </div>
                <script>
                    setTimeout(function() {
                        window.location.reload();
                    }, 5000);
                </script>
            </body>
            </html>
        """.trimIndent()

        webView?.loadDataWithBaseURL(null, errorHtml, "text/html", "UTF-8", null)
    }

    private fun showStartupError(error: Throwable) {
        setContentView(R.layout.activity_startup_error)

        val errorText = findViewById<TextView>(R.id.errorText)
        val retryButton = findViewById<Button>(R.id.retryButton)
        val wizardButton = findViewById<Button>(R.id.wizardButton)

        errorText.text = getString(
            R.string.startup_error_message,
            error.message ?: getString(R.string.unknown_error)
        )

        retryButton.setOnClickListener {
            recreate()
        }

        wizardButton.setOnClickListener {
            startActivity(Intent(this, WizardActivity::class.java))
            finish()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (handleIncomingDeepLink(intent)) {
            loadPlayer()
        }
    }

    private fun getServerUrl(): String {
        val prefs = getSharedPreferences("omnex_player", MODE_PRIVATE)
        val savedUrl = prefs.getString("server_url", null)?.trim()
        return normalizeServerUrl(if (!savedUrl.isNullOrEmpty()) savedUrl else BuildConfig.SERVER_URL)
    }

    private fun handleIncomingDeepLink(intent: Intent?): Boolean {
        val rawUrl = extractPlayerUrlFromIntent(intent) ?: return false
        val normalized = normalizeServerUrl(rawUrl)

        if (!(normalized.startsWith("http://") || normalized.startsWith("https://"))) {
            android.util.Log.w("OmnexPlayer", "Ignored unsupported deep link URL: $normalized")
            return false
        }

        val prefs = getSharedPreferences("omnex_player", MODE_PRIVATE)
        val currentUrl = prefs.getString("server_url", null)?.trim()
        if (currentUrl == normalized) {
            return false
        }

        prefs.edit()
            .putString("server_url", normalized)
            .putBoolean("first_run", false)
            .apply()

        Toast.makeText(this, getString(R.string.player_url_updated), Toast.LENGTH_SHORT).show()
        android.util.Log.i("OmnexPlayer", "Player URL updated from deep link: $normalized")
        return true
    }

    private fun extractPlayerUrlFromIntent(intent: Intent?): String? {
        if (intent?.action != Intent.ACTION_VIEW) {
            return null
        }

        val data = intent.data ?: return null

        val queryKeys = listOf("url", "playerUrl", "server", "server_url", "path")
        for (key in queryKeys) {
            val value = data.getQueryParameter(key)
            if (!value.isNullOrBlank()) {
                return Uri.decode(value.trim())
            }
        }

        if (data.scheme.equals("http", ignoreCase = true) || data.scheme.equals("https", ignoreCase = true)) {
            return data.toString()
        }

        if (data.scheme.equals("omnexpriceview", ignoreCase = true)) {
            val encodedPath = data.encodedPath?.trim('/')
            if (!encodedPath.isNullOrBlank()) {
                return Uri.decode(encodedPath)
            }
        }

        return null
    }

    private fun normalizeServerUrl(rawUrl: String): String {
        var url = rawUrl.trim()
        if (url.startsWith("/")) {
            val prefs = getSharedPreferences("omnex_player", MODE_PRIVATE)
            val baseCandidates = listOf(
                prefs.getString("server_url", null),
                BuildConfig.SERVER_URL
            )
            val origin = baseCandidates
                .mapNotNull { extractOrigin(it) }
                .firstOrNull()

            if (!origin.isNullOrBlank()) {
                url = origin + url
            }
        }
        if (url.isEmpty()) {
            return BuildConfig.SERVER_URL
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            val hostCandidate = url
                .substringBefore('/')
                .substringBefore('?')
                .substringBefore('#')
                .substringBefore('@')
                .substringBefore(':')
            val scheme = if (isLikelyLocalHost(hostCandidate)) "http" else "https"
            url = "$scheme://$url"
        }
        if (!url.endsWith("/")) {
            url += "/"
        }
        return url
    }

    private fun isStrictSslModeEnabled(): Boolean {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        if (prefs.contains(PREF_SSL_STRICT_MODE)) {
            return prefs.getBoolean(PREF_SSL_STRICT_MODE, true)
        }

        // Local network setups often use self-signed certs; keep strict mode off by default there.
        return !isLocalNetworkUrl(getServerUrl())
    }

    private fun setStrictSslModeEnabled(enabled: Boolean) {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        prefs.edit().putBoolean(PREF_SSL_STRICT_MODE, enabled).apply()
    }

    /**
     * Check if a URL points to a local network (LAN) address.
     * LAN URLs can use flexible SSL mode for self-signed certificates.
     * Public URLs always require valid SSL certificates.
     */
    private fun isLocalNetworkUrl(url: String): Boolean {
        val uri = Uri.parse(url)
        val host = uri.host ?: return false
        return isLikelyLocalHost(host)
    }

    private fun isLikelyLocalHost(host: String): Boolean {
        val normalized = host.trim().lowercase()
        if (normalized.isEmpty()) return false

        if (normalized == "localhost" || normalized == "127.0.0.1" || normalized == "::1") {
            return true
        }

        if (normalized.endsWith(".local")) {
            return true
        }

        if (normalized.startsWith("10.") || normalized.startsWith("192.168.")) {
            return true
        }

        if (normalized.startsWith("172.")) {
            val parts = normalized.split('.')
            val secondOctet = parts.getOrNull(1)?.toIntOrNull()
            if (secondOctet != null && secondOctet in 16..31) {
                return true
            }
        }

        return false
    }

    private fun extractOrigin(rawUrl: String?): String? {
        if (rawUrl.isNullOrBlank()) return null

        var value = rawUrl.trim()
        if (value.startsWith("/")) return null
        if (!value.startsWith("http://") && !value.startsWith("https://")) {
            val hostCandidate = value
                .substringBefore('/')
                .substringBefore('?')
                .substringBefore('#')
                .substringBefore('@')
                .substringBefore(':')
            val scheme = if (isLikelyLocalHost(hostCandidate)) "http" else "https"
            value = "$scheme://$value"
        }

        val uri = Uri.parse(value)
        val host = uri.host ?: return null
        return buildString {
            append(uri.scheme ?: "https")
            append("://")
            append(host)
            if (uri.port != -1) {
                append(":")
                append(uri.port)
            }
        }
    }

    private fun enableFullscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val controller = window.insetsController
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_FULLSCREEN
                    )
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
            )
        }
    }

    /**
     * dispatchKeyEvent intercepts ALL key events BEFORE WebView gets them.
     * This ensures barcode scanner works regardless of content type
     * (video, HTML template, image, web page, iframe).
     */
    override fun dispatchKeyEvent(event: KeyEvent?): Boolean {
        if (event == null) return super.dispatchKeyEvent(event)
        val keyCode = event.keyCode

        if (event.action == KeyEvent.ACTION_DOWN) {
            // BACK: close camera > overlay > double-back exit
            if (keyCode == KeyEvent.KEYCODE_BACK) {
                handleBackPressed()
                return true
            }

            // D-pad CENTER/ENTER: hide overlay if visible
            if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
                // If barcode buffer has data, Enter = process barcode
                if (barcodeBuffer.isNotEmpty()) {
                    barcodeBufferRunnable?.let { barcodeBufferHandler.removeCallbacks(it) }
                    processHardwareBarcodeBuffer()
                    return true
                }
                if (priceViewOverlayManager?.isVisible == true) {
                    priceViewOverlayManager?.hide()
                    return true
                }
            }

            // D-pad navigation when overlay visible
            if (priceViewOverlayManager?.isVisible == true) {
                when (keyCode) {
                    KeyEvent.KEYCODE_DPAD_UP -> { priceViewOverlayManager?.scrollUp(); return true }
                    KeyEvent.KEYCODE_DPAD_DOWN -> { priceViewOverlayManager?.scrollDown(); return true }
                }
            }

            // Hardware barcode scanner: numeric/alpha keys -> buffer
            // Intercept BEFORE WebView to prevent typing into HTML forms/iframes
            if (keyCode in KeyEvent.KEYCODE_0..KeyEvent.KEYCODE_9 ||
                keyCode in KeyEvent.KEYCODE_A..KeyEvent.KEYCODE_Z) {
                val char = event.unicodeChar.toChar()
                if (char.isLetterOrDigit()) {
                    barcodeBuffer.append(char)
                    barcodeBufferRunnable?.let { barcodeBufferHandler.removeCallbacks(it) }
                    barcodeBufferRunnable = Runnable { processHardwareBarcodeBuffer() }
                    barcodeBufferHandler.postDelayed(barcodeBufferRunnable!!, 300)
                    return true  // Consume - don't let WebView/iframe see it
                }
            }
        }

        return super.dispatchKeyEvent(event)
    }

    // Keep onKeyDown as fallback for non-dispatch scenarios
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && event?.action == KeyEvent.ACTION_DOWN) {
            handleBackPressed()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
        exoPlayerManager?.resume()
        // Restore correct volume based on overlay/camera state
        if (priceViewOverlayManager?.isVisible == true || cameraPipActive) {
            exoPlayerManager?.setVolume(0f)
        } else {
            exoPlayerManager?.setVolume(1f)
        }
        applyDisplayTuning(force = true)
        enableFullscreen()

        if (waitingForInstallPermission) {
            waitingForInstallPermission = false
            val pendingInfo = pendingUpdateInfo ?: return
            val manager = updateManager ?: UpdateManager(this).also { updateManager = it }
            if (manager.canInstallPackages()) {
                val started = manager.downloadAndInstall(pendingInfo)
                if (started) {
                    pendingUpdateInfo = null
                } else {
                    waitingForInstallPermission = true
                }
            } else {
                showUpdateDialog(pendingInfo)
            }
        }
    }

    override fun onPause() {
        super.onPause()
        webView?.onPause()
        exoPlayerManager?.pause()
        playbackWatchdog?.removeCallbacksAndMessages(null)
        isPlaybackActive = false
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode == REQUEST_NOTIFICATIONS_PERMISSION) {
            val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                Toast.makeText(this, getString(R.string.notification_permission_denied), Toast.LENGTH_SHORT).show()
            }
            return
        }

        if (requestCode == REQUEST_STORAGE_PERMISSION) {
            val granted = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
            if (!granted) {
                Toast.makeText(this, getString(R.string.storage_permission_denied), Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onBackPressed() {
        handleBackPressed()
    }

    override fun onDestroy() {
        // PriceView cleanup
        stopTokenBridgePolling()
        stopCameraScanning()
        try { hardwareScannerReceiver?.let { unregisterReceiver(it) } } catch (e: Exception) {}
        hardwareScannerReceiver = null
        priceViewOverlayManager?.destroy()
        priceViewOverlayManager = null
        printHelper?.dispose()
        printHelper = null
        barcodeBufferHandler.removeCallbacksAndMessages(null)

        // Ã¢Å"â€¦ PHASE 2: Release ExoPlayer resources
        exoPlayerManager?.release()
        exoPlayerManager = null
        playbackWatchdog?.removeCallbacksAndMessages(null)
        playbackWatchdog = null

        webView?.destroy()
        webView = null
        super.onDestroy()
    }

    /**
     * GÃƒÂ¼ncelleme kontrolÃƒÂ¼ yap (5 saniye gecikme ile)
     */
    private fun requestStartupPermissionsIfNeeded() {
        createNotificationChannel()
        requestAllPermissionsAtOnce()
        promptInstallPermissionIfNeeded()
    }

    /**
     * Request ALL runtime permissions in a single dialog.
     * Android only shows one permission dialog at a time - calling requestPermissions
     * multiple times causes later calls to be silently ignored.
     * Combines: Camera, Notifications (Android 13+), Media (Android 13+), Storage (legacy).
     */
    private fun requestAllPermissionsAtOnce() {
        val permissionsNeeded = mutableListOf<String>()

        // Camera (barcode scanning)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.CAMERA)
        }

        // Notifications (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS)
            }
            // Media images (gallery barcode picker, Android 13+)
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES)
                != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_MEDIA_IMAGES)
            }
        }

        // Legacy storage (Android 9 and below)
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }

        if (permissionsNeeded.isNotEmpty()) {
            android.util.Log.i("PriceView", "Requesting ${permissionsNeeded.size} permissions: $permissionsNeeded")
            ActivityCompat.requestPermissions(
                this,
                permissionsNeeded.toTypedArray(),
                REQUEST_CAMERA_PERMISSION
            )
        }
    }

    // requestNotificationPermissionIfNeeded() removed - merged into requestAllPermissionsAtOnce()

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Omnex Player Bildirimleri",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Uzaktan komut ve durum bildirimleri"
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
        }
    }

    fun postSystemNotification(title: String, body: String, type: String) {
        val iconRes = when (type) {
            "success" -> android.R.drawable.ic_dialog_info
            "warning" -> android.R.drawable.ic_dialog_alert
            "error" -> android.R.drawable.ic_dialog_alert
            else -> android.R.drawable.ic_dialog_info
        }

        val intent = Intent(this, this::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager?.notify(notificationIdCounter++, builder.build())
    }

    // requestLegacyStoragePermissionIfNeeded() removed - merged into requestAllPermissionsAtOnce()

    private fun promptInstallPermissionIfNeeded() {
        if (!BuildConfig.SELF_UPDATE_ENABLED) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = updateManager ?: UpdateManager(this).also { updateManager = it }
        if (manager.canInstallPackages()) return

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        if (prefs.getBoolean(PREF_INSTALL_PERMISSION_PROMPTED, false)) return

        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(getString(R.string.update_permission_title))
            .setMessage(getString(R.string.update_permission_message))
            .setPositiveButton(getString(R.string.open_settings)) { _, _ ->
                prefs.edit().putBoolean(PREF_INSTALL_PERMISSION_PROMPTED, true).apply()
                manager.openInstallPermissionSettings()
            }
            .setNegativeButton(getString(R.string.later)) { _, _ ->
                prefs.edit().putBoolean(PREF_INSTALL_PERMISSION_PROMPTED, true).apply()
            }
            .show()
    }

    private fun checkForUpdates() {
        // Play Store build: guncelleme Play Store tarafindan yonetilir
        if (!BuildConfig.SELF_UPDATE_ENABLED) {
            android.util.Log.i("UpdateManager", "Self-update disabled (Play Store build)")
            return
        }

        android.util.Log.i("UpdateManager", "Scheduling update check in ${performanceProfile.updateCheckDelayMs}ms (webView=${webView != null})")

        // Use Handler instead of webView?.postDelayed to avoid null webView issue
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            val manager = updateManager ?: UpdateManager(this).also { updateManager = it }
            manager.checkForUpdates { updateInfo ->
                runOnUiThread {
                    if (updateInfo != null) {
                        showUpdateDialog(updateInfo)
                    }
                }
            }
        }, performanceProfile.updateCheckDelayMs)
    }

    /**
     * GÃƒÂ¼ncelleme diyalogu gÃƒÂ¶ster
     */
    private fun showUpdateDialog(updateInfo: UpdateManager.UpdateInfo) {
        val updateBody = getString(
            R.string.update_available_body,
            updateInfo.versionName,
            BuildConfig.VERSION_NAME
        )
        val fullMessage = if (updateInfo.releaseNotes.isNotEmpty()) {
            "$updateBody\n\n${getString(R.string.update_what_is_new)}\n${updateInfo.releaseNotes}"
        } else {
            updateBody
        }

        val dialog = androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(getString(R.string.update_available_title))
            .setMessage(fullMessage)
            .setPositiveButton(getString(R.string.update_now)) { _, _ ->
                val manager = updateManager ?: UpdateManager(this).also { updateManager = it }
                pendingUpdateInfo = updateInfo
                val started = manager.downloadAndInstall(updateInfo)
                waitingForInstallPermission = !started
                if (started) {
                    pendingUpdateInfo = null
                }
            }
            .setCancelable(!updateInfo.mandatory)

        if (!updateInfo.mandatory) {
            dialog.setNegativeButton(getString(R.string.later), null)
        }

        dialog.show()
    }

    /**
     * Functions callable from JavaScript.
     */
    class AndroidBridge(private val activity: MainActivity) {
        /**
         * Called from WebView JS when hardware barcode scanner sends keyboard events.
         */
        @JavascriptInterface
        fun onBarcodeScanned(barcode: String) {
            android.util.Log.i("PriceView", "Barcode from WebView JS: $barcode")
            activity.runOnUiThread {
                activity.handleBarcodeScanned(barcode)
            }
        }

        /**
         * Called from WebView JS to pass device token from PWA player to PriceView native.
         * PWA player stores token in localStorage after device approval.
         */
        @JavascriptInterface
        fun setDeviceToken(token: String, deviceId: String, companyId: String) {
            android.util.Log.i("PriceView", "Device token received from WebView (deviceId: $deviceId)")
            activity.priceViewConfig?.deviceToken = token
            activity.priceViewConfig?.deviceId = deviceId
            activity.priceViewConfig?.companyId = companyId
            // Trigger initial sync now that we have a token
            activity.runOnUiThread {
                activity.triggerInitialSyncIfNeeded()
            }
        }

        /**
         * Called from player command flow to trigger immediate PriceView sync.
         * Returns true when request is accepted.
         */
        @JavascriptInterface
        fun triggerPriceViewSyncNow(): Boolean {
            return try {
                activity.runOnUiThread {
                    activity.triggerPriceViewInstantSync("remote_command")
                }
                true
            } catch (e: Exception) {
                android.util.Log.w("PriceView", "triggerPriceViewSyncNow failed: ${e.message}")
                false
            }
        }

        @JavascriptInterface
        fun getDeviceInfo(): String {
            return """
                {
                    "model": "${Build.MODEL}",
                    "manufacturer": "${Build.MANUFACTURER}",
                    "brand": "${Build.BRAND}",
                    "device": "${Build.DEVICE}",
                    "product": "${Build.PRODUCT}",
                    "androidVersion": "${Build.VERSION.RELEASE}",
                    "sdkVersion": ${Build.VERSION.SDK_INT},
                    "appVersion": "${BuildConfig.VERSION_NAME}",
                    "isTV": ${activity.packageManager.hasSystemFeature("android.software.leanback")},
                    "performanceProfile": "${activity.performanceProfile.id}"
                }
            """.trimIndent()
        }

        @JavascriptInterface
        fun showToast(message: String) {
            activity.runOnUiThread {
                Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun showSystemNotification(title: String, body: String, type: String) {
            activity.runOnUiThread {
                activity.postSystemNotification(title, body, type)
            }
        }

        /**
         * Set screen orientation from JavaScript.
         * @param orientation "landscape", "portrait", or "auto"
         */
        @JavascriptInterface
        fun setOrientation(orientation: String) {
            activity.runOnUiThread {
                val requested = when (orientation.lowercase().trim()) {
                    "landscape", "yatay", "l" -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    "portrait", "dikey", "p" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    else -> ActivityInfo.SCREEN_ORIENTATION_FULL_USER
                }
                activity.requestedOrientation = requested
                android.util.Log.i("OmnexPlayer", "Orientation set to: $orientation ($requested)")
            }
        }

        /**
         * Get current screen orientation.
         * @return "landscape" or "portrait"
         */
        @JavascriptInterface
        fun getOrientation(): String {
            return when (activity.resources.configuration.orientation) {
                Configuration.ORIENTATION_PORTRAIT -> "portrait"
                else -> "landscape"
            }
        }

        @JavascriptInterface
        fun keepScreenOn(enable: Boolean) {
            activity.runOnUiThread {
                if (enable) {
                    activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                } else {
                    activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                }
            }
        }

        @JavascriptInterface
        fun reloadPage() {
            activity.runOnUiThread {
                activity.webView?.reload()
            }
        }

        @JavascriptInterface
        fun getAppVersion(): String {
            return BuildConfig.VERSION_NAME
        }

        @JavascriptInterface
        fun getAppVersionCode(): Int {
            return BuildConfig.VERSION_CODE
        }

        @JavascriptInterface
        fun setStrictSslMode(enabled: Boolean) {
            activity.setStrictSslModeEnabled(enabled)
            activity.runOnUiThread {
                Toast.makeText(
                    activity,
                    if (enabled) "SSL strict mod aktif" else "SSL esnek mod aktif",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }

        @JavascriptInterface
        fun getStrictSslMode(): Boolean {
            return activity.isStrictSslModeEnabled()
        }

        @JavascriptInterface
        fun getPerformanceProfile(): String {
            val overrideProfile = PerformanceProfiles.getOverride(activity) ?: "auto"
            val profile = activity.performanceProfile
            return """
                {
                    "active": "${profile.id}",
                    "override": "$overrideProfile",
                    "useHardwareLayer": ${profile.useHardwareLayer},
                    "eagerExoPlayerInit": ${profile.eagerExoPlayerInit},
                    "enableServiceWorker": ${profile.enableServiceWorker},
                    "enableMediaPrecache": ${profile.enableMediaPrecache},
                    "heartbeatSeconds": ${profile.heartbeatSeconds},
                    "syncSeconds": ${profile.syncSeconds},
                    "verifyPollingMs": ${profile.verifyPollingMs},
                    "updateCheckDelayMs": ${profile.updateCheckDelayMs},
                    "displayBrightness": ${String.format(Locale.US, "%.3f", profile.displayBrightness)},
                    "displayContrast": ${String.format(Locale.US, "%.3f", profile.displayContrast)},
                    "maxContrast": ${String.format(Locale.US, "%.3f", profile.maxContrast)},
                    "enableContrastTuning": ${profile.enableContrastTuning}
                }
            """.trimIndent()
        }

        @JavascriptInterface
        fun setPerformanceProfile(profileId: String): Boolean {
            return activity.applyPerformanceProfileOverride(profileId)
        }

        @JavascriptInterface
        fun getDisplayTuning(): String {
            return activity.getDisplayTuningJson()
        }

        @JavascriptInterface
        fun setDisplayTuning(brightness: Double, contrast: Double): Boolean {
            return activity.setDisplayTuningOverride(brightness, contrast)
        }

        @JavascriptInterface
        fun clearDisplayTuningOverride(): Boolean {
            return activity.clearDisplayTuningOverride()
        }

        @JavascriptInterface
        fun showAbout() {
            activity.runOnUiThread {
                activity.showAboutDialog()
            }
        }

        /**
         * Ã¢Å"â€¦ WATCHDOG: JavaScript'ten playback started sinyali
         */
        @JavascriptInterface
        fun onPlaybackStarted() {
            activity.runOnUiThread {
                activity.onPlaybackStarted()
            }
        }

        @JavascriptInterface
        fun setWebViewTransparent(enabled: Boolean) {
            activity.setWebViewTransparency(enabled)
        }

        /**
         * Ã¢Å"â€¦ PHASE 2: Play video with ExoPlayer (hybrid mode)
         * @param url Video URL (HLS m3u8, MP4, WEBM)
         * @param muted Audio muted state (default: true)
         * @return JSON string with { success: boolean, mode: "exoplayer"|"webview", error?: string }
         */
        @JavascriptInterface
        fun playVideoNative(url: String, muted: Boolean = true): String {
            val manager = activity.ensureExoPlayerInitialized()

            if (manager == null) {
                return """{"success": false, "mode": "webview", "error": "ExoPlayer not initialized"}"""
            }

            val started = AtomicBoolean(false)
            val errorRef = AtomicReference<String?>(null)
            val latch = CountDownLatch(1)

            activity.runOnUiThread {
                try {
                    activity.isPlaybackActive = false
                    activity.startPlaybackWatchdog()
                    started.set(manager.playVideo(url, useNative = true, muted = muted))
                } catch (t: Throwable) {
                    errorRef.set(t.message ?: "Unknown native playback error")
                } finally {
                    latch.countDown()
                }
            }

            val completed = latch.await(1500, TimeUnit.MILLISECONDS)
            val errorMessage = errorRef.get()

            if (!completed) {
                return """{"success": false, "mode": "webview", "error": "Native playback timeout"}"""
            }

            if (!errorMessage.isNullOrEmpty()) {
                return """{"success": false, "mode": "webview", "error": "$errorMessage"}"""
            }

            return if (started.get()) {
                """{"success": true, "mode": "exoplayer"}"""
            } else {
                """{"success": false, "mode": "webview", "error": "ExoPlayer failed to start"}"""
            }
        }

        /**
         * Ã¢Å"â€¦ PHASE 2: Stop native video playback
         */
        @JavascriptInterface
        fun stopVideoNative() {
            activity.runOnUiThread {
                activity.exoPlayerManager?.stopVideo()
            }
        }

        /**
         * Preload next video URL for instant playback.
         * ExoPlayer will buffer in the background without playing.
         */
        @JavascriptInterface
        fun preloadNextVideoNative(url: String) {
            activity.runOnUiThread {
                activity.exoPlayerManager?.preloadNextVideo(url)
            }
        }

        /**
         * Release any buffered preload player.
         * Prevents decoder contention when switching into HTML templates with inline video.
         */
        @JavascriptInterface
        fun clearPreloadedVideoNative() {
            activity.runOnUiThread {
                activity.exoPlayerManager?.clearPreloadedVideo()
            }
        }

        /**
         * Set transition type and duration for native video playback.
         * Called from JS before playVideoNative() to configure enter animation.
         * @param type Transition type:
         * "none", "fade", "crossfade",
         * "zoom", "zoom-in", "zoom-out",
         * "slide-left", "slide-right", "slide-up", "slide-down",
         * "push-left", "push-right", "push-up", "push-down",
         * "wipe-left", "wipe-right", "wipe-up", "wipe-down"
         * @param durationMs Animation duration in milliseconds
         */
        @JavascriptInterface
        fun setVideoTransition(type: String, durationMs: Int) {
            activity.runOnUiThread {
                activity.exoPlayerManager?.setTransition(type, durationMs.toLong())
            }
        }

        /**
         * Ã¢Å"â€¦ PHASE 2: Check if currently playing with ExoPlayer
         */
        @JavascriptInterface
        fun isPlayingNatively(): Boolean {
            return activity.exoPlayerManager?.isPlayingNatively() ?: false
        }

        /**
         * Ã¢Å"â€¦ PHASE 2: Pause native playback
         */
        @JavascriptInterface
        fun pauseVideoNative() {
            activity.runOnUiThread {
                activity.exoPlayerManager?.pause()
            }
        }

        /**
         * Ã¢Å"â€¦ PHASE 2: Resume native playback
         */
        @JavascriptInterface
        fun resumeVideoNative() {
            activity.runOnUiThread {
                activity.exoPlayerManager?.resume()
            }
        }

        /**
         * Set native video volume from JavaScript (0.0 - 1.0)
         */
        @JavascriptInterface
        fun setVideoVolume(volume: Double) {
            activity.runOnUiThread {
                activity.exoPlayerManager?.setVolume(volume.toFloat())
            }
        }

        /**
         * Ã¢Å"â€¦ PHASE 2: Get ExoPlayer capabilities
         */
        @JavascriptInterface
        fun getExoPlayerInfo(): String {
            val manager = activity.exoPlayerManager
            val available = manager != null

            return """
                {
                    "available": $available,
                    "isPlaying": ${manager?.isPlaying() ?: false},
                    "isNative": ${manager?.isPlayingNatively() ?: false},
                    "currentUrl": "${manager?.getCurrentUrl() ?: ""}",
                    "position": ${manager?.getCurrentPosition() ?: 0},
                    "duration": ${manager?.getDuration() ?: 0}
                }
            """.trimIndent()
        }

        /**
         * Ã¢Å"â€¦ PHASE 2: Get hardware codec capabilities
         */
        @JavascriptInterface
        fun getCodecInfo(): String {
            return CodecChecker.getCodecInfoJson()
        }

        @JavascriptInterface
        fun getCodecSupport(): String {
            return CodecChecker.getCodecInfoJson()
        }

        /**
         * Ã¢Å"â€¦ PHASE 2: Get codec report (for debugging)
         */
        @JavascriptInterface
        fun getCodecReport(): String {
            return CodecChecker.getCodecReport()
        }
    }

    /**
     * Ã¢Å"â€¦ WATCHDOG: Playback timeout kontrolÃƒÂ¼ baÃ…Å¸lat
     */
    private fun startPlaybackWatchdog() {
        playbackWatchdog = android.os.Handler(android.os.Looper.getMainLooper())
        playbackWatchdog?.postDelayed({
            if (!isPlaybackActive) {
                android.util.Log.e("Watchdog", "Playback timeout - resetting player")
                resetPlayer()
                retryCount++

                if (retryCount >= 3) {
                    Toast.makeText(this, getString(R.string.playback_fallback_to_image), Toast.LENGTH_LONG).show()
                    fallbackToImageMode()
                }
            }
        }, PLAYBACK_TIMEOUT)
    }

    /**
     * Ã¢Å"â€¦ WATCHDOG: Playback baÃ…Å¸ladÃ„Â± sinyali
     */
    private fun onPlaybackStarted() {
        isPlaybackActive = true
        playbackWatchdog?.removeCallbacksAndMessages(null)
        retryCount = 0
    }

    /**
     * Ã¢Å"â€¦ WATCHDOG: Player reset
     */
    private fun resetPlayer() {
        webView?.reload()
    }

    /**
     * Ã¢Å"â€¦ WATCHDOG: GÃƒÂ¶rsel moduna geÃƒÂ§ (video olmadan)
     */
    private fun fallbackToImageMode() {
        // Backend'e "video devre dÃ„Â±Ã…Å¸Ã„Â±" sinyali gÃƒÂ¶nderilebilir
        // Ã…Âu an iÃƒÂ§in sadece sayfa yenileniyor
        webView?.reload()
    }

    /**
     * HakkÃ„Â±nda diyalogu gÃƒÂ¶ster
     */
    private fun showAboutDialog() {
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Omnex Player")
            .setMessage(
                getString(
                    R.string.about_message,
                    BuildConfig.VERSION_NAME,
                    BuildConfig.VERSION_CODE,
                    Build.VERSION.RELEASE,
                    Build.MANUFACTURER,
                    Build.MODEL
                )
            )
            .setPositiveButton(getString(R.string.ok), null)
            .setNeutralButton(getString(R.string.check_updates)) { _, _ ->
                checkForUpdates()
            }
            .show()
    }

    // =========================================================================
    // PriceView Integration
    // =========================================================================

    private fun initPriceView() {
        try {
            priceViewConfig = PriceViewConfig(this)
            priceViewDatabase = LocalDatabase.getInstance(this)
            priceViewApiClient = ApiClient(priceViewConfig!!)

            val overlayContainer = findViewById<FrameLayout>(R.id.priceViewOverlay)
            val productCard = findViewById<View>(R.id.productCard)
            val scanPrompt = findViewById<View>(R.id.scanPrompt)
            val notFoundView = findViewById<View>(R.id.notFoundView)
            val printButton = findViewById<View>(R.id.btnPrint)
            val productName = findViewById<TextView>(R.id.productName)
            val productPrice = findViewById<TextView>(R.id.productPrice)
            val productBarcode = findViewById<TextView>(R.id.productBarcode)
            val productImage = findViewById<ImageView>(R.id.productImage)
            val closeButton = findViewById<ImageButton>(R.id.btnCloseOverlay)
            val productHtmlOverlay = findViewById<WebView>(R.id.productHtmlOverlay)
            val notFoundHtmlOverlay = findViewById<WebView>(R.id.notFoundHtmlOverlay)
            val dummyPreview = PreviewView(this)

            if (overlayContainer != null && productCard != null && notFoundView != null &&
                printButton != null && productName != null && productPrice != null &&
                productBarcode != null
            ) {
                priceViewOverlayManager = PriceViewOverlayManager(
                    overlayContainer = overlayContainer,
                    cameraPreview = dummyPreview,
                    productCard = productCard,
                    scanPrompt = scanPrompt ?: View(this),
                    notFoundView = notFoundView,
                    printButton = printButton,
                    productNameText = productName,
                    productPriceText = productPrice,
                    productBarcodeText = productBarcode,
                    productImageView = productImage,
                    closeButton = closeButton,
                    torchButton = null,
                    productHtmlWebView = productHtmlOverlay,
                    notFoundHtmlWebView = notFoundHtmlOverlay,
                    config = priceViewConfig!!
                )

                applyOverlayDisplayConfig()

                priceViewOverlayManager?.onShowListener = {
                    exoPlayerManager?.setVolume(0f)
                    // Bring overlay to front - ensures it's above WebView hardware content
                    findViewById<FrameLayout>(R.id.priceViewOverlay)?.bringToFront()
                }
                priceViewOverlayManager?.onHideListener = {
                    // Resume signage media; JS will restore per-item mute state.
                    exoPlayerManager?.resume()
                    webView?.evaluateJavascript(
                        "(function(){" +
                        "var p=window.OmnexPlayer;" +
                        "if(p&&typeof p.resumeFromPriceView==='function'){try{p.resumeFromPriceView();return;}catch(e){}}" +
                        "document.querySelectorAll('video,audio').forEach(function(m){try{m.play();}catch(e){}});" +
                        "if(p&&p._pvPaused){p._pvPaused=false;p.scheduleNext(2);}" +
                        "})()", null
                    )
                }
                priceViewOverlayManager?.onPrintRequested = { product -> printProduct(product) }
            }

            printHelper = PrintHelper(this, priceViewApiClient!!, priceViewConfig!!)

            // Setup UI elements first (independent of permissions)
            interceptWebViewKeyEvents()
            setupFabScanButton()
            setupSyncProgressUI()

            // These may fail on some Android versions (e.g. Android 16 BroadcastReceiver restrictions)
            try { registerHardwareScannerReceivers() } catch (e: Exception) {
                android.util.Log.w("PriceView", "Hardware scanner receivers failed (non-fatal): ${e.message}")
            }

            // Trigger initial sync with progress
            triggerInitialSyncIfNeeded()

            android.util.Log.i("PriceView", "PriceView initialized (hardware scanner + camera mode)")
        } catch (e: Exception) {
            android.util.Log.e("PriceView", "PriceView init failed (non-fatal)", e)
        }
    }

    private fun applyRemotePriceViewConfig(data: org.json.JSONObject) {
        val config = priceViewConfig ?: return
        val apiClient = priceViewApiClient ?: return

        val interval = data.optInt("sync_interval_minutes", 30)
        val timeout = data.optInt("overlay_timeout_seconds", 10)
        val templateId = data.optString("default_template_id", "")

        config.syncIntervalMinutes = interval
        config.overlayTimeoutSeconds = timeout
        if (templateId.isNotBlank() && templateId != "null") {
            config.defaultTemplateId = templateId
        }
        config.printEnabled = data.optBoolean("print_enabled", true)
        config.signageEnabled = data.optBoolean("signage_enabled", true)

        DisplayTemplateSyncManager(apiClient, config).applyConfigAndSyncTemplates(data)
        runOnUiThread { applyOverlayDisplayConfig() }
    }

    private fun triggerPriceViewInstantSync(source: String) {
        try {
            SyncWorker.syncNow(this)
            android.util.Log.i("PriceView", "Instant sync enqueued (source=$source)")
        } catch (e: Exception) {
            android.util.Log.w("PriceView", "Instant sync enqueue failed (source=$source): ${e.message}")
        }
    }

    private fun applyOverlayDisplayConfig() {
        val config = priceViewConfig ?: return
        priceViewOverlayManager?.applyDisplayTemplates(
            mode = config.productDisplayMode,
            productHtml = config.displayTemplateProductHtml,
            notFoundHtml = config.displayTemplateNotFoundHtml,
            companyName = config.companyName,
            branchName = config.branchName
        )
    }

    private fun registerHardwareScannerReceivers() {
        hardwareScannerReceiver = object : android.content.BroadcastReceiver() {
            override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
                val barcode = when (intent?.action) {
                    "com.se4500.onDecodeComplete" -> intent.getStringExtra("se4500")
                    "nlscan.action.SCANNER_RESULT" -> intent.getStringExtra("SCAN_BARCODE1")
                    "android.intent.ACTION_DECODE_DATA" -> intent.getStringExtra("barcode_string")
                    "com.android.decodewedge.decode_action" ->
                        intent.getStringExtra("com.android.decode.intentwedge.barcode_string")?.replace("\n", "")
                    else -> null
                }
                if (!barcode.isNullOrBlank()) {
                    android.util.Log.i("PriceView", "Hardware scanner: $barcode (action: ${intent?.action})")
                    runOnUiThread { handleBarcodeScanned(barcode) }
                }
            }
        }
        val intentFilter = android.content.IntentFilter().apply {
            addAction("com.se4500.onDecodeComplete")
            addAction("nlscan.action.SCANNER_RESULT")
            addAction("android.intent.ACTION_DECODE_DATA")
            addAction("com.android.decodewedge.decode_action")
        }
        // Android 13+ (API 33) requires RECEIVER_EXPORTED/NOT_EXPORTED flag
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(hardwareScannerReceiver, intentFilter, android.content.Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(hardwareScannerReceiver, intentFilter)
        }
        android.util.Log.i("PriceView", "Hardware scanner receivers registered (4 brands)")
    }

    // ================================================================
    // WebView Key Event Interceptor
    // ================================================================

    /**
     * Intercept key events at the WebView level.
     * When WebView has focus (HTML/iframe content), dispatchKeyEvent doesn't fire.
     * This setOnKeyListener catches events BEFORE WebView processes them.
     * Combined with JS injection, this ensures barcode works with ALL content types.
     */
    private fun interceptWebViewKeyEvents() {
        webView?.setOnKeyListener { _, keyCode, event ->
            if (event.action != KeyEvent.ACTION_DOWN) return@setOnKeyListener false

            // Enter key with buffer = process barcode
            if ((keyCode == KeyEvent.KEYCODE_ENTER || keyCode == KeyEvent.KEYCODE_DPAD_CENTER) && barcodeBuffer.isNotEmpty()) {
                barcodeBufferRunnable?.let { barcodeBufferHandler.removeCallbacks(it) }
                processHardwareBarcodeBuffer()
                return@setOnKeyListener true
            }

            // BACK: close overlay
            if (keyCode == KeyEvent.KEYCODE_BACK && priceViewOverlayManager?.isVisible == true) {
                priceViewOverlayManager?.hide()
                return@setOnKeyListener true
            }

            // Numeric/alpha keys = barcode scanner input
            if (keyCode in KeyEvent.KEYCODE_0..KeyEvent.KEYCODE_9 ||
                keyCode in KeyEvent.KEYCODE_A..KeyEvent.KEYCODE_Z) {
                val char = event.unicodeChar.toChar()
                if (char.isLetterOrDigit()) {
                    barcodeBuffer.append(char)
                    barcodeBufferRunnable?.let { barcodeBufferHandler.removeCallbacks(it) }
                    barcodeBufferRunnable = Runnable { processHardwareBarcodeBuffer() }
                    barcodeBufferHandler.postDelayed(barcodeBufferRunnable!!, 300)
                    return@setOnKeyListener true // Consume - don't let WebView/iframe see it
                }
            }

            false // Let other keys pass through to WebView
        }
        android.util.Log.i("PriceView", "WebView key interceptor installed")
    }

    // ================================================================
    // FAB Scan Button (camera toggle)
    // ================================================================

    private var cameraPipActive = false

    private fun setupFabScanButton() {
        val fabButton = findViewById<ImageButton>(R.id.fabScanButton)

        // Check for REAL camera devices (not just feature flag)
        // G66 reports FEATURE_CAMERA_ANY=true (supports external USB camera)
        // but has 0 actual camera devices. Must check CameraManager.
        val hasRealCamera = try {
            val cm = getSystemService(android.content.Context.CAMERA_SERVICE) as android.hardware.camera2.CameraManager
            val count = cm.cameraIdList.size
            android.util.Log.i("PriceView", "Camera devices found: $count")
            count > 0
        } catch (e: Exception) {
            android.util.Log.w("PriceView", "CameraManager check failed: ${e.message}")
            // Fallback to PackageManager (less reliable but doesn't crash)
            packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_CAMERA_FRONT)
        }

        if (hasRealCamera) {
            fabButton?.visibility = View.VISIBLE
            fabButton?.setOnClickListener { toggleCameraPip() }
            android.util.Log.i("PriceView", "Real camera detected - FAB visible")
        } else {
            fabButton?.visibility = View.GONE
            android.util.Log.i("PriceView", "No real camera - FAB hidden")
        }
    }

    private fun toggleCameraPip() {
        if (cameraPipActive) {
            closeCameraFullscreen()
        } else {
            openCameraFullscreen()
        }
    }

    private fun openCameraFullscreen() {
        val cameraPipContainer = findViewById<FrameLayout>(R.id.cameraPipContainer)
        cameraPipActive = true
        cameraPipContainer?.visibility = View.VISIBLE
        cameraPipContainer?.bringToFront()
        exoPlayerManager?.setVolume(0f) // Mute signage
        startCameraScanning()
    }

    private fun closeCameraFullscreen() {
        val cameraPipContainer = findViewById<FrameLayout>(R.id.cameraPipContainer)
        cameraPipActive = false
        cameraPipContainer?.visibility = View.GONE
        stopCameraScanning()
        exoPlayerManager?.setVolume(1f) // Unmute signage
    }

    private fun startCameraScanning() {
        try {
            val previewView = findViewById<PreviewView>(R.id.cameraPipPreview) ?: return
            val scanDot = findViewById<View>(R.id.scanIndicatorDot)

            if (checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Kamera izni gerekli - Ayarlar'dan izin verin", Toast.LENGTH_LONG).show()
                closeCameraFullscreen()
                return
            }

            // Close button
            findViewById<ImageButton>(R.id.btnCloseCamera)?.setOnClickListener {
                closeCameraFullscreen()
            }

            // Gallery picker button - scan barcode from image file
            findViewById<ImageButton>(R.id.btnPickFromGallery)?.setOnClickListener {
                pickImageForBarcode()
            }

            val scanner = com.omnex.priceview.scanner.BarcodeScannerManager(this, this)
            scanner.start(previewView) { result ->
                runOnUiThread {
                    // Close camera first, then show product
                    closeCameraFullscreen()
                    handleBarcodeScanned(result.rawValue)
                }
            }
            this.barcodeScannerManager = scanner
            android.util.Log.i("PriceView", "Camera fullscreen scanning started")
        } catch (e: Exception) {
            android.util.Log.e("PriceView", "Camera start failed", e)
            cameraPipActive = false
            findViewById<FrameLayout>(R.id.cameraPipContainer)?.visibility = View.GONE
        }
    }

    private fun stopCameraScanning() {
        barcodeScannerManager?.stop()
        barcodeScannerManager = null
        android.util.Log.i("PriceView", "Camera PIP scanning stopped")
    }

    private var barcodeScannerManager: com.omnex.priceview.scanner.BarcodeScannerManager? = null

    // ================================================================
    // Gallery Image Barcode Scanner
    // ================================================================

    private val galleryPickerLauncher = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            scanBarcodeFromImage(uri)
        }
    }

    private fun pickImageForBarcode() {
        try {
            // Stop camera before opening gallery picker to avoid overlay conflicts
            stopCameraScanning()
            galleryPickerLauncher.launch("image/*")
        } catch (e: Exception) {
            android.util.Log.e("PriceView", "Gallery picker failed", e)
            Toast.makeText(this, "Galeri a\u00E7\u0131lamad\u0131", Toast.LENGTH_SHORT).show()
        }
    }

    private fun scanBarcodeFromImage(uri: android.net.Uri) {
        try {
            val inputImage = com.google.mlkit.vision.common.InputImage.fromFilePath(this, uri)
            val scanner = com.google.mlkit.vision.barcode.BarcodeScanning.getClient(
                com.google.mlkit.vision.barcode.BarcodeScannerOptions.Builder()
                    .setBarcodeFormats(
                        com.google.mlkit.vision.barcode.common.Barcode.FORMAT_EAN_13,
                        com.google.mlkit.vision.barcode.common.Barcode.FORMAT_EAN_8,
                        com.google.mlkit.vision.barcode.common.Barcode.FORMAT_UPC_A,
                        com.google.mlkit.vision.barcode.common.Barcode.FORMAT_UPC_E,
                        com.google.mlkit.vision.barcode.common.Barcode.FORMAT_CODE_128,
                        com.google.mlkit.vision.barcode.common.Barcode.FORMAT_CODE_39,
                        com.google.mlkit.vision.barcode.common.Barcode.FORMAT_QR_CODE,
                        com.google.mlkit.vision.barcode.common.Barcode.FORMAT_ITF
                    )
                    .build()
            )

            scanner.process(inputImage)
                .addOnSuccessListener { barcodes ->
                    if (barcodes.isNotEmpty()) {
                        val barcode = barcodes.first().rawValue ?: ""
                        android.util.Log.i("PriceView", "Barcode from image: $barcode")
                        closeCameraFullscreen()
                        handleBarcodeScanned(barcode)
                    } else {
                        Toast.makeText(this, "Resimde barkod bulunamad\u0131", Toast.LENGTH_SHORT).show()
                    }
                }
                .addOnFailureListener { e ->
                    android.util.Log.e("PriceView", "Image barcode scan failed", e)
                    Toast.makeText(this, "Barkod okunamad\u0131", Toast.LENGTH_SHORT).show()
                }
        } catch (e: Exception) {
            android.util.Log.e("PriceView", "Image processing failed", e)
            Toast.makeText(this, "Resim i\u015Flenemedi", Toast.LENGTH_SHORT).show()
        }
    }

    // ================================================================
    // Sync Progress UI (Madde 3)
    // ================================================================

    private fun setupSyncProgressUI() {
        val wm = androidx.work.WorkManager.getInstance(this)
        // Immediate sync (one-time, uses tag not unique name)
        wm.getWorkInfosByTagLiveData("product_sync_immediate").observe(this) { workInfos ->
            val info = workInfos?.lastOrNull() ?: return@observe
            updateSyncProgressUI(info)
        }
        // Periodic sync (unique name)
        wm.getWorkInfosForUniqueWorkLiveData("omnex_priceview_product_sync").observe(this) { workInfos ->
            val info = workInfos?.firstOrNull() ?: return@observe
            updateSyncProgressUI(info)
        }
    }

    private fun updateSyncProgressUI(info: androidx.work.WorkInfo) {
        val container = findViewById<LinearLayout>(R.id.syncProgressContainer)
        val textView = findViewById<TextView>(R.id.syncProgressText)

        when (info.state) {
            androidx.work.WorkInfo.State.RUNNING -> {
                val status = info.progress.getString("status") ?: ""
                val current = info.progress.getInt("progress", 0)
                val total = info.progress.getInt("total", 0)

                // Token expired: re-inject token bridge from WebView
                if (status == "token_expired") {
                    android.util.Log.w("PriceView", "Token expired during sync, re-injecting token bridge")
                    injectDeviceTokenBridge(webView)
                    container?.visibility = View.VISIBLE
                    container?.bringToFront()
                    textView?.text = "Oturum yenileniyor..."
                    return
                }

                container?.visibility = View.VISIBLE
                container?.bringToFront()
                if (total > 0 && current > 0) {
                    val pct = (current * 100 / total).coerceIn(0, 100)
                    textView?.text = "\u00DCr\u00FCnler y\u00FCkleniyor... %$pct ($current/$total)"
                } else {
                    textView?.text = "\u00DCr\u00FCn verileri indiriliyor..."
                }
            }
            androidx.work.WorkInfo.State.SUCCEEDED -> {
                val updated = info.outputData.getInt("updated", 0)
                if (updated > 0) {
                    container?.visibility = View.VISIBLE
                    container?.bringToFront()
                    textView?.text = "\u2713 $updated \u00FCr\u00FCn indirildi"
                }
                // Auto-hide after 4 seconds
                android.os.Handler(mainLooper).postDelayed({
                    container?.visibility = View.GONE
                }, 4000)
            }
            androidx.work.WorkInfo.State.FAILED -> {
                container?.visibility = View.VISIBLE
                textView?.text = "\u26A0 Senkronizasyon ba\u015Far\u0131s\u0131z"
                android.os.Handler(mainLooper).postDelayed({
                    container?.visibility = View.GONE
                }, 4000)
            }
            else -> {
                container?.visibility = View.GONE
            }
        }
    }

    // ================================================================
    // Sync Trigger
    // ================================================================

    fun triggerInitialSyncIfNeeded() {
        if (priceViewConfig?.isDeviceRegistered == true) {
            val config = priceViewConfig ?: return
            val apiClient = priceViewApiClient

            // Schedule periodic sync immediately with local config without blocking UI thread.
            val initialInterval = config.syncIntervalMinutes.takeIf { it > 0 } ?: 30
            priceViewScope.launch(Dispatchers.IO) {
                try {
                    SyncWorker.schedule(this@MainActivity, initialInterval)
                } catch (e: Exception) {
                    android.util.Log.w("PriceView", "Initial periodic sync schedule failed", e)
                }
            }

            // Fetch remote config asynchronously; if interval changes, reschedule background sync.
            if (apiClient != null) {
                priceViewScope.launch(Dispatchers.IO) {
                    try {
                        val previousInterval = config.syncIntervalMinutes.takeIf { it > 0 } ?: 30
                        val response = apiClient.get("/api/priceview/config")
                        if (response.success) {
                            val data = response.toJson()
                            if (data != null) {
                                applyRemotePriceViewConfig(data)
                                val updatedInterval = config.syncIntervalMinutes.takeIf { it > 0 } ?: 30
                                if (updatedInterval != previousInterval) {
                                    SyncWorker.schedule(this@MainActivity, updatedInterval)
                                    android.util.Log.i(
                                        "PriceView",
                                        "Startup sync interval updated: ${previousInterval}min -> ${updatedInterval}min"
                                    )
                                }
                                android.util.Log.i(
                                    "PriceView",
                                    "Startup config (async): sync=${config.syncIntervalMinutes}min, timeout=${config.overlayTimeoutSeconds}s, " +
                                        "template=${config.defaultTemplateId}, displayMode=${config.productDisplayMode}, displayTpl=${config.displayTemplateName}"
                                )
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.w("PriceView", "Startup config fetch failed (non-fatal)", e)
                    }
                }
            }

            priceViewScope.launch {
                try {
                    val syncMeta = kotlinx.coroutines.withContext(Dispatchers.IO) {
                        priceViewDatabase?.syncMetadataDao()?.get("products")
                    }
                    if (syncMeta?.lastSyncAt == null) {
                        android.util.Log.i("PriceView", "First sync needed - triggering immediate sync")
                        // Show sync progress immediately
                        runOnUiThread {
                            val container = findViewById<LinearLayout>(R.id.syncProgressContainer)
                            val textView = findViewById<TextView>(R.id.syncProgressText)
                            container?.visibility = View.VISIBLE
                            container?.bringToFront()
                            textView?.text = "\u00DCr\u00FCn verileri indiriliyor..."
                            // Fallback: check after 20s if observer doesn't fire
                            android.os.Handler(mainLooper).postDelayed({
                                if (container?.visibility == View.VISIBLE) {
                                    priceViewScope.launch {
                                        val count = kotlinx.coroutines.withContext(Dispatchers.IO) {
                                            priceViewDatabase?.productDao()?.getCount() ?: 0
                                        }
                                        runOnUiThread {
                                            if (count > 0) {
                                                textView?.text = "\u2713 $count \u00FCr\u00FCn indirildi"
                                                android.os.Handler(mainLooper).postDelayed({
                                                    container?.visibility = View.GONE
                                                }, 4000)
                                            } else {
                                                container?.visibility = View.GONE
                                            }
                                        }
                                    }
                                }
                            }, 20000)
                        }
                        SyncWorker.syncNow(this@MainActivity)
                    } else {
                        // Already synced before - trigger delta sync for fresh data
                        android.util.Log.i("PriceView", "Delta sync at startup (last: ${syncMeta?.lastSyncAt})")
                        SyncWorker.syncNow(this@MainActivity)
                    }
                } catch (e: Exception) {
                    android.util.Log.w("PriceView", "Sync check failed", e)
                }
            }
        }
    }

    fun handleBarcodeScanned(scannedBarcode: String) {
        val normalizedBarcode = scannedBarcode.trim()
        if (normalizedBarcode.isBlank()) return

        val nowMs = SystemClock.elapsedRealtime()
        if (normalizedBarcode == lastHandledBarcode &&
            (nowMs - lastHandledBarcodeAtMs) <= BARCODE_SCAN_DEBOUNCE_MS
        ) {
            android.util.Log.d("PriceView", "Duplicate barcode ignored in debounce window: $normalizedBarcode")
            return
        }

        if (!barcodeLookupInFlight.compareAndSet(false, true)) {
            android.util.Log.d("PriceView", "Barcode lookup already in progress, ignored: $normalizedBarcode")
            return
        }

        lastHandledBarcode = normalizedBarcode
        lastHandledBarcodeAtMs = nowMs

        val barcode = normalizedBarcode
        applyOverlayDisplayConfig()

        // Mute + pause ALL signage media when barcode scanned
        exoPlayerManager?.setVolume(0f)
        exoPlayerManager?.pause()
        // Pause signage runtime (full playlist + media freeze) while PriceView overlay is active.
        webView?.evaluateJavascript(
            "(function(){" +
            "var p=window.OmnexPlayer;" +
            "if(p&&typeof p.pauseForPriceView==='function'){try{p.pauseForPriceView();return;}catch(e){}}" +
            "document.querySelectorAll('video,audio').forEach(function(m){try{m.pause();}catch(e){}});" +
            "if(p&&p.contentTimer){clearTimeout(p.contentTimer);p._pvPaused=true;}" +
            "})()", null
        )

        priceViewScope.launch {
            try {
                var product = kotlinx.coroutines.withContext(Dispatchers.IO) {
                    priceViewDatabase?.productDao()?.findByBarcode(barcode)
                }

                // Weighing barcode matching: if barcode starts with flag code (20-29),
                // extract the 5-digit scale code and search by that.
                // Format: FF XXXXX QQ qqq C (flag + scale_code + weight + check)
                // Short: FF XXXXX (7 digits) or full EAN-13: FF XXXXX QQQQQ C (13 digits)
                if (product == null && barcode.length >= 7) {
                    val flagCode = barcode.substring(0, 2)
                    if (flagCode.toIntOrNull() in 20..29) {
                        val scaleCode = barcode.substring(2, 7) // 5-digit terazi kodu
                        android.util.Log.i("PriceView", "Weighing barcode detected: flag=$flagCode, scaleCode=$scaleCode")
                        product = kotlinx.coroutines.withContext(Dispatchers.IO) {
                            // Try exact scale code match first
                            priceViewDatabase?.productDao()?.findByBarcode(scaleCode)
                                // Also try with leading zeros stripped
                                ?: priceViewDatabase?.productDao()?.findByBarcode(scaleCode.trimStart('0'))
                        }
                    }
                }

                // Bundle fallback from local SQLite (barcode or sku)
                val localBundle = if (product == null) {
                    kotlinx.coroutines.withContext(Dispatchers.IO) {
                        priceViewDatabase?.bundleDao()?.findByBarcode(barcode)
                            ?: priceViewDatabase?.bundleDao()?.findBySku(barcode)
                    }
                } else null

                if (product != null) {
                    priceViewOverlayManager?.show()
                    priceViewOverlayManager?.showProduct(product)
                    return@launch
                }

                if (localBundle != null) {
                    priceViewOverlayManager?.show()
                    priceViewOverlayManager?.showProduct(bundleToProductEntity(localBundle, barcode))
                    return@launch
                }

                val productResponse = kotlinx.coroutines.withContext(Dispatchers.IO) {
                    priceViewApiClient?.get("/api/priceview/products/barcode/$barcode")
                }
                if (productResponse?.success == true) {
                    val json = productResponse.toJson()
                    if (json != null) {
                        priceViewOverlayManager?.show()
                        priceViewOverlayManager?.showProduct(jsonToProductEntity(json, barcode))
                        return@launch
                    }
                }

                // Online bundle fallback
                val bundleResponse = kotlinx.coroutines.withContext(Dispatchers.IO) {
                    priceViewApiClient?.get("/api/priceview/bundles/barcode/$barcode")
                }
                if (bundleResponse?.success == true) {
                    val bundleJson = bundleResponse.toJson()
                    if (bundleJson != null) {
                        priceViewOverlayManager?.show()
                        priceViewOverlayManager?.showProduct(bundleJsonToProductEntity(bundleJson, barcode))
                        return@launch
                    }
                }

                priceViewOverlayManager?.show()
                priceViewOverlayManager?.showNotFound(barcode)
            } catch (e: Exception) {
                android.util.Log.e("PriceView", "Barcode lookup error: $barcode", e)
                priceViewOverlayManager?.show()
                priceViewOverlayManager?.showNotFound(barcode)
            } finally {
                barcodeLookupInFlight.set(false)
            }
        }
    }

    private fun bundleToProductEntity(
        bundle: com.omnex.priceview.data.entities.BundleEntity,
        scannedBarcode: String
    ): com.omnex.priceview.data.entities.ProductEntity {
        return com.omnex.priceview.data.entities.ProductEntity(
            id = bundle.id,
            companyId = bundle.companyId,
            sku = bundle.sku ?: "",
            barcode = bundle.barcode ?: scannedBarcode,
            name = bundle.name,
            description = null,
            currentPrice = bundle.finalPrice ?: bundle.totalPrice,
            previousPrice = null,
            unit = null,
            groupName = null,
            category = null,
            subcategory = null,
            brand = null,
            imageUrl = null,
            images = bundle.images,
            videos = null,
            coverImageIndex = null,
            stock = 0,
            status = bundle.status,
            vatRate = null,
            discountPercent = bundle.discountPercent,
            campaignText = null,
            weight = null,
            shelfLocation = null,
            origin = null,
            productionType = null,
            isFeatured = false,
            erpProductId = null,
            erpData = null,
            kunyeData = null,
            extraData = bundle.productsJson,
            version = 1,
            updatedAt = bundle.updatedAt,
            syncedAt = bundle.syncedAt
        )
    }

    private fun jsonToProductEntity(
        json: org.json.JSONObject,
        scannedBarcode: String
    ): com.omnex.priceview.data.entities.ProductEntity {
        return com.omnex.priceview.data.entities.ProductEntity(
            id = json.optString("id", ""),
            companyId = json.optString("company_id", ""),
            sku = json.optString("sku", ""),
            barcode = json.optString("barcode", scannedBarcode),
            name = json.optString("name", "Unknown"),
            description = json.optString("description", null),
            currentPrice = if (json.has("current_price")) json.optDouble("current_price") else null,
            previousPrice = if (json.has("previous_price")) json.optDouble("previous_price") else null,
            unit = json.optString("unit", null),
            groupName = json.optString("group", null),
            category = json.optString("category", null),
            subcategory = json.optString("subcategory", null),
            brand = json.optString("brand", null),
            imageUrl = json.optString("image_url", null),
            images = json.optString("images", null),
            videos = json.optString("videos", null),
            coverImageIndex = null,
            stock = json.optInt("stock", 0),
            status = json.optString("status", "active"),
            vatRate = null,
            discountPercent = if (json.has("discount_percent")) json.optDouble("discount_percent") else null,
            campaignText = json.optString("campaign_text", null),
            weight = null,
            shelfLocation = json.optString("shelf_location", null),
            origin = json.optString("origin", null),
            productionType = json.optString("production_type", null),
            isFeatured = false,
            erpProductId = null,
            erpData = null,
            kunyeData = json.optString("kunye_data", null),
            extraData = json.optString("extra_data", null),
            version = json.optInt("version", 1),
            updatedAt = json.optString("updated_at", ""),
            syncedAt = ""
        )
    }

    private fun bundleJsonToProductEntity(
        json: org.json.JSONObject,
        scannedBarcode: String
    ): com.omnex.priceview.data.entities.ProductEntity {
        val currentPrice = when {
            json.has("final_price") -> json.optDouble("final_price")
            json.has("current_price") -> json.optDouble("current_price")
            json.has("total_price") -> json.optDouble("total_price")
            else -> Double.NaN
        }.let { if (it.isNaN() || it.isInfinite()) null else it }

        val previousPrice = when {
            json.has("previous_final_price") -> json.optDouble("previous_final_price")
            json.has("previous_price") -> json.optDouble("previous_price")
            else -> Double.NaN
        }.let { if (it.isNaN() || it.isInfinite()) null else it }

        return com.omnex.priceview.data.entities.ProductEntity(
            id = json.optString("id", ""),
            companyId = json.optString("company_id", ""),
            sku = json.optString("sku", ""),
            barcode = json.optString("barcode", scannedBarcode),
            name = json.optString("name", "Unknown"),
            description = json.optString("description", null),
            currentPrice = currentPrice,
            previousPrice = previousPrice,
            unit = null,
            groupName = null,
            category = json.optString("category", null),
            subcategory = null,
            brand = null,
            imageUrl = json.optString("image_url", null),
            images = json.optString("images", null),
            videos = json.optString("videos", null),
            coverImageIndex = null,
            stock = 0,
            status = json.optString("status", "active"),
            vatRate = null,
            discountPercent = if (json.has("discount_percent")) json.optDouble("discount_percent") else null,
            campaignText = null,
            weight = null,
            shelfLocation = null,
            origin = null,
            productionType = json.optString("type", null),
            isFeatured = false,
            erpProductId = null,
            erpData = null,
            kunyeData = null,
            extraData = json.optString("products_json", null),
            version = 1,
            updatedAt = json.optString("updated_at", ""),
            syncedAt = ""
        )
    }

    private fun processHardwareBarcodeBuffer() {
        val barcode = barcodeBuffer.toString().trim()
        barcodeBuffer.clear()
        if (barcode.length >= 4) handleBarcodeScanned(barcode)
    }

    private fun printProduct(product: com.omnex.priceview.data.entities.ProductEntity) {
        priceViewScope.launch {
            var templateId = priceViewConfig?.defaultTemplateId

            // If templateId is not set, try fetching config one more time
            if (templateId.isNullOrBlank()) {
                try {
                    val config = priceViewConfig
                    val apiClient = priceViewApiClient
                    if (config != null && apiClient != null) {
                        kotlinx.coroutines.withContext(Dispatchers.IO) {
                            val response = apiClient.get("/api/priceview/config")
                            if (response.success) {
                                val data = response.toJson()
                                if (data != null) {
                                    applyRemotePriceViewConfig(data)
                                }
                            }
                        }
                        templateId = config.defaultTemplateId
                    }
                } catch (e: Exception) {
                    android.util.Log.w("PriceView", "Config retry for print failed", e)
                }
            }

            if (templateId.isNullOrBlank()) {
                // "Bask\u0131 \u015Fablonu se\u00E7ilmedi" = Baskı şablonu seçilmedi
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Bask\u0131 \u015fablonu se\u00e7ilmedi", Toast.LENGTH_SHORT).show()
                }
                return@launch
            }

            try {
                val result = printHelper?.printProductLabel(product.id, templateId, product.name)
                if (result?.success != true) {
                    runOnUiThread {
                        // "Bask\u0131 hatas\u0131" = Baskı hatası
                        Toast.makeText(this@MainActivity, "Bask\u0131 hatas\u0131: ${result?.error ?: "Bilinmeyen"}", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("PriceView", "Print error", e)
                runOnUiThread { Toast.makeText(this@MainActivity, "Bask\u0131 hatas\u0131", Toast.LENGTH_SHORT).show() }
            }
        }
    }
}
