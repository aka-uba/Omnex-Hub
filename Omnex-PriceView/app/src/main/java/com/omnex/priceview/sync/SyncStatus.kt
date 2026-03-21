package com.omnex.priceview.sync

/**
 * Observable sync state for UI updates.
 */
data class SyncStatus(
    val state: State,
    val progress: Int = 0,        // 0-100
    val totalProducts: Int = 0,
    val syncedProducts: Int = 0,
    val message: String? = null,
    val error: String? = null,
    val lastSyncAt: String? = null
) {
    enum class State {
        IDLE,
        SYNCING,
        COMPLETED,
        ERROR,
        NO_NETWORK
    }

    val isRunning: Boolean get() = state == State.SYNCING

    companion object {
        fun idle(lastSyncAt: String? = null, totalProducts: Int = 0) = SyncStatus(
            state = State.IDLE,
            lastSyncAt = lastSyncAt,
            totalProducts = totalProducts
        )

        fun syncing(progress: Int = 0, synced: Int = 0, total: Int = 0, message: String? = null) = SyncStatus(
            state = State.SYNCING,
            progress = progress,
            syncedProducts = synced,
            totalProducts = total,
            message = message
        )

        fun completed(totalProducts: Int, lastSyncAt: String) = SyncStatus(
            state = State.COMPLETED,
            totalProducts = totalProducts,
            lastSyncAt = lastSyncAt
        )

        fun error(message: String, lastSyncAt: String? = null) = SyncStatus(
            state = State.ERROR,
            error = message,
            lastSyncAt = lastSyncAt
        )

        fun noNetwork(lastSyncAt: String? = null) = SyncStatus(
            state = State.NO_NETWORK,
            lastSyncAt = lastSyncAt,
            message = "No network connection"
        )
    }
}
