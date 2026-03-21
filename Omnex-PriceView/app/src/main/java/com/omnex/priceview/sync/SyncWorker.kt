package com.omnex.priceview.sync

import android.content.Context
import android.util.Log
import androidx.work.*
import com.omnex.priceview.data.LocalDatabase
import com.omnex.priceview.network.ApiClient
import com.omnex.priceview.settings.PriceViewConfig
import java.util.concurrent.TimeUnit

/**
 * WorkManager worker for periodic background product sync.
 * Runs every 30 minutes (configurable) when network is available.
 */
class SyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "SyncWorker"
        private const val WORK_NAME = "omnex_priceview_product_sync"

        /**
         * Schedule periodic sync with WorkManager.
         */
        fun schedule(context: Context, intervalMinutes: Int = 30) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            // WorkManager minimum interval is 15 minutes.
            // For shorter intervals, use UPDATE policy to force re-schedule.
            val effectiveInterval = intervalMinutes.toLong().coerceAtLeast(15)

            val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
                effectiveInterval, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    1, TimeUnit.MINUTES
                )
                .addTag("product_sync")
                .build()

            // UPDATE replaces existing work if interval changed (KEEP would ignore new interval)
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                syncRequest
            )

            Log.i(TAG, "Periodic sync scheduled: every ${effectiveInterval}min (requested: ${intervalMinutes}min)")

            // For intervals < 15min, also trigger immediate sync
            if (intervalMinutes < 15) {
                syncNow(context)
                Log.i(TAG, "Short interval requested ($intervalMinutes min < 15 min minimum), triggered immediate sync")
            }
        }

        /**
         * Cancel scheduled sync.
         */
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.i(TAG, "Periodic sync cancelled")
        }

        /**
         * Trigger immediate one-time sync.
         */
        fun syncNow(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val oneTimeRequest = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .addTag("product_sync_immediate")
                .build()

            WorkManager.getInstance(context).enqueue(oneTimeRequest)
            Log.i(TAG, "Immediate sync triggered")
        }
    }

    override suspend fun doWork(): Result {
        Log.i(TAG, "Sync worker starting (attempt ${runAttemptCount + 1})")

        val config = PriceViewConfig(applicationContext)
        if (!config.isDeviceRegistered) {
            Log.w(TAG, "Device not registered, skipping sync")
            return Result.success()
        }

        val database = LocalDatabase.getInstance(applicationContext)
        val apiClient = ApiClient(config)
        val productSyncManager = ProductSyncManager(applicationContext, apiClient, database)
        val bundleSyncManager = BundleSyncManager(applicationContext, apiClient, database)

        // Fetch remote config and apply to local settings
        fetchAndApplyConfig(apiClient, config)

        // Report starting progress
        setProgress(workDataOf("progress" to 0, "total" to 0, "status" to "syncing"))

        val productResult = productSyncManager.sync { current, total ->
            // Progress callback from ProductSyncManager
            setProgress(workDataOf("progress" to current, "total" to total, "status" to "syncing"))
        }
        val bundleResult = bundleSyncManager.sync()

        return if (productResult.success && bundleResult.success) {
            Log.i(
                TAG,
                "Sync completed: products ${productResult.inserted} updated/${productResult.deleted} deleted, " +
                    "bundles ${bundleResult.inserted} updated/${bundleResult.deleted} deleted"
            )
            Result.success(
                workDataOf(
                    "updated" to productResult.inserted,
                    "deleted" to productResult.deleted,
                    "bundles_updated" to bundleResult.inserted,
                    "bundles_deleted" to bundleResult.deleted,
                    "status" to "done"
                )
            )
        } else {
            val errorText = buildString {
                if (!productResult.success) {
                    append("products: " + (productResult.error ?: "unknown"))
                }
                if (!bundleResult.success) {
                    if (isNotEmpty()) append(" | ")
                    append("bundles: " + (bundleResult.error ?: "unknown"))
                }
            }
            Log.w(TAG, "Sync failed: $errorText")

            // 401 = token expired/invalid -> request token refresh from WebView
            if (errorText.contains("401")) {
                Log.w(TAG, "Token expired, requesting refresh from WebView")
                setProgress(workDataOf("status" to "token_expired"))
            }

            if (runAttemptCount < 3) {
                Result.retry()  // Exponential backoff: 1min, 2min, 4min
            } else {
                Log.e(TAG, "Sync failed after ${runAttemptCount + 1} attempts, giving up until next period")
                Result.failure(workDataOf("status" to "failed", "error" to if (errorText.isBlank()) "unknown" else errorText))
            }
        }
    }

    /**
     * Fetch remote config from /api/priceview/config and apply to local PriceViewConfig.
     * Updates sync interval, overlay timeout, default template, print/signage toggles.
     */
    private fun fetchAndApplyConfig(apiClient: ApiClient, config: PriceViewConfig) {
        try {
            val response = apiClient.get("/api/priceview/config")
            if (response.success) {
                val data = response.toJson() ?: return
                val previousInterval = config.syncIntervalMinutes

                // Apply config values
                val syncInterval = data.optInt("sync_interval_minutes", 30)
                val overlayTimeout = data.optInt("overlay_timeout_seconds", 10)
                val templateId = data.optString("default_template_id", "")
                val printEnabled = data.optBoolean("print_enabled", true)
                val signageEnabled = data.optBoolean("signage_enabled", true)
                val companyName = data.optString("company_name", "")
                val branchName = data.optString("branch_name", "")

                config.syncIntervalMinutes = syncInterval
                config.overlayTimeoutSeconds = overlayTimeout
                if (templateId.isNotBlank() && templateId != "null") {
                    config.defaultTemplateId = templateId
                }
                config.printEnabled = printEnabled
                config.signageEnabled = signageEnabled
                if (companyName.isNotBlank()) config.companyName = companyName
                config.branchName = if (branchName.isBlank() || branchName == "null") null else branchName

                // Product display HTML templates (native/html mode + cache-by-signature)
                DisplayTemplateSyncManager(apiClient, config).applyConfigAndSyncTemplates(data)

                Log.i(TAG, "Remote config applied: sync=${syncInterval}min, timeout=${overlayTimeout}s, template=${templateId}")

                // Re-schedule WorkManager if interval changed
                if (previousInterval != syncInterval) {
                    schedule(applicationContext, syncInterval)
                    Log.i(TAG, "Sync interval updated: ${previousInterval} -> ${syncInterval}min")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch remote config (non-fatal): ${e.message}")
        }
    }
}

