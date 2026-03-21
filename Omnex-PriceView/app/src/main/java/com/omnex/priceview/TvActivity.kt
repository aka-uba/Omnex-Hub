package com.omnex.priceview

import android.os.Bundle

/**
 * Omnex Player - TV Activity
 * Android TV ve Google TV için özel launcher
 * Ana işlevsellik MainActivity'den miras alınır
 */
class TvActivity : MainActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // TV için ek ayarlar burada yapılabilir
        // Örneğin: D-pad navigasyonu, ses kontrolü, vs.
    }
}
