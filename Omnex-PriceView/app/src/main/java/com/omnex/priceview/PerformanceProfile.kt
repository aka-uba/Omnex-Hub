package com.omnex.priceview

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.webkit.WebView

data class PlayerPerformanceProfile(
    val id: String,
    val useHardwareLayer: Boolean,
    val eagerExoPlayerInit: Boolean,
    val enableServiceWorker: Boolean,
    val enableMediaPrecache: Boolean,
    val heartbeatSeconds: Int,
    val syncSeconds: Int,
    val verifyPollingMs: Int,
    val updateCheckDelayMs: Long,
    val displayBrightness: Float,
    val displayContrast: Float,
    val maxContrast: Float,
    val enableContrastTuning: Boolean
)

object PerformanceProfiles {
    private const val PROFILE_DEFAULT = "default"
    private const val PROFILE_BALANCED = "balanced"
    private const val PROFILE_LEGACY = "legacy"
    private const val PREF_OVERRIDE_KEY = "performance_profile_override"

    private val defaultProfile = PlayerPerformanceProfile(
        id = PROFILE_DEFAULT,
        useHardwareLayer = true,
        eagerExoPlayerInit = true,
        enableServiceWorker = true,
        enableMediaPrecache = true,
        heartbeatSeconds = 5,
        syncSeconds = 60,
        verifyPollingMs = 3000,
        updateCheckDelayMs = 5000L,
        displayBrightness = 1.0f,
        displayContrast = 1.06f,
        maxContrast = 1.30f,
        enableContrastTuning = true
    )

    private val legacyProfile = PlayerPerformanceProfile(
        id = PROFILE_LEGACY,
        useHardwareLayer = false,
        eagerExoPlayerInit = true,
        enableServiceWorker = true,
        enableMediaPrecache = false,
        heartbeatSeconds = 10,
        syncSeconds = 90,
        verifyPollingMs = 5000,
        updateCheckDelayMs = 20000L,
        displayBrightness = 1.0f,
        displayContrast = 1.0f,
        maxContrast = 1.30f,
        enableContrastTuning = true
    )

    private val balancedProfile = PlayerPerformanceProfile(
        id = PROFILE_BALANCED,
        useHardwareLayer = true,
        eagerExoPlayerInit = true,
        enableServiceWorker = true,
        enableMediaPrecache = false,
        heartbeatSeconds = 7,
        syncSeconds = 75,
        verifyPollingMs = 4000,
        updateCheckDelayMs = 10000L,
        displayBrightness = 1.0f,
        displayContrast = 1.04f,
        maxContrast = 1.24f,
        enableContrastTuning = true
    )

    fun resolve(context: Context): PlayerPerformanceProfile {
        return when (getOverride(context)) {
            PROFILE_DEFAULT -> defaultProfile
            PROFILE_BALANCED -> balancedProfile
            PROFILE_LEGACY -> legacyProfile
            else -> detect(context)
        }
    }

    fun getOverride(context: Context): String? {
        val prefs = context.getSharedPreferences("omnex_player", Context.MODE_PRIVATE)
        val value = prefs.getString(PREF_OVERRIDE_KEY, null)?.trim()?.lowercase()
        return when (value) {
            PROFILE_DEFAULT,
            PROFILE_BALANCED,
            PROFILE_LEGACY -> value
            else -> null
        }
    }

    fun setOverride(context: Context, profileId: String): Boolean {
        val normalized = profileId.trim().lowercase()
        val prefs = context.getSharedPreferences("omnex_player", Context.MODE_PRIVATE)

        return when (normalized) {
            "auto" -> {
                prefs.edit().remove(PREF_OVERRIDE_KEY).apply()
                true
            }
            PROFILE_DEFAULT,
            PROFILE_BALANCED,
            PROFILE_LEGACY -> {
                prefs.edit().putString(PREF_OVERRIDE_KEY, normalized).apply()
                true
            }
            else -> false
        }
    }

    /**
     * Profile detection based on OS/WebView version (not RAM).
     *
     * - LEGACY:   WebView <= 83, Android <= 11 (API 30), or system isLowRamDevice flag
     * - BALANCED: Android 12+ (API 31+) - all modern devices
     *
     * RAM is no longer a primary factor because modern low-RAM devices (e.g. Grundig TV 2GB)
     * with Android 13+ and recent WebView can run balanced without issues.
     * Balanced is the safest for signage (lower CPU, minimal swap, no media precache).
     * Even Android 13/14 devices with <=2GB RAM benefit from balanced due to
     * reduced CPU spikes during content transitions and near-zero swap usage.
     * The system isLowRamDevice flag is still respected as it indicates truly constrained
     * hardware (typically < 1GB, set by OEM).
     */
    private fun detect(context: Context): PlayerPerformanceProfile {
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        val lowRamDevice = activityManager?.isLowRamDevice == true
        val webViewMajor = getCurrentWebViewMajorVersion()
        val legacyWebView = webViewMajor != null && webViewMajor <= 83
        val sdkVersion = Build.VERSION.SDK_INT

        // 1. Legacy: Old WebView, old Android, or system-flagged low RAM
        // Android 11 (API 30) and below, or WebView <= 83
        if (lowRamDevice || legacyWebView || sdkVersion <= Build.VERSION_CODES.R) {
            return legacyProfile
        }

        // 2. Android 12+ (API 31+): balanced profile
        // Balanced is the safest for signage (lower CPU, minimal swap, no media precache).
        // Even Android 13/14 devices with <=2GB RAM benefit from balanced due to
        // reduced CPU spikes during content transitions and near-zero swap usage.
        return balancedProfile
    }

    private fun getCurrentWebViewMajorVersion(): Int? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return null
        }

        return try {
            WebView.getCurrentWebViewPackage()
                ?.versionName
                ?.substringBefore('.')
                ?.toIntOrNull()
        } catch (_: Throwable) {
            null
        }
    }
}
