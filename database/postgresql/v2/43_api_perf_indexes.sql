-- API-focused indexes for list/search/sort hot paths.
-- Targets:
-- - products list search/sort/filter
-- - devices list search/sort/filter
-- - media list folder/scope/filter

-- =========================
-- products (catalog.products)
-- =========================

-- Multi-filter + default sort for list pages.
CREATE INDEX IF NOT EXISTS "idx_products_company_group_category_status_updated"
    ON "catalog"."products" ("company_id", "group", "category", "status", "updated_at" DESC);

-- Case-insensitive sort support.
CREATE INDEX IF NOT EXISTS "idx_products_company_lower_name"
    ON "catalog"."products" ("company_id", (LOWER("name")));

CREATE INDEX IF NOT EXISTS "idx_products_company_lower_sku"
    ON "catalog"."products" ("company_id", (LOWER("sku")));

CREATE INDEX IF NOT EXISTS "idx_products_company_lower_barcode"
    ON "catalog"."products" ("company_id", (LOWER("barcode")));

-- Trigram indexes for contains-search (%term%) on main searchable fields.
CREATE INDEX IF NOT EXISTS "idx_products_name_trgm"
    ON "catalog"."products" USING gin ((LOWER("name")) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_products_sku_trgm"
    ON "catalog"."products" USING gin ((LOWER("sku")) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_products_barcode_trgm"
    ON "catalog"."products" USING gin ((LOWER("barcode")) gin_trgm_ops);

-- =======================
-- devices (devices.devices)
-- =======================

-- Branch/type/status filter with created_at sort.
CREATE INDEX IF NOT EXISTS "idx_devices_company_branch_type_status_created"
    ON "devices"."devices" ("company_id", "branch_id", "type", "status", "created_at" DESC);

-- Expression index for "last_activity" sort fallback chain.
CREATE INDEX IF NOT EXISTS "idx_devices_company_last_activity_expr"
    ON "devices"."devices" (
        "company_id",
        (COALESCE("last_seen", "last_online", "last_heartbeat", "last_sync", "updated_at")) DESC
    );

-- Trigram indexes for contains-search fields.
CREATE INDEX IF NOT EXISTS "idx_devices_name_trgm"
    ON "devices"."devices" USING gin ((LOWER("name")) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_devices_device_id_trgm"
    ON "devices"."devices" USING gin ((LOWER("device_id")) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_devices_ip_trgm"
    ON "devices"."devices" USING gin ((LOWER("ip_address")) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_devices_mac_trgm"
    ON "devices"."devices" USING gin ((LOWER("mac_address")) gin_trgm_ops);

-- ==================
-- media (media.media)
-- ==================

-- Company scope + folder traversal + recent first order.
CREATE INDEX IF NOT EXISTS "idx_media_company_folder_created_at"
    ON "media"."media" ("company_id", "folder_id", "created_at" DESC);

-- Public/scope traversals and recent order.
CREATE INDEX IF NOT EXISTS "idx_media_scope_folder_created_at"
    ON "media"."media" ("scope", "folder_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_media_public_folder_created_at"
    ON "media"."media" ("folder_id", "created_at" DESC)
    WHERE "is_public" = true;

-- Type-filter + recent order for list pages.
CREATE INDEX IF NOT EXISTS "idx_media_company_type_created_at"
    ON "media"."media" ("company_id", "file_type", "created_at" DESC);

-- Folder listing order optimization.
CREATE INDEX IF NOT EXISTS "idx_media_folders_company_parent_name"
    ON "media"."media_folders" ("company_id", "parent_id", "name");
