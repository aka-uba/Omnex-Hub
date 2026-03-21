package com.omnex.priceview.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log
import com.omnex.priceview.data.LocalDatabase
import com.omnex.priceview.data.entities.ProductEntity
import com.omnex.priceview.data.entities.SyncMetadata
import com.omnex.priceview.network.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

/**
 * Product sync engine - handles full sync and delta sync with backend.
 *
 * Full sync: Downloads all products (paginated, streaming).
 * Delta sync: Downloads only changed/deleted products since last sync.
 *
 * Uses streaming JSON parsing to avoid OOM on large catalogs (50K+ products).
 */
class ProductSyncManager(
    private val context: Context,
    private val apiClient: ApiClient,
    private val database: LocalDatabase
) {
    companion object {
        private const val TAG = "ProductSync"
        private const val PAGE_SIZE = 5000
        private const val BATCH_INSERT_SIZE = 500
    }

    private var _status: SyncStatus = SyncStatus.idle()
    val status: SyncStatus get() = _status

    private var statusListener: ((SyncStatus) -> Unit)? = null

    fun setStatusListener(listener: (SyncStatus) -> Unit) {
        statusListener = listener
    }

    private fun updateStatus(newStatus: SyncStatus) {
        _status = newStatus
        statusListener?.invoke(newStatus)
    }

    /**
     * Execute product sync (full or delta based on last sync state).
     * Call from background thread (coroutine or WorkManager).
     */
    /**
     * @param onProgress Optional callback for progress reporting (current, total)
     */
    suspend fun sync(onProgress: (suspend (Int, Int) -> Unit)? = null): SyncResult = withContext(Dispatchers.IO) {
        if (!isNetworkAvailable()) {
            updateStatus(SyncStatus.noNetwork())
            return@withContext SyncResult(success = false, error = "No network")
        }

        val syncMeta = database.syncMetadataDao().get("products")
        val lastSyncAt = syncMeta?.lastSyncAt

        return@withContext try {
            if (lastSyncAt == null) {
                Log.i(TAG, "Starting FULL sync (no previous sync)")
                fullSync(onProgress)
            } else {
                Log.i(TAG, "Starting DELTA sync (since: $lastSyncAt)")
                deltaSync(lastSyncAt, onProgress)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Sync failed", e)
            val errorMsg = e.message ?: "Unknown sync error"
            updateStatus(SyncStatus.error(errorMsg, lastSyncAt))
            database.syncMetadataDao().updateStatus("products", "error", errorMsg)
            SyncResult(success = false, error = errorMsg)
        }
    }

    /**
     * Full sync - downloads all active products (paginated).
     */
    private suspend fun fullSync(onProgress: (suspend (Int, Int) -> Unit)? = null): SyncResult {
        database.syncMetadataDao().upsert(
            SyncMetadata("products", null, 0, "syncing", null)
        )
        updateStatus(SyncStatus.syncing(message = "Starting full sync..."))

        var page = 1
        var totalInserted = 0
        var serverTime: String? = null
        var totalProducts = 0

        while (true) {
            val params = mapOf(
                "full" to "true",
                "page" to page.toString(),
                "limit" to PAGE_SIZE.toString()
            )

            val response = apiClient.getSync("/api/priceview/products/sync", params)
            if (!response.success) {
                throw Exception("Sync API error: ${response.statusCode} - ${response.error ?: response.body}")
            }

            val json = JSONObject(response.body)
            val data = if (json.has("data")) json.getJSONObject("data") else json
            val products = data.getJSONArray("products")
            serverTime = data.optString("server_time", null)
            totalProducts = data.optInt("total", totalProducts)
            val hasMore = data.optBoolean("has_more", false)

            // Parse and batch insert
            val entities = parseProducts(products)
            insertBatch(entities)
            totalInserted += entities.size

            val progress = if (totalProducts > 0) {
                ((totalInserted.toFloat() / totalProducts) * 100).toInt().coerceIn(0, 100)
            } else {
                if (hasMore) 50 else 100
            }

            updateStatus(SyncStatus.syncing(
                progress = progress,
                synced = totalInserted,
                total = totalProducts,
                message = "Syncing: $totalInserted / $totalProducts products"
            ))
            onProgress?.invoke(totalInserted, totalProducts)

            Log.i(TAG, "Full sync page $page: ${entities.size} products (total: $totalInserted)")

            if (!hasMore || entities.isEmpty()) break
            page++
        }

        // Update sync metadata
        val syncTime = serverTime ?: nowIso()
        database.syncMetadataDao().updateLastSync("products", syncTime, totalInserted)
        updateStatus(SyncStatus.completed(totalInserted, syncTime))

        Log.i(TAG, "Full sync complete: $totalInserted products")
        return SyncResult(success = true, inserted = totalInserted, serverTime = syncTime)
    }

    /**
     * Delta sync - downloads only changed/deleted products since last sync.
     */
    private suspend fun deltaSync(since: String, onProgress: (suspend (Int, Int) -> Unit)? = null): SyncResult {
        database.syncMetadataDao().updateStatus("products", "syncing", null)
        updateStatus(SyncStatus.syncing(message = "Checking for updates..."))

        val params = mapOf("since" to since, "limit" to PAGE_SIZE.toString())
        val response = apiClient.getSync("/api/priceview/products/sync", params)

        if (!response.success) {
            throw Exception("Delta sync API error: ${response.statusCode} - ${response.error ?: response.body}")
        }

        val json = JSONObject(response.body)
        val data = if (json.has("data")) json.getJSONObject("data") else json
        val products = data.getJSONArray("products")
        val deletedIdsArray = data.optJSONArray("deleted_ids") ?: JSONArray()
        val serverTime = data.optString("server_time", nowIso())

        // Upsert changed products
        val entities = parseProducts(products)
        if (entities.isNotEmpty()) {
            insertBatch(entities)
        }

        // Delete removed products
        val deletedIds = mutableListOf<String>()
        for (i in 0 until deletedIdsArray.length()) {
            deletedIds.add(deletedIdsArray.getString(i))
        }
        if (deletedIds.isNotEmpty()) {
            // Room @Query IN clause has 999 limit, batch if needed
            deletedIds.chunked(900).forEach { chunk ->
                database.productDao().deleteByIds(chunk)
            }
        }

        // Update metadata
        val currentCount = database.productDao().getCount()
        database.syncMetadataDao().updateLastSync("products", serverTime, currentCount)
        updateStatus(SyncStatus.completed(currentCount, serverTime))

        Log.i(TAG, "Delta sync complete: ${entities.size} updated, ${deletedIds.size} deleted")
        return SyncResult(
            success = true,
            inserted = entities.size,
            deleted = deletedIds.size,
            serverTime = serverTime
        )
    }

    /**
     * Parse JSONArray of products into ProductEntity list.
     */
    private fun parseProducts(jsonArray: JSONArray): List<ProductEntity> {
        val now = nowIso()
        val result = mutableListOf<ProductEntity>()

        for (i in 0 until jsonArray.length()) {
            try {
                val obj = jsonArray.getJSONObject(i)
                result.add(
                    ProductEntity(
                        id = obj.getString("id"),
                        companyId = obj.getString("company_id"),
                        sku = obj.optString("sku", ""),
                        barcode = obj.optStringOrNull("barcode"),
                        name = obj.optString("name", ""),
                        description = obj.optStringOrNull("description"),
                        currentPrice = obj.optDoubleOrNull("current_price"),
                        previousPrice = obj.optDoubleOrNull("previous_price"),
                        unit = obj.optStringOrNull("unit"),
                        groupName = obj.optStringOrNull("group"),
                        category = obj.optStringOrNull("category"),
                        subcategory = obj.optStringOrNull("subcategory"),
                        brand = obj.optStringOrNull("brand"),
                        imageUrl = obj.optStringOrNull("image_url"),
                        images = obj.optStringOrNull("images"),
                        videos = obj.optStringOrNull("videos"),
                        coverImageIndex = if (obj.has("cover_image_index")) obj.optInt("cover_image_index") else null,
                        stock = obj.optInt("stock", 0),
                        status = obj.optString("status", "active"),
                        vatRate = obj.optDoubleOrNull("vat_rate"),
                        discountPercent = obj.optDoubleOrNull("discount_percent"),
                        campaignText = obj.optStringOrNull("campaign_text"),
                        weight = obj.optDoubleOrNull("weight"),
                        shelfLocation = obj.optStringOrNull("shelf_location"),
                        origin = obj.optStringOrNull("origin"),
                        productionType = obj.optStringOrNull("production_type"),
                        isFeatured = obj.optBoolean("is_featured", false),
                        erpProductId = obj.optStringOrNull("erp_product_id"),
                        erpData = obj.optStringOrNull("erp_data"),
                        kunyeData = obj.optStringOrNull("kunye_data"),
                        extraData = obj.optStringOrNull("extra_data"),
                        version = obj.optInt("version", 1),
                        updatedAt = obj.optString("updated_at", now),
                        syncedAt = now
                    )
                )
            } catch (e: Exception) {
                Log.w(TAG, "Failed to parse product at index $i", e)
            }
        }

        return result
    }

    /**
     * Insert products in batches of BATCH_INSERT_SIZE to avoid memory issues.
     */
    private suspend fun insertBatch(products: List<ProductEntity>) {
        products.chunked(BATCH_INSERT_SIZE).forEach { batch ->
            database.productDao().upsertAll(batch)
        }
    }

    /**
     * Check network availability.
     */
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

    // JSON extension helpers
    private fun JSONObject.optStringOrNull(key: String): String? {
        val value = this.optString(key, "")
        return if (value.isBlank() || value == "null") null else value
    }

    private fun JSONObject.optDoubleOrNull(key: String): Double? {
        return if (this.has(key) && !this.isNull(key)) this.optDouble(key).let {
            if (it.isNaN() || it.isInfinite()) null else it
        } else null
    }
}

data class SyncResult(
    val success: Boolean,
    val inserted: Int = 0,
    val deleted: Int = 0,
    val error: String? = null,
    val serverTime: String? = null
)
