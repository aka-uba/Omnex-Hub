package com.omnex.priceview

import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.os.Build
import android.util.Log

/**
 * CodecChecker - Hardware codec capability detection (Phase 2)
 *
 * Checks if the device supports hardware decoding for video formats.
 * Used to determine if ExoPlayer should be used (native decode) or
 * fallback to WebView (software decode or HLS.js).
 *
 * Supported formats:
 * - H.264/AVC (MP4, most common)
 * - H.265/HEVC (MP4, high efficiency)
 * - VP8/VP9 (WEBM, Google formats)
 *
 * HLS (.m3u8) is a container format that can use any of the above codecs.
 */
object CodecChecker {
    private const val TAG = "CodecChecker"

    // Common MIME types
    const val MIME_TYPE_H264 = "video/avc"           // H.264 (most common, MP4)
    const val MIME_TYPE_H265 = "video/hevc"          // H.265 (HEVC, MP4)
    const val MIME_TYPE_VP8 = "video/x-vnd.on2.vp8"  // VP8 (WEBM)
    const val MIME_TYPE_VP9 = "video/x-vnd.on2.vp9"  // VP9 (WEBM)

    private var cachedResults: MutableMap<String, Boolean>? = null

    /**
     * Check if hardware decoder is available for a MIME type
     *
     * @param mimeType Video MIME type (e.g., "video/avc")
     * @return true if hardware decoder is available
     */
    fun hasHardwareDecoder(mimeType: String): Boolean {
        // Check cache first
        if (cachedResults == null) {
            cachedResults = mutableMapOf()
        }

        if (cachedResults!!.containsKey(mimeType)) {
            return cachedResults!![mimeType]!!
        }

        val result = try {
            @Suppress("DEPRECATION")
            val codecList = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                MediaCodecList(MediaCodecList.REGULAR_CODECS)
            } else {
                null
            }

            val codecInfos = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && codecList != null) {
                codecList.codecInfos
            } else {
                // For older API levels (pre-Lollipop), return empty array
                // ExoPlayer requires Lollipop+ anyway
                emptyArray()
            }

            codecInfos.any { codecInfo ->
                !codecInfo.isEncoder &&
                codecInfo.supportedTypes.any { it.equals(mimeType, ignoreCase = true) } &&
                isHardwareAccelerated(codecInfo)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking codec: $mimeType", e)
            false
        }

        cachedResults!![mimeType] = result
        Log.d(TAG, "Hardware decoder for $mimeType: $result")

        return result
    }

    /**
     * Check if a codec is hardware accelerated
     */
    private fun isHardwareAccelerated(codecInfo: MediaCodecInfo): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+ has explicit hardware flag
            codecInfo.isHardwareAccelerated
        } else {
            // Pre-Android 10: heuristic based on name
            // Hardware codecs usually have vendor-specific names
            val name = codecInfo.name.lowercase()
            !name.startsWith("omx.google.") &&
            !name.startsWith("c2.android.") &&
            (name.contains("qcom") ||      // Qualcomm
             name.contains("mtk") ||       // MediaTek
             name.contains("exynos") ||    // Samsung Exynos
             name.contains("nvidia") ||    // NVIDIA
             name.contains("intel") ||     // Intel
             name.contains("hisi") ||      // Huawei HiSilicon
             name.contains("kirin") ||     // Huawei Kirin
             name.contains("rockchip"))    // Rockchip
        }
    }

    /**
     * Check H.264 hardware support (most common format)
     */
    fun hasH264HardwareDecoder(): Boolean = hasHardwareDecoder(MIME_TYPE_H264)

    /**
     * Check H.265/HEVC hardware support
     */
    fun hasH265HardwareDecoder(): Boolean = hasHardwareDecoder(MIME_TYPE_H265)

    /**
     * Check VP8 hardware support (WEBM)
     */
    fun hasVP8HardwareDecoder(): Boolean = hasHardwareDecoder(MIME_TYPE_VP8)

    /**
     * Check VP9 hardware support (WEBM)
     */
    fun hasVP9HardwareDecoder(): Boolean = hasHardwareDecoder(MIME_TYPE_VP9)

    /**
     * Check if the device supports hardware decode for common formats
     *
     * @return true if at least H.264 is supported
     */
    fun hasBasicHardwareSupport(): Boolean {
        return hasH264HardwareDecoder()
    }

    /**
     * Get a report of all codec capabilities
     */
    fun getCodecReport(): String {
        return buildString {
            appendLine("=== Codec Capabilities ===")
            appendLine("H.264 (AVC):  ${if (hasH264HardwareDecoder()) "✅ HW" else "❌ SW"}")
            appendLine("H.265 (HEVC): ${if (hasH265HardwareDecoder()) "✅ HW" else "❌ SW"}")
            appendLine("VP8:          ${if (hasVP8HardwareDecoder()) "✅ HW" else "❌ SW"}")
            appendLine("VP9:          ${if (hasVP9HardwareDecoder()) "✅ HW" else "❌ SW"}")
            appendLine("=========================")
        }
    }

    /**
     * Get detailed codec list (for debugging)
     */
    fun listAllCodecs(): List<String> {
        @Suppress("DEPRECATION")
        val codecList = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            MediaCodecList(MediaCodecList.REGULAR_CODECS)
        } else {
            null
        }

        val codecInfos = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && codecList != null) {
            codecList.codecInfos
        } else {
            emptyArray()
        }

        return codecInfos.filter { !it.isEncoder }.map { codecInfo ->
            val hw = if (isHardwareAccelerated(codecInfo)) "HW" else "SW"
            "${codecInfo.name} [$hw]: ${codecInfo.supportedTypes.joinToString(", ")}"
        }
    }

    /**
     * Clear codec cache (useful for testing)
     */
    fun clearCache() {
        cachedResults?.clear()
        cachedResults = null
    }

    /**
     * Recommend playback mode based on codec support
     *
     * @return "exoplayer" if hardware decode available, "webview" otherwise
     */
    fun getRecommendedPlaybackMode(): String {
        return if (hasBasicHardwareSupport()) {
            "exoplayer"
        } else {
            "webview"
        }
    }

    /**
     * Get codec info as JSON (for JavaScript bridge)
     */
    fun getCodecInfoJson(): String {
        return """
            {
                "h264": ${hasH264HardwareDecoder()},
                "h265": ${hasH265HardwareDecoder()},
                "vp8": ${hasVP8HardwareDecoder()},
                "vp9": ${hasVP9HardwareDecoder()},
                "recommendedMode": "${getRecommendedPlaybackMode()}"
            }
        """.trimIndent()
    }
}
