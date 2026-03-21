package com.omnex.priceview.data.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "bundles",
    indices = [
        Index(value = ["company_id"]),
        Index(value = ["barcode"])
    ]
)
data class BundleEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "company_id")
    val companyId: String,

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "sku")
    val sku: String? = null,

    @ColumnInfo(name = "barcode")
    val barcode: String? = null,

    @ColumnInfo(name = "type")
    val type: String? = null,

    @ColumnInfo(name = "products_json")
    val productsJson: String? = null,

    @ColumnInfo(name = "total_price")
    val totalPrice: Double? = null,

    @ColumnInfo(name = "discount_percent")
    val discountPercent: Double? = null,

    @ColumnInfo(name = "final_price")
    val finalPrice: Double? = null,

    @ColumnInfo(name = "status", defaultValue = "'active'")
    val status: String = "active",

    @ColumnInfo(name = "images")
    val images: String? = null,

    @ColumnInfo(name = "updated_at")
    val updatedAt: String,

    @ColumnInfo(name = "synced_at")
    val syncedAt: String
)
