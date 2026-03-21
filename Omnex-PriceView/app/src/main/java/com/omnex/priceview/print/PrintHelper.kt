package com.omnex.priceview.print

import android.content.Context
import android.os.Build
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Log
import android.webkit.WebView
import android.webkit.WebViewClient
import com.omnex.priceview.network.ApiClient
import com.omnex.priceview.settings.PriceViewConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONObject
import kotlin.coroutines.resume

/**
 * Android Print Framework wrapper for PriceView.
 *
 * Flow:
 * 1. Fetch print HTML from backend (api/priceview/print/{templateId})
 * 2. Load HTML into hidden WebView
 * 3. Create PrintDocumentAdapter from WebView
 * 4. Send to Android PrintManager (user selects printer)
 */
class PrintHelper(
    private val context: Context,
    private val apiClient: ApiClient,
    private val config: PriceViewConfig
) {
    companion object {
        private const val TAG = "PrintHelper"
    }

    private var printWebView: WebView? = null

    /**
     * Print a product label.
     *
     * @param productId UUID of the product
     * @param templateId UUID of the template
     * @param productName Display name for print job
     */
    suspend fun printProductLabel(
        productId: String,
        templateId: String,
        productName: String
    ): PrintResult {
        // 1. Fetch HTML from backend
        val html = fetchPrintHtml(productId, templateId)
            ?: return PrintResult(false, "Failed to generate print HTML")

        // 2. Load into WebView and print
        return withContext(Dispatchers.Main) {
            printHtml(html, "PriceView - $productName")
        }
    }

    /**
     * Fetch print-ready HTML from backend API.
     */
    private suspend fun fetchPrintHtml(productId: String, templateId: String): String? =
        withContext(Dispatchers.IO) {
            try {
                val body = JSONObject().apply {
                    put("product_id", productId)
                }

                val response = apiClient.getHtml(
                    "/api/priceview/print/$templateId",
                    body
                )

                if (response.success && response.body.isNotBlank()) {
                    Log.d(TAG, "Print HTML fetched: ${response.body.length} chars")
                    response.body
                } else {
                    Log.e(TAG, "Print HTML fetch failed: ${response.statusCode} - ${response.error}")
                    null
                }
            } catch (e: Exception) {
                Log.e(TAG, "Print HTML fetch error", e)
                null
            }
        }

    /**
     * Load HTML into hidden WebView and trigger Android Print.
     * Must be called on Main thread.
     */
    private suspend fun printHtml(html: String, jobName: String): PrintResult =
        suspendCancellableCoroutine { continuation ->
            try {
                // Dispose previous WebView if any
                dispose()

                printWebView = WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false

                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView, url: String?) {
                            try {
                                val printManager = context.getSystemService(
                                    Context.PRINT_SERVICE
                                ) as? PrintManager

                                if (printManager == null) {
                                    Log.e(TAG, "PrintManager not available")
                                    if (continuation.isActive) {
                                        continuation.resume(PrintResult(false, "PrintManager unavailable"))
                                    }
                                    return
                                }

                                val adapter = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                                    view.createPrintDocumentAdapter(jobName)
                                } else {
                                    @Suppress("DEPRECATION")
                                    view.createPrintDocumentAdapter()
                                }

                                val attributes = PrintAttributes.Builder()
                                    .setMediaSize(PrintAttributes.MediaSize.ISO_A7)
                                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                    .build()

                                printManager.print(jobName, adapter, attributes)

                                Log.i(TAG, "Print job created: $jobName")
                                if (continuation.isActive) {
                                    continuation.resume(PrintResult(true))
                                }
                            } catch (e: Exception) {
                                Log.e(TAG, "Print error", e)
                                if (continuation.isActive) {
                                    continuation.resume(PrintResult(false, e.message))
                                }
                            }
                        }
                    }

                    // Load the HTML
                    loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
                }

                continuation.invokeOnCancellation {
                    dispose()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Print setup error", e)
                if (continuation.isActive) {
                    continuation.resume(PrintResult(false, e.message))
                }
            }
        }

    /**
     * Dispose hidden WebView to free memory.
     */
    fun dispose() {
        try {
            printWebView?.stopLoading()
            printWebView?.destroy()
        } catch (e: Exception) {
            Log.w(TAG, "WebView dispose error", e)
        }
        printWebView = null
    }
}

data class PrintResult(
    val success: Boolean,
    val error: String? = null
)
