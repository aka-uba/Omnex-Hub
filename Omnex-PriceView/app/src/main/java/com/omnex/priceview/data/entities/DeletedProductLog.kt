package com.omnex.priceview.data.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "deleted_product_log")
data class DeletedProductLog(
    @PrimaryKey
    @ColumnInfo(name = "product_id")
    val productId: String,

    @ColumnInfo(name = "company_id")
    val companyId: String,

    @ColumnInfo(name = "deleted_at")
    val deletedAt: String
)
