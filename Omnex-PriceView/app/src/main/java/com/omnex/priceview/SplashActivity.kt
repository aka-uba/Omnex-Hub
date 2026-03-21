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
import android.view.animation.AnimationUtils
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.VideoView
import androidx.appcompat.app.AppCompatActivity

/**
 * Splash/Landing activity.
 * Shows brand logo PNG with entrance animation + startup chime,
 * then routes to wizard or player.
 */
class SplashActivity : AppCompatActivity() {

    private var videoView: VideoView? = null
    private val splashDuration = 3200L
    private val mainHandler = Handler(Looper.getMainLooper())
    private var startupPlayer: MediaPlayer? = null
    private var hasPlayedStartupChime = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val isTV = packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)

        if (isTV) {
            setContentView(R.layout.activity_splash_tv)
            setupVideoSplashOrAnimated()
        } else {
            setContentView(R.layout.activity_splash_mobile)
            findViewById<TextView?>(R.id.splashVersionText)?.let { tv ->
                tv.text = getString(R.string.splash_version_format, BuildConfig.VERSION_NAME)
            }
        }

        // Animate logo entrance (PNG with scale + fade)
        startLogoAnimation()

        // Animate progress bar + version text
        startOtherAnimations()

        // Play startup chime sound
        playStartupChime()

        enableFullscreen()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Navigate after splash duration
        mainHandler.postDelayed({
            checkFirstRun()
        }, splashDuration)
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
                    mp.isLooping = false
                    mp.start()
                }
                videoView?.setOnCompletionListener {
                    mainHandler.removeCallbacksAndMessages(null)
                    checkFirstRun()
                }
                videoView?.setOnErrorListener { _, _, _ ->
                    videoView?.visibility = View.GONE
                    logoContainer?.visibility = View.VISIBLE
                    true
                }
            } catch (_: Exception) {
                // Keep animated splash
            }
        } else {
            videoView?.visibility = View.GONE
        }
    }

    /**
     * Animate the brand logo PNG: scale up from 85% with overshoot + fade in.
     */
    private fun startLogoAnimation() {
        val logoIcon = findViewById<ImageView?>(R.id.splashLogoIcon) ?: return
        val anim = AnimationUtils.loadAnimation(this, R.anim.splash_logo_enter)
        logoIcon.startAnimation(anim)
        mainHandler.postDelayed({ logoIcon.alpha = 1f }, 700)
    }

    /**
     * Animate progress bar and version text with staggered delays.
     */
    private fun startOtherAnimations() {
        // ProgressBar - fade in after logo settles
        val progress = findViewById<ProgressBar?>(R.id.splashProgress)
        progress?.let {
            val anim = AnimationUtils.loadAnimation(this, R.anim.splash_progress_enter)
            it.startAnimation(anim)
            mainHandler.postDelayed({ it.alpha = 1f }, 2100)
        }

        // Version text (mobile only) - fade in with progress
        val versionText = findViewById<TextView?>(R.id.splashVersionText)
        versionText?.let {
            val anim = AnimationUtils.loadAnimation(this, R.anim.splash_progress_enter)
            it.startAnimation(anim)
            mainHandler.postDelayed({ it.alpha = 1f }, 2100)
        }
    }

    /**
     * Play startup chime from res/raw/startup_chime.ogg (or .wav).
     * Falls back to silent if file doesn't exist.
     */
    private fun playStartupChime() {
        if (hasPlayedStartupChime) return
        hasPlayedStartupChime = true

        val chimeResId = resources.getIdentifier("startup_chime", "raw", packageName)
        if (chimeResId == 0) {
            playLegacyTone()
            return
        }

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
            } else {
                playLegacyTone()
            }
        } catch (_: Throwable) {
            playLegacyTone()
        }
    }

    /**
     * Legacy 3-tone beep fallback (when no chime file exists).
     */
    private fun playLegacyTone() {
        try {
            val tone = android.media.ToneGenerator(
                android.media.AudioManager.STREAM_MUSIC, 78
            )
            mainHandler.post {
                tone.startTone(android.media.ToneGenerator.TONE_PROP_BEEP2, 110)
            }
            mainHandler.postDelayed({
                tone.startTone(android.media.ToneGenerator.TONE_PROP_BEEP, 135)
            }, 120)
            mainHandler.postDelayed({
                tone.startTone(android.media.ToneGenerator.TONE_PROP_ACK, 240)
            }, 290)
            mainHandler.postDelayed({ tone.release() }, 600)
        } catch (_: Throwable) {
            // Ignore audio failures
        }
    }

    private fun checkFirstRun() {
        val prefs = getSharedPreferences("omnex_player", MODE_PRIVATE)
        val isFirstRun = prefs.getBoolean("first_run", true)
        val hasServerUrl = !prefs.getString("server_url", null).isNullOrBlank()

        if (isFirstRun || !hasServerUrl) {
            navigateToWizard()
        } else {
            navigateToPlayer()
        }
    }

    private fun navigateToWizard() {
        startActivity(Intent(this, WizardActivity::class.java))
        finish()
    }

    private fun navigateToPlayer() {
        val isTV = packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
        val intent = if (isTV) {
            Intent(this, TvActivity::class.java)
        } else {
            Intent(this, MainActivity::class.java)
        }
        startActivity(intent)
        finish()
    }

    private fun enableFullscreen() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
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

    override fun onPause() {
        super.onPause()
        videoView?.pause()
    }

    override fun onResume() {
        super.onResume()
        enableFullscreen()
        videoView?.start()
    }

    override fun onDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        startupPlayer?.release()
        startupPlayer = null
        videoView?.stopPlayback()
        super.onDestroy()
    }
}
