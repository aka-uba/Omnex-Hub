package com.omnex.priceview.scanner

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.ToneGenerator
import android.media.AudioManager
import android.util.Log
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Manages camera-based barcode scanning using CameraX + ML Kit.
 * Handles camera lifecycle, torch, scan sound feedback.
 */
class BarcodeScannerManager(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner
) {
    companion object {
        private const val TAG = "BarcodeScanner"
    }

    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var preview: Preview? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var analyzer: BarcodeAnalyzer? = null
    private var cameraExecutor: ExecutorService? = null
    private var toneGenerator: ToneGenerator? = null

    var isTorchEnabled: Boolean = false
        private set

    var scanSoundEnabled: Boolean = true

    private var onScanResult: ((ScanResult) -> Unit)? = null

    /**
     * Check if camera permission is granted.
     */
    fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Start camera preview and barcode scanning.
     * @param previewView CameraX PreviewView to bind camera output
     * @param onResult Callback for detected barcodes
     */
    fun start(previewView: PreviewView, onResult: (ScanResult) -> Unit) {
        if (!hasCameraPermission()) {
            Log.w(TAG, "Camera permission not granted")
            return
        }

        onScanResult = onResult
        cameraExecutor = Executors.newSingleThreadExecutor()

        try {
            toneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
        } catch (e: Exception) {
            Log.w(TAG, "ToneGenerator init failed", e)
        }

        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()
                bindCameraUseCases(previewView)
            } catch (e: Exception) {
                Log.e(TAG, "Camera provider failed", e)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    private fun bindCameraUseCases(previewView: PreviewView) {
        val provider = cameraProvider ?: return

        // Unbind any existing use cases
        provider.unbindAll()

        // Preview
        preview = Preview.Builder()
            .build()
            .also { it.setSurfaceProvider(previewView.surfaceProvider) }

        // Barcode analyzer
        analyzer = BarcodeAnalyzer { result ->
            // Play scan sound on main thread
            if (scanSoundEnabled) {
                try {
                    toneGenerator?.startTone(ToneGenerator.TONE_PROP_ACK, 100)
                } catch (e: Exception) { /* ignore */ }
            }
            onScanResult?.invoke(result)
        }

        imageAnalysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also { it.setAnalyzer(cameraExecutor!!, analyzer!!) }

        // Try back camera first, fall back to front, then any available
        val cameraSelector = try {
            val backSelector = CameraSelector.Builder()
                .requireLensFacing(CameraSelector.LENS_FACING_BACK)
                .build()
            // Test if back camera exists
            provider.hasCamera(backSelector)
            backSelector
        } catch (e: Exception) {
            Log.w(TAG, "Back camera not available, trying front camera")
            try {
                val frontSelector = CameraSelector.Builder()
                    .requireLensFacing(CameraSelector.LENS_FACING_FRONT)
                    .build()
                provider.hasCamera(frontSelector)
                frontSelector
            } catch (e2: Exception) {
                Log.w(TAG, "Front camera not available, using default")
                CameraSelector.DEFAULT_FRONT_CAMERA
            }
        }

        try {
            camera = provider.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                preview,
                imageAnalysis
            )
            Log.i(TAG, "Camera started for barcode scanning (selector: $cameraSelector)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to bind camera use cases", e)
            // Last resort: try default camera
            try {
                camera = provider.bindToLifecycle(
                    lifecycleOwner,
                    CameraSelector.DEFAULT_FRONT_CAMERA,
                    preview,
                    imageAnalysis
                )
                Log.i(TAG, "Camera started with DEFAULT_FRONT_CAMERA fallback")
            } catch (e2: Exception) {
                Log.e(TAG, "All camera attempts failed", e2)
            }
        }
    }

    /**
     * Toggle flashlight/torch.
     */
    fun toggleTorch(): Boolean {
        val cam = camera ?: return false
        if (!cam.cameraInfo.hasFlashUnit()) return false

        isTorchEnabled = !isTorchEnabled
        cam.cameraControl.enableTorch(isTorchEnabled)
        Log.d(TAG, "Torch: $isTorchEnabled")
        return isTorchEnabled
    }

    /**
     * Set torch state directly.
     */
    fun setTorch(enabled: Boolean) {
        val cam = camera ?: return
        if (!cam.cameraInfo.hasFlashUnit()) return
        isTorchEnabled = enabled
        cam.cameraControl.enableTorch(enabled)
    }

    /**
     * Reset scan debounce (allow re-scanning same barcode).
     */
    fun resetScanState() {
        analyzer?.reset()
    }

    /**
     * Stop camera and release resources.
     */
    fun stop() {
        try {
            cameraProvider?.unbindAll()
            cameraExecutor?.shutdown()
            toneGenerator?.release()
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping scanner", e)
        }

        camera = null
        preview = null
        imageAnalysis = null
        analyzer = null
        cameraExecutor = null
        toneGenerator = null
        isTorchEnabled = false

        Log.i(TAG, "Camera stopped")
    }
}
