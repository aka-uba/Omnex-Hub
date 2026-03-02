-- PostgreSQL performance indexes for common list endpoints
-- Added after baseline auto-generated indexes.

CREATE INDEX IF NOT EXISTS "idx_products_company_updated_at"
    ON "catalog"."products" ("company_id", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_products_company_status_updated_at"
    ON "catalog"."products" ("company_id", "status", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_devices_company_created_at"
    ON "devices"."devices" ("company_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_devices_company_status_created_at"
    ON "devices"."devices" ("company_id", "status", "created_at" DESC);

