package com.omnex.priceview.scanner

/**
 * Barcode scan result data class.
 */
data class ScanResult(
    val rawValue: String,
    val format: BarcodeFormat,
    val displayValue: String = rawValue,
    val timestamp: Long = System.currentTimeMillis()
)

enum class BarcodeFormat {
    EAN_13,
    EAN_8,
    UPC_A,
    UPC_E,
    CODE_128,
    CODE_39,
    QR_CODE,
    ITF,
    UNKNOWN;

    companion object {
        fun fromMlKit(format: Int): BarcodeFormat {
            return when (format) {
                com.google.mlkit.vision.barcode.common.Barcode.FORMAT_EAN_13 -> EAN_13
                com.google.mlkit.vision.barcode.common.Barcode.FORMAT_EAN_8 -> EAN_8
                com.google.mlkit.vision.barcode.common.Barcode.FORMAT_UPC_A -> UPC_A
                com.google.mlkit.vision.barcode.common.Barcode.FORMAT_UPC_E -> UPC_E
                com.google.mlkit.vision.barcode.common.Barcode.FORMAT_CODE_128 -> CODE_128
                com.google.mlkit.vision.barcode.common.Barcode.FORMAT_CODE_39 -> CODE_39
                com.google.mlkit.vision.barcode.common.Barcode.FORMAT_QR_CODE -> QR_CODE
                com.google.mlkit.vision.barcode.common.Barcode.FORMAT_ITF -> ITF
                else -> UNKNOWN
            }
        }
    }
}
