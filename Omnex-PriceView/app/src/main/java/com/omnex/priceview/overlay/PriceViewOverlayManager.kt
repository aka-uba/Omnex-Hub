package com.omnex.priceview.overlay

import android.animation.ObjectAnimator
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.webkit.JavascriptInterface
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
        private const val ANIMATION_DURATION = 380L
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
    private val htmlUiBridge = HtmlUiBridge()
    private val htmlRenderStates = mutableMapOf<WebView, HtmlRenderState>()

    val isVisible: Boolean get() = _isVisible

    var onShowListener: (() -> Unit)? = null
    var onHideListener: (() -> Unit)? = null
    var onPrintRequested: ((ProductEntity) -> Unit)? = null

    private data class HtmlRenderState(
        var templateSignature: String = "",
        var isLoaded: Boolean = false,
        var pendingPayload: JSONObject? = null,
        var pendingAnimateOnLoad: Boolean = false,
        var pendingIsProductTemplate: Boolean = false
    )

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
        val productChanged = productTemplateHtml != productHtml
        val notFoundChanged = notFoundTemplateHtml != notFoundHtml
        productDisplayMode = if (mode == "html") "html" else "native"
        productTemplateHtml = productHtml
        notFoundTemplateHtml = notFoundHtml
        this.companyName = companyName
        this.branchName = branchName

        if (productChanged) {
            resetHtmlRenderState(productHtmlWebView)
        }
        if (notFoundChanged) {
            resetHtmlRenderState(notFoundHtmlWebView)
        }
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

        animateSlideUp(productCard)

        startTimeout()
        Log.d(TAG, "Showing product (native): ${product.name} (${product.barcode})")
    }

    /**
     * Show "product not found" message.
     */
    fun showNotFound(barcode: String) {
        currentProduct = null
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

        // Not-found overlays should respect integration/device timeout settings exactly like product overlays.
        startTimeout()

        Log.d(TAG, "Product not found: $barcode (timeout=${config.overlayTimeoutSeconds}s)")
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

        productCard.visibility = View.GONE
        notFoundView.visibility = View.GONE
        productHtmlWebView?.visibility = View.VISIBLE
        printButton.visibility = if (config.printEnabled) View.VISIBLE else View.GONE

        loadHtml(
            productHtmlWebView,
            htmlTemplate,
            payload,
            animateOnLoad = true,
            isProductTemplate = true
        )
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
        notFoundView.visibility = View.GONE
        productCard.visibility = View.GONE
        notFoundHtmlWebView?.visibility = View.VISIBLE
        loadHtml(
            notFoundHtmlWebView,
            htmlTemplate,
            payload,
            animateOnLoad = true,
            isProductTemplate = false
        )
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
        webView.addJavascriptInterface(htmlUiBridge, "PriceViewNative")
        webView.addJavascriptInterface(htmlUiBridge, "AndroidBridge")
        webView.addJavascriptInterface(htmlUiBridge, "Android")
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                val target = view ?: return
                val state = htmlRenderStates[target] ?: return
                state.isLoaded = true

                val payload = state.pendingPayload ?: return
                val animateOnLoad = state.pendingAnimateOnLoad
                val isProductTemplate = state.pendingIsProductTemplate

                state.pendingPayload = null
                bindJsData(target, payload, isProductTemplate)

                if (animateOnLoad) {
                    animateSlideUp(target)
                } else {
                    target.alpha = 1f
                    target.translationY = 0f
                }
            }
        }
        htmlRenderStates[webView] = HtmlRenderState()
        webView.visibility = View.GONE
    }

    private fun loadHtml(
        webView: WebView?,
        htmlTemplate: String,
        payload: JSONObject,
        animateOnLoad: Boolean,
        isProductTemplate: Boolean
    ) {
        if (webView == null) return

        val preparedHtml = prepareHtmlForRender(htmlTemplate, isProductTemplate)
        val signature = "${if (isProductTemplate) "product" else "not_found"}:${preparedHtml.hashCode()}"
        val state = htmlRenderStates.getOrPut(webView) { HtmlRenderState() }

        if (state.isLoaded && state.templateSignature == signature) {
            bindJsData(webView, payload, isProductTemplate)
            if (animateOnLoad) {
                animateSlideUp(webView)
            } else {
                webView.alpha = 1f
                webView.translationY = 0f
            }
            return
        }

        webView.alpha = 0f
        webView.translationY = 120f
        webView.stopLoading()

        state.templateSignature = signature
        state.isLoaded = false
        state.pendingPayload = payload
        state.pendingAnimateOnLoad = animateOnLoad
        state.pendingIsProductTemplate = isProductTemplate

        webView.loadDataWithBaseURL(null, preparedHtml, "text/html", "UTF-8", null)
    }

    private fun resetHtmlRenderState(webView: WebView?) {
        if (webView == null) return
        htmlRenderStates[webView] = HtmlRenderState()
    }

    private fun bindJsData(webView: WebView, payload: JSONObject, isProductTemplate: Boolean) {
        val companyEscaped = jsEscape(companyName ?: "")
        val branchEscaped = jsEscape(branchName ?: "")
        val payloadJson = payload.toString()
        val templateKind = if (isProductTemplate) "product" else "not_found"

        val script = """
            (function(){
              try {
                var data = $payloadJson;
                var __pvTemplateKind = '$templateKind';
                var __pvExpectedImage = String((data && data.image_url) || '').trim();

                var __pvStyle = document.getElementById('__pv-runtime-style');
                if (!__pvStyle) {
                  __pvStyle = document.createElement('style');
                  __pvStyle.id = '__pv-runtime-style';
                  document.head.appendChild(__pvStyle);
                }
                var __pvCss = '';
                __pvCss += '[data-action="close"],[data-action="print"],[title="Kapat"],[title="Close"],.pv-close,.pv-close-btn,.pv-print,.pv-print-btn{transition:none!important;animation:none!important;}';
                __pvCss += 'button{transition:none!important;animation:none!important;}';
                if (__pvTemplateKind === 'product') {
                  __pvCss += '.pv-card{width:min(100%,1280px)!important;margin:0 auto!important;}';
                  __pvCss += '[data-bind="image_url"],.pv-img-area img,img{animation:none!important;transition:none!important;}';
                }
                __pvStyle.textContent = __pvCss;

                if (window.PriceView && typeof window.PriceView.setProduct === 'function') {
                  window.PriceView.setProduct(data);
                }
                if (window.PriceView && typeof window.PriceView.setCompany === 'function') {
                  window.PriceView.setCompany('$companyEscaped', '$branchEscaped');
                }
                if (window.PriceView && typeof window.PriceView.setTimestamp === 'function') {
                  window.PriceView.setTimestamp();
                }

                function __pvCreateImageFallback(img) {
                  if (!img) return null;
                  var host = img.parentElement || img;
                  var existing = host.querySelector('[data-pv-img-fallback="1"], .pv-missing-image-wrap');
                  if (existing) return existing;

                  if (window.getComputedStyle && window.getComputedStyle(host).position === 'static') {
                    host.style.position = 'relative';
                  }

                  var outer = document.createElement('div');
                  outer.setAttribute('data-pv-img-fallback', '1');
                  outer.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;z-index:30;';

                  var bubble = document.createElement('div');
                  bubble.style.cssText = 'width:180px;height:180px;border-radius:50%;background:transparent;display:flex;align-items:center;justify-content:center;font-size:90px;';
                  bubble.innerHTML = '&#128269;';

                  outer.appendChild(bubble);
                  host.appendChild(outer);
                  return outer;
                }

                function __pvToggleImageFallback(img, hasValidImage) {
                  if (!img) return;
                  var fallback = __pvCreateImageFallback(img);
                  var isTemplateFallback = !!(fallback && fallback.classList && fallback.classList.contains('pv-missing-image-wrap'));
                  if (hasValidImage) {
                    img.style.display = 'block';
                    if (fallback) {
                      if (isTemplateFallback && fallback.classList) fallback.classList.remove('active');
                      fallback.style.display = 'none';
                    }
                  } else {
                    img.style.display = 'none';
                    if (fallback) {
                      if (isTemplateFallback && fallback.classList) fallback.classList.add('active');
                      fallback.style.display = 'flex';
                    }
                  }
                }

                function __pvApplyImageFallback() {
                  if (window.__pvTemplateMotionFixV4 === true) {
                    return;
                  }
                  var imgs = document.querySelectorAll('img[data-bind="image_url"], [data-bind="image_url"]');
                  for (var i = 0; i < imgs.length; i++) {
                    var img = imgs[i];
                    if (!img || String(img.tagName || '').toLowerCase() !== 'img') continue;

                    if (!(img.dataset && img.dataset.pvImgFallbackBound === '1')) {
                      if (img.dataset) img.dataset.pvImgFallbackBound = '1';
                      img.addEventListener('load', function(ev) {
                        var target = ev && ev.target;
                        var ok = !!(target && target.naturalWidth > 0);
                        __pvToggleImageFallback(target, ok);
                      });
                      img.addEventListener('error', function(ev) {
                        var target = ev && ev.target;
                        __pvToggleImageFallback(target, false);
                      });
                    }

                    var src = (img.getAttribute('src') || '').trim();
                    var validSrc = !!src && src !== 'null' && src !== 'undefined';
                    if (!validSrc) {
                      if (__pvExpectedImage) {
                        __pvToggleImageFallback(img, true);
                      } else {
                        __pvToggleImageFallback(img, false);
                      }
                      continue;
                    }

                    if (img.complete) {
                      __pvToggleImageFallback(img, img.naturalWidth > 0);
                    } else {
                      __pvToggleImageFallback(img, true);
                    }
                  }
                }

                __pvApplyImageFallback();

                function __pvCall(methodName) {
                  var bridges = [window.PriceViewNative, window.AndroidBridge, window.Android];
                  for (var i = 0; i < bridges.length; i++) {
                    var b = bridges[i];
                    if (b && typeof b[methodName] === 'function') {
                      try { b[methodName](); return true; } catch (ignoreBridgeError) {}
                    }
                  }
                  return false;
                }

                function __pvBindClick(el, methodName, flagName) {
                  if (!el) return;
                  if (el.dataset && el.dataset[flagName] === '1') return;
                  if (el.dataset) el.dataset[flagName] = '1';
                  __pvStripHover(el);
                  el.addEventListener('click', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    __pvCall(methodName);
                  }, true);
                }

                function __pvStripHover(el) {
                  if (!el) return;
                  var attrs = ['onmouseenter','onmouseleave','onmouseover','onmouseout','onmousedown','onmouseup'];
                  for (var ai = 0; ai < attrs.length; ai++) {
                    if (el.hasAttribute && el.hasAttribute(attrs[ai])) {
                      el.removeAttribute(attrs[ai]);
                    }
                  }
                  if (el.style) {
                    el.style.transition = 'none';
                    el.style.animation = 'none';
                  }
                }

                var closeTargets = document.querySelectorAll('[data-action="close"],[title="Kapat"],[title="Close"],.pv-close,.pv-close-btn');
                for (var ci = 0; ci < closeTargets.length; ci++) {
                  __pvBindClick(closeTargets[ci], 'closeOverlay', 'pvCloseBound');
                }

                var printTargets = document.querySelectorAll('[data-action="print"],.pv-print,.pv-print-btn');
                for (var pi = 0; pi < printTargets.length; pi++) {
                  __pvBindClick(printTargets[pi], 'printCurrentProduct', 'pvPrintBound');
                }

                var buttons = document.querySelectorAll('button,a,[role="button"]');
                for (var bi = 0; bi < buttons.length; bi++) {
                  var btn = buttons[bi];
                  __pvStripHover(btn);
                  var text = (btn.textContent || '').toLowerCase();
                  if (text.indexOf('kapat') >= 0 || text.indexOf('close') >= 0) {
                    __pvBindClick(btn, 'closeOverlay', 'pvCloseBound');
                    continue;
                  }
                  if (text.indexOf('yazd') >= 0 || text.indexOf('print') >= 0) {
                    __pvBindClick(btn, 'printCurrentProduct', 'pvPrintBound');
                  }
                }

                if (window.PriceView && typeof window.PriceView === 'object') {
                  window.PriceView.close = function() {
                    if (!__pvCall('closeOverlay')) { return false; }
                    return true;
                  };
                  window.PriceView.print = function() {
                    if (!__pvCall('printCurrentProduct')) { return false; }
                    return true;
                  };
                }

                window.printSection = function() {
                  if (!__pvCall('printCurrentProduct')) { return false; }
                  return true;
                };
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
        val preferredFromImages = resolvePreferredImageFromImages(product.images)
        if (preferredFromImages.isNotBlank()) {
            return preferredFromImages
        }

        val directImage = product.imageUrl.orEmpty().trim()
        if (directImage.isNotBlank() && directImage != "null") {
            return directImage
        }

        return ""
    }

    private fun resolvePreferredImageFromImages(rawImages: String?): String {
        if (rawImages.isNullOrBlank()) {
            return ""
        }

        return try {
            val arr = org.json.JSONArray(rawImages)
            for (i in 0 until arr.length()) {
                val item = arr.opt(i)
                when (item) {
                    is String -> {
                        val candidate = item.trim()
                        if (candidate.isNotBlank() && candidate != "null") {
                            return candidate
                        }
                    }
                    is JSONObject -> {
                        val thumbCandidate = firstNonBlank(
                            item.optString("thumbnail_url", ""),
                            item.optString("thumbnail", ""),
                            item.optString("thumb_url", ""),
                            item.optString("thumb", ""),
                            item.optString("poster_url", ""),
                            item.optString("poster", "")
                        )
                        if (thumbCandidate.isNotBlank()) {
                            return thumbCandidate
                        }

                        val urlCandidate = firstNonBlank(
                            item.optString("url", ""),
                            item.optString("path", "")
                        )
                        if (urlCandidate.isNotBlank()) {
                            return urlCandidate
                        }
                    }
                }
            }
            ""
        } catch (_: Exception) {
            ""
        }
    }

    private fun firstNonBlank(vararg values: String): String {
        for (value in values) {
            val normalized = value.trim()
            if (normalized.isNotBlank() && normalized != "null" && normalized != "undefined") {
                return normalized
            }
        }
        return ""
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

    private fun prepareHtmlForRender(html: String, isProductTemplate: Boolean): String {
        val productOnlyCss = if (isProductTemplate) {
            """
            [data-bind="image_url"],.pv-img-area img,img{
              animation:none !important;
              transition:none !important;
            }
            """.trimIndent()
        } else {
            ""
        }

        val preloadStyle = """
            <style id="__pv-preload-style">
            html,body{
              height:100% !important;
              min-height:100% !important;
              overflow:hidden !important;
            }
            body{
              display:flex !important;
              align-items:flex-end !important;
              justify-content:center !important;
              padding:6px 8px 18px !important;
            }
            *{
              animation:none !important;
              transition:none !important;
            }
            .pv-card{
              width:min(100%,1280px) !important;
              margin:0 auto !important;
            }
            $productOnlyCss
            </style>
        """.trimIndent()

        return if (html.contains("</head>", ignoreCase = true)) {
            html.replace("</head>", "$preloadStyle</head>", ignoreCase = true)
        } else {
            "$preloadStyle$html"
        }
    }

    private fun animateSlideUp(view: View) {
        view.animate().cancel()
        view.translationY = 120f
        view.alpha = 0f
        view.animate()
            .translationY(0f)
            .alpha(1f)
            .setDuration(ANIMATION_DURATION)
            .setInterpolator(DecelerateInterpolator())
            .start()
    }

    private inner class HtmlUiBridge {
        @JavascriptInterface
        fun closeOverlay() {
            handler.post {
                Log.d(TAG, "HTML bridge close requested")
                hide()
            }
        }

        @JavascriptInterface
        fun printCurrentProduct() {
            handler.post {
                Log.d(TAG, "HTML bridge print requested")
                currentProduct?.let { product ->
                    onPrintRequested?.invoke(product)
                }
                resetTimeout()
            }
        }
    }

    fun destroy() {
        cancelTimeout()
        handler.removeCallbacksAndMessages(null)
        currentProduct = null
    }
}
