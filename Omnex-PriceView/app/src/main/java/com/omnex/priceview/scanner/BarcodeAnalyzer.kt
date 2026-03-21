package com.omnex.priceview.scanner

import android.util.Log
import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage

/**
 * CameraX ImageAnalysis.Analyzer that uses ML Kit for barcode detection.
 * Supports EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, QR, ITF.
 */
class BarcodeAnalyzer(
    private val onBarcodeDetected: (ScanResult) -> Unit
) : ImageAnalysis.Analyzer {

    companion object {
        private const val TAG = "BarcodeAnalyzer"
        private const val DEBOUNCE_MS = 500L  // Minimum time between scans
    }

    private var lastScanTime = 0L
    private var lastBarcode = ""
    private var isProcessing = false

    private val options = BarcodeScannerOptions.Builder()
        .setBarcodeFormats(
            Barcode.FORMAT_EAN_13,
            Barcode.FORMAT_EAN_8,
            Barcode.FORMAT_UPC_A,
            Barcode.FORMAT_UPC_E,
            Barcode.FORMAT_CODE_128,
            Barcode.FORMAT_CODE_39,
            Barcode.FORMAT_QR_CODE,
            Barcode.FORMAT_ITF
        )
        .build()

    private val scanner = BarcodeScanning.getClient(options)

    @OptIn(ExperimentalGetImage::class)
    override fun analyze(imageProxy: ImageProxy) {
        if (isProcessing) {
            imageProxy.close()
            return
        }

        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        isProcessing = true
        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)

        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                if (barcodes.isNotEmpty()) {
                    val barcode = barcodes[0]  // Take first detected barcode
                    val rawValue = barcode.rawValue ?: ""

                    if (rawValue.isNotBlank()) {
                        val now = System.currentTimeMillis()

                        // Debounce: skip if same barcode within DEBOUNCE_MS
                        if (rawValue != lastBarcode || (now - lastScanTime) > DEBOUNCE_MS) {
                            lastScanTime = now
                            lastBarcode = rawValue

                            val result = ScanResult(
                                rawValue = rawValue,
                                format = BarcodeFormat.fromMlKit(barcode.format),
                                displayValue = barcode.displayValue ?: rawValue
                            )

                            Log.d(TAG, "Barcode detected: $rawValue (${result.format})")
                            onBarcodeDetected(result)
                        }
                    }
                }
            }
            .addOnFailureListener { e ->
                Log.w(TAG, "Barcode analysis failed", e)
            }
            .addOnCompleteListener {
                isProcessing = false
                imageProxy.close()
            }
    }

    /**
     * Reset debounce state (e.g., when overlay reopens).
     */
    fun reset() {
        lastBarcode = ""
        lastScanTime = 0L
    }
}
