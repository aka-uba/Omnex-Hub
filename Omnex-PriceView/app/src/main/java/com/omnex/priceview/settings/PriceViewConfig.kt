package com.omnex.priceview.settings

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * PriceView configuration - encrypted SharedPreferences for secure token storage.
 * Non-sensitive settings use regular SharedPreferences for compatibility.
 */
class PriceViewConfig(context: Context) {

    /** Encrypted prefs for sensitive data - falls back to regular prefs if Keystore fails */
    private val securePrefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "omnex_priceview_secure",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        // Fallback: some devices have broken Keystore (Android 11 emulator, cheap tablets)
        android.util.Log.w("PriceViewConfig", "EncryptedSharedPreferences failed, using fallback", e)
        context.getSharedPreferences("omnex_priceview_secure_fallback", Context.MODE_PRIVATE)
    }

    /** Regular prefs for non-sensitive settings */
    private val prefs: SharedPreferences =
        context.getSharedPreferences("omnex_priceview_config", Context.MODE_PRIVATE)

    // === Secure Settings ===

    var deviceToken: String?
        get() = securePrefs.getString("device_token", null)
        set(value) = securePrefs.edit().putString("device_token", value).apply()

    var deviceId: String?
        get() = securePrefs.getString("device_id", null)
        set(value) = securePrefs.edit().putString("device_id", value).apply()

    var companyId: String?
        get() = securePrefs.getString("company_id", null)
        set(value) = securePrefs.edit().putString("company_id", value).apply()

    // === General Settings ===

    var serverUrl: String?
        get() = prefs.getString("server_url", null)
        set(value) = prefs.edit().putString("server_url", value).apply()

    var syncIntervalMinutes: Int
        get() = prefs.getInt("sync_interval_minutes", 30)
        set(value) = prefs.edit().putInt("sync_interval_minutes", value).apply()

    var overlayTimeoutSeconds: Int
        get() = prefs.getInt("overlay_timeout_seconds", 10)
        set(value) = prefs.edit().putInt("overlay_timeout_seconds", value).apply()

    var defaultTemplateId: String?
        get() = prefs.getString("default_template_id", null)
        set(value) = prefs.edit().putString("default_template_id", value).apply()

    var lastPrinterName: String?
        get() = prefs.getString("last_printer_name", null)
        set(value) = prefs.edit().putString("last_printer_name", value).apply()

    var fontSizeMultiplier: Float
        get() = prefs.getFloat("font_size_multiplier", 1.0f)
        set(value) = prefs.edit().putFloat("font_size_multiplier", value).apply()

    var scanSoundEnabled: Boolean
        get() = prefs.getBoolean("scan_sound_enabled", true)
        set(value) = prefs.edit().putBoolean("scan_sound_enabled", value).apply()

    var autoPrintEnabled: Boolean
        get() = prefs.getBoolean("auto_print_enabled", false)
        set(value) = prefs.edit().putBoolean("auto_print_enabled", value).apply()

    var cameraTorchDefault: Boolean
        get() = prefs.getBoolean("camera_torch_default", false)
        set(value) = prefs.edit().putBoolean("camera_torch_default", value).apply()

    var printEnabled: Boolean
        get() = prefs.getBoolean("print_enabled", true)
        set(value) = prefs.edit().putBoolean("print_enabled", value).apply()

    var signageEnabled: Boolean
        get() = prefs.getBoolean("signage_enabled", true)
        set(value) = prefs.edit().putBoolean("signage_enabled", value).apply()

    /** Product overlay render mode: native | html */
    var productDisplayMode: String
        get() = prefs.getString("product_display_mode", "native") ?: "native"
        set(value) = prefs.edit().putString("product_display_mode", value).apply()

    /** Resolved display template name from server (effective company/device selection). */
    var displayTemplateName: String?
        get() = prefs.getString("display_template_name", null)
        set(value) = prefs.edit().putString("display_template_name", value).apply()

    /** Signature/hash used to avoid re-downloading unchanged HTML templates. */
    var displayTemplateSignature: String?
        get() = prefs.getString("display_template_signature", null)
        set(value) = prefs.edit().putString("display_template_signature", value).apply()

    /** Cached "product found" HTML template payload. */
    var displayTemplateProductHtml: String?
        get() = prefs.getString("display_template_product_html", null)
        set(value) = prefs.edit().putString("display_template_product_html", value).apply()

    /** Cached "not found" HTML template payload. */
    var displayTemplateNotFoundHtml: String?
        get() = prefs.getString("display_template_not_found_html", null)
        set(value) = prefs.edit().putString("display_template_not_found_html", value).apply()

    /** Last config sync metadata (used by template bindings like company/branch name). */
    var companyName: String?
        get() = prefs.getString("company_name", null)
        set(value) = prefs.edit().putString("company_name", value).apply()

    var branchName: String?
        get() = prefs.getString("branch_name", null)
        set(value) = prefs.edit().putString("branch_name", value).apply()

    /** Input mode: "camera" or "keyboard" (D-pad devices) */
    var inputMode: String
        get() = prefs.getString("input_mode", "camera") ?: "camera"
        set(value) = prefs.edit().putString("input_mode", value).apply()

    var firstRunCompleted: Boolean
        get() = prefs.getBoolean("first_run_completed", false)
        set(value) = prefs.edit().putBoolean("first_run_completed", value).apply()

    // === Helpers ===

    val isDeviceRegistered: Boolean
        get() = !deviceToken.isNullOrBlank()

    fun clearDeviceAuth() {
        deviceToken = null
        deviceId = null
        companyId = null
    }

    fun clearAll() {
        securePrefs.edit().clear().apply()
        prefs.edit().clear().apply()
    }
}
