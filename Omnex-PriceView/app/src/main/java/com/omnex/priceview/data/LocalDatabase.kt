package com.omnex.priceview.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.omnex.priceview.data.dao.BundleDao
import com.omnex.priceview.data.dao.CategoryDao
import com.omnex.priceview.data.dao.DeletedProductLogDao
import com.omnex.priceview.data.dao.ProductDao
import com.omnex.priceview.data.dao.SyncMetadataDao
import com.omnex.priceview.data.entities.BundleEntity
import com.omnex.priceview.data.entities.CategoryEntity
import com.omnex.priceview.data.entities.DeletedProductLog
import com.omnex.priceview.data.entities.ProductEntity
import com.omnex.priceview.data.entities.SyncMetadata

@Database(
    entities = [
        ProductEntity::class,
        CategoryEntity::class,
        BundleEntity::class,
        SyncMetadata::class,
        DeletedProductLog::class
    ],
    version = 1,
    exportSchema = false
)
abstract class LocalDatabase : RoomDatabase() {

    abstract fun productDao(): ProductDao
    abstract fun categoryDao(): CategoryDao
    abstract fun bundleDao(): BundleDao
    abstract fun syncMetadataDao(): SyncMetadataDao
    abstract fun deletedProductLogDao(): DeletedProductLogDao

    companion object {
        @Volatile
        private var INSTANCE: LocalDatabase? = null

        fun getInstance(context: Context): LocalDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    LocalDatabase::class.java,
                    "omnex_priceview.db"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
