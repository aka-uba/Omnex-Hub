package com.omnex.priceview.sync

import android.util.Log
import com.omnex.priceview.network.ApiClient
import com.omnex.priceview.settings.PriceViewConfig
import org.json.JSONObject
import java.security.MessageDigest

/**
 * Syncs PriceView HTML overlay templates based on remote /api/priceview/config metadata.
 */
class DisplayTemplateSyncManager(
    private val apiClient: ApiClient,
    private val config: PriceViewConfig
) {
    companion object {
        private const val TAG = "DisplayTemplateSync"
    }

    /**
     * Apply remote config fields and sync HTML templates only when signature/name changes.
     */
    fun applyConfigAndSyncTemplates(configJson: JSONObject) {
        val mode = configJson.optString("product_display_mode", "native")
        val templateName = configJson.optString("display_template_name", "")
        val templateSignature = configJson.optString("display_template_signature", "")
        val templateUrl = configJson.optString("display_template_url", "/api/priceview/display-template")
        val previousTemplateName = config.displayTemplateName.orEmpty()
        val previousSignature = config.displayTemplateSignature.orEmpty()
        val hasCachedProduct = !config.displayTemplateProductHtml.isNullOrBlank()
        val hasCachedNotFound = !config.displayTemplateNotFoundHtml.isNullOrBlank()

        config.productDisplayMode = if (mode == "html") "html" else "native"
        if (templateName.isNotBlank()) {
            config.displayTemplateName = templateName
        }
        if (configJson.has("company_name")) {
            val value = configJson.optString("company_name", "")
            config.companyName = if (value.isBlank() || value == "null") null else value
        }
        if (configJson.has("branch_name")) {
            val value = configJson.optString("branch_name", "")
            config.branchName = if (value.isBlank() || value == "null") null else value
        }

        if (config.productDisplayMode != "html") {
            Log.d(TAG, "Display mode is native, template sync skipped")
            return
        }

        val templateNameChanged = templateName.isNotBlank() && templateName != previousTemplateName
        val signatureChanged = templateSignature.isNotBlank() && templateSignature != previousSignature

        val shouldFetch = !hasCachedProduct ||
            !hasCachedNotFound ||
            templateSignature.isBlank() ||
            templateNameChanged ||
            signatureChanged

        if (!shouldFetch) {
            Log.d(
                TAG,
                "Display templates unchanged, using cached HTML (tpl=$templateName sig=$templateSignature cachedTpl=$previousTemplateName cachedSig=$previousSignature)"
            )
            return
        }

        try {
            val response = apiClient.get(templateUrl)
            if (!response.success) {
                Log.w(TAG, "Template fetch failed: status=${response.statusCode} err=${response.error}")
                return
            }

            val payload = response.toJson() ?: run {
                Log.w(TAG, "Template fetch response JSON parse failed")
                return
            }

            val productHtml = payload.optString("product_html", payload.optString("html", ""))
            val notFoundHtml = payload.optString("not_found_html", "")
            val resolvedTemplateName = payload.optString("template_name", templateName)
            val resolvedSignature = payload.optString("template_signature", templateSignature)

            if (productHtml.isBlank()) {
                Log.w(TAG, "Template fetch succeeded but product_html is empty")
                return
            }

            config.displayTemplateProductHtml = productHtml
            config.displayTemplateNotFoundHtml = if (notFoundHtml.isNotBlank()) {
                notFoundHtml
            } else {
                config.displayTemplateNotFoundHtml
            }

            config.displayTemplateName = if (resolvedTemplateName.isNotBlank()) {
                resolvedTemplateName
            } else {
                templateName.ifBlank { config.displayTemplateName }
            }

            config.displayTemplateSignature = if (resolvedSignature.isNotBlank()) {
                resolvedSignature
            } else {
                sha1Hex((config.displayTemplateName ?: "") + "|" + productHtml + "|" + (config.displayTemplateNotFoundHtml ?: ""))
            }

            Log.i(
                TAG,
                "Display templates synced: mode=${config.productDisplayMode}, template=${config.displayTemplateName}, sig=${config.displayTemplateSignature}"
            )
        } catch (e: Exception) {
            Log.w(TAG, "Template sync error: ${e.message}", e)
        }
    }

    private fun sha1Hex(value: String): String {
        val digest = MessageDigest.getInstance("SHA-1").digest(value.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }
}
