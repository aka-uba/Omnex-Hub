# Add project specific ProGuard rules here.

# Keep JavaScript interface
-keepclassmembers class com.omnex.player.MainActivity$AndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebView
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
    public boolean *(android.webkit.WebView, java.lang.String);
    public void *(android.webkit.WebView, java.lang.String);
}

# Keep BuildConfig
-keep class com.omnex.player.BuildConfig { *; }
