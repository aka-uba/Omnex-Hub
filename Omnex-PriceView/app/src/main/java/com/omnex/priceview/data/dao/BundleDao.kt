package com.omnex.priceview.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import com.omnex.priceview.data.entities.BundleEntity

@Dao
interface BundleDao {

    @Query("SELECT * FROM bundles WHERE barcode = :barcode LIMIT 1")
    suspend fun findByBarcode(barcode: String): BundleEntity?

    @Query("SELECT * FROM bundles WHERE sku = :sku LIMIT 1")
    suspend fun findBySku(sku: String): BundleEntity?

    @Query("SELECT * FROM bundles ORDER BY name ASC")
    suspend fun getAll(): List<BundleEntity>

    @Query("SELECT COUNT(*) FROM bundles")
    suspend fun getCount(): Int

    @Transaction
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(bundles: List<BundleEntity>)

    @Query("DELETE FROM bundles WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<String>)

    @Query("DELETE FROM bundles WHERE company_id = :companyId")
    suspend fun deleteByCompanyId(companyId: String)
}
