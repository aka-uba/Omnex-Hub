package com.omnex.priceview

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.view.animation.AnimationUtils
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * First-run setup wizard with smooth transitions.
 */
class WizardActivity : AppCompatActivity() {

    private var currentStep = 0
    private val totalSteps = 3

    private lateinit var stepIndicators: List<View>
    private lateinit var stepTitle: TextView
    private lateinit var stepDescription: TextView
    private lateinit var stepImage: ImageView
    private lateinit var prevButton: Button
    private lateinit var nextButton: Button
    private lateinit var serverUrlInput: EditText
    private lateinit var serverUrlLayout: View
    private lateinit var keyboardDimOverlay: View
    private var useDefaultServerButton: Button? = null
    private var contentCard: View? = null

    private lateinit var wizardSteps: List<WizardStep>
    private var isTvDevice = false
    private var isAnimating = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        isTvDevice = packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
        if (isTvDevice) {
            setContentView(R.layout.activity_wizard_tv)
            enableFullscreen()
        } else {
            setContentView(R.layout.activity_wizard_mobile)
        }

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        wizardSteps = listOf(
            WizardStep(
                title = getString(R.string.wizard_welcome_title),
                description = getString(R.string.wizard_welcome_desc, BuildConfig.VERSION_NAME),
                imageRes = R.drawable.wizard_welcome
            ),
            WizardStep(
                title = getString(R.string.wizard_server_title),
                description = getString(R.string.wizard_server_desc),
                imageRes = R.drawable.wizard_server,
                showServerInput = true
            ),
            WizardStep(
                title = getString(R.string.wizard_ready_title),
                description = getString(R.string.wizard_ready_desc),
                imageRes = R.drawable.wizard_ready
            )
        )

        initViews()
        prefillServerUrl()
        updateStep(animate = false)
    }

    private fun initViews() {
        stepTitle = findViewById(R.id.wizardTitle)
        stepDescription = findViewById(R.id.wizardDescription)
        stepImage = findViewById(R.id.wizardImage)
        prevButton = findViewById(R.id.btnPrev)
        nextButton = findViewById(R.id.btnNext)
        serverUrlInput = findViewById(R.id.serverUrlInput)
        serverUrlLayout = findViewById(R.id.serverUrlLayout)
        keyboardDimOverlay = findViewById(R.id.keyboardDimOverlay)
        useDefaultServerButton = findViewById(R.id.btnUseDefaultServer)
        contentCard = findViewById(R.id.wizardContentCard)

        stepIndicators = listOf(
            findViewById(R.id.step1),
            findViewById(R.id.step2),
            findViewById(R.id.step3)
        )

        prevButton.setOnClickListener { previousStep() }
        nextButton.setOnClickListener { nextStep() }
        useDefaultServerButton?.setOnClickListener {
            applyDefaultServerUrl(showToast = true)
            if (currentStep == 1) {
                showKeyboardForServerInput(force = isTvDevice)
            }
        }

        serverUrlInput.setOnFocusChangeListener { _, hasFocus ->
            updateKeyboardDimOverlay(hasFocus && currentStep == 1)
            if (hasFocus && currentStep == 1 && isTvDevice) {
                showKeyboardForServerInput(force = true)
            }
        }

        serverUrlInput.setOnClickListener {
            if (currentStep == 1) {
                showKeyboardForServerInput(force = isTvDevice)
            }
        }

        serverUrlInput.setOnEditorActionListener { _, actionId, event ->
            val imeDone = actionId == EditorInfo.IME_ACTION_DONE || actionId == EditorInfo.IME_ACTION_GO
            val enterPressed = event?.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN
            if (imeDone || enterPressed) {
                nextStep()
                true
            } else {
                false
            }
        }

        if (isTvDevice) {
            configureTvNavigation()
        }

        focusPrimaryAction()
    }

    private fun prefillServerUrl() {
        val prefs = getSharedPreferences("omnex_player", MODE_PRIVATE)
        val savedUrl = prefs.getString("server_url", null)?.trim().orEmpty()
        if (savedUrl.isNotEmpty()) {
            serverUrlInput.setText(savedUrl)
        } else {
            serverUrlInput.setText(normalizeServerUrl(BuildConfig.SERVER_URL))
        }
        serverUrlInput.setSelection(serverUrlInput.text.length)
    }

    private fun normalizeServerUrl(rawUrl: String): String {
        var normalizedUrl = rawUrl.trim()
        if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
            val hostCandidate = normalizedUrl
                .substringBefore('/')
                .substringBefore('?')
                .substringBefore('#')
                .substringBefore('@')
                .substringBefore(':')
            val scheme = if (isLikelyLocalHost(hostCandidate)) "http" else "https"
            normalizedUrl = "$scheme://$normalizedUrl"
        }
        if (!normalizedUrl.endsWith("/")) {
            normalizedUrl += "/"
        }
        return normalizedUrl
    }

    private fun isLikelyLocalHost(host: String): Boolean {
        val normalized = host.trim().lowercase()
        if (normalized.isEmpty()) return false

        if (normalized == "localhost" || normalized == "127.0.0.1" || normalized == "::1") {
            return true
        }

        if (normalized.endsWith(".local")) {
            return true
        }

        if (normalized.startsWith("10.") || normalized.startsWith("192.168.")) {
            return true
        }

        if (normalized.startsWith("172.")) {
            val parts = normalized.split('.')
            val secondOctet = parts.getOrNull(1)?.toIntOrNull()
            if (secondOctet != null && secondOctet in 16..31) {
                return true
            }
        }

        return false
    }

    private fun applyDefaultServerUrl(showToast: Boolean) {
        val defaultUrl = normalizeServerUrl(BuildConfig.SERVER_URL)
        serverUrlInput.setText(defaultUrl)
        serverUrlInput.setSelection(serverUrlInput.text.length)
        if (showToast) {
            Toast.makeText(this, getString(R.string.wizard_default_server_applied), Toast.LENGTH_SHORT).show()
        }
    }

    private fun updateStep(animate: Boolean = true, forward: Boolean = true) {
        val step = wizardSteps[currentStep]

        if (animate) {
            animateStepTransition(forward) {
                applyStepContent(step)
            }
        } else {
            applyStepContent(step)
        }
    }

    private fun applyStepContent(step: WizardStep) {
        stepTitle.text = step.title
        stepDescription.text = step.description
        stepImage.setImageResource(step.imageRes)

        serverUrlLayout.visibility = if (step.showServerInput) View.VISIBLE else View.GONE
        useDefaultServerButton?.visibility = if (step.showServerInput) View.VISIBLE else View.GONE

        if (!step.showServerInput) {
            serverUrlInput.clearFocus()
            hideKeyboard()
            updateKeyboardDimOverlay(false)
        } else {
            if (serverUrlInput.text.toString().trim().isEmpty()) {
                applyDefaultServerUrl(showToast = false)
            }
            if (isTvDevice) {
                serverUrlInput.requestFocus()
                showKeyboardForServerInput(force = true)
            }
            updateKeyboardDimOverlay(serverUrlInput.hasFocus())
        }

        prevButton.visibility = if (currentStep > 0) View.VISIBLE else View.INVISIBLE
        nextButton.text = if (currentStep == totalSteps - 1) {
            getString(R.string.wizard_finish)
        } else {
            getString(R.string.wizard_next)
        }

        // Animate step indicators with size change (pill for active, dot for others)
        updateStepIndicators()

        if (isTvDevice) {
            window.decorView.post { focusPrimaryAction() }
        }
    }

    private fun updateStepIndicators() {
        stepIndicators.forEachIndexed { index, view ->
            view.isSelected = index == currentStep
            view.isEnabled = index <= currentStep

            // Animate size: active step gets pill width, others get dot width
            val lp = view.layoutParams as LinearLayout.LayoutParams
            val density = resources.displayMetrics.density

            if (isTvDevice) {
                if (index == currentStep) {
                    lp.width = (28 * density).toInt()
                    lp.height = (8 * density).toInt()
                } else {
                    lp.width = (8 * density).toInt()
                    lp.height = (8 * density).toInt()
                }
            } else {
                if (index == currentStep) {
                    lp.width = (22 * density).toInt()
                    lp.height = (6 * density).toInt()
                } else {
                    lp.width = (6 * density).toInt()
                    lp.height = (6 * density).toInt()
                }
            }

            view.layoutParams = lp
            view.alpha = if (index <= currentStep) 1f else 0.35f
        }
    }

    private fun animateStepTransition(forward: Boolean, onComplete: () -> Unit) {
        if (isAnimating) return
        isAnimating = true

        val target = contentCard ?: stepTitle.parent as? View ?: run {
            isAnimating = false
            onComplete()
            return
        }

        // Slide + fade out
        target.animate()
            .alpha(0f)
            .translationX(if (forward) -40f else 40f)
            .setDuration(180)
            .withEndAction {
                onComplete()

                // Prepare entrance position
                target.translationX = if (forward) 40f else -40f

                // Slide + fade in
                target.animate()
                    .alpha(1f)
                    .translationX(0f)
                    .setDuration(280)
                    .withEndAction {
                        isAnimating = false
                    }
                    .start()
            }
            .start()
    }

    private fun previousStep() {
        if (currentStep > 0 && !isAnimating) {
            currentStep--
            updateStep(animate = true, forward = false)
        }
    }

    private fun nextStep() {
        if (isAnimating) return

        if (currentStep == 1 && !saveServerUrl()) {
            return
        }

        if (currentStep < totalSteps - 1) {
            currentStep++
            updateStep(animate = true, forward = true)
        } else {
            finishWizard()
        }
    }

    private fun saveServerUrl(): Boolean {
        val rawServerUrl = serverUrlInput.text.toString().trim()
        if (rawServerUrl.isEmpty()) {
            Toast.makeText(this, getString(R.string.wizard_server_required), Toast.LENGTH_SHORT).show()
            serverUrlInput.requestFocus()
            showKeyboardForServerInput(force = isTvDevice)
            return false
        }

        val normalizedUrl = normalizeServerUrl(rawServerUrl)
        val prefs = getSharedPreferences("omnex_player", MODE_PRIVATE)
        prefs.edit()
            .putString("server_url", normalizedUrl)
            .putBoolean("first_run", false)
            .apply()

        hideKeyboard()
        updateKeyboardDimOverlay(false)
        return true
    }

    private fun finishWizard() {
        hideKeyboard()

        // Smooth fade-out transition before navigating
        val rootView = window.decorView.findViewById<View>(android.R.id.content)
        rootView.animate()
            .alpha(0f)
            .setDuration(300)
            .withEndAction {
                val intent = if (isTvDevice) {
                    Intent(this, TvActivity::class.java)
                } else {
                    Intent(this, MainActivity::class.java)
                }
                startActivity(intent)
                @Suppress("DEPRECATION")
                overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
                finish()
            }
            .start()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        val editingServerInput =
            currentStep == 1 &&
                serverUrlLayout.visibility == View.VISIBLE &&
                serverUrlInput.hasFocus()

        val focusedViewId = currentFocus?.id

        if (isTvDevice) {
            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_CENTER,
                KeyEvent.KEYCODE_ENTER -> {
                    if (currentStep == 1 && serverUrlLayout.visibility == View.VISIBLE) {
                        if (focusedViewId == R.id.serverUrlInput) {
                            showKeyboardForServerInput(force = true)
                            return true
                        }
                    }
                }
                KeyEvent.KEYCODE_BACK -> {
                    hideKeyboard()
                    if (editingServerInput) {
                        nextButton.requestFocus()
                        return true
                    }
                    if (currentStep > 0) {
                        previousStep()
                        return true
                    }
                }
            }
            return super.onKeyDown(keyCode, event)
        }

        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER -> {
                if (currentStep == 1 && serverUrlLayout.visibility == View.VISIBLE) {
                    showKeyboardForServerInput(force = true)
                    return true
                }
            }
            KeyEvent.KEYCODE_DPAD_LEFT -> {
                if (!editingServerInput) {
                    previousStep()
                    return true
                }
            }
            KeyEvent.KEYCODE_DPAD_RIGHT -> {
                if (!editingServerInput) {
                    nextStep()
                    return true
                }
            }
            KeyEvent.KEYCODE_BACK -> {
                hideKeyboard()
                if (currentStep > 0) {
                    previousStep()
                    return true
                }
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun configureTvNavigation() {
        serverUrlInput.isFocusable = true
        serverUrlInput.isFocusableInTouchMode = true
        useDefaultServerButton?.isFocusable = true
        prevButton.isFocusable = true
        nextButton.isFocusable = true

        serverUrlInput.setOnKeyListener { _, keyCode, event ->
            if (event.action != KeyEvent.ACTION_DOWN) {
                return@setOnKeyListener false
            }

            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_DOWN -> {
                    (useDefaultServerButton ?: nextButton).requestFocus()
                    true
                }
                KeyEvent.KEYCODE_DPAD_CENTER,
                KeyEvent.KEYCODE_ENTER -> {
                    showKeyboardForServerInput(force = true)
                    true
                }
                else -> false
            }
        }

        useDefaultServerButton?.setOnKeyListener { _, keyCode, event ->
            if (event.action != KeyEvent.ACTION_DOWN) {
                return@setOnKeyListener false
            }

            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_UP -> {
                    serverUrlInput.requestFocus()
                    true
                }
                KeyEvent.KEYCODE_DPAD_DOWN -> {
                    nextButton.requestFocus()
                    true
                }
                else -> false
            }
        }

        prevButton.setOnKeyListener { _, keyCode, event ->
            if (event.action != KeyEvent.ACTION_DOWN) {
                return@setOnKeyListener false
            }

            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_RIGHT -> {
                    nextButton.requestFocus()
                    true
                }
                KeyEvent.KEYCODE_DPAD_UP -> {
                    if (currentStep == 1 && serverUrlLayout.visibility == View.VISIBLE) {
                        (useDefaultServerButton ?: serverUrlInput).requestFocus()
                        true
                    } else {
                        false
                    }
                }
                else -> false
            }
        }

        nextButton.setOnKeyListener { _, keyCode, event ->
            if (event.action != KeyEvent.ACTION_DOWN) {
                return@setOnKeyListener false
            }

            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_LEFT -> {
                    if (prevButton.visibility == View.VISIBLE) {
                        prevButton.requestFocus()
                        true
                    } else {
                        false
                    }
                }
                KeyEvent.KEYCODE_DPAD_UP -> {
                    if (currentStep == 1 && serverUrlLayout.visibility == View.VISIBLE) {
                        (useDefaultServerButton ?: serverUrlInput).requestFocus()
                        true
                    } else {
                        false
                    }
                }
                else -> false
            }
        }
    }

    private fun focusPrimaryAction() {
        if (!isTvDevice) {
            nextButton.requestFocus()
            return
        }

        if (currentStep == 1 && serverUrlLayout.visibility == View.VISIBLE) {
            serverUrlInput.requestFocus()
        } else {
            nextButton.requestFocus()
        }
    }

    private fun showKeyboardForServerInput(force: Boolean) {
        if (currentStep != 1 || serverUrlLayout.visibility != View.VISIBLE) return

        serverUrlInput.requestFocus()
        serverUrlInput.setSelection(serverUrlInput.text.length)

        serverUrlInput.post {
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            @Suppress("DEPRECATION")
            val showFlag = if (force) InputMethodManager.SHOW_FORCED else InputMethodManager.SHOW_IMPLICIT
            imm.showSoftInput(serverUrlInput, showFlag)
        }

        updateKeyboardDimOverlay(true)
    }

    private fun hideKeyboard() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(serverUrlInput.windowToken, 0)
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

    private fun updateKeyboardDimOverlay(visible: Boolean) {
        val shouldShow = visible && serverUrlLayout.visibility == View.VISIBLE
        if (shouldShow) {
            if (keyboardDimOverlay.visibility != View.VISIBLE) {
                keyboardDimOverlay.alpha = 0f
                keyboardDimOverlay.visibility = View.VISIBLE
            }
            keyboardDimOverlay.animate().alpha(1f).setDuration(180).start()
        } else if (keyboardDimOverlay.visibility == View.VISIBLE) {
            keyboardDimOverlay.animate()
                .alpha(0f)
                .setDuration(160)
                .withEndAction { keyboardDimOverlay.visibility = View.GONE }
                .start()
        }
    }

    data class WizardStep(
        val title: String,
        val description: String,
        val imageRes: Int,
        val showServerInput: Boolean = false
    )
}
