package com.omnex.priceview.data.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sync_metadata")
data class SyncMetadata(
    @PrimaryKey
    @ColumnInfo(name = "entity_type")
    val entityType: String,

    @ColumnInfo(name = "last_sync_at")
    val lastSyncAt: String? = null,

    @ColumnInfo(name = "total_count", defaultValue = "0")
    val totalCount: Int = 0,

    @ColumnInfo(name = "sync_status", defaultValue = "'idle'")
    val syncStatus: String = "idle",

    @ColumnInfo(name = "error_message")
    val errorMessage: String? = null
)
