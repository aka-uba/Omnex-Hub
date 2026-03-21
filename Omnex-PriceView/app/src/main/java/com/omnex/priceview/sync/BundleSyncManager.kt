package com.omnex.priceview.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log
import com.omnex.priceview.data.LocalDatabase
import com.omnex.priceview.data.entities.BundleEntity
import com.omnex.priceview.data.entities.SyncMetadata
import com.omnex.priceview.network.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Bundle sync engine - handles full sync and delta sync for package/bundle data.
 */
class BundleSyncManager(
    private val context: Context,
    private val apiClient: ApiClient,
    private val database: LocalDatabase
) {
    companion object {
        private const val TAG = "BundleSync"
        private const val PAGE_SIZE = 1000
        private const val BATCH_INSERT_SIZE = 250
    }

    suspend fun sync(): SyncResult = withContext(Dispatchers.IO) {
        if (!isNetworkAvailable()) {
            return@withContext SyncResult(success = false, error = "No network")
        }

        val syncMeta = database.syncMetadataDao().get("bundles")
        val lastSyncAt = syncMeta?.lastSyncAt

        return@withContext try {
            if (lastSyncAt == null) {
                fullSync()
            } else {
                deltaSync(lastSyncAt)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Bundle sync failed", e)
            val errorMsg = e.message ?: "Unknown bundle sync error"
            database.syncMetadataDao().updateStatus("bundles", "error", errorMsg)
            SyncResult(success = false, error = errorMsg)
        }
    }

    private suspend fun fullSync(): SyncResult {
        database.syncMetadataDao().upsert(
            SyncMetadata("bundles", null, 0, "syncing", null)
        )

        var page = 1
        var totalInserted = 0
        var serverTime: String? = null
        var totalBundles = 0

        while (true) {
            val params = mapOf(
                "full" to "true",
                "page" to page.toString(),
                "limit" to PAGE_SIZE.toString()
            )

            val response = apiClient.getSync("/api/priceview/bundles/sync", params)
            if (!response.success) {
                throw Exception("Bundle sync API error: ${response.statusCode} - ${response.error ?: response.body}")
            }

            val json = JSONObject(response.body)
            val data = if (json.has("data")) json.getJSONObject("data") else json
            val bundles = data.getJSONArray("bundles")
            serverTime = data.optString("server_time", null)
            totalBundles = data.optInt("total", totalBundles)
            val hasMore = data.optBoolean("has_more", false)

            val entities = parseBundles(bundles)
            insertBatch(entities)
            totalInserted += entities.size

            Log.i(TAG, "Full bundle sync page $page: ${entities.size} bundles (total: $totalInserted)")
            if (!hasMore || entities.isEmpty()) break
            page++
        }

        val syncTime = serverTime ?: nowIso()
        val currentCount = database.bundleDao().getCount()
        database.syncMetadataDao().updateLastSync("bundles", syncTime, currentCount)

        Log.i(TAG, "Full bundle sync complete: $currentCount bundles (raw inserted: $totalInserted, total hint: $totalBundles)")
        return SyncResult(success = true, inserted = currentCount, serverTime = syncTime)
    }

    private suspend fun deltaSync(since: String): SyncResult {
        database.syncMetadataDao().updateStatus("bundles", "syncing", null)

        val params = mapOf(
            "since" to since,
            "limit" to PAGE_SIZE.toString()
        )
        val response = apiClient.getSync("/api/priceview/bundles/sync", params)

        if (!response.success) {
            throw Exception("Bundle delta sync API error: ${response.statusCode} - ${response.error ?: response.body}")
        }

        val json = JSONObject(response.body)
        val data = if (json.has("data")) json.getJSONObject("data") else json
        val bundles = data.optJSONArray("bundles") ?: JSONArray()
        val deletedIdsArray = data.optJSONArray("deleted_ids") ?: JSONArray()
        val serverTime = data.optString("server_time", nowIso())

        val entities = parseBundles(bundles)
        if (entities.isNotEmpty()) {
            insertBatch(entities)
        }

        val deletedIds = mutableListOf<String>()
        for (i in 0 until deletedIdsArray.length()) {
            deletedIds.add(deletedIdsArray.getString(i))
        }
        if (deletedIds.isNotEmpty()) {
            deletedIds.chunked(900).forEach { chunk ->
                database.bundleDao().deleteByIds(chunk)
            }
        }

        val currentCount = database.bundleDao().getCount()
        database.syncMetadataDao().updateLastSync("bundles", serverTime, currentCount)

        Log.i(TAG, "Delta bundle sync complete: ${entities.size} updated, ${deletedIds.size} deleted")
        return SyncResult(
            success = true,
            inserted = entities.size,
            deleted = deletedIds.size,
            serverTime = serverTime
        )
    }

    private fun parseBundles(jsonArray: JSONArray): List<BundleEntity> {
        val now = nowIso()
        val result = mutableListOf<BundleEntity>()

        for (i in 0 until jsonArray.length()) {
            try {
                val obj = jsonArray.getJSONObject(i)
                val rawImages = obj.optJsonStringOrNull("images")
                val imageUrl = obj.optStringOrNull("image_url")
                val normalizedImages = when {
                    !rawImages.isNullOrBlank() -> rawImages
                    !imageUrl.isNullOrBlank() -> JSONArray().put(imageUrl).toString()
                    else -> null
                }
                result.add(
                    BundleEntity(
                        id = obj.getString("id"),
                        companyId = obj.getString("company_id"),
                        name = obj.optString("name", ""),
                        sku = obj.optStringOrNull("sku"),
                        barcode = obj.optStringOrNull("barcode"),
                        type = obj.optStringOrNull("type"),
                        productsJson = obj.optJsonStringOrNull("products_json"),
                        totalPrice = obj.optDoubleOrNull("total_price"),
                        discountPercent = obj.optDoubleOrNull("discount_percent"),
                        finalPrice = obj.optDoubleOrNull("final_price"),
                        status = obj.optString("status", "active"),
                        images = normalizedImages,
                        updatedAt = obj.optString("updated_at", now),
                        syncedAt = now
                    )
                )
            } catch (e: Exception) {
                Log.w(TAG, "Failed to parse bundle at index $i", e)
            }
        }

        return result
    }

    private suspend fun insertBatch(bundles: List<BundleEntity>) {
        bundles.chunked(BATCH_INSERT_SIZE).forEach { batch ->
            database.bundleDao().upsertAll(batch)
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = cm.activeNetwork ?: return false
            val capabilities = cm.getNetworkCapabilities(network) ?: return false
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION")
            cm.activeNetworkInfo?.isConnected == true
        }
    }

    private fun nowIso(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    private fun JSONObject.optStringOrNull(key: String): String? {
        val value = this.optString(key, "")
        return if (value.isBlank() || value == "null") null else value
    }

    private fun JSONObject.optDoubleOrNull(key: String): Double? {
        return if (this.has(key) && !this.isNull(key)) this.optDouble(key).let {
            if (it.isNaN() || it.isInfinite()) null else it
        } else null
    }

    private fun JSONObject.optJsonStringOrNull(key: String): String? {
        if (!this.has(key) || this.isNull(key)) {
            return null
        }

        val value = this.opt(key)
        return when (value) {
            is JSONArray -> value.toString()
            is JSONObject -> value.toString()
            is String -> {
                if (value.isBlank() || value == "null") null else value
            }
            else -> value?.toString()
        }
    }
}
