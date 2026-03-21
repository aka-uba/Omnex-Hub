package com.omnex.priceview.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.omnex.priceview.data.entities.SyncMetadata

@Dao
interface SyncMetadataDao {

    @Query("SELECT * FROM sync_metadata WHERE entity_type = :entityType LIMIT 1")
    suspend fun get(entityType: String): SyncMetadata?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(metadata: SyncMetadata)

    @Query("UPDATE sync_metadata SET sync_status = :status, error_message = :errorMessage WHERE entity_type = :entityType")
    suspend fun updateStatus(entityType: String, status: String, errorMessage: String? = null)

    @Query("UPDATE sync_metadata SET last_sync_at = :lastSyncAt, total_count = :totalCount, sync_status = 'idle', error_message = NULL WHERE entity_type = :entityType")
    suspend fun updateLastSync(entityType: String, lastSyncAt: String, totalCount: Int)
}
