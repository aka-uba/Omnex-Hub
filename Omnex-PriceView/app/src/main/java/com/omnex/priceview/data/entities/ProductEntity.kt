package com.omnex.priceview.data.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "products",
    indices = [
        Index(value = ["barcode"]),
        Index(value = ["sku"]),
        Index(value = ["company_id", "sku"], unique = true),
        Index(value = ["company_id", "barcode"]),
        Index(value = ["name"]),
        Index(value = ["category"]),
        Index(value = ["status"]),
        Index(value = ["company_id", "updated_at"])
    ]
)
data class ProductEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "company_id")
    val companyId: String,

    @ColumnInfo(name = "sku")
    val sku: String,

    @ColumnInfo(name = "barcode")
    val barcode: String? = null,

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "description")
    val description: String? = null,

    @ColumnInfo(name = "current_price")
    val currentPrice: Double? = null,

    @ColumnInfo(name = "previous_price")
    val previousPrice: Double? = null,

    @ColumnInfo(name = "unit")
    val unit: String? = null,

    @ColumnInfo(name = "group_name")
    val groupName: String? = null,

    @ColumnInfo(name = "category")
    val category: String? = null,

    @ColumnInfo(name = "subcategory")
    val subcategory: String? = null,

    @ColumnInfo(name = "brand")
    val brand: String? = null,

    @ColumnInfo(name = "image_url")
    val imageUrl: String? = null,

    @ColumnInfo(name = "images")
    val images: String? = null,

    @ColumnInfo(name = "videos")
    val videos: String? = null,

    @ColumnInfo(name = "cover_image_index")
    val coverImageIndex: Int? = null,

    @ColumnInfo(name = "stock", defaultValue = "0")
    val stock: Int = 0,

    @ColumnInfo(name = "status", defaultValue = "'active'")
    val status: String = "active",

    @ColumnInfo(name = "vat_rate")
    val vatRate: Double? = null,

    @ColumnInfo(name = "discount_percent")
    val discountPercent: Double? = null,

    @ColumnInfo(name = "campaign_text")
    val campaignText: String? = null,

    @ColumnInfo(name = "weight")
    val weight: Double? = null,

    @ColumnInfo(name = "shelf_location")
    val shelfLocation: String? = null,

    @ColumnInfo(name = "origin")
    val origin: String? = null,

    @ColumnInfo(name = "production_type")
    val productionType: String? = null,

    @ColumnInfo(name = "is_featured", defaultValue = "0")
    val isFeatured: Boolean = false,

    @ColumnInfo(name = "erp_product_id")
    val erpProductId: String? = null,

    @ColumnInfo(name = "erp_data")
    val erpData: String? = null,

    @ColumnInfo(name = "kunye_data")
    val kunyeData: String? = null,

    @ColumnInfo(name = "extra_data")
    val extraData: String? = null,

    @ColumnInfo(name = "version", defaultValue = "1")
    val version: Int = 1,

    @ColumnInfo(name = "updated_at")
    val updatedAt: String,

    @ColumnInfo(name = "synced_at")
    val syncedAt: String
)
