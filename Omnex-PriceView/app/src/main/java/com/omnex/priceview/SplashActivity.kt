package com.omnex.priceview

import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebView
import android.widget.TextView
import android.widget.VideoView
import androidx.appcompat.app.AppCompatActivity
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Splash/Landing activity.
 * WebView ile HTML/CSS animasyonlu logo (HTML logo pack'ten birebir).
 * Altında "OmneX Fiyat Gör" başlığı + sürüm notu.
 */
class SplashActivity : AppCompatActivity() {

    private var videoView: VideoView? = null
    private var splashWebView: WebView? = null
    private val splashDuration = 5500L
    private val mainHandler = Handler(Looper.getMainLooper())
    private var startupPlayer: MediaPlayer? = null
    private var hasPlayedStartupChime = false
    private val navigationTriggered = AtomicBoolean(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val isTV = packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)

        if (isTV) {
            setContentView(R.layout.activity_splash_tv)
            setupVideoSplashOrAnimated()
        } else {
            setContentView(R.layout.activity_splash_mobile)
        }

        // Sürüm metnini ayarla
        findViewById<TextView?>(R.id.splashVersionText)?.let { tv ->
            tv.text = getString(R.string.splash_version_format, BuildConfig.VERSION_NAME)
        }

        // WebView ile HTML animasyonu yükle
        setupSplashWebView()

        // Başlık ve sürüm animasyonu
        setupTextAnimations()

        // Startup chime
        playStartupChime()

        enableFullscreen()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Navigate after splash
        mainHandler.postDelayed({
            checkFirstRun()
        }, splashDuration)
    }

    /**
     * WebView ile assets/splash_animation.html yükle.
     * Bu HTML, logo pack'teki CSS animasyonun birebir kopyası.
     */
    private fun setupSplashWebView() {
        splashWebView = findViewById(R.id.splashWebView)
        splashWebView?.let { wv ->
            wv.setBackgroundColor(0xFF061536.toInt())
            wv.settings.javaScriptEnabled = true
            wv.settings.domStorageEnabled = true
            wv.settings.allowFileAccess = true
            // Hardware acceleration for smooth CSS animations
            wv.setLayerType(View.LAYER_TYPE_HARDWARE, null)
            wv.loadUrl("file:///android_asset/splash_animation.html")
        }
    }

    /**
     * Başlık ve sürüm notu kademeli görünür.
     */
    private fun setupTextAnimations() {
        val titleView = findViewById<TextView?>(R.id.splashTitle)
        val versionView = findViewById<TextView?>(R.id.splashVersionText)

        // Başlık: 2sn sonra
        titleView?.let { tv ->
            mainHandler.postDelayed({
                tv.visibility = View.VISIBLE
                tv.alpha = 0f
                tv.animate().alpha(1f).setDuration(500).start()
            }, 2000)
        }

        // Sürüm: 2.5sn sonra
        versionView?.let { tv ->
            mainHandler.postDelayed({
                tv.visibility = View.VISIBLE
                tv.alpha = 0f
                tv.animate().alpha(1f).setDuration(400).start()
            }, 2500)
        }
    }

    private fun setupVideoSplashOrAnimated() {
        videoView = findViewById(R.id.splashVideoView)
        val videoResId = resources.getIdentifier("splash_video", "raw", packageName)

        if (videoResId != 0) {
            try {
                val logoContainer = findViewById<View?>(R.id.splashLogoContainer)
                logoContainer?.visibility = View.GONE
                videoView?.visibility = View.VISIBLE

                val videoUri = Uri.parse("android.resource://$packageName/$videoResId")
                videoView?.setVideoURI(videoUri)
                videoView?.setOnPreparedListener { mp ->
                    if (navigationTriggered.get() || isFinishing || isDestroyed) {
                        return@setOnPreparedListener
                    }
                    mp.isLooping = false
                    mp.start()
                }
                videoView?.setOnCompletionListener {
                    mainHandler.removeCallbacksAndMessages(null)
                    checkFirstRun()
                }
                videoView?.setOnErrorListener { _, _, _ ->
                    videoView?.visibility = View.GONE
                    true
                }
            } catch (_: Exception) {}
        } else {
            videoView?.visibility = View.GONE
        }
    }

    private fun playStartupChime() {
        if (hasPlayedStartupChime) return
        hasPlayedStartupChime = true

        val chimeResId = resources.getIdentifier("startup_chime", "raw", packageName)
        if (chimeResId == 0) { playLegacyTone(); return }

        try {
            val mp = MediaPlayer.create(this, chimeResId)
            if (mp != null) {
                mp.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                mp.setVolume(0.75f, 0.75f)
                mp.setOnCompletionListener { it.release() }
                mp.start()
                startupPlayer = mp
            } else { playLegacyTone() }
        } catch (_: Throwable) { playLegacyTone() }
    }

    private fun playLegacyTone() {
        try {
            val tone = android.media.ToneGenerator(android.media.AudioManager.STREAM_MUSIC, 78)
            mainHandler.post { tone.startTone(android.media.ToneGenerator.TONE_PROP_BEEP2, 110) }
            mainHandler.postDelayed({ tone.startTone(android.media.ToneGenerator.TONE_PROP_BEEP, 135) }, 120)
            mainHandler.postDelayed({ tone.startTone(android.media.ToneGenerator.TONE_PROP_ACK, 240) }, 290)
            mainHandler.postDelayed({ tone.release() }, 600)
        } catch (_: Throwable) {}
    }

    private fun checkFirstRun() {
        if (!navigationTriggered.compareAndSet(false, true)) return
        mainHandler.removeCallbacksAndMessages(null)

        val prefs = getSharedPreferences("omnex_player", MODE_PRIVATE)
        val isFirstRun = prefs.getBoolean("first_run", true)
        val hasServerUrl = !prefs.getString("server_url", null).isNullOrBlank()

        if (isFirstRun || !hasServerUrl) navigateToWizard() else navigateToPlayer()
    }

    private fun navigateToWizard() {
        cleanupSplashMedia()
        startActivity(Intent(this, WizardActivity::class.java))
        @Suppress("DEPRECATION") overridePendingTransition(0, 0)
        finish()
    }

    private fun navigateToPlayer() {
        val isTV = packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
        cleanupSplashMedia()
        startActivity(Intent(this, if (isTV) TvActivity::class.java else MainActivity::class.java))
        @Suppress("DEPRECATION") overridePendingTransition(0, 0)
        finish()
    }

    private fun enableFullscreen() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            window.insetsController?.let { c ->
                c.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                c.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } ?: run {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN)
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN)
        }
    }

    override fun onPause() {
        super.onPause()
        videoView?.pause()
    }

    override fun onResume() {
        super.onResume()
        enableFullscreen()
        if (!navigationTriggered.get() && !isFinishing && !isDestroyed) {
            videoView?.start()
        }
    }

    private fun cleanupSplashMedia() {
        mainHandler.removeCallbacksAndMessages(null)
        try { splashWebView?.destroy() } catch (_: Throwable) {}
        splashWebView = null
        try {
            videoView?.setOnPreparedListener(null)
            videoView?.setOnCompletionListener(null)
            videoView?.setOnErrorListener(null)
            videoView?.stopPlayback()
        } catch (_: Throwable) {}
        videoView = null
        try { startupPlayer?.release() } catch (_: Throwable) {}
        startupPlayer = null
    }

    override fun onDestroy() {
        cleanupSplashMedia()
        super.onDestroy()
    }
}
