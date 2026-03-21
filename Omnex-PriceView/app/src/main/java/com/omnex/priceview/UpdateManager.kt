package com.omnex.priceview

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.util.Log
import android.widget.Toast
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlin.concurrent.thread

class UpdateManager(private val context: Context) {

    companion object {
        private const val TAG = "UpdateManager"
        private const val UPDATE_URL = "https://hub.omnexcore.com/downloads/update.json"
        private const val APK_URL = "https://hub.omnexcore.com/downloads/omnex-priceview.apk"
        private const val APP_KEY = "com.omnex.priceview" // Key in multi-app update.json
    }

    private var downloadId: Long = -1

    fun canInstallPackages(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            context.packageManager.canRequestPackageInstalls()
    }

    fun openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                data = Uri.parse("package:${context.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }
    }

    /**
     * Check for updates in background.
     */
    fun checkForUpdates(callback: (UpdateInfo?) -> Unit) {
        thread {
            try {
                val connection = URL(UPDATE_URL).openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 10000
                connection.readTimeout = 10000

                if (connection.responseCode == 200) {
                    val response = connection.inputStream.bufferedReader().readText()
                    val json = JSONObject(response)

                    // Multi-app format: { "apps": { "com.omnex.player": {...}, "com.omnex.priceview": {...} } }
                    // Fallback: try legacy single-app format if key not found
                    val appJson = if (json.has("apps")) {
                        json.getJSONObject("apps").optJSONObject(APP_KEY)
                    } else {
                        null // Legacy format is for player only, not priceview
                    }

                    if (appJson == null) {
                        Log.i(TAG, "No update entry for $APP_KEY in update.json")
                        callback(null)
                        connection.disconnect()
                        return@thread
                    }

                    val updateInfo = UpdateInfo(
                        versionCode = appJson.getInt("versionCode"),
                        versionName = appJson.getString("versionName"),
                        downloadUrl = appJson.optString("downloadUrl", APK_URL),
                        releaseNotes = appJson.optString("releaseNotes", ""),
                        mandatory = appJson.optBoolean("mandatory", false),
                        sha256 = appJson.optString("sha256", "")
                    )

                    val currentVersionCode = BuildConfig.VERSION_CODE
                    if (updateInfo.versionCode > currentVersionCode) {
                        callback(updateInfo)
                    } else {
                        callback(null)
                    }
                } else {
                    Log.w(TAG, "Update check failed: HTTP ${connection.responseCode}")
                    callback(null)
                }

                connection.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Update check error", e)
                callback(null)
            }
        }
    }

    /**
     * Download APK and start install flow.
     * @return true when download started, false when permission is missing.
     */
    fun downloadAndInstall(updateInfo: UpdateInfo): Boolean {
        if (!canInstallPackages()) {
            openInstallPermissionSettings()
            Toast.makeText(
                context,
                "Lütfen bilinmeyen kaynaklardan yüklemeye izin verin",
                Toast.LENGTH_LONG
            ).show()
            return false
        }

        val fileName = "omnex-priceview-${updateInfo.versionName}.apk"

        val request = DownloadManager.Request(Uri.parse(updateInfo.downloadUrl)).apply {
            setTitle("Omnex Player Güncelleniyor")
            setDescription("Sürüm ${updateInfo.versionName} indiriliyor...")
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            setAllowedOverMetered(true)
            setAllowedOverRoaming(true)
        }

        val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        downloadId = downloadManager.enqueue(request)

        val expectedHash = updateInfo.sha256

        val onComplete = object : BroadcastReceiver() {
            override fun onReceive(ctxt: Context, intent: Intent) {
                val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                if (id == downloadId) {
                    context.unregisterReceiver(this)

                    // Verify integrity before installing
                    if (expectedHash.isNotBlank()) {
                        val file = File(
                            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                            fileName
                        )
                        if (file.exists()) {
                            val fileHash = computeSha256(file)
                            if (!fileHash.equals(expectedHash, ignoreCase = true)) {
                                Log.e(TAG, "APK hash mismatch! Expected=$expectedHash Got=$fileHash")
                                Toast.makeText(
                                    context,
                                    "Güncelleme dosyası doğrulanamadı. İndirme iptal edildi.",
                                    Toast.LENGTH_LONG
                                ).show()
                                // Delete corrupted/tampered APK
                                file.delete()
                                return
                            }
                            Log.i(TAG, "APK hash verified OK: $fileHash")
                        }
                    } else {
                        Log.w(TAG, "No sha256 in update.json - skipping integrity check")
                    }

                    installApk(fileName)
                }
            }
        }

        val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(onComplete, filter, Context.RECEIVER_EXPORTED)
        } else {
            context.registerReceiver(onComplete, filter)
        }

        Toast.makeText(context, "Güncelleme indiriliyor...", Toast.LENGTH_SHORT).show()
        return true
    }

    /**
     * Compute SHA-256 hash of a file.
     */
    private fun computeSha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { fis ->
            val buffer = ByteArray(8192)
            var bytesRead: Int
            while (fis.read(buffer).also { bytesRead = it } != -1) {
                digest.update(buffer, 0, bytesRead)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    /**
     * Start APK installer intent.
     */
    private fun installApk(fileName: String) {
        try {
            val file = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                fileName
            )

            if (!file.exists()) {
                Log.e(TAG, "APK file not found: ${file.absolutePath}")
                Toast.makeText(context, "APK dosyası bulunamadı", Toast.LENGTH_SHORT).show()
                return
            }

            val uri: Uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            } else {
                Uri.fromFile(file)
            }

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }

            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "APK installation error", e)
            Toast.makeText(context, "Kurulum başlatılamadı: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    data class UpdateInfo(
        val versionCode: Int,
        val versionName: String,
        val downloadUrl: String,
        val releaseNotes: String,
        val mandatory: Boolean,
        val sha256: String = ""
    )
}
