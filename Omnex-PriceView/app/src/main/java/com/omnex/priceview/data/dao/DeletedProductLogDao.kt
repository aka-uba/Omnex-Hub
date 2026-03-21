package com.omnex.priceview.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.omnex.priceview.data.entities.DeletedProductLog

@Dao
interface DeletedProductLogDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(logs: List<DeletedProductLog>)

    @Query("DELETE FROM deleted_product_log WHERE deleted_at < :date")
    suspend fun deleteOlderThan(date: String)

    @Query("SELECT * FROM deleted_product_log ORDER BY deleted_at DESC")
    suspend fun getAll(): List<DeletedProductLog>
}
