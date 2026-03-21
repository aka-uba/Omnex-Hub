package com.omnex.priceview.overlay

import android.animation.ObjectAnimator
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import androidx.camera.view.PreviewView
import com.omnex.priceview.data.entities.ProductEntity
import com.omnex.priceview.settings.PriceViewConfig
import org.json.JSONObject
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Date
import java.util.Locale

/**
 * Manages PriceView overlay visibility, mode switching (native/html), animations and timeout.
 */
class PriceViewOverlayManager(
    private val overlayContainer: FrameLayout,
    private val cameraPreview: PreviewView,
    private val productCard: View,
    private val scanPrompt: View,
    private val notFoundView: View,
    private val printButton: View,
    private val productNameText: TextView,
    private val productPriceText: TextView,
    private val productBarcodeText: TextView,
    private val productImageView: ImageView?,
    private val closeButton: ImageButton?,
    private val torchButton: ImageButton?,
    private val productHtmlWebView: WebView?,
    private val notFoundHtmlWebView: WebView?,
    private val config: PriceViewConfig
) {
    companion object {
        private const val TAG = "PriceViewOverlay"
        private const val ANIMATION_DURATION = 300L
    }

    private val handler = Handler(Looper.getMainLooper())
    private var timeoutRunnable: Runnable? = null
    private var _isVisible = false
    private var currentProduct: ProductEntity? = null

    private var productDisplayMode: String = "native"
    private var productTemplateHtml: String? = null
    private var notFoundTemplateHtml: String? = null
    private var companyName: String? = null
    private var branchName: String? = null

    val isVisible: Boolean get() = _isVisible

    var onShowListener: (() -> Unit)? = null
    var onHideListener: (() -> Unit)? = null
    var onPrintRequested: ((ProductEntity) -> Unit)? = null

    init {
        closeButton?.setOnClickListener { hide() }
        printButton.setOnClickListener {
            currentProduct?.let { product ->
                onPrintRequested?.invoke(product)
            }
        }

        setupHtmlWebView(productHtmlWebView)
        setupHtmlWebView(notFoundHtmlWebView)
    }

    /**
     * Apply resolved display mode and cached HTML templates.
     */
    fun applyDisplayTemplates(
        mode: String,
        productHtml: String?,
        notFoundHtml: String?,
        companyName: String?,
        branchName: String?
    ) {
        productDisplayMode = if (mode == "html") "html" else "native"
        productTemplateHtml = productHtml
        notFoundTemplateHtml = notFoundHtml
        this.companyName = companyName
        this.branchName = branchName
    }

    /**
     * Show overlay with camera scanning mode.
     */
    fun show() {
        if (_isVisible) return
        _isVisible = true

        overlayContainer.visibility = View.VISIBLE
        showScanMode()

        overlayContainer.alpha = 0f
        ObjectAnimator.ofFloat(overlayContainer, "alpha", 0f, 1f).apply {
            duration = ANIMATION_DURATION
            interpolator = DecelerateInterpolator()
            start()
        }

        onShowListener?.invoke()
        Log.d(TAG, "Overlay shown")
    }

    /**
     * Hide overlay and return to signage.
     */
    fun hide() {
        if (!_isVisible) return

        cancelTimeout()

        ObjectAnimator.ofFloat(overlayContainer, "alpha", 1f, 0f).apply {
            duration = ANIMATION_DURATION
            interpolator = DecelerateInterpolator()
            addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: android.animation.Animator) {
                    overlayContainer.visibility = View.GONE
                    _isVisible = false
                    currentProduct = null
                    onHideListener?.invoke()
                }
            })
            start()
        }

        Log.d(TAG, "Overlay hiding")
    }

    /**
     * Show scan mode (camera preview + prompt).
     */
    private fun showScanMode() {
        cameraPreview.visibility = View.VISIBLE
        scanPrompt.visibility = View.VISIBLE
        productCard.visibility = View.GONE
        notFoundView.visibility = View.GONE
        printButton.visibility = View.GONE
        productHtmlWebView?.visibility = View.GONE
        notFoundHtmlWebView?.visibility = View.GONE
        cancelTimeout()
    }

    /**
     * Show product info after successful barcode scan.
     */
    fun showProduct(product: ProductEntity) {
        currentProduct = product
        cameraPreview.visibility = View.GONE
        scanPrompt.visibility = View.GONE
        notFoundView.visibility = View.GONE
        notFoundHtmlWebView?.visibility = View.GONE

        if (shouldUseHtmlMode()) {
            showProductHtml(product)
            return
        }

        // Native fallback rendering
        productNameText.text = product.name
        productPriceText.text = formatPrice(product.currentPrice, product.previousPrice)
        productBarcodeText.text = product.barcode ?: product.sku

        productCard.visibility = View.VISIBLE
        productHtmlWebView?.visibility = View.GONE
        printButton.visibility = if (config.printEnabled) View.VISIBLE else View.GONE

        productCard.translationY = 100f
        ObjectAnimator.ofFloat(productCard, "translationY", 100f, 0f).apply {
            duration = ANIMATION_DURATION
            interpolator = DecelerateInterpolator()
            start()
        }

        startTimeout()
        Log.d(TAG, "Showing product (native): ${product.name} (${product.barcode})")
    }

    /**
     * Show "product not found" message.
     */
    fun showNotFound(barcode: String) {
        cameraPreview.visibility = View.GONE
        scanPrompt.visibility = View.GONE
        productCard.visibility = View.GONE
        productHtmlWebView?.visibility = View.GONE
        printButton.visibility = View.GONE

        if (shouldUseHtmlMode()) {
            showNotFoundHtml(barcode)
        } else {
            notFoundHtmlWebView?.visibility = View.GONE
            notFoundView.visibility = View.VISIBLE
            notFoundView.findViewWithTag<TextView>("not_found_barcode")?.text = barcode
        }

        handler.postDelayed({
            if (_isVisible) showScanMode()
        }, 3000)

        Log.d(TAG, "Product not found: $barcode")
    }

    /**
     * Start auto-hide timeout.
     */
    private fun startTimeout() {
        cancelTimeout()
        val timeout = config.overlayTimeoutSeconds * 1000L
        timeoutRunnable = Runnable { hide() }
        handler.postDelayed(timeoutRunnable!!, timeout)
    }

    /**
     * Cancel auto-hide timeout.
     */
    fun cancelTimeout() {
        timeoutRunnable?.let { handler.removeCallbacks(it) }
        timeoutRunnable = null
    }

    /**
     * Reset timeout.
     */
    fun resetTimeout() {
        if (currentProduct != null) {
            startTimeout()
        }
    }

    // === D-pad Navigation Support ===

    fun scrollUp() {
        if (shouldUseHtmlMode() && productHtmlWebView?.visibility == View.VISIBLE) {
            productHtmlWebView.scrollBy(0, -80)
        } else {
            productCard.scrollBy(0, -50)
        }
        resetTimeout()
    }

    fun scrollDown() {
        if (shouldUseHtmlMode() && productHtmlWebView?.visibility == View.VISIBLE) {
            productHtmlWebView.scrollBy(0, 80)
        } else {
            productCard.scrollBy(0, 50)
        }
        resetTimeout()
    }

    private fun shouldUseHtmlMode(): Boolean {
        return productDisplayMode == "html" && productHtmlWebView != null && notFoundHtmlWebView != null
    }

    private fun showProductHtml(product: ProductEntity) {
        val htmlTemplate = productTemplateHtml
        if (htmlTemplate.isNullOrBlank()) {
            Log.w(TAG, "HTML mode enabled but product template missing, falling back to native")
            productCard.visibility = View.VISIBLE
            printButton.visibility = if (config.printEnabled) View.VISIBLE else View.GONE
            productNameText.text = product.name
            productPriceText.text = formatPrice(product.currentPrice, product.previousPrice)
            productBarcodeText.text = product.barcode ?: product.sku
            startTimeout()
            return
        }

        val payload = buildProductPayload(product)
        val html = applyPlaceholderBindings(htmlTemplate, payload)

        productCard.visibility = View.GONE
        notFoundView.visibility = View.GONE
        productHtmlWebView?.visibility = View.VISIBLE
        printButton.visibility = if (config.printEnabled) View.VISIBLE else View.GONE

        loadHtml(productHtmlWebView, html, payload)
        startTimeout()
        Log.d(TAG, "Showing product (html): ${product.name} (${product.barcode})")
    }

    private fun showNotFoundHtml(barcode: String) {
        val htmlTemplate = notFoundTemplateHtml
        if (htmlTemplate.isNullOrBlank()) {
            notFoundView.visibility = View.VISIBLE
            notFoundView.findViewWithTag<TextView>("not_found_barcode")?.text = barcode
            return
        }

        val payload = JSONObject().apply {
            put("barcode", barcode)
            put("name", "")
            put("product_name", "")
            put("description", "Ürün bulunamadı")
            put("timestamp", formatTimestamp())
            put("company_name", companyName ?: "")
            put("branch_name", branchName ?: "")
        }
        val html = applyPlaceholderBindings(htmlTemplate, payload)

        notFoundView.visibility = View.GONE
        productCard.visibility = View.GONE
        notFoundHtmlWebView?.visibility = View.VISIBLE
        loadHtml(notFoundHtmlWebView, html, payload)
    }

    private fun setupHtmlWebView(webView: WebView?) {
        if (webView == null) return

        webView.setBackgroundColor(android.graphics.Color.TRANSPARENT)
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = false
            cacheMode = WebSettings.LOAD_NO_CACHE
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
        }
        webView.visibility = View.GONE
    }

    private fun loadHtml(webView: WebView?, html: String, payload: JSONObject) {
        if (webView == null) return

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                val target = view ?: return
                bindJsData(target, payload)
            }
        }
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
    }

    private fun bindJsData(webView: WebView, payload: JSONObject) {
        val companyEscaped = jsEscape(companyName ?: "")
        val branchEscaped = jsEscape(branchName ?: "")
        val payloadJson = payload.toString()

        val script = """
            (function(){
              try {
                var data = $payloadJson;
                if (window.PriceView && typeof window.PriceView.setProduct === 'function') {
                  window.PriceView.setProduct(data);
                }
                if (window.PriceView && typeof window.PriceView.setCompany === 'function') {
                  window.PriceView.setCompany('$companyEscaped', '$branchEscaped');
                }
                if (window.PriceView && typeof window.PriceView.setTimestamp === 'function') {
                  window.PriceView.setTimestamp();
                }
              } catch (e) {}
            })();
        """.trimIndent()

        webView.evaluateJavascript(script, null)
    }

    private fun buildProductPayload(product: ProductEntity): JSONObject {
        val barcode = product.barcode ?: product.sku
        val current = formatMoney(product.currentPrice)
        val previous = formatMoney(product.previousPrice)
        val discountPercent = product.discountPercent?.let { DecimalFormat("0.##").format(it) } ?: ""
        val vatRate = product.vatRate?.let { DecimalFormat("0.##").format(it) } ?: ""

        return JSONObject().apply {
            put("id", product.id)
            put("name", product.name)
            put("product_name", product.name)
            put("description", product.description ?: "")
            put("current_price", current)
            put("previous_price", previous)
            put("barcode", barcode ?: "")
            put("sku", product.sku)
            put("image_url", resolveImageUrl(product))
            put("category", product.category ?: "")
            put("brand", product.brand ?: "")
            put("unit", product.unit ?: "")
            put("origin", product.origin ?: "")
            put("production_type", product.productionType ?: "")
            put("discount_percent", discountPercent)
            put("campaign_text", product.campaignText ?: "")
            put("currency", "₺")
            put("vat_rate", vatRate)
            put("installment_price", current)
            put("company_name", companyName ?: "")
            put("branch_name", branchName ?: "")
            put("timestamp", formatTimestamp())
        }
    }

    private fun resolveImageUrl(product: ProductEntity): String {
        if (!product.imageUrl.isNullOrBlank()) {
            return product.imageUrl
        }

        return try {
            val raw = product.images ?: return ""
            val trimmed = raw.trim()
            if (trimmed.startsWith("[")) {
                val arr = org.json.JSONArray(trimmed)
                for (i in 0 until arr.length()) {
                    val item = arr.optString(i, "")
                    if (item.isNotBlank() && item != "null") {
                        return item
                    }
                }
            }
            ""
        } catch (_: Exception) {
            ""
        }
    }

    private fun applyPlaceholderBindings(templateHtml: String, payload: JSONObject): String {
        var html = templateHtml
        val keys = payload.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val value = payload.optString(key, "")
            html = html.replace("{{${key}}}", htmlEscape(value))
        }
        return html
    }

    private fun formatPrice(current: Double?, previous: Double?): String {
        if (current == null) return "-"
        val currentStr = "${formatMoney(current)} TL"
        return if (previous != null && previous > current) {
            "$currentStr  (Eski: ${formatMoney(previous)} TL)"
        } else {
            currentStr
        }
    }

    private fun formatMoney(value: Double?): String {
        if (value == null) return ""
        val symbols = DecimalFormatSymbols(Locale.US).apply {
            decimalSeparator = ','
            groupingSeparator = '.'
        }
        val formatter = DecimalFormat("#,##0.00", symbols)
        return formatter.format(value)
    }

    private fun formatTimestamp(): String {
        val date = Date()
        val cal = java.util.Calendar.getInstance().apply { time = date }
        val hh = cal.get(java.util.Calendar.HOUR_OF_DAY).toString().padStart(2, '0')
        val mm = cal.get(java.util.Calendar.MINUTE).toString().padStart(2, '0')
        return "$hh:$mm"
    }

    private fun htmlEscape(value: String): String {
        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;")
    }

    private fun jsEscape(value: String): String {
        return value
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "")
    }

    fun destroy() {
        cancelTimeout()
        handler.removeCallbacksAndMessages(null)
        currentProduct = null
    }
}

