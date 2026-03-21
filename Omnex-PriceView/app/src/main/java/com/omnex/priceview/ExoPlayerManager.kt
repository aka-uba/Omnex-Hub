package com.omnex.priceview

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.graphics.Rect
import android.util.Log
import android.view.MotionEvent
import android.view.View
import android.view.animation.PathInterpolator
import android.webkit.WebView
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.PlaybackException
import com.google.android.exoplayer2.Player
import com.google.android.exoplayer2.source.hls.HlsMediaSource
import com.google.android.exoplayer2.ui.PlayerView
import com.google.android.exoplayer2.upstream.DefaultDataSource
import com.google.android.exoplayer2.video.VideoSize

/**
 * ExoPlayerManager - Hybrid video playback manager (Phase 2)
 *
 * Manages native video playback with ExoPlayer for better performance.
 * Falls back to WebView when codec is not supported or playback fails.
 *
 * Architecture:
 * - WebView: UI, playlist management, sync, image content
 * - ExoPlayer: Native video decode (HLS, MP4, WEBM)
 *
 * Features:
 * - Hardware decode detection
 * - Automatic fallback to WebView
 * - HLS adaptive streaming support
 * - Seamless loop playback
 * - Resource management
 */
class ExoPlayerManager(
    private val context: Context,
    private val playerView: PlayerView,
    private val webView: WebView,
    private val onPlaybackError: ((error: String) -> Unit)? = null
) {
    companion object {
        private const val TAG = "ExoPlayerManager"
    }

    private var exoPlayer: ExoPlayer? = null
    private var preloadPlayer: ExoPlayer? = null
    private var preloadedUrl: String? = null
    private var currentVideoUrl: String? = null
    private var isUsingExoPlayer = false

    // Transition settings (set from JS bridge)
    private var transitionType: String = "none"
    private var transitionDuration: Long = 500L
    private var currentAnimator: AnimatorSet? = null
    private var isSwitchingToWebView = false
    private val cssEaseInterpolator = PathInterpolator(0.25f, 0.1f, 0.25f, 1f)
    // Native player can animate using transition values calculated by JS.
    // JS remains the source of truth for transition selection/direction.
    private val jsOwnsTransitions = false

    private fun setWebViewTransparencyForNativeVideo(enabled: Boolean) {
        webView.setBackgroundColor(if (enabled) Color.TRANSPARENT else Color.BLACK)
    }

    private fun resolveNativeTransition(requestedType: String): String {
        val normalized = requestedType.lowercase().trim()
        val supported = setOf(
            "none",
            "fade",
            "crossfade",
            "zoom",
            "zoom-in",
            "zoom-out",
            "slide-left",
            "slide-right",
            "slide-up",
            "slide-down",
            "push-left",
            "push-right",
            "push-up",
            "push-down",
            "wipe-left",
            "wipe-right",
            "wipe-up",
            "wipe-down"
        )

        return if (supported.contains(normalized)) normalized else "fade"
    }

    private fun getTransitionTravelWidth(): Float {
        val parentWidth = (playerView.parent as? View)?.width ?: 0
        val width = maxOf(
            playerView.width,
            parentWidth,
            webView.width,
            context.resources.displayMetrics.widthPixels,
            1
        )
        return width.toFloat()
    }

    private fun getTransitionTravelHeight(): Float {
        val parentHeight = (playerView.parent as? View)?.height ?: 0
        val height = maxOf(
            playerView.height,
            parentHeight,
            webView.height,
            context.resources.displayMetrics.heightPixels,
            1
        )
        return height.toFloat()
    }

    private fun getTransitionTravelWidthPx(): Int = maxOf(getTransitionTravelWidth().toInt(), 1)

    private fun getTransitionTravelHeightPx(): Int = maxOf(getTransitionTravelHeight().toInt(), 1)

    private fun createWipeEnterAnimator(type: String): Animator {
        val width = getTransitionTravelWidthPx()
        val height = getTransitionTravelHeightPx()

        // Match CSS wipe keyframes by animating the visible clip rectangle.
        playerView.clipBounds = when (type) {
            "wipe-left" -> Rect(0, 0, 0, height)
            "wipe-right" -> Rect(width, 0, width, height)
            "wipe-up" -> Rect(0, 0, width, 0)
            "wipe-down" -> Rect(0, height, width, height)
            else -> Rect(0, 0, width, height)
        }

        return ValueAnimator.ofFloat(0f, 1f).apply {
            duration = transitionDuration
            addUpdateListener { animator ->
                val p = animator.animatedValue as Float
                val rect = when (type) {
                    "wipe-left" -> Rect(
                        0,
                        0,
                        (width * p).toInt().coerceIn(0, width),
                        height
                    )
                    "wipe-right" -> Rect(
                        (width * (1f - p)).toInt().coerceIn(0, width),
                        0,
                        width,
                        height
                    )
                    "wipe-up" -> Rect(
                        0,
                        0,
                        width,
                        (height * p).toInt().coerceIn(0, height)
                    )
                    "wipe-down" -> Rect(
                        0,
                        (height * (1f - p)).toInt().coerceIn(0, height),
                        width,
                        height
                    )
                    else -> Rect(0, 0, width, height)
                }
                playerView.clipBounds = rect
            }
        }
    }

    private fun createWipeExitAnimator(type: String): Animator {
        val width = getTransitionTravelWidthPx()
        val height = getTransitionTravelHeightPx()

        playerView.clipBounds = Rect(0, 0, width, height)

        return ValueAnimator.ofFloat(0f, 1f).apply {
            duration = transitionDuration
            addUpdateListener { animator ->
                val p = animator.animatedValue as Float
                val rect = when (type) {
                    "wipe-left" -> Rect(
                        0,
                        0,
                        (width * (1f - p)).toInt().coerceIn(0, width),
                        height
                    )
                    "wipe-right" -> Rect(
                        (width * p).toInt().coerceIn(0, width),
                        0,
                        width,
                        height
                    )
                    "wipe-up" -> Rect(
                        0,
                        0,
                        width,
                        (height * (1f - p)).toInt().coerceIn(0, height)
                    )
                    "wipe-down" -> Rect(
                        0,
                        (height * p).toInt().coerceIn(0, height),
                        width,
                        height
                    )
                    else -> Rect(0, 0, width, height)
                }
                playerView.clipBounds = rect
            }
        }
    }

    /**
     * Initialize ExoPlayer instance
     */
    fun initialize() {
        try {
            exoPlayer = ExoPlayer.Builder(context)
                .build()
                .also { player ->
                    playerView.player = player

                    // Configure player
                    player.repeatMode = Player.REPEAT_MODE_OFF
                    player.playWhenReady = true

                    // Keep WebView controls clickable when native video overlay is visible.
                    playerView.isFocusable = false
                    playerView.isFocusableInTouchMode = false
                    playerView.isClickable = false
                    playerView.setOnTouchListener { _, event ->
                        val copied = MotionEvent.obtain(event)
                        val dispatched = webView.dispatchTouchEvent(copied)
                        copied.recycle()
                        dispatched
                    }

                    // Add listeners
                    player.addListener(object : Player.Listener {
                        override fun onPlaybackStateChanged(playbackState: Int) {
                            when (playbackState) {
                                Player.STATE_READY -> {
                                    Log.d(TAG, "ExoPlayer ready")
                                }
                                Player.STATE_ENDED -> {
                                    Log.d(TAG, "ExoPlayer ended")
                                    handlePlaybackEnded()
                                }
                                Player.STATE_BUFFERING -> {
                                    Log.d(TAG, "ExoPlayer buffering")
                                }
                                Player.STATE_IDLE -> {
                                    Log.d(TAG, "ExoPlayer idle")
                                }
                            }
                        }

                        override fun onPlayerError(error: PlaybackException) {
                            Log.e(TAG, "ExoPlayer error: ${error.message}", error)
                            handlePlaybackError(error.message ?: "Unknown error")
                        }

                        override fun onVideoSizeChanged(videoSize: VideoSize) {
                            Log.d(TAG, "Video size: ${videoSize.width}x${videoSize.height}")
                        }
                    })
                }

            Log.i(TAG, "ExoPlayer initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize ExoPlayer", e)
            onPlaybackError?.invoke("ExoPlayer initialization failed: ${e.message}")
        }
    }

    /**
     * Play video with ExoPlayer (HLS or MP4/WEBM)
     *
     * @param url Video URL (HLS m3u8, MP4, WEBM)
     * @param useNative Force native playback (skip codec check)
     * @param muted Audio muted state (default: true)
     * @return true if ExoPlayer started, false if fallback needed
     */
    fun playVideo(url: String, useNative: Boolean = true, muted: Boolean = true): Boolean {
        if (!useNative) {
            Log.i(TAG, "Native playback disabled, using WebView")
            return false
        }

        val player = exoPlayer
        if (player == null) {
            Log.w(TAG, "ExoPlayer not initialized")
            return false
        }

        try {
            currentVideoUrl = url

            // Check if this URL was preloaded - swap players for instant start
            if (preloadedUrl == url && preloadPlayer != null) {
                Log.i(TAG, "Using preloaded video: $url - Muted: $muted")
                swapPreloadToMain(muted)
                switchToExoPlayer()
                return true
            }

            // Not preloaded - load normally
            releasePreload()

            val isHls = url.contains(".m3u8") || url.contains("hls")
            Log.i(TAG, "Playing video: $url (${if (isHls) "HLS" else "MP4/WEBM"}) - Muted: $muted")

            player.volume = if (muted) 0f else 1f

            if (isHls) {
                val dataSourceFactory = DefaultDataSource.Factory(context)
                val hlsMediaSource = HlsMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(Uri.parse(url)))
                player.setMediaSource(hlsMediaSource)
            } else {
                val mediaItem = MediaItem.fromUri(Uri.parse(url))
                player.setMediaItem(mediaItem)
            }

            player.prepare()
            player.play()

            switchToExoPlayer()
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play video with ExoPlayer", e)
            handlePlaybackError(e.message ?: "Playback failed")
            return false
        }
    }

    /**
     * Preload the next video URL so it starts instantly when playVideo() is called.
     * Creates a secondary ExoPlayer that buffers the video in the background.
     * On low-RAM devices, only buffers metadata (no full buffer).
     */
    fun preloadNextVideo(url: String) {
        if (url == preloadedUrl) return // Already preloaded
        if (url == currentVideoUrl) return // Currently playing

        releasePreload()

        try {
            val preload = ExoPlayer.Builder(context).build()
            preload.playWhenReady = false // Buffer only, don't play
            preload.volume = 0f

            val isHls = url.contains(".m3u8") || url.contains("hls")
            if (isHls) {
                val dataSourceFactory = DefaultDataSource.Factory(context)
                val hlsMediaSource = HlsMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(Uri.parse(url)))
                preload.setMediaSource(hlsMediaSource)
            } else {
                preload.setMediaItem(MediaItem.fromUri(Uri.parse(url)))
            }

            preload.prepare() // Start buffering
            preloadPlayer = preload
            preloadedUrl = url

            Log.i(TAG, "Preloading next video: $url")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to preload video: ${e.message}")
            releasePreload()
        }
    }

    /**
     * Swap preloaded player to main player for instant playback.
     */
    private fun swapPreloadToMain(muted: Boolean) {
        val preload = preloadPlayer ?: return
        val oldMain = exoPlayer

        // Stop and release the old main player
        oldMain?.stop()
        oldMain?.release()

        // Promote preload to main
        preload.volume = if (muted) 0f else 1f
        preload.playWhenReady = true
        preload.repeatMode = Player.REPEAT_MODE_OFF
        playerView.player = preload

        // Re-add ended/error listener
        preload.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                when (playbackState) {
                    Player.STATE_ENDED -> handlePlaybackEnded()
                    else -> {}
                }
            }
            override fun onPlayerError(error: PlaybackException) {
                handlePlaybackError(error.message ?: "Unknown error")
            }
        })

        exoPlayer = preload
        preloadPlayer = null
        preloadedUrl = null
        isUsingExoPlayer = true

        Log.i(TAG, "Swapped preloaded player to main - instant start")
    }

    /**
     * Release the preload player to free memory.
     */
    private fun releasePreload() {
        preloadPlayer?.apply {
            stop()
            release()
        }
        preloadPlayer = null
        preloadedUrl = null
    }

    /**
     * Explicitly clear any preloaded video buffer.
     * Useful before switching to HTML/WebView content that also decodes video.
     */
    fun clearPreloadedVideo() {
        releasePreload()
        Log.d(TAG, "Preloaded video cleared")
    }

    /**
     * Stop ExoPlayer and switch back to WebView
     */
    fun stopVideo() {
        try {
            // Do NOT releasePreload() here - the preloaded video will be
            // consumed by the next playVideo() call. Releasing it here
            // destroys the buffer right before it's needed.
            val player = exoPlayer
            if (player == null) {
                switchToWebView()
                currentVideoUrl = null
                return
            }

            val shouldAnimateExit =
                isUsingExoPlayer &&
                !jsOwnsTransitions &&
                transitionType != "none" &&
                transitionDuration > 0L &&
                playerView.visibility == View.VISIBLE

            if (shouldAnimateExit) {
                // Freeze last frame so WebView content can animate in behind it.
                player.pause()
                switchToWebView(animateExit = true) {
                    try {
                        if (!isUsingExoPlayer) {
                            player.stop()
                            player.clearMediaItems()
                        }
                    } catch (_: Throwable) {
                    }
                }
                currentVideoUrl = null
                Log.d(TAG, "Video stop requested with animated native exit")
                return
            }

            player.stop()
            player.clearMediaItems()
            switchToWebView()
            currentVideoUrl = null

            Log.d(TAG, "Video stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping video", e)
        }
    }

    /**
     * Pause playback
     */
    fun pause() {
        exoPlayer?.pause()
        Log.d(TAG, "Playback paused")
    }

    /**
     * Resume playback
     */
    fun resume() {
        exoPlayer?.play()
        Log.d(TAG, "Playback resumed")
    }

    /**
     * Check if currently using ExoPlayer for playback
     */
    fun isPlayingNatively(): Boolean = isUsingExoPlayer

    /**
     * Get current video URL
     */
    fun getCurrentUrl(): String? = currentVideoUrl

    /**
     * Release ExoPlayer resources
     */
    fun release() {
        try {
            releasePreload()

            exoPlayer?.apply {
                stop()
                release()
            }
            exoPlayer = null

            switchToWebView()

            Log.i(TAG, "ExoPlayer released")
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing ExoPlayer", e)
        }
    }

    /**
     * Set transition type and duration from JS bridge.
     * Called before playVideo() to configure how video appears.
     */
    fun setTransition(type: String, durationMs: Long) {
        val requestedType = type.lowercase().trim()
        transitionType = resolveNativeTransition(requestedType)
        // Keep JS-provided timing exact for cross-client transition parity.
        transitionDuration = durationMs.coerceAtLeast(0L)
        Log.d(TAG, "Transition set: $requestedType -> $transitionType, ${transitionDuration}ms (jsOwns=$jsOwnsTransitions)")
    }

    /**
     * Switch to ExoPlayer display with enter transition animation
     */
    private fun switchToExoPlayer() {
        isSwitchingToWebView = false
        currentAnimator?.cancel()
        currentAnimator = null

        playerView.visibility = View.VISIBLE
        setWebViewTransparencyForNativeVideo(true)
        // Keep WebView as the top layer so JS overlays (orientation icon, UI controls)
        // stay visible above native video while WebView background is transparent.
        webView.bringToFront()
        isUsingExoPlayer = true

        if (jsOwnsTransitions || transitionType == "none" || transitionDuration <= 0) {
            // No transition - instant show
            playerView.alpha = 1f
            playerView.scaleX = 1f
            playerView.scaleY = 1f
            playerView.translationX = 0f
            playerView.translationY = 0f
            playerView.clipBounds = null
            if (jsOwnsTransitions) {
                Log.d(TAG, "Switched to ExoPlayer display (instant, JS-driven transition)")
            } else {
                Log.d(TAG, "Switched to ExoPlayer display (instant)")
            }
            return
        }

        // Apply enter transition animation
        val animators = mutableListOf<Animator>()
        when (transitionType) {
            "fade", "crossfade" -> {
                playerView.alpha = 0f
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 0f, 1f).apply {
                    duration = transitionDuration
                })
            }
            "zoom", "zoom-in" -> {
                playerView.alpha = 0f
                playerView.scaleX = 0.88f
                playerView.scaleY = 0.88f
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 0f, 1f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.SCALE_X, 0.88f, 1f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.SCALE_Y, 0.88f, 1f).apply {
                    duration = transitionDuration
                })
            }
            "zoom-out" -> {
                playerView.alpha = 0f
                playerView.scaleX = 1.12f
                playerView.scaleY = 1.12f
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 0f, 1f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.SCALE_X, 1.12f, 1f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.SCALE_Y, 1.12f, 1f).apply {
                    duration = transitionDuration
                })
            }
            "slide-left" -> {
                val width = getTransitionTravelWidth()
                Log.d(TAG, "Enter transition ${transitionType} travelX=$width view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                val start = width * 0.14f
                playerView.alpha = 0f
                playerView.translationX = start
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 0f, 1f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_X, start, 0f).apply {
                    duration = transitionDuration
                })
            }
            "slide-up" -> {
                val height = getTransitionTravelHeight()
                Log.d(TAG, "Enter transition ${transitionType} travelY=$height view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                val start = height * 0.14f
                playerView.alpha = 0f
                playerView.translationY = start
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 0f, 1f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_Y, start, 0f).apply {
                    duration = transitionDuration
                })
            }
            "slide-right" -> {
                val width = getTransitionTravelWidth()
                Log.d(TAG, "Enter transition ${transitionType} travelX=$width view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                val start = -(width * 0.14f)
                playerView.alpha = 0f
                playerView.translationX = start
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 0f, 1f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_X, start, 0f).apply {
                    duration = transitionDuration
                })
            }
            "slide-down" -> {
                val height = getTransitionTravelHeight()
                Log.d(TAG, "Enter transition ${transitionType} travelY=$height view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                val start = -(height * 0.14f)
                playerView.alpha = 0f
                playerView.translationY = start
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 0f, 1f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_Y, start, 0f).apply {
                    duration = transitionDuration
                })
            }
            "push-left" -> {
                val width = getTransitionTravelWidth()
                Log.d(TAG, "Enter transition ${transitionType} travelX=$width view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                playerView.alpha = 1f
                playerView.clipBounds = null
                playerView.translationX = width
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_X, width, 0f).apply {
                    duration = transitionDuration
                })
            }
            "push-up" -> {
                val height = getTransitionTravelHeight()
                Log.d(TAG, "Enter transition ${transitionType} travelY=$height view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                playerView.alpha = 1f
                playerView.clipBounds = null
                playerView.translationY = height
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_Y, height, 0f).apply {
                    duration = transitionDuration
                })
            }
            "push-right" -> {
                val width = getTransitionTravelWidth()
                Log.d(TAG, "Enter transition ${transitionType} travelX=$width view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                playerView.alpha = 1f
                playerView.clipBounds = null
                playerView.translationX = -width
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_X, -width, 0f).apply {
                    duration = transitionDuration
                })
            }
            "push-down" -> {
                val height = getTransitionTravelHeight()
                Log.d(TAG, "Enter transition ${transitionType} travelY=$height view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                playerView.alpha = 1f
                playerView.clipBounds = null
                playerView.translationY = -height
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_Y, -height, 0f).apply {
                    duration = transitionDuration
                })
            }
            "wipe-left", "wipe-right", "wipe-up", "wipe-down" -> {
                playerView.alpha = 1f
                playerView.translationX = 0f
                playerView.translationY = 0f
                animators.add(createWipeEnterAnimator(transitionType))
            }
            else -> {
                // Unknown transition type - use fade as fallback
                playerView.alpha = 0f
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 0f, 1f).apply {
                    duration = transitionDuration
                })
            }
        }

        if (animators.isNotEmpty()) {
            currentAnimator = AnimatorSet().apply {
                playTogether(animators)
                interpolator = cssEaseInterpolator
                addListener(object : AnimatorListenerAdapter() {
                    override fun onAnimationEnd(animation: Animator) {
                        // Reset transform state after animation
                        playerView.scaleX = 1f
                        playerView.scaleY = 1f
                        playerView.translationX = 0f
                        playerView.translationY = 0f
                        playerView.alpha = 1f
                        playerView.clipBounds = null
                        currentAnimator = null
                    }
                })
                start()
            }
            Log.d(TAG, "Switched to ExoPlayer with $transitionType transition (${transitionDuration}ms)")
        }
    }

    /**
     * Switch to WebView display
     */
    private fun switchToWebView(animateExit: Boolean = false, onHidden: (() -> Unit)? = null) {
        currentAnimator?.cancel()
        currentAnimator = null

        fun applyWebViewVisibleState() {
            playerView.visibility = View.GONE
            playerView.alpha = 1f
            playerView.scaleX = 1f
            playerView.scaleY = 1f
            playerView.translationX = 0f
            playerView.translationY = 0f
            playerView.clipBounds = null
            setWebViewTransparencyForNativeVideo(false)
            webView.bringToFront()
            isUsingExoPlayer = false
            onHidden?.invoke()
        }

        val shouldAnimate =
            animateExit &&
            !jsOwnsTransitions &&
            transitionType != "none" &&
            transitionDuration > 0L &&
            playerView.visibility == View.VISIBLE

        if (!shouldAnimate) {
            isSwitchingToWebView = false
            applyWebViewVisibleState()
            Log.d(TAG, "Switched to WebView display")
            return
        }

        isSwitchingToWebView = true
        val animators = mutableListOf<Animator>()

        when (transitionType) {
            "fade", "crossfade" -> {
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 1f, 0f).apply {
                    duration = transitionDuration
                })
            }
            "zoom", "zoom-in" -> {
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 1f, 0f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.SCALE_X, 1f, 1.08f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.SCALE_Y, 1f, 1.08f).apply {
                    duration = transitionDuration
                })
            }
            "zoom-out" -> {
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 1f, 0f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.SCALE_X, 1f, 0.92f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.SCALE_Y, 1f, 0.92f).apply {
                    duration = transitionDuration
                })
            }
            "slide-left" -> {
                val width = getTransitionTravelWidth()
                Log.d(TAG, "Exit transition ${transitionType} travelX=$width view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                val target = -(width * 0.10f)
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 1f, 0f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_X, 0f, target).apply {
                    duration = transitionDuration
                })
            }
            "slide-right" -> {
                val width = getTransitionTravelWidth()
                Log.d(TAG, "Exit transition ${transitionType} travelX=$width view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                val target = width * 0.10f
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 1f, 0f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_X, 0f, target).apply {
                    duration = transitionDuration
                })
            }
            "slide-up" -> {
                val height = getTransitionTravelHeight()
                Log.d(TAG, "Exit transition ${transitionType} travelY=$height view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                val target = -(height * 0.10f)
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 1f, 0f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_Y, 0f, target).apply {
                    duration = transitionDuration
                })
            }
            "slide-down" -> {
                val height = getTransitionTravelHeight()
                Log.d(TAG, "Exit transition ${transitionType} travelY=$height view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                val target = height * 0.10f
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 1f, 0f).apply {
                    duration = transitionDuration
                })
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_Y, 0f, target).apply {
                    duration = transitionDuration
                })
            }
            "push-left" -> {
                val width = getTransitionTravelWidth()
                Log.d(TAG, "Exit transition ${transitionType} travelX=$width view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_X, 0f, -width).apply {
                    duration = transitionDuration
                })
            }
            "push-right" -> {
                val width = getTransitionTravelWidth()
                Log.d(TAG, "Exit transition ${transitionType} travelX=$width view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_X, 0f, width).apply {
                    duration = transitionDuration
                })
            }
            "push-up" -> {
                val height = getTransitionTravelHeight()
                Log.d(TAG, "Exit transition ${transitionType} travelY=$height view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_Y, 0f, -height).apply {
                    duration = transitionDuration
                })
            }
            "push-down" -> {
                val height = getTransitionTravelHeight()
                Log.d(TAG, "Exit transition ${transitionType} travelY=$height view=${playerView.width}x${playerView.height} web=${webView.width}x${webView.height}")
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.TRANSLATION_Y, 0f, height).apply {
                    duration = transitionDuration
                })
            }
            "wipe-left", "wipe-right", "wipe-up", "wipe-down" -> {
                playerView.alpha = 1f
                playerView.translationX = 0f
                playerView.translationY = 0f
                animators.add(createWipeExitAnimator(transitionType))
            }
            else -> {
                playerView.clipBounds = null
                animators.add(ObjectAnimator.ofFloat(playerView, View.ALPHA, 1f, 0f).apply {
                    duration = transitionDuration
                })
            }
        }

        currentAnimator = AnimatorSet().apply {
            playTogether(animators)
            interpolator = cssEaseInterpolator
            addListener(object : AnimatorListenerAdapter() {
                private var handled = false
                private fun finalizeExit() {
                    if (handled) return
                    handled = true
                    if (!isSwitchingToWebView) {
                        currentAnimator = null
                        return
                    }
                    isSwitchingToWebView = false
                    applyWebViewVisibleState()
                    currentAnimator = null
                    Log.d(TAG, "Switched to WebView display (animated $transitionType)")
                }

                override fun onAnimationEnd(animation: Animator) {
                    finalizeExit()
                }

                override fun onAnimationCancel(animation: Animator) {
                    finalizeExit()
                }
            })
            start()
        }
    }

    /**
     * Handle playback error and fallback to WebView
     */
    private fun handlePlaybackError(error: String) {
        Log.w(TAG, "Falling back to WebView due to error: $error")

        switchToWebView()
        onPlaybackError?.invoke(error)

        // Notify WebView to take over playback
        currentVideoUrl?.let { url ->
            webView.evaluateJavascript(
                "if (window.OmnexPlayer && window.OmnexPlayer.fallbackToWebView) { " +
                "  window.OmnexPlayer.fallbackToWebView('$url', '$error'); " +
                "}",
                null
            )
        }
    }

    private fun handlePlaybackEnded() {
        switchToWebView()
        webView.post {
            webView.evaluateJavascript(
                "if (window.OmnexPlayer && window.OmnexPlayer.onNativeVideoEnded) { " +
                "  window.OmnexPlayer.onNativeVideoEnded(); " +
                "}",
                null
            )
        }
    }

    /**
     * Set video volume (0.0 to 1.0)
     */
    fun setVolume(volume: Float) {
        exoPlayer?.volume = volume.coerceIn(0f, 1f)
        Log.d(TAG, "Volume set to $volume")
    }

    /**
     * Check if ExoPlayer is currently playing
     */
    fun isPlaying(): Boolean = exoPlayer?.isPlaying == true

    /**
     * Get current playback position in milliseconds
     */
    fun getCurrentPosition(): Long = exoPlayer?.currentPosition ?: 0L

    /**
     * Get total duration in milliseconds
     */
    fun getDuration(): Long = exoPlayer?.duration ?: 0L
}
